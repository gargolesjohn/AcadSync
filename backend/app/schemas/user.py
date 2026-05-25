"""User schemas."""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    name: str
    role: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    department_section: str
    enrollment_status: str
    section_id: Optional[int] = None
    status: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    role: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_section: str
    enrollment_status: Optional[str] = "Regular"
    section_id: Optional[int] = None
    status: Optional[str] = "Active"
    password: str
    year: Optional[str] = None
    custom_id: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    department_section: Optional[str] = None
    enrollment_status: Optional[str] = None
    section_id: Optional[int] = None
    status: Optional[str] = None


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_section: Optional[str] = None
    enrollment_status: Optional[str] = None
    section_id: Optional[int] = None
    status: Optional[str] = None
    password: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserListItem(BaseModel):
    id: str
    name: str
    role: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    department_section: str
    enrollment_status: str
    section_id: Optional[int] = None
    status: str
    is_active: bool = True

    class Config:
        from_attributes = True
