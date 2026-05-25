"""Schedule model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    course_code = Column(String(100), nullable=False)
    course_label = Column(String(100), nullable=False)
    day_of_week = Column(String(20), nullable=False)  # "Monday", "Tuesday", etc.
    start_time = Column(String(8), nullable=False)  # "08:00"
    end_time = Column(String(8), nullable=False)  # "09:30"
    room_location = Column(String(50), nullable=False)
    section_or_instructor = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="schedules")

    __table_args__ = (
        Index("idx_schedule_user_id", "user_id"),
        Index("idx_schedule_day_of_week", "day_of_week"),
        Index("idx_schedule_course_code", "course_code"),
    )
