from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.schemas.course import CourseCreate, CourseResponse, CourseUpdate
from app.security import require_role
from app.utils.constants import ROLE_ADMIN, ROLE_REGISTRAR

router = APIRouter()

from app.security import get_current_user
from app.models.user import User
from app.models.section import Section
from app.utils.constants import ROLE_INSTRUCTOR

@router.get("")
def list_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List courses (filtered for instructors)."""
    if current_user.role == ROLE_INSTRUCTOR:
        # Get courses linked to sections assigned to this instructor
        courses = db.query(Course).join(Course.sections).join(Section.instructors).filter(User.id == current_user.id).distinct().all()
    else:
        courses = db.query(Course).all()
    
    return {"success": True, "data": [CourseResponse.model_validate(c).dict() for c in courses]}

@router.post("", response_model=CourseResponse)
def create_course(
    req: CourseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR))
):
    """Create a new course (admin only)."""
    existing = db.query(Course).filter(Course.code == req.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course code already exists.")
    
    course = Course(code=req.code.upper(), name=req.name, units=req.units)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR))
):
    """Delete a course (admin only)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    db.delete(course)
    db.commit()
    return {"success": True}

@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    req: CourseUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR))
):
    """Update a course (admin only)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    
    if req.code is not None:
        existing = db.query(Course).filter(Course.code == req.code.upper(), Course.id != course_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Course code already exists.")
        course.code = req.code.upper()
    if req.name is not None:
        course.name = req.name
    if req.units is not None:
        course.units = req.units

    db.commit()
    db.refresh(course)
    return course
