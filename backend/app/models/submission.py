"""Submission model."""

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    file_original_name = Column(String(255), nullable=False)
    grade = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    graded_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")

    __table_args__ = (
        Index("idx_submission_assignment_id", "assignment_id"),
        Index("idx_submission_student_id", "student_id"),
        Index("idx_submission_submitted_at", "submitted_at"),
        UniqueConstraint("assignment_id", "student_id", name="uq_assignment_student"),
    )
