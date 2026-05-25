"""Schedule endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleBatchCreate
from app.security import get_current_user
from app.models.section import Section
from app.models.course import Course
from app.models.attendance import Attendance
from app.utils.constants import ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_STUDENT

router = APIRouter()


def sched_to_dict(s):
    return {
        "id": s.id, "course_code": s.course_code, "course_label": s.course_label,
        "day_of_week": s.day_of_week, "start_time": s.start_time, "end_time": s.end_time,
        "room_location": s.room_location, "section_or_instructor": s.section_or_instructor,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("")
def get_schedule(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == ROLE_STUDENT:
        section_name = current_user.department_section
        if current_user.section:
            section_name = current_user.section.name
            
        if section_name:
            items = db.query(Schedule).join(User, Schedule.user_id == User.id).filter(
                Schedule.section_or_instructor == section_name,
                User.role.in_([ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD])
            ).all()
            
            course_codes = list(set(s.course_code for s in items))
            courses = db.query(Course).filter(Course.code.in_(course_codes)).all()
            course_units = {c.code: c.units for c in courses}
            
            res = []
            for s in items:
                d = sched_to_dict(s)
                d["section_or_instructor"] = f"Prof. {s.user.name}"
                d["units"] = course_units.get(s.course_code, 3)
                res.append(d)
            return {"success": True, "data": res}
        return {"success": True, "data": []}
        
    items = db.query(Schedule).filter(Schedule.user_id == current_user.id).all()
    
    course_codes = list(set(s.course_code for s in items))
    courses = db.query(Course).filter(Course.code.in_(course_codes)).all()
    course_units = {c.code: c.units for c in courses}
    
    res = []
    for s in items:
        d = sched_to_dict(s)
        d["units"] = course_units.get(s.course_code, 3)
        res.append(d)
        
    return {"success": True, "data": res}


@router.get("/pending")
def get_pending_schedules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List subjects assigned to instructor that don't have a schedule yet."""
    if current_user.role not in [ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD]:
        return {"success": True, "data": []}
        
    # Find sections where this user is an instructor
    sections = db.query(Section).join(Section.instructors).filter(User.id == current_user.id).all()
    
    pending = []
    for sec in sections:
        # Determine which courses this instructor is actually assigned to
        assigned_course_ids = [sa.course_id for sa in sec.subject_assignments if sa.instructor_id == current_user.id]
        
        for course in sec.courses:
            # Only show subjects explicitly assigned to this instructor.
            if course.id not in assigned_course_ids:
                continue
                
            # Get existing schedules for this course and section
            existing_schedules = db.query(Schedule).filter(
                Schedule.user_id == current_user.id,
                Schedule.course_code == course.code,
                Schedule.section_or_instructor == sec.name
            ).all()
            
            total_hours = 0.0
            for s in existing_schedules:
                try:
                    s_t = datetime.strptime(s.start_time, "%H:%M")
                    e_t = datetime.strptime(s.end_time, "%H:%M")
                    diff = (e_t - s_t).total_seconds() / 3600.0
                    if diff > 0:
                        total_hours += diff
                except ValueError:
                    pass
            
            if total_hours < course.units:
                pending.append({
                    "course_code": course.code,
                    "course_name": course.name,
                    "section_name": sec.name,
                    "section_id": sec.id,
                    "units": course.units,
                    "scheduled_hours": total_hours,
                    "existing_schedules": [sched_to_dict(s) for s in existing_schedules]
                })
                
    return {"success": True, "data": pending}


@router.post("")
def add_schedule(req: ScheduleCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    # Create instructor's schedule
    s = Schedule(user_id=current_user.id, course_code=req.course_code, course_label=req.course_label,
                 day_of_week=req.day_of_week, start_time=req.start_time, end_time=req.end_time,
                 room_location=req.room_location, section_or_instructor=req.section_or_instructor)
    db.add(s)
    
    db.commit()
    db.refresh(s)
    return {"success": True, "data": sched_to_dict(s)}


@router.post("/batch")
def add_batch_schedule(req: ScheduleBatchCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    # Validate hours
    course = db.query(Course).filter(Course.code == req.course_code).first()
    if not course:
        raise HTTPException(404, "Course not found")
        
    total_hours = 0.0
    for b in req.blocks:
        try:
            s_t = datetime.strptime(b.start_time, "%H:%M")
            e_t = datetime.strptime(b.end_time, "%H:%M")
            diff = (e_t - s_t).total_seconds() / 3600.0
            if diff > 0:
                total_hours += diff
        except ValueError:
            pass
            
    if abs(total_hours - course.units) > 0.01:
        if total_hours > course.units:
            raise HTTPException(400, "Schedule exceeds allowed weekly hours based on subject units.")
        else:
            raise HTTPException(400, f"Incomplete schedule: requires {course.units} hours but only {total_hours:.1f} hours scheduled.")
        
    # Delete existing schedules for this course/section/user
    db.query(Schedule).filter(
        Schedule.user_id == current_user.id,
        Schedule.course_code == req.course_code,
        Schedule.section_or_instructor == req.section_or_instructor
    ).delete()
    
    # Insert new blocks
    new_schedules = []
    for b in req.blocks:
        s = Schedule(
            user_id=current_user.id,
            course_code=req.course_code,
            course_label=req.course_label,
            section_or_instructor=req.section_or_instructor,
            day_of_week=b.day_of_week,
            start_time=b.start_time,
            end_time=b.end_time,
            room_location=b.room_location
        )
        db.add(s)
        new_schedules.append(s)
        
    db.commit()
    for s in new_schedules:
        db.refresh(s)
        
    return {"success": True, "data": [sched_to_dict(s) for s in new_schedules]}


@router.put("/{schedule_id}")
def update_schedule(schedule_id: int, req: ScheduleCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == current_user.id).first()
    if not s: 
        raise HTTPException(404, "Schedule not found.")
        
    s.day_of_week = req.day_of_week
    s.start_time = req.start_time
    s.end_time = req.end_time
    s.room_location = req.room_location
    
    db.commit()
    db.refresh(s)
    return {"success": True, "data": sched_to_dict(s)}


@router.delete("/{schedule_id}")
def remove_schedule(schedule_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == current_user.id).first()
    if not s: 
        raise HTTPException(404, "Schedule not found.")
    
    db.query(Attendance).filter(Attendance.schedule_id == schedule_id).delete()
    db.delete(s)
    db.commit()
    return {"success": True, "message": "Schedule deleted"}