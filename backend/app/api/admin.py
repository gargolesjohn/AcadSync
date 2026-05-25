"""Admin endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.message import Message
from app.models.announcement import Announcement
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.models.schedule import Schedule
from app.models.user_preference import UserPreference
from app.models.password_reset_token import PasswordResetToken
from app.models.section import Section
from app.models.attendance import Attendance
from app.security import require_role
from app.utils.constants import ROLE_ADMIN, ROLE_REGISTRAR, ROLE_STUDENT, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD
from app.seed.default_data import *

router = APIRouter()


@router.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db),
                    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR))):
    unread = db.query(Message).filter(Message.to_id == current_user.id, Message.is_read == False).count()
    
    # Fetch recent activities
    recent_users = db.query(User).order_by(User.created_at.desc()).limit(4).all()
    recent_announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).limit(4).all()
    
    activities = []
    for u in recent_users:
        activities.append({
            "type": "USER",
            "title": f"New User: {u.name}",
            "description": f"Registered as {u.role.capitalize()}",
            "time": u.created_at.isoformat() if u.created_at else None,
            "icon": "fa-user-plus",
            "color": "#6366f1"
        })
    for a in recent_announcements:
        activities.append({
            "type": "ANNOUNCEMENT",
            "title": a.title,
            "description": f"Posted to {a.target_audience}",
            "time": a.created_at.isoformat() if a.created_at else None,
            "icon": "fa-bullhorn",
            "color": "#10b981"
        })
    
    activities.sort(key=lambda x: x["time"] or "", reverse=True)

    return {"success": True, "data": {
        "unread_messages": unread,
        "total_users": db.query(User).count(),
        "total_announcements": db.query(Announcement).count(),
        "system_status": "online",
        "total_students": db.query(User).filter(User.role == ROLE_STUDENT).count(),
        "total_instructors": db.query(User).filter(User.role.in_([ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD])).count(),
        "total_admins": db.query(User).filter(User.role == ROLE_ADMIN).count(),
        "recent_activities": activities[:6]
    }}


from app.models.grade import Grade

@router.post("/reset-data")
def reset_data(db: Session = Depends(get_db),
               current_user: User = Depends(require_role(ROLE_ADMIN))):
    """Reset all data to defaults (DEMO only)."""
    # Clear all tables
    db.query(PasswordResetToken).delete()
    db.query(Attendance).delete()
    db.query(Section).delete()
    db.query(Submission).delete()
    db.query(Assignment).delete()
    db.query(Schedule).delete()
    db.query(Grade).delete()
    db.query(Message).delete()
    db.query(Announcement).delete()
    db.query(UserPreference).delete()
    db.query(User).delete()
    db.commit()

    # Re-seed
    for s in get_default_sections():
        db.add(Section(**s))
    db.commit()
    for u in get_default_users():
        db.add(User(**u))
    db.commit()
    for a in get_default_announcements():
        db.add(Announcement(**a))
    for m in get_default_messages():
        db.add(Message(**m))
    for a in get_default_assignments():
        db.add(Assignment(**a))
    db.commit()
    for s in get_default_submissions():
        db.add(Submission(**s))
    for sc in get_default_schedules():
        db.add(Schedule(**sc))
    for p in get_default_preferences():
        db.add(UserPreference(**p))
    db.commit()

    return {"success": True, "message": "All data reset to defaults"}
