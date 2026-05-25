"""Announcement endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from app.security import get_current_user, require_role
from app.utils.constants import *

router = APIRouter()


def get_department(s: str) -> str:
    if not s: return ""
    s = s.upper()
    if any(x in s for x in ["BSCS", "BSIT", "ICS", "IT"]): return "ICS"
    if any(x in s for x in ["BSBA", "IBE"]): return "IBE"
    if any(x in s for x in ["BSE", "ITE"]): return "ITE"
    return s


def ann_to_dict(a, db):
    author = db.query(User).filter(User.id == a.author_id).first()
    return {
        "id": a.id, "title": a.title, "body": a.body,
        "type": a.announcement_type, "color": a.color,
        "target_audience": a.target_audience, "target_class": a.target_class,
        "author_id": a.author_id,
        "author_name": author.name if author else "Unknown",
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
def list_announcements(page: int = Query(1, ge=1), per_page: int = Query(20),
                       type: str = Query(None), search: str = Query(None),
                       management: bool = Query(False),
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Announcement)
    # Role-based filtering
    if current_user.role == ROLE_STUDENT:
        from sqlalchemy import func
        user_dept = get_department(current_user.department_section)
        query = query.filter(
            (Announcement.target_audience.in_([TARGET_ALL, TARGET_STUDENTS])) &
            (
                (Announcement.target_class == None) | 
                (Announcement.target_class == "") |
                (func.lower(func.trim(Announcement.target_class)) == func.lower(func.trim(current_user.department_section))) |
                (func.lower(func.trim(Announcement.target_class)) == func.lower(func.trim(user_dept)))
            )
        )
    elif current_user.role in (ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD):
        query = query.filter(
            (Announcement.author_id == current_user.id) |
            (Announcement.target_audience.in_([TARGET_ALL, TARGET_FACULTY]))
        )
    elif current_user.role == ROLE_ADMIN:
        if not management:
            query = query.filter(Announcement.announcement_type != "academic")
            
    if type:
        query = query.filter(Announcement.announcement_type == type)
    if search:
        query = query.filter((Announcement.title.ilike(f"%{search}%")) | (Announcement.body.ilike(f"%{search}%")))
    total = query.count()
    anns = query.order_by(Announcement.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [ann_to_dict(a, db) for a in anns], "total": total, "page": page}}


@router.post("")
async def create_announcement(req: AnnouncementCreate, db: Session = Depends(get_db),
                        current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD))):
    color = ANNOUNCEMENT_TYPE_COLORS.get(req.type, "slate")
    target_audience = req.target_audience or TARGET_ALL
    target_class = req.target_class

    if current_user.role == ROLE_PROGRAM_HEAD:
        # Program Heads can target Students (in their department) or Faculty
        if target_audience not in [TARGET_STUDENTS, TARGET_FACULTY]:
            target_audience = TARGET_STUDENTS
            
        if target_audience == TARGET_STUDENTS:
            target_class = get_department(current_user.department_section)
        else:
            target_class = None

    ann = Announcement(author_id=current_user.id, title=req.title, body=req.body,
                       announcement_type=req.type, color=color,
                       target_audience=target_audience,
                       target_class=target_class)
    db.add(ann); db.commit(); db.refresh(ann)
    
    # Notify connected users in real-time via WebSocket
    from app.utils.websocket_manager import manager
    ann_data = ann_to_dict(ann, db)
    await manager.notify_new_announcement(ann_data)
    
    return {"success": True, "data": ann_data}


@router.patch("/{ann_id}")
def update_announcement(ann_id: int, req: AnnouncementUpdate, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann: raise HTTPException(404, "Announcement not found.")
    if current_user.role != ROLE_ADMIN and ann.author_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    if req.title: ann.title = req.title
    if req.body: ann.body = req.body
    if req.type:
        ann.announcement_type = req.type
        ann.color = ANNOUNCEMENT_TYPE_COLORS.get(req.type, ann.color)
    if req.target_class is not None: ann.target_class = req.target_class
    db.commit(); db.refresh(ann)
    return {"success": True, "data": ann_to_dict(ann, db)}


@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann: raise HTTPException(404, "Announcement not found.")
    if current_user.role != ROLE_ADMIN and ann.author_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    db.delete(ann); db.commit()
    return {"success": True, "message": "Announcement deleted"}
