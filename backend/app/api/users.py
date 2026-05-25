"""User endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.section import Section
from app.schemas.user import (
    UserCreate, UserUpdate, AdminUserUpdate, UserResponse,
    ChangePasswordRequest, UserListItem,
)
from app.schemas.section import SectionCreate, SectionResponse, SectionUpdate
from app.security import get_current_user, verify_password, hash_password, require_role
from app.utils.id_generator import generate_user_id
from app.utils.constants import ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_REGISTRAR, ALL_ROLES

router = APIRouter()


def user_to_response(user: User) -> dict:
    """Convert User model to response dict."""
    return {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar,
        "bio": user.bio,
        "department_section": user.department_section,
        "enrollment_status": user.enrollment_status,
        "section_id": user.section_id,
        "status": user.status,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


@router.get("/contacts")
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active users as contacts (for compose message picker)."""
    users = db.query(User).filter(User.is_active == True, User.id != current_user.id).all()
    return {
        "success": True,
        "data": [
            {"id": u.id, "name": u.name, "role": u.role, "avatar": u.avatar, "department_section": u.department_section}
            for u in users
        ],
    }


@router.get("/me")
def get_current_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {"success": True, "data": user_to_response(current_user)}


@router.patch("/me")
def update_profile(
    update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile."""
    if update.name is not None:
        current_user.name = update.name
        # Update avatar from name initials
        parts = update.name.split()
        current_user.avatar = "".join(p[0] for p in parts[:2]).upper()
    if update.email is not None:
        current_user.email = update.email
    if update.phone is not None:
        current_user.phone = update.phone
    if update.bio is not None:
        current_user.bio = update.bio
    if update.department_section is not None:
        current_user.department_section = update.department_section

    db.commit()
    db.refresh(current_user)
    return {"success": True, "data": user_to_response(current_user)}


@router.post("/me/change-password")
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change current user password."""
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail="Cannot change password for OAuth accounts. Use your social login provider.")

    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    current_user.password_hash = hash_password(request.new_password)
    db.commit()
    return {"success": True, "message": "Password changed successfully"}


@router.get("/sections")
def list_sections(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD)),
):
    """List sections (filtered for instructors)."""
    query = db.query(Section)
    if current_user.role == ROLE_INSTRUCTOR:
        query = query.join(Section.instructors).filter(User.id == current_user.id)
    sections = query.all()
    res = []
    for s in sections:
        res.append({
            "id": s.id,
            "name": s.name,
            "year_level": s.year_level,
            "status": s.status,
            "courses": [{"id": c.id, "code": c.code, "name": c.name} for c in s.courses] if s.courses else [],
            "instructors": [{"id": i.id, "name": i.name, "avatar": i.avatar} for i in s.instructors] if s.instructors else [],
            "subject_assignments": [{"course_id": sa.course_id, "instructor_id": sa.instructor_id} for sa in getattr(s, "subject_assignments", [])],
            "student_count": db.query(User).filter(
                (User.section_id == s.id) | (User.department_section == s.name),
                User.role == 'student'
            ).count(),
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return {
        "success": True,
        "data": res,
    }


@router.get("/sections/{section_id}/students")
def list_section_students(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD)),
):
    """List students in a specific section."""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")

    students = db.query(User).filter(
        (User.section_id == section.id) | (User.department_section == section.name),
        User.role == 'student'
    ).all()
    return {
        "success": True,
        "data": [user_to_response(u) for u in students]
    }


@router.get("/next-id")
def get_next_id(
    role: str = Query(...),
    year: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR)),
):
    """Get the next available user ID for a role (admin only)."""
    if role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    new_id = generate_user_id(db, role, year=year)
    return {"success": True, "data": {"id": new_id}}


