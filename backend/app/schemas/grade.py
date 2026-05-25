from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GradeBase(BaseModel):
    student_id: str
    subject: str
    section: str
    attendance_score: float = 0.0
    recitation_score: float = 0.0
    quizzes_data: str = "[]"
    activities_data: str = "[]"
    activities_score: float = 0.0
    exam_score: float = 0.0
    final_grade: float = 5.0
    percentage_score: float = 0.0
    remarks: str = "Failed"

class GradeCreate(GradeBase):
    pass

class GradeUpdate(BaseModel):
    attendance_score: Optional[float] = None
    recitation_score: Optional[float] = None
    quizzes_data: Optional[str] = None
    activities_data: Optional[str] = None
    activities_score: Optional[float] = None
    exam_score: Optional[float] = None
    final_grade: Optional[float] = None
    percentage_score: Optional[float] = None
    remarks: Optional[str] = None

class GradeResponse(GradeBase):
    id: int
    professor_id: str
    student_name: Optional[str] = None
    professor_name: Optional[str] = None
    subject_units: Optional[int] = None
    is_activities_synced: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
