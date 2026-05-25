from typing import Optional
from pydantic import BaseModel

class CourseBase(BaseModel):
    code: str
    name: str
    units: int

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    units: Optional[int] = None

class CourseResponse(CourseBase):
    id: int

    class Config:
        from_attributes = True
