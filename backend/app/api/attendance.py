"""Attendance endpoints."""

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.attendance import Attendance
from app.models.schedule import Schedule
from app.models.section import Section
from app.security import get_current_user

router = APIRouter()


class CheckInRequest(BaseModel):
    schedule_id: int


class ApproveRequest(BaseModel):
    attendance_id: int
    status: str  # "Approved", "Absent", "Late"

class ManualAttendanceRequest(BaseModel):
    course_code: str
    student_id: str
    date: str
    status: str

class ResetAttendanceRequest(BaseModel):
    course_code: str
    student_id: str

@router.get("/schedules")
def get_today_schedules(date_str: str = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve schedules with attendance statuses for a given date (defaults to today)."""
    now_tz = datetime.utcnow() + timedelta(hours=8)
    
    if date_str:
        today_date = date.fromisoformat(date_str)
        current_time = datetime.strptime("00:00:00", "%H:%M:%S").time() # Don't care about time for past dates
    else:
        today_date = now_tz.date()
        current_time = now_tz.time()

    today_day = today_date.strftime("%A")
    
    yesterday_date = today_date - timedelta(days=1)
    yesterday_day = yesterday_date.strftime("%A")

    if current_user.role == "student":
        # Get student's schedules explicitly assigned, OR inherited from their section
        section_name = current_user.department_section
        if current_user.section:
            section_name = current_user.section.name
            
        if section_name:
            schedules = db.query(Schedule).filter(
                (Schedule.user_id == current_user.id) | (Schedule.section_or_instructor == section_name),
                Schedule.day_of_week.in_([today_day, yesterday_day])
            ).all()
        else:
            schedules = db.query(Schedule).filter(
                Schedule.user_id == current_user.id,
                Schedule.day_of_week.in_([today_day, yesterday_day])
            ).all()

        data = []
        for s in schedules:
            s_time = datetime.strptime(s.start_time, "%H:%M").time()
            e_time = datetime.strptime(s.end_time, "%H:%M").time()
            
            if s.day_of_week == today_day:
                s_dt = datetime.combine(today_date, s_time)
                e_dt = datetime.combine(today_date, e_time)
                if s_time > e_time:
                    e_dt += timedelta(days=1)
            else:
                if s_time <= e_time:
                    continue
                s_dt = datetime.combine(yesterday_date, s_time)
                e_dt = datetime.combine(yesterday_date, e_time)
                e_dt += timedelta(days=1)
                if now_tz > e_dt:
                    continue

            is_active = s_dt <= now_tz <= e_dt

            record = db.query(Attendance).filter(
                Attendance.student_id == current_user.id,
                Attendance.attendance_date == today_date,
                Attendance.schedule_id == s.id
            ).first()

            data.append({
                "schedule_id": s.id,
                "course_code": s.course_code,
                "course_label": s.course_label,
                "time": f"{s.start_time} - {s.end_time}",
                "room": s.room_location,
                "instructor": s.section_or_instructor,
                "status": record.status if record else "Not Checked In",
                "attendance_id": record.id if record else None,
                "is_active": is_active,
                "start_dt": s_dt.isoformat(),
                "end_dt": e_dt.isoformat()
            })
        return {"success": True, "data": data}

    elif current_user.role == "instructor":
        # Get instructor's schedules for today
        schedules = db.query(Schedule).filter(
            Schedule.user_id == current_user.id,
            Schedule.day_of_week.in_([today_day, yesterday_day])
        ).all()

        data = []
        for s in schedules:
            s_time = datetime.strptime(s.start_time, "%H:%M").time()
            e_time = datetime.strptime(s.end_time, "%H:%M").time()
            
            if s.day_of_week == today_day:
                s_dt = datetime.combine(today_date, s_time)
                e_dt = datetime.combine(today_date, e_time)
                if s_time > e_time:
                    e_dt += timedelta(days=1)
            else:
                if s_time <= e_time:
                    continue
                s_dt = datetime.combine(yesterday_date, s_time)
                e_dt = datetime.combine(yesterday_date, e_time)
                e_dt += timedelta(days=1)
                if now_tz > e_dt:
                    continue
            
            is_active = s_dt <= now_tz <= e_dt

            section = db.query(Section).filter(Section.name == s.section_or_instructor).first()
            if not section:
                total_enrolled = 0
                checked_in_count = 0
                pending_count = 0
            else:
                total_enrolled = db.query(User).filter(
                    (User.section_id == section.id) | (User.department_section == section.name),
                    User.role == 'student'
                ).count()

                records = db.query(Attendance).filter(
                    Attendance.attendance_date == today_date,
                    Attendance.schedule_id == s.id
                ).all()

                checked_in_count = len(records)
                pending_count = sum(1 for r in records if r.status == "Pending")

            data.append({
                "schedule_id": s.id,
                "course_code": s.course_code,
                "course_label": s.course_label,
                "time": f"{s.start_time} - {s.end_time}",
                "room": s.room_location,
                "section": s.section_or_instructor,
                "total_enrolled": total_enrolled,
                "checked_in_count": checked_in_count,
                "pending_count": pending_count,
                "is_active": is_active,
                "start_dt": s_dt.isoformat(),
                "end_dt": e_dt.isoformat()
            })
        return {"success": True, "data": data}

    else:
        raise HTTPException(403, "Role not authorized to view schedules.")


@router.post("/check-in")
def check_in(req: CheckInRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Allow student to mark attendance for a specific schedule for today."""
    now_tz = datetime.utcnow() + timedelta(hours=8)
    today_date = now_tz.date()
    today_day = today_date.strftime("%A")
    yesterday_date = today_date - timedelta(days=1)
    yesterday_day = yesterday_date.strftime("%A")

    # 1. Verify schedule exists and belongs to this student OR their section
    sched = db.query(Schedule).filter(Schedule.id == req.schedule_id).first()
    if not sched:
        raise HTTPException(404, "Schedule not found.")
        
    if sched.user_id != current_user.id:
        section_name = current_user.department_section
        if current_user.section:
            section_name = current_user.section.name
            
        if section_name and sched.section_or_instructor == section_name:
            pass # Inherited from section
        else:
            raise HTTPException(404, "Schedule not found or does not belong to you.")

    # 2. Check if schedule is actually scheduled for today or yesterday (midnight crossing)
    if sched.day_of_week.lower() not in [today_day.lower(), yesterday_day.lower()]:
        raise HTTPException(400, f"This class is not scheduled for today.")

    # 2b. Check if the class is currently active (strictly within start_time and end_time)
    s_time = datetime.strptime(sched.start_time, "%H:%M").time()
    e_time = datetime.strptime(sched.end_time, "%H:%M").time()
    
    if sched.day_of_week.lower() == today_day.lower():
        s_dt = datetime.combine(today_date, s_time)
        e_dt = datetime.combine(today_date, e_time)
        if s_time > e_time:
            e_dt += timedelta(days=1)
    else:
        s_dt = datetime.combine(yesterday_date, s_time)
        e_dt = datetime.combine(yesterday_date, e_time)
        if s_time > e_time:
            e_dt += timedelta(days=1)
        else:
            raise HTTPException(400, "This class is not currently active.")

    if not (s_dt <= now_tz <= e_dt):
        raise HTTPException(400, "This class is not currently active.")

    # 3. Check for duplicate record for today + schedule
    existing = db.query(Attendance).filter(
        Attendance.student_id == current_user.id,
        Attendance.attendance_date == today_date,
        Attendance.schedule_id == req.schedule_id
    ).first()

    if existing:
        raise HTTPException(400, "You have already marked your attendance for this class today.")

    # 4. Check attendance limit (max 100 records per semester per subject)
    total_course_attendance = db.query(Attendance).join(Schedule).filter(
        Attendance.student_id == current_user.id,
        Schedule.course_code == sched.course_code
    ).count()

    if total_course_attendance >= 100:
        raise HTTPException(400, "Attendance limit reached: Maximum of 100 attendance records allowed per semester for this subject.")

    record = Attendance(
        student_id=current_user.id,
        schedule_id=req.schedule_id,
        attendance_date=today_date,
        status="Pending"
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": "Attendance marked as Pending. Waiting for instructor approval.",
        "data": {"id": record.id, "status": record.status}
    }


@router.post("/approve")
def approve_attendance(req: ApproveRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Allow instructors to approve or override a student's check-in status."""
    if current_user.role not in ["instructor", "program_head"]:
        raise HTTPException(403, "Only professors can approve attendance.")

    if req.status not in ["Approved", "Absent", "Late"]:
        raise HTTPException(400, "Invalid status. Must be 'Approved', 'Absent', or 'Late'.")

    # Find attendance record
    record = db.query(Attendance).filter(Attendance.id == req.attendance_id).first()
    if not record:
        raise HTTPException(404, "Attendance record not found.")

    student_sched = record.schedule
    if not student_sched:
        raise HTTPException(400, "Associated schedule not found for this attendance record.")

    # Get student's section
    student = record.student
    if not student:
        raise HTTPException(404, "Student associated with attendance record not found.")

    section_name = student.section.name if student.section else student.department_section
    if not section_name:
        raise HTTPException(400, "Student is not assigned to any section.")

    # Verify that the instructor teaches this course for this student's section at this schedule time slot
    matching_inst_sched = db.query(Schedule).filter(
        Schedule.user_id == current_user.id,
        Schedule.course_code == student_sched.course_code,
        Schedule.day_of_week == student_sched.day_of_week,
        Schedule.start_time == student_sched.start_time,
        Schedule.section_or_instructor == section_name
    ).first()

    if not matching_inst_sched:
        raise HTTPException(403, "You are not authorized to approve attendance for this course section schedule.")

    # Update status
    record.status = req.status
    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": f"Attendance marked as {req.status} successfully.",
        "data": {"id": record.id, "status": record.status}
    }


@router.post("/manual")
def manual_attendance(req: ManualAttendanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually mark attendance for a student (Instructor only)."""
    if current_user.role not in ["instructor", "program_head"]:
        raise HTTPException(403, "Only professors can manually update attendance.")
    
    if req.status not in ["Approved", "Absent", "Remove"]:
        raise HTTPException(400, "Invalid status. Must be 'Approved', 'Absent', or 'Remove'.")

    # Find the student
    student = db.query(User).filter(User.id == req.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(404, "Student not found.")

    target_date = date.fromisoformat(req.date)

    # First, try to find an EXISTING attendance record for this student, date, and course code
    record = db.query(Attendance).join(Schedule).filter(
        Attendance.student_id == req.student_id,
        Attendance.attendance_date == target_date,
        Schedule.course_code == req.course_code
    ).first()

    if req.status == "Remove":
        if record:
            db.delete(record)
            db.commit()
        return {"success": True, "message": "Record removed successfully"}

    if record:
        record.status = req.status
        db.commit()
        db.refresh(record)
        return {"success": True, "data": {"id": record.id, "status": record.status}}

    # If we are here, we need to create a NEW record, so we must find the correct schedule.
    schedule = None
    if student.section:
        schedule = db.query(Schedule).filter(
            Schedule.course_code == req.course_code,
            Schedule.section_or_instructor == student.section.name
        ).first()
    
    if not schedule:
        # Try to find by Grade record section
        from app.models.grade import Grade
        grade = db.query(Grade).filter(Grade.student_id == req.student_id, Grade.subject == req.course_code).first()
        if grade and grade.section:
            schedule = db.query(Schedule).filter(Schedule.course_code == req.course_code, Schedule.section_or_instructor == grade.section).first()

    if not schedule:
        # If instructor is making the request, find the schedule they teach for this course
        schedule = db.query(Schedule).filter(
            Schedule.course_code == req.course_code,
            Schedule.user_id == current_user.id
        ).first()

    if not schedule:
        # Last resort: just pick any schedule for this course code
        schedule = db.query(Schedule).filter(Schedule.course_code == req.course_code).first()

    if not schedule:
        # Create a generic schedule as a fallback so attendance can still be tracked
        schedule = Schedule(
            user_id=current_user.id,
            course_code=req.course_code,
            course_label=req.course_code,
            day_of_week="TBA",
            start_time="00:00",
            end_time="23:59",
            room_location="TBA",
            section_or_instructor=student.section.name if student.section else "TBA"
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    # Check attendance limit (max 100 records per semester per subject)
    total_course_attendance = db.query(Attendance).join(Schedule).filter(
        Attendance.student_id == req.student_id,
        Schedule.course_code == req.course_code
    ).count()

    if total_course_attendance >= 100:
        raise HTTPException(400, "Attendance limit reached: Maximum of 100 attendance records allowed per semester for this subject.")

    record = Attendance(
        student_id=req.student_id,
        schedule_id=schedule.id,
        attendance_date=target_date,
        status=req.status
    )
    db.add(record)
    
    db.commit()
    db.refresh(record)

    return {"success": True, "data": {"id": record.id, "status": record.status}}

@router.post("/reset")
def reset_attendance(req: ResetAttendanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reset all attendance records for a student in a course to 0."""
    if current_user.role not in ["instructor", "program_head"]:
        raise HTTPException(403, "Only professors can reset attendance.")

    records = db.query(Attendance).join(Schedule).filter(
        Attendance.student_id == req.student_id,
        Schedule.course_code == req.course_code
    ).all()

    for r in records:
        db.delete(r)
        
    db.commit()
    return {"success": True, "message": "Attendance reset to 0"}


@router.get("/students-status")
def get_students_status(schedule_id: int, date_str: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Instructor audit view to get status of all students enrolled in their schedule's slot."""
    if current_user.role not in ["instructor", "program_head"]:
        raise HTTPException(403, "Only professors can access student status.")

    # Find instructor's schedule
    inst_sched = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == current_user.id).first()
    if not inst_sched:
        raise HTTPException(404, "Schedule not found or does not belong to you.")

    target_date = date.fromisoformat(date_str) if date_str else date.today()

    # Look up the section by name
    section = db.query(Section).filter(Section.name == inst_sched.section_or_instructor).first()
    if not section:
        return {"success": True, "data": []}

    students = db.query(User).filter(
        (User.section_id == section.id) | (User.department_section == section.name),
        User.role == "student"
    ).all()

    if not students:
        return {"success": True, "data": []}

    # Retrieve attendance records for this instructor schedule and date
    attendance_records = db.query(Attendance).filter(
        Attendance.attendance_date == target_date,
        Attendance.schedule_id == inst_sched.id
    ).all()

    attendance_map = {r.student_id: r for r in attendance_records}

    data = []
    for s in students:
        record = attendance_map.get(s.id)
        data.append({
            "student_id": s.id,
            "student_name": s.name,
            "email": s.email,
            "department_section": s.department_section,
            "attendance_id": record.id if record else None,
            "status": record.status if record else "Not Checked In",
            "checked_in_time": record.created_at.isoformat() + "Z" if record and record.created_at else None,
            "schedule_id": inst_sched.id
        })

    return {"success": True, "data": data}


@router.get("/status")
def get_attendance_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check if student checked in today and get historical percentage stats."""
    today = (datetime.utcnow() + timedelta(hours=8)).date()
    checked_in = db.query(Attendance).filter(
        Attendance.student_id == current_user.id,
        Attendance.attendance_date == today
    ).count() > 0

    total_approved = db.query(Attendance).filter(Attendance.student_id == current_user.id, Attendance.status == "Approved").count()
    total_late = db.query(Attendance).filter(Attendance.student_id == current_user.id, Attendance.status == "Late").count()
    total_absent = db.query(Attendance).filter(Attendance.student_id == current_user.id, Attendance.status == "Absent").count()
    total_pending = db.query(Attendance).filter(Attendance.student_id == current_user.id, Attendance.status == "Pending").count()

    total_present = total_approved + total_late
    total_records = total_approved + total_late + total_absent

    percentage = (total_present / total_records) * 100 if total_records > 0 else 100.0

    return {
        "success": True,
        "data": {
            "checked_in_today": checked_in,
            "total_present": total_present,
            "total_absent": total_absent,
            "total_late": total_late,
            "total_pending": total_pending,
            "percentage": round(percentage, 1)
        }
    }


@router.get("/history")
def get_attendance_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return student's full attendance logs, including course details, date, and status."""
    records = db.query(Attendance).filter(Attendance.student_id == current_user.id).order_by(Attendance.attendance_date.desc()).all()

    data = []
    for r in records:
        data.append({
            "id": r.id,
            "date": r.attendance_date.isoformat(),
            "status": r.status,
            "course_code": r.schedule.course_code if r.schedule else "Unknown",
            "course_label": r.schedule.course_label if r.schedule else "Unknown Class",
            "time": f"{r.schedule.start_time} - {r.schedule.end_time}" if r.schedule else "N/A",
            "room": r.schedule.room_location if r.schedule else "N/A"
        })
    return {"success": True, "data": data}


@router.get("/calendar-data")
def get_calendar_data(schedule_id: int = None, course_code: str = None, student_id: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch attendance records for a specific schedule or course code to render in a calendar view."""
    
    # Determine the target student
    target_student_id = str(current_user.id)
    if current_user.role in ["instructor", "admin", "program_head", "registrar"] and student_id:
        target_student_id = student_id
    elif current_user.role == "student" and student_id and student_id != str(current_user.id):
        raise HTTPException(403, "Students can only view their own calendar.")

    query = db.query(Attendance).filter(Attendance.student_id == target_student_id)
    if schedule_id:
        query = query.filter(Attendance.schedule_id == schedule_id)
    elif course_code:
        query = query.join(Schedule).filter(Schedule.course_code == course_code)
    else:
        raise HTTPException(400, "Must provide schedule_id or course_code")

    records = query.order_by(Attendance.attendance_date.asc()).all()

    data = []
    for r in records:
        data.append({
            "date": r.attendance_date.isoformat(),
            "status": r.status
        })

    return {"success": True, "data": data}
