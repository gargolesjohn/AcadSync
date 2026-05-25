import json
from typing import List, Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.grade import Grade
from app.models.user import User
from app.models.attendance import Attendance
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.schemas.grade import GradeCreate, GradeResponse, GradeUpdate
from app.security import require_role
from app.utils.constants import ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_ADMIN, ROLE_REGISTRAR, ROLE_STUDENT
from app.models.schedule import Schedule

router = APIRouter()

def calculate_ph_grade(p: float) -> Tuple[float, str]:
    if p >= 97: return 1.00, "Passed"
    if p >= 94: return 1.25, "Passed"
    if p >= 91: return 1.50, "Passed"
    if p >= 88: return 1.75, "Passed"
    if p >= 85: return 2.00, "Passed"
    if p >= 82: return 2.25, "Passed"
    if p >= 79: return 2.50, "Passed"
    if p >= 76: return 2.75, "Passed"
    if p >= 75: return 3.00, "Passed"
    if p >= 70: return 4.00, "INC"
    return 5.00, "Failed"

def get_automated_activities_score(db: Session, student_id: str, subject: str) -> Tuple[Optional[float], List[dict]]:
    """Calculate Activities score (0-100) based on assignment submissions."""
    # Find assignments for this subject
    assignments = db.query(Assignment).filter(
        (Assignment.course_name == subject) | (Assignment.course_code == subject)
    ).all()
    
    if not assignments:
        return None, []  # No assignments found, allow manual entry
        
    assignment_ids = [a.id for a in assignments]
    submissions = db.query(Submission).filter(
        Submission.assignment_id.in_(assignment_ids),
        Submission.student_id == student_id,
        Submission.grade.isnot(None)
    ).all()
    
    if not submissions:
        return 0.0, []
        
    total_perc = 0.0
    graded_count = 0
    details = []
    
    for s in submissions:
        # Find corresponding assignment for max_points
        a = next((x for x in assignments if x.id == s.assignment_id), None)
        if a and a.max_points > 0:
            total_perc += (float(s.grade) / float(a.max_points)) * 100
            graded_count += 1
            details.append({"id": s.id, "name": a.title, "score": float(s.grade), "max": float(a.max_points)})
            
    if graded_count == 0:
        return 0.0, []
        
    return total_perc / graded_count, details

def get_automated_attendance_score(db: Session, student_id: str, subject: str) -> float:
    """Calculate Attendance score (0-100) based on raw count of check-ins."""
    total_present = db.query(func.count(Attendance.id)).join(Schedule).filter(
        Attendance.student_id == student_id,
        Schedule.course_code == subject,
        Attendance.status.in_(["Approved", "Late"])
    ).scalar() or 0
    
    # 1 attendance = 1 point, up to a maximum of 100 points
    return min(100.0, float(total_present))

@router.get("")
def list_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_ADMIN, ROLE_REGISTRAR, ROLE_STUDENT))
):
    """List grades. Managers audit all, professors see their own students, students see their own records."""
    from app.models.section import SectionSubjectAssignment
    query = db.query(Grade)
    if current_user.role == ROLE_STUDENT:
        query = query.filter(Grade.student_id == current_user.id)
    elif current_user.role in [ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD]:
        query = query.filter(Grade.professor_id == current_user.id)
    
    records = query.all()
    existing_map = {(g.student_id, g.subject): g for g in records}
    
    # Generate missing grade records for students enrolled in sections with assigned courses
    if current_user.role in [ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD]:
        assignments = db.query(SectionSubjectAssignment).filter(SectionSubjectAssignment.instructor_id == current_user.id).all()
    elif current_user.role in [ROLE_ADMIN, ROLE_REGISTRAR]:
        assignments = db.query(SectionSubjectAssignment).all()
    else:
        assignments = []
        
    for sa in assignments:
        course = sa.course
        section = sa.section
        # If section or course was deleted, skip
        if not course or not section: continue
        
        students = db.query(User).filter(
            (User.section_id == section.id) | (User.department_section == section.name),
            User.role == 'student'
        ).all()
        for st in students:
            key = (st.id, course.name)
            if key not in existing_map:
                dummy = Grade(
                    student_id=st.id,
                    professor_id=sa.instructor_id,
                    subject=course.name,
                    section=section.name,
                    attendance_score=0.0,
                    recitation_score=0.0,
                    quizzes_data="[]",
                    activities_data="[]",
                    activities_score=0.0,
                    exam_score=0.0,
                    percentage_score=0.0,
                    final_grade=5.0,
                    remarks="Failed"
                )
                dummy.student = st
                dummy.professor = sa.instructor
                records.append(dummy)
                existing_map[key] = dummy

    # Ensure all new dummy records are flushed to DB to get IDs
    for g in records:
        if getattr(g, 'id', None) is None:
            db.add(g)
    db.flush()

    results = []
    
    from app.models.course import Course
    courses = db.query(Course).all()
    course_map = {c.name: c.units for c in courses}
    course_map.update({c.code: c.units for c in courses})
    
    valid_subjects = set(course_map.keys())
    
    for g in records:
        if g.subject not in valid_subjects:
            continue
            
        # Auto-update Attendance Score from check-ins ALWAYS
        g.attendance_score = get_automated_attendance_score(db, g.student_id, g.subject)
        
        try:
            quizzes = json.loads(g.quizzes_data)
            quiz_perc = sum((float(q['score']) / float(q['max'])) * 100 for q in quizzes if float(q['max']) > 0) / len(quizzes) if quizzes else 0
        except: quiz_perc = 0
        
        try:
            manual_acts = json.loads(g.activities_data)
            if not isinstance(manual_acts, list): manual_acts = []
        except: 
            manual_acts = []

        _, auto_details = get_automated_activities_score(db, g.student_id, g.subject)
        
        combined_activities = auto_details + manual_acts
        
        if combined_activities:
            act_perc = sum((float(a['score']) / float(a['max'])) * 100 for a in combined_activities if float(a.get('max', 0)) > 0) / len(combined_activities)
        else:
            act_perc = 0
            
        g.activities_score = act_perc
        
        att_perc = (min(g.attendance_score, 100.0) / 100.0) * 100.0
        rec_perc = (min(g.recitation_score, 10.0) / 10.0) * 100.0
        exam_perc = (min(g.exam_score, 100.0) / 100.0) * 100.0
        
        g.percentage_score = min((att_perc * 0.1) + (rec_perc * 0.1) + (quiz_perc * 0.2) + (act_perc * 0.2) + (exam_perc * 0.4), 100.0)
        g.final_grade, g.remarks = calculate_ph_grade(g.percentage_score)
        
        res = GradeResponse.model_validate(g)
        res.activities_data = json.dumps(combined_activities)
        res.student_name = g.student.name if g.student else "Unknown"
        res.professor_name = g.professor.name if g.professor else "Unknown"
        res.subject_units = course_map.get(g.subject, 3)
        results.append(res.model_dump())
        
        db.add(g) # Ensure object is in session for tracking
        
    db.commit() # Single commit after loop for performance and cursor stability
    return {"success": True, "data": results}

