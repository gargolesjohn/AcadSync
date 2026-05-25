"""User ID generation utilities."""

from sqlalchemy.orm import Session
from app.models.user import User
from app.utils.constants import ROLE_STUDENT, ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD
from datetime import datetime


def generate_user_id(db: Session, role: str, year: str = None) -> str:
    """Generate the next user ID based on role.

    Format:
    - Admin:      ADM-#####
    - Instructor:  INS-#####
    - Program Head: INS-##### (same as instructor)
    - Student:     STUYY-##### (e.g., STU24-00001)
    """
    if not year:
        year_short = datetime.now().strftime("%y")
    else:
        # Use provided year (e.g., "26")
        year_short = year

    if role == ROLE_STUDENT:
        prefix = f"STU{year_short}"
    elif role == ROLE_ADMIN:
        prefix = "ADM"
    elif role in (ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD):
        prefix = "INS"
    else:
        raise ValueError(f"Invalid role: {role}")

    # Find the highest existing ID with this prefix
    # We search for IDs starting with this prefix followed by a dash
    existing = (
        db.query(User.id)
        .filter(User.id.like(f"{prefix}-%"))
        .all()
    )

    if existing:
        nums = []
        for (uid,) in existing:
            try:
                # Split by dash and take the last part
                num_str = uid.split("-")[-1]
                nums.append(int(num_str))
            except (ValueError, IndexError):
                continue
        next_num = max(nums) + 1 if nums else 1
    else:
        next_num = 1

    return f"{prefix}-{str(next_num).zfill(5)}"
