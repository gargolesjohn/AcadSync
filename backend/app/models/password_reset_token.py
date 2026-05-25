"""PasswordResetToken model."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index

from app.database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), ForeignKey("users.id"), nullable=False)
    token = Column(String(6), nullable=False)  # 6-digit OTP
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_token_user_id", "user_id"),
        Index("idx_token_expires_at", "expires_at"),
    )
