"""User preference schemas."""

from typing import Optional
from pydantic import BaseModel


class PreferenceResponse(BaseModel):
    dark_mode: bool = False
    accent_color: str = "indigo"
    notifications_email: bool = True
    notifications_bell: bool = True
    notifications_messages: bool = True

    class Config:
        from_attributes = True


class PreferenceUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    accent_color: Optional[str] = None
    notifications_email: Optional[bool] = None
    notifications_bell: Optional[bool] = None
    notifications_messages: Optional[bool] = None
