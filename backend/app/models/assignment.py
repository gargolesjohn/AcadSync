"""Assignment model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    instructor_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    course_code = Column(String(20), nullable=False)
    course_name = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    due_date = Column(DateTime, nullable=False)
    max_points = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    instructor = relationship(
        "User", foreign_keys=[instructor_id], back_populates="assignments_created"
    )
    submissions = relationship(
        "Submission", back_populates="assignment", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_assignment_instructor_id", "instructor_id"),
        Index("idx_assignment_due_date", "due_date"),
        Index("idx_assignment_created_at", "created_at"),
    )
