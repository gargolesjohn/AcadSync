from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.schemas.course import CourseResponse

class SectionBase(BaseModel):
    name: str
    year_level: str
    status: Optional[str] = "Active"

class SubjectAssignmentCreate(BaseModel):
    course_id: int
    instructor_id: str

class SectionCreate(SectionBase):
    course_ids: List[int]
    instructor_ids: List[str]
    subject_assignments: Optional[List[SubjectAssignmentCreate]] = []
    student_ids: Optional[List[str]] = []

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    year_level: Optional[str] = None
    status: Optional[str] = None
    course_ids: Optional[List[int]] = None
    instructor_ids: Optional[List[str]] = None
    subject_assignments: Optional[List[SubjectAssignmentCreate]] = None
    student_ids: Optional[List[str]] = None

class SectionResponse(SectionBase):
    id: int
    courses: List[CourseResponse]
    instructors: List[dict] # Simplified user info
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
