"""Message model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    to_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    is_spam = Column(Boolean, default=False)
    is_important = Column(Boolean, default=False)
    deleted_by_sender = Column(Boolean, default=False)
    deleted_by_recipient = Column(Boolean, default=False)
    is_unsent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sender = relationship("User", foreign_keys=[from_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[to_id], back_populates="received_messages")

    __table_args__ = (
        Index("idx_message_to_id", "to_id"),
        Index("idx_message_from_id", "from_id"),
        Index("idx_message_created_at", "created_at"),
    )
