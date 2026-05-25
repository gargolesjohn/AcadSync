from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    professor_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    section = Column(String(50), nullable=False)
    
    attendance_score = Column(Float, default=0.0)
    recitation_score = Column(Float, default=0.0)
    quizzes_data = Column(String, default="[]") # JSON string of [{score, max}]
    activities_data = Column(String, default="[]") # JSON string of [{name, score, max}]
    activities_score = Column(Float, default=0.0)
    exam_score = Column(Float, default=0.0)
    final_grade = Column(Float, default=5.0)  # Numerical grade (1.0 - 5.0)
    percentage_score = Column(Float, default=0.0) # Raw percentage (0-100)
    remarks = Column(String(20), default="Failed") 
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    professor = relationship("User", foreign_keys=[professor_id])
