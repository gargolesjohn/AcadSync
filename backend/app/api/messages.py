"""Message endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.message import Message
from app.schemas.message import MessageCreate
from app.security import get_current_user

router = APIRouter()


def msg_to_dict(msg, db, current_user_id=None):
    sender = db.query(User).filter(User.id == msg.from_id).first()
    recipient = db.query(User).filter(User.id == msg.to_id).first()
    
    is_unsent = getattr(msg, 'is_unsent', False)
    body = msg.body
    
    if is_unsent:
        if current_user_id and msg.from_id == current_user_id:
            body = "you unsent a message"
        else:
            body = "A message was unsent"
            
    return {
        "id": msg.id, "from_id": msg.from_id,
        "from_name": sender.name if sender else "Unknown",
        "to_id": msg.to_id, "to_name": recipient.name if recipient else "Unknown",
        "subject": msg.subject, "body": body, 
        "is_read": msg.is_read, "is_spam": msg.is_spam, "is_important": msg.is_important,
        "is_unsent": is_unsent,
        "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
    }


# ─── Named GET routes MUST come before /{message_id} to avoid being shadowed ───

@router.get("/inbox")
def get_inbox(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=1000),
              unread_only: bool = Query(False), db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    query = db.query(Message).filter(Message.to_id == current_user.id, Message.is_spam == False, Message.deleted_by_recipient == False)
    if unread_only:
        query = query.filter(Message.is_read == False)
    total = query.count()
    unread = db.query(Message).filter(Message.to_id == current_user.id, Message.is_read == False, Message.deleted_by_recipient == False).count()
    msgs = query.order_by(Message.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [msg_to_dict(m, db, current_user.id) for m in msgs], "total": total, "page": page, "unread_count": unread}}


@router.get("/sent")
def get_sent(page: int = Query(1, ge=1), per_page: int = Query(20), db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    query = db.query(Message).filter(Message.from_id == current_user.id, Message.deleted_by_sender == False)
    total = query.count()
    msgs = query.order_by(Message.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [msg_to_dict(m, db, current_user.id) for m in msgs], "total": total, "page": page}}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Message).filter(Message.to_id == current_user.id, Message.is_read == False, Message.deleted_by_recipient == False).count()
    return {"success": True, "data": {"unread_count": c}}


@router.get("/important")
def get_important(page: int = Query(1, ge=1), per_page: int = Query(20), db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    query = db.query(Message).filter(Message.to_id == current_user.id, Message.is_important == True, Message.deleted_by_recipient == False)
    total = query.count()
    msgs = query.order_by(Message.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [msg_to_dict(m, db, current_user.id) for m in msgs], "total": total, "page": page}}


@router.get("/spam")
def get_spam(page: int = Query(1, ge=1), per_page: int = Query(20), db: Session = Depends(get_db),
            current_user: User = Depends(get_current_user)):
    query = db.query(Message).filter(Message.to_id == current_user.id, Message.is_spam == True, Message.deleted_by_recipient == False)
    total = query.count()
    msgs = query.order_by(Message.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [msg_to_dict(m, db, current_user.id) for m in msgs], "total": total, "page": page}}


# ─── Parameterized routes come AFTER named routes ───

@router.get("/conversations/{contact_id}")
def get_conversation(contact_id: str, subject: str = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve full conversation history between current_user and contact_id, filtering by subject, and marking incoming messages as read."""
    query = db.query(Message).filter(
        ((Message.from_id == current_user.id) & (Message.to_id == contact_id)) |
        ((Message.from_id == contact_id) & (Message.to_id == current_user.id))
    )
    
    if subject:
        query = query.filter(Message.subject == subject)
        
    msgs = query.order_by(Message.created_at.asc()).all()
    
    # Filter out messages deleted by the current user
    filtered_msgs = []
    for m in msgs:
        if m.from_id == current_user.id and m.deleted_by_sender:
            continue
        if m.to_id == current_user.id and m.deleted_by_recipient:
            continue
        filtered_msgs.append(m)

    # Mark incoming messages as read
    unread_incoming = [m for m in filtered_msgs if m.to_id == current_user.id and not m.is_read]
    if unread_incoming:
        for m in unread_incoming:
            m.is_read = True
        db.commit()

    return {"success": True, "data": [msg_to_dict(m, db, current_user.id) for m in filtered_msgs]}


