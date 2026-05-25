"""Auth schemas."""

from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    user_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    password_reset_token: str
    new_password: str


class ForgotPasswordResponse(BaseModel):
    reset_token_id: str
    email_masked: str
    otp: Optional[str] = None  # Only in DEMO mode

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str
    department_section: str
    phone: Optional[str] = None

class OAuthLoginRequest(BaseModel):
    provider: str  # "google" or "facebook"
    token: str
