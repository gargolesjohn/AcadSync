from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    units = Column(Integer, default=3, nullable=False)

    # Relationships
    sections = relationship("Section", secondary="section_courses", back_populates="courses")
