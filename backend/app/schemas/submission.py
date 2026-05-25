"""Submission schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: str
    student_name: Optional[str] = None
    file_name: str
    grade: Optional[int] = None
    feedback: Optional[str] = None
    submitted_at: datetime
    graded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GradeRequest(BaseModel):
    grade: int
    feedback: Optional[str] = None
