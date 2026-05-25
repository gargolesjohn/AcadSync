"""Announcement model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    author_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    announcement_type = Column(String(50), nullable=False)  # "ACADEMIC", "URGENT", "CAMPUS", "FACULTY"
    color = Column(String(20), nullable=False)  # "indigo", "red", "amber", "emerald"
    target_audience = Column(String(20), nullable=False)  # "ALL", "STUDENTS", "FACULTY"
    target_class = Column(String(50), nullable=True)  # e.g. "BSIT 4A"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="announcements")

    __table_args__ = (
        Index("idx_announcement_created_at", "created_at"),
        Index("idx_announcement_target", "target_audience"),
        Index("idx_announcement_author_id", "author_id"),
    )
