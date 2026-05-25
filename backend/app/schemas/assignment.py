"""Assignment schemas."""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    course_code: str
    course_name: str
    title: str
    description: str
    due_date: datetime
    max_points: int


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_points: Optional[int] = None


class AssignmentResponse(BaseModel):
    id: int
    course_code: str
    course_name: str
    title: str
    description: str
    due_date: datetime
    max_points: int
    instructor_id: str
    instructor_name: Optional[str] = None
    submission_count: int = 0
    submitted_by_me: Optional[bool] = None
    my_grade: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
