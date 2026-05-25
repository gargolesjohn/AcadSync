"""Assignment endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.security import get_current_user, require_role
from app.utils.constants import ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_STUDENT

router = APIRouter()


def asgn_to_dict(a, db, current_user=None):
    instructor = db.query(User).filter(User.id == a.instructor_id).first()
    sub_count = db.query(Submission).filter(Submission.assignment_id == a.id).count()
    result = {
        "id": a.id, "course_code": a.course_code, "course_name": a.course_name,
        "title": a.title, "description": a.description,
        "due_date": a.due_date.isoformat() + "Z" if a.due_date else None,
        "max_points": a.max_points, "instructor_id": a.instructor_id,
        "instructor_name": instructor.name if instructor else "Unknown",
        "submission_count": sub_count,
        "created_at": a.created_at.isoformat() + "Z" if a.created_at else None,
    }
    if current_user and current_user.role == ROLE_STUDENT:
        my_sub = db.query(Submission).filter(Submission.assignment_id == a.id, Submission.student_id == current_user.id).first()
        result["submitted_by_me"] = my_sub is not None
        result["my_grade"] = my_sub.grade if my_sub else None
        if my_sub:
            result["my_submission"] = {
                "id": my_sub.id,
                "file_name": my_sub.file_original_name,
                "submitted_at": my_sub.submitted_at.isoformat() + "Z" if my_sub.submitted_at else None,
                "feedback": my_sub.feedback,
            }
    return result


@router.get("")
def list_assignments(page: int = Query(1, ge=1), per_page: int = Query(20),
                     course_code: str = Query(None), db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    query = db.query(Assignment)
    if current_user.role in [ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD]:
        query = query.filter(Assignment.instructor_id == current_user.id)
    if course_code:
        query = query.filter(Assignment.course_code == course_code)
    total = query.count()
    items = query.order_by(Assignment.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"success": True, "data": {"items": [asgn_to_dict(a, db, current_user) for a in items], "total": total, "page": page}}


@router.get("/{assignment_id}")
def get_assignment(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a: raise HTTPException(404, "Assignment not found.")
    data = asgn_to_dict(a, db, current_user)
    if current_user.role in [ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_ADMIN]:
        subs = db.query(Submission).filter(Submission.assignment_id == a.id).all()
        data["submissions"] = []
        for s in subs:
            student = db.query(User).filter(User.id == s.student_id).first()
            data["submissions"].append({
                "id": s.id, "student_id": s.student_id,
                "student_name": student.name if student else "Unknown",
                "file_name": s.file_original_name, "grade": s.grade, "feedback": s.feedback,
                "submitted_at": s.submitted_at.isoformat() + "Z" if s.submitted_at else None,
                "graded_at": s.graded_at.isoformat() + "Z" if s.graded_at else None,
            })
    return {"success": True, "data": data}


@router.post("")
async def create_assignment(req: AssignmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD))):
    a = Assignment(instructor_id=current_user.id, course_code=req.course_code.upper(),
                   course_name=req.course_name, title=req.title, description=req.description,
                   due_date=req.due_date, max_points=req.max_points)
    db.add(a); db.commit(); db.refresh(a)
    data = asgn_to_dict(a, db, current_user)
    from app.utils.websocket_manager import manager
    await manager.notify_assignment_updated({**data, "event": "assignment_created"})
    return {"success": True, "data": data}


@router.patch("/{assignment_id}")
async def update_assignment(assignment_id: int, req: AssignmentUpdate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a: raise HTTPException(404, "Assignment not found.")
    if current_user.role != ROLE_ADMIN and a.instructor_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    if req.title: a.title = req.title
    if req.description: a.description = req.description
    if req.due_date: a.due_date = req.due_date
    if req.max_points: a.max_points = req.max_points
    db.commit(); db.refresh(a)
    data = asgn_to_dict(a, db, current_user)
    from app.utils.websocket_manager import manager
    await manager.notify_assignment_updated({**data, "event": "assignment_updated"})
    return {"success": True, "data": data}


@router.delete("/{assignment_id}")
async def delete_assignment(assignment_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a: raise HTTPException(404, "Assignment not found.")
    if current_user.role != ROLE_ADMIN and a.instructor_id != current_user.id:
        raise HTTPException(403, "Access denied.")
    assignment_data = asgn_to_dict(a, db, current_user)
    db.delete(a); db.commit()
    from app.utils.websocket_manager import manager
    await manager.notify_assignment_updated({**assignment_data, "event": "assignment_deleted"})
    return {"success": True, "message": "Assignment deleted"}
