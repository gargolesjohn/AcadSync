"""Announcement schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    type: str  # ACADEMIC, URGENT, CAMPUS, FACULTY
    target_audience: Optional[str] = "ALL"
    target_class: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    type: Optional[str] = None
    target_class: Optional[str] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    body: str
    type: str
    color: str
    target_audience: str
    target_class: Optional[str] = None
    author_id: str
    author_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
