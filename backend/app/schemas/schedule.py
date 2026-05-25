"""Schedule schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    course_code: str
    course_label: str
    day_of_week: str
    start_time: str
    end_time: str
    room_location: str
    section_or_instructor: str


class ScheduleBlockCreate(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    room_location: str


class ScheduleBatchCreate(BaseModel):
    course_code: str
    course_label: str
    section_or_instructor: str
    blocks: list[ScheduleBlockCreate]


class ScheduleResponse(BaseModel):
    id: int
    course_code: str
    course_label: str
    day_of_week: str
    start_time: str
    end_time: str
    room_location: str
    section_or_instructor: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
