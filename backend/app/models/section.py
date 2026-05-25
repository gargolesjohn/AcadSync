from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base

# Association table for Sections and Instructors (Users)
section_instructors = Table(
    "section_instructors",
    Base.metadata,
    Column("section_id", Integer, ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
    Column("instructor_id", String(20), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

# Association table for Sections and Courses
section_courses = Table(
    "section_courses",
    Base.metadata,
    Column("section_id", Integer, ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
)

class SectionSubjectAssignment(Base):
    __tablename__ = "section_subject_assignments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    instructor_id = Column(String(20), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    section = relationship("Section", back_populates="subject_assignments")
    course = relationship("Course")
    instructor = relationship("User")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    year_level = Column(String(20), nullable=False)  # 1st Year, 2nd Year, 3rd Year, 4th Year
    status = Column(String(20), default="Active")  # Active, Inactive, Archived
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    instructors = relationship("User", secondary=section_instructors)
    courses = relationship("Course", secondary=section_courses, back_populates="sections")
    students = relationship("User", back_populates="section", foreign_keys="User.section_id")
    subject_assignments = relationship("SectionSubjectAssignment", back_populates="section", cascade="all, delete-orphan")