@router.post("", response_model=None)
async def create_or_update_grade(
    req: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD))
):
    """Create or update a student grade."""
    student = db.query(User).filter(User.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Calculate Quiz Percentage from JSON
    try:
        quizzes = json.loads(req.quizzes_data)
        if quizzes:
            # Average of percentages
            quiz_perc = sum((float(q['score']) / float(q['max'])) * 100 for q in quizzes if float(q['max']) > 0) / len(quizzes)
        else:
            quiz_perc = 0
    except:
        quiz_perc = 0

    manual_acts = []
    try:
        activities = json.loads(req.activities_data) if getattr(req, 'activities_data', None) else []
        for act in activities:
            if "id" in act and act["id"]:
                # Update submission
                sub = db.query(Submission).filter(Submission.id == act["id"]).first()
                if sub:
                    sub.grade = float(act["score"])
                    db.add(sub)
            else:
                manual_acts.append(act)
    except Exception as e:
        print(f"Error parsing activities_data: {e}")
        
    db.commit() # commit submission updates so get_automated_activities_score sees them

    _, auto_details = get_automated_activities_score(db, req.student_id, req.subject)
    combined_activities = auto_details + manual_acts
    
    if combined_activities:
        final_act_score = sum((float(a['score']) / float(a['max'])) * 100 for a in combined_activities if float(a.get('max', 0)) > 0) / len(combined_activities)
    else:
        final_act_score = 0

    # Always use automated score for attendance
    final_att_score = get_automated_attendance_score(db, req.student_id, req.subject)

    # Calculate Overall Percentage
    att_perc = (min(final_att_score, 100.0) / 100.0) * 100.0
    rec_perc = (min(req.recitation_score, 10.0) / 10.0) * 100.0
    exam_perc = (min(req.exam_score, 100.0) / 100.0) * 100.0

    percentage = min((att_perc * 0.1) + (rec_perc * 0.1) + (quiz_perc * 0.2) + \
                 (final_act_score * 0.2) + (exam_perc * 0.4), 100.0)
    
    num_grade, remarks = calculate_ph_grade(percentage)

    # Automatic Student Classification based on performance
    if num_grade >= 3.00:
        student.enrollment_status = "Irregular"
        db.add(student)

    existing_query = db.query(Grade).filter(
        Grade.student_id == req.student_id,
        Grade.subject == req.subject
    )
    existing_query = existing_query.filter(Grade.professor_id == current_user.id)
    existing = existing_query.first()

    if existing:
        existing.attendance_score = final_att_score
        existing.recitation_score = req.recitation_score
        existing.quizzes_data = req.quizzes_data
        existing.activities_data = json.dumps(manual_acts)
        existing.activities_score = final_act_score
        existing.exam_score = req.exam_score
        existing.percentage_score = percentage
        existing.final_grade = num_grade
        existing.remarks = remarks
        existing.section = req.section
        db.commit()
        db.refresh(existing)
        grade = existing
    else:
        grade_data = req.model_dump(exclude={'final_grade', 'remarks', 'percentage_score', 'activities_score', 'attendance_score', 'activities_data'})
        grade = Grade(
            **grade_data,
            attendance_score=final_att_score,
            activities_data=json.dumps(manual_acts),
            activities_score=final_act_score,
            percentage_score=percentage,
            final_grade=num_grade,
            remarks=remarks,
            professor_id=current_user.id
        )
        db.add(grade)
        db.commit()
        db.refresh(grade)
    
    res = GradeResponse.model_validate(grade)
    res.student_name = student.name
    res.professor_name = current_user.name
    grade_data = res.model_dump()

    from app.utils.websocket_manager import manager
    await manager.notify_grade_updated(grade_data)
    # Also notify the Assignments tab so submissions refresh in real time
    await manager.notify_assignment_updated({
        "student_id": req.student_id,
        "instructor_id": current_user.id,
        "event": "grade_updated_from_grades",
    })

    return {"success": True, "data": grade_data}

@router.delete("/{grade_id}")
def delete_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD))
):
    """Delete a grade record."""
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade record not found.")
    
    # Permission check
    if grade.professor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this record.")
        
    db.delete(grade)
    db.commit()
    return {"success": True}