@router.get("/{user_id}")
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user by ID (admin/instructor view)."""
    user = db.query(User).filter(User.id == user_id.upper()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"success": True, "data": user_to_response(user)}


@router.get("")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    role: str = Query(None),
    search: str = Query(None),
    is_active: bool = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD)),
):
    """List all users (admin only)."""
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_term))
            | (User.id.ilike(search_term))
            | (User.email.ilike(search_term))
            | (User.department_section.ilike(search_term))
        )

    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "success": True,
        "data": {
            "items": [user_to_response(u) for u in users],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,
        },
    }




@router.post("/sections")
def create_section(
    req: SectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR)),
):
    """Create a new section (admin only)."""
    existing = db.query(Section).filter(Section.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Section already exists.")
    
    section = Section(
        name=req.name,
        year_level=req.year_level,
        status=req.status or "Active"
    )
    
    # Add instructors
    if req.instructor_ids:
        instructors = db.query(User).filter(User.id.in_(req.instructor_ids)).all()
        section.instructors = instructors
        
    # Add courses
    if req.course_ids:
        from app.models.course import Course
        courses = db.query(Course).filter(Course.id.in_(req.course_ids)).all()
        section.courses = courses

    # Add subject assignments
    if req.subject_assignments:
        from app.models.section import SectionSubjectAssignment
        for sa in req.subject_assignments:
            section.subject_assignments.append(SectionSubjectAssignment(
                course_id=sa.course_id, instructor_id=sa.instructor_id
            ))

    db.add(section)
    db.flush()  # Get ID

    if req.student_ids:
        db.query(User).filter(User.id.in_(req.student_ids)).update(
            {User.section_id: section.id, User.department_section: section.name},
            synchronize_session=False
        )
    
    db.commit()
    db.refresh(section)
    return {"success": True, "data": {"id": section.id, "name": section.name}}


@router.patch("/sections/{section_id}")
def update_section(
    section_id: int,
    req: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR)),
):
    """Update section details (admin only)."""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    
    if req.name is not None:
        section.name = req.name
        # Update department_section for all students in this section
        db.query(User).filter(User.section_id == section.id).update(
            {User.department_section: req.name},
            synchronize_session=False
        )
    if req.year_level is not None: section.year_level = req.year_level
    if req.status is not None: section.status = req.status
    
    if req.instructor_ids is not None:
        instructors = db.query(User).filter(User.id.in_(req.instructor_ids)).all()
        section.instructors = instructors
        
    if req.course_ids is not None:
        from app.models.course import Course
        courses = db.query(Course).filter(Course.id.in_(req.course_ids)).all()
        section.courses = courses

    if req.subject_assignments is not None:
        from app.models.section import SectionSubjectAssignment
        # Clear existing
        section.subject_assignments = []
        for sa in req.subject_assignments:
            section.subject_assignments.append(SectionSubjectAssignment(
                course_id=sa.course_id, instructor_id=sa.instructor_id
            ))
    
    if req.student_ids is not None:
        # Reset students currently in this section
        db.query(User).filter(User.section_id == section.id).update(
            {User.section_id: None},
            synchronize_session=False
        )
        # Assign new students
        db.query(User).filter(User.id.in_(req.student_ids)).update(
            {User.section_id: section.id, User.department_section: section.name},
            synchronize_session=False
        )
    
    db.commit()
    return {"success": True}


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN, ROLE_REGISTRAR)),
):
    """Delete a section (admin only)."""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    
    # Remove section reference from students
    db.query(User).filter(User.section_id == section_id).update(
        {User.section_id: None},
        synchronize_session=False
    )
    
    db.delete(section)
    db.commit()
    return {"success": True}






@router.post("")
def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    """Create a new user (admin only)."""
    if request.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")

    if request.custom_id:
        new_id = request.custom_id.strip().upper()
        if db.query(User).filter(User.id == new_id).first():
            raise HTTPException(status_code=400, detail="User ID already exists.")
    else:
        new_id = generate_user_id(db, request.role, year=request.year)

    name = f"{request.first_name} {request.last_name}"
    avatar = (request.first_name[0] + request.last_name[0]).upper()

    section_name = request.department_section
    if request.section_id:
        section = db.query(Section).filter(Section.id == request.section_id).first()
        if section:
            section_name = section.name

    user = User(
        id=new_id,
        password_hash=hash_password(request.password),
        name=name,
        role=request.role,
        email=request.email or None,
        phone=request.phone or None,
        department_section=section_name,
        enrollment_status=request.enrollment_status or "Regular",
        section_id=request.section_id,
        status=request.status or "Active",
        is_active=(request.status != "Inactive" and request.status != "Suspended"),
        avatar=avatar,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": user_to_response(user),
        "message": "User created successfully",
    }


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    request: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id.upper()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if request.name is not None:
        user.name = request.name
        parts = request.name.split()
        user.avatar = "".join(p[0] for p in parts[:2]).upper()
    if request.email is not None:
        user.email = request.email
    if request.phone is not None:
        user.phone = request.phone
    if request.department_section is not None:
        user.department_section = request.department_section
    if request.enrollment_status is not None:
        user.enrollment_status = request.enrollment_status
    if request.section_id is not None:
        user.section_id = request.section_id
        # Fetch section name to update department_section
        if request.section_id:
            section = db.query(Section).filter(Section.id == request.section_id).first()
            if section:
                user.department_section = section.name
        else:
            user.department_section = "" # Or keep existing if section_id is None? 
            # In AcadSync, students without section usually have "Not Assigned" or empty.
    
    if request.status is not None:
        user.status = request.status
        # Sync is_active with status
        user.is_active = (request.status == "Active")
    if request.password:
        user.password_hash = hash_password(request.password)

    db.commit()
    db.refresh(user)
    return {"success": True, "data": user_to_response(user)}


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    """Delete a user and all related data (admin only)."""
    from app.models.message import Message
    from app.models.announcement import Announcement
    from app.models.assignment import Assignment
    from app.models.submission import Submission
    from app.models.schedule import Schedule
    from app.models.user_preference import UserPreference
    from app.models.password_reset_token import PasswordResetToken

    uid = user_id.upper()

    if uid == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Cascade-delete all related records to avoid FK constraint errors
    from app.models.grade import Grade
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == uid).delete()
    db.query(Submission).filter(Submission.student_id == uid).delete()
    db.query(Grade).filter((Grade.student_id == uid) | (Grade.professor_id == uid)).delete()
    db.query(Message).filter((Message.from_id == uid) | (Message.to_id == uid)).delete(synchronize_session="fetch")
    db.query(Announcement).filter(Announcement.author_id == uid).delete()
    db.query(Schedule).filter(Schedule.user_id == uid).delete()
    db.query(UserPreference).filter(UserPreference.user_id == uid).delete()
    # Delete assignments created by this user (instructor)
    db.query(Assignment).filter(Assignment.instructor_id == uid).delete()

    db.delete(user)
    db.commit()
    return {"success": True, "message": "User deleted successfully"}