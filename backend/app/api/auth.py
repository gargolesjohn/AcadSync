"""Authentication endpoints."""

import httpx
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.schemas.auth import (
    LoginRequest, RefreshRequest, ForgotPasswordRequest,
    VerifyOTPRequest, ResetPasswordRequest, RegisterRequest, OAuthLoginRequest
)
from app.security import (
    verify_password, create_access_token, create_refresh_token,
    create_password_reset_token, decode_token, hash_password, get_current_user,
)
from app.config import settings
from app.utils.id_generator import generate_user_id

router = APIRouter()


def mask_email(email: str) -> str:
    """Mask an email address for display."""
    parts = email.split("@")
    if len(parts) != 2:
        return "***"
    user = parts[0]
    if len(user) > 2:
        masked = user[0] + "*" * (len(user) - 2) + user[-1]
    else:
        masked = user[0] + "*"
    return f"{masked}@{parts[1]}"


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return tokens."""
    user = db.query(User).filter(User.id == request.user_id.upper()).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect ID or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role,
                "email": user.email,
                "avatar": user.avatar,
                "department_section": user.department_section,
            },
        },
    }

@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user manually."""
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )

    new_id = generate_user_id(db, request.role)

    avatar_initials = (request.first_name[0] + request.last_name[0]).upper() if request.first_name and request.last_name else "U"

    new_user = User(
        id=new_id,
        password_hash=hash_password(request.password),
        auth_provider="local",
        name=f"{request.first_name} {request.last_name}",
        role=request.role,
        email=request.email,
        phone=request.phone,
        avatar=avatar_initials,
        department_section=request.department_section,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({"sub": new_user.id})
    refresh_token = create_refresh_token({"sub": new_user.id})

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "role": new_user.role,
                "email": new_user.email,
                "avatar": new_user.avatar,
                "department_section": new_user.department_section,
            },
        },
    }

@router.post("/oauth")
async def oauth_login(request: OAuthLoginRequest, db: Session = Depends(get_db)):
    """Login or register via Google/Facebook."""
    email = None
    name = None
    oauth_id = None
    avatar_url = None

    if request.provider == "google":
        # Try verifying as an ID token first
        id_token_valid = False
        try:
            idinfo = id_token.verify_oauth2_token(
                request.token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
            )
            email = idinfo.get("email")
            name = idinfo.get("name")
            oauth_id = idinfo.get("sub")
            avatar_url = idinfo.get("picture")
            id_token_valid = True
        except (ValueError, Exception):
            id_token_valid = False

        # If ID token verification failed, treat it as an access token
        # and fetch user info from Google's userinfo endpoint
        if not id_token_valid:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {request.token}"}
                    )
                    if response.status_code != 200:
                        raise HTTPException(status_code=400, detail="Invalid Google token.")
                    userinfo = response.json()
                    email = userinfo.get("email")
                    name = userinfo.get("name")
                    oauth_id = userinfo.get("sub")
                    avatar_url = userinfo.get("picture")
            except httpx.HTTPError:
                raise HTTPException(status_code=400, detail="Failed to verify Google token.")

    elif request.provider == "facebook":
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.facebook.com/me",
                params={"fields": "id,name,email,picture", "access_token": request.token}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Facebook token.")
            data = response.json()
            email = data.get("email")
            name = data.get("name")
            oauth_id = data.get("id")
            if data.get("picture") and data["picture"].get("data"):
                avatar_url = data["picture"]["data"].get("url")
    else:
        raise HTTPException(status_code=400, detail="Invalid provider.")

    if not email or not oauth_id:
        raise HTTPException(status_code=400, detail="Could not retrieve email from provider.")

    user = db.query(User).filter((User.oauth_id == oauth_id) | (User.email == email)).first()

    # Build avatar initials from name (avatar column is String(10), can't store URLs)
    avatar_initials = "O"
    if name:
        parts = name.split()
        avatar_initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not found. Only pre-registered users can log in."
        )
    else:
        if not user.oauth_id:
            user.oauth_id = oauth_id
            user.auth_provider = request.provider
            db.commit()

    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role,
                "email": user.email,
                "avatar": user.avatar,
                "department_section": user.department_section,
            },
        },
    }


@router.post("/logout")
def logout():
    """Logout (client-side token removal)."""
    return {"success": True, "message": "Logged out successfully"}


@router.post("/refresh")
def refresh_token(request: RefreshRequest):
    """Refresh an access token."""
    payload = decode_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    new_access = create_access_token({"sub": user_id})

    return {
        "success": True,
        "data": {"access_token": new_access},
    }


@router.post("/forgot-password/request")
def request_password_reset(request: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Request a password reset OTP."""
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this Email address.")

    # Generate 6-digit OTP
    otp = "".join(random.choices(string.digits, k=6))

    # Store token
    token = PasswordResetToken(
        user_id=user.id,
        token=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(token)
    db.commit()

    # Trigger password reset OTP email in the background
    from app.utils.email import send_system_email, get_otp_template
    email_body = get_otp_template(otp, user.name)
    background_tasks.add_task(
        send_system_email,
        to_email=user.email,
        subject="Password Reset Verification Code",
        html_body=email_body
    )

    response_data = {
        "reset_token_id": str(token.id),
        "email_masked": mask_email(user.email),
    }

    # In DEMO mode, include OTP in response
    if settings.DEMO_MODE:
        response_data["otp"] = otp

    return {
        "success": True,
        "data": response_data,
        "message": "OTP sent to your email",
    }


@router.post("/forgot-password/verify-otp")
def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP for password reset."""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this Email address.")

    token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.token == request.otp,
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )

    if not token:
        raise HTTPException(status_code=400, detail="Incorrect or expired code.")

    # Delete used token
    db.delete(token)
    db.commit()

    # Create temporary password reset JWT
    reset_jwt = create_password_reset_token(user.id)

    return {
        "success": True,
        "data": {"password_reset_token": reset_jwt},
    }


@router.post("/forgot-password/reset")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using temporary token."""
    payload = decode_token(request.password_reset_token)

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid reset token.")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password_hash = hash_password(request.new_password)
    db.commit()

    return {"success": True, "message": "Password updated successfully"}
