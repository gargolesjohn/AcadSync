"""UserPreference model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), ForeignKey("users.id"), unique=True, nullable=False)
    dark_mode = Column(Boolean, default=True)
    accent_color = Column(String(20), default="indigo")
    notifications_email = Column(Boolean, default=True)
    notifications_bell = Column(Boolean, default=True)
    notifications_messages = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="preferences")