@router.get("/{message_id}")
def get_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg: raise HTTPException(404, "Message not found.")
    if msg.to_id != current_user.id and msg.from_id != current_user.id: raise HTTPException(403, "Access denied.")
    
    if msg.from_id == current_user.id and msg.deleted_by_sender: raise HTTPException(404, "Message not found.")
    if msg.to_id == current_user.id and msg.deleted_by_recipient: raise HTTPException(404, "Message not found.")
    
    if msg.to_id == current_user.id and not msg.is_read:
        msg.is_read = True; db.commit()
    return {"success": True, "data": msg_to_dict(msg, db, current_user.id)}


@router.post("")
async def send_message(req: MessageCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recipient = db.query(User).filter(User.id == req.to_id).first()
    if not recipient: raise HTTPException(404, "Recipient not found.")
    msg = Message(from_id=current_user.id, to_id=req.to_id, subject=req.subject, body=req.body)
    db.add(msg); db.commit(); db.refresh(msg)
    
    # Notify recipient in real time via WebSocket
    from app.utils.websocket_manager import manager
    msg_data = msg_to_dict(msg, db)
    await manager.notify_new_message(msg.to_id, msg_data)

    # Queue background email alert if recipient has preference enabling it
    if recipient.email and (not recipient.preferences or recipient.preferences.notifications_email):
        from app.utils.email import send_system_email, get_message_template
        snippet = req.body[:150] + "..." if len(req.body) > 150 else req.body
        email_body = get_message_template(
            sender_name=current_user.name,
            subject=req.subject or "No Subject",
            snippet=snippet,
            recipient_name=recipient.name
        )
        background_tasks.add_task(
            send_system_email,
            to_email=recipient.email,
            subject=f"New message from {current_user.name}: {req.subject or 'No Subject'}",
            html_body=email_body
        )
    
    return {"success": True, "data": msg_data}



@router.patch("/{message_id}/read")
def mark_read(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == message_id, Message.to_id == current_user.id).first()
    if not msg: raise HTTPException(404, "Message not found.")
    msg.is_read = True; db.commit()
    return {"success": True, "message": "Message marked as read"}


@router.patch("/{message_id}/important")
def toggle_important(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == message_id, Message.to_id == current_user.id).first()
    if not msg: raise HTTPException(404, "Message not found.")
    msg.is_important = not msg.is_important
    db.commit()
    return {"success": True, "data": {"is_important": msg.is_important}}


@router.patch("/{message_id}/spam")
def toggle_spam(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == message_id, Message.to_id == current_user.id).first()
    if not msg: raise HTTPException(404, "Message not found.")
    msg.is_spam = not msg.is_spam
    db.commit()
    return {"success": True, "data": {"is_spam": msg.is_spam}}


@router.delete("/{message_id}")
def delete_message(message_id: int, for_everyone: bool = Query(False), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg: raise HTTPException(404, "Message not found.")
    if msg.to_id != current_user.id and msg.from_id != current_user.id: raise HTTPException(403, "Access denied.")
    
    is_sender = (msg.from_id == current_user.id)
    
    if for_everyone and is_sender:
        msg.is_unsent = True
    else:
        if msg.from_id == current_user.id:
            msg.deleted_by_sender = True
        if msg.to_id == current_user.id:
            msg.deleted_by_recipient = True
        
        if getattr(msg, 'deleted_by_sender', False) and getattr(msg, 'deleted_by_recipient', False) and getattr(msg, 'is_unsent', False):
            pass
            
    db.commit()
    return {"success": True, "message": "Message deleted"}