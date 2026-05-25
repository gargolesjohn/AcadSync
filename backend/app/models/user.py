"""User model."""

from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Text, Index, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(20), primary_key=True)  # e.g., "ADM-00001", "STU24-00001"
    password_hash = Column(String(255), nullable=True)
    auth_provider = Column(String(20), default="local", nullable=False)  # "local", "google", "facebook"
    oauth_id = Column(String(255), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # "admin" | "instructor" | "student"
    email = Column(String(100), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    avatar = Column(String(10), nullable=True)  # e.g., "JD"
    bio = Column(Text, nullable=True)
    department_section = Column(String(50), nullable=False)  # e.g., "IT Department", "BSIT 4A"
    is_active = Column(Boolean, default=True)
    status = Column(String(20), default="Active")  # Active, Inactive, Graduated, Suspended
    enrollment_status = Column(String(20), default="Regular")  # Regular, Irregular, Dropped
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    sent_messages = relationship(
        "Message", foreign_keys="Message.from_id", back_populates="sender"
    )
    received_messages = relationship(
        "Message", foreign_keys="Message.to_id", back_populates="recipient"
    )
    announcements = relationship("Announcement", back_populates="author")
    section = relationship("Section", back_populates="students", foreign_keys=[section_id])
    schedules = relationship("Schedule", back_populates="user")
    assignments_created = relationship(
        "Assignment", foreign_keys="Assignment.instructor_id", back_populates="instructor"
    )
    submissions = relationship("Submission", back_populates="student")
    preferences = relationship(
        "UserPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_user_email", "email"),
        Index("idx_user_role", "role"),
    )
