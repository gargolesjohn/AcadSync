"""Attendance model."""

from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, default=date.today, nullable=False)
    status = Column(String(20), default="Pending", nullable=False)  # "Pending", "Approved", "Absent", "Late"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("User", backref="attendance_records")
    schedule = relationship("Schedule", backref="attendance_records")

    __table_args__ = (
        UniqueConstraint('student_id', 'attendance_date', 'schedule_id', name='_student_date_schedule_uc'),
        Index("idx_attendance_student_id", "student_id"),
        Index("idx_attendance_date", "attendance_date"),
        Index("idx_attendance_schedule_id", "schedule_id"),
    )

