"""Message schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class MessageCreate(BaseModel):
    to_id: str
    subject: str
    body: str


class MessageResponse(BaseModel):
    id: int
    from_id: str
    from_name: Optional[str] = None
    to_id: str
    to_name: Optional[str] = None
    subject: str
    body: str
    is_read: bool
    is_spam: bool
    is_important: bool
    created_at: datetime

    class Config:
        from_attributes = True
