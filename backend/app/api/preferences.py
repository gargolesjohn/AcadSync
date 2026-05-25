"""Preferences endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.preference import PreferenceUpdate
from app.security import get_current_user

router = APIRouter()


@router.get("")
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref); db.commit(); db.refresh(pref)
    return {"success": True, "data": {
        "dark_mode": pref.dark_mode, "accent_color": pref.accent_color,
        "notifications_email": pref.notifications_email, "notifications_bell": pref.notifications_bell,
        "notifications_messages": pref.notifications_messages,
    }}


@router.patch("")
def update_preferences(req: PreferenceUpdate, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
    if req.dark_mode is not None: pref.dark_mode = req.dark_mode
    if req.accent_color is not None: pref.accent_color = req.accent_color
    if req.notifications_email is not None: pref.notifications_email = req.notifications_email
    if req.notifications_bell is not None: pref.notifications_bell = req.notifications_bell
    if req.notifications_messages is not None: pref.notifications_messages = req.notifications_messages
    db.commit(); db.refresh(pref)
    return {"success": True, "data": {
        "dark_mode": pref.dark_mode, "accent_color": pref.accent_color,
        "notifications_email": pref.notifications_email, "notifications_bell": pref.notifications_bell,
        "notifications_messages": pref.notifications_messages,
    }}