"""File upload/storage utilities."""

import os
import uuid
from fastapi import UploadFile

from app.config import settings


def ensure_upload_dir():
    """Create upload directories if they don't exist."""
    submissions_dir = os.path.join(settings.UPLOAD_DIR, "submissions")
    os.makedirs(submissions_dir, exist_ok=True)
    return submissions_dir


async def save_upload_file(file: UploadFile, student_id: str, course_code: str) -> tuple[str, str]:
    """Save an uploaded file and return (file_path, original_name).

    Files are stored as: uploads/submissions/{student_id}_{course_code}_{uuid}_{original_name}
    """
    submissions_dir = ensure_upload_dir()

    # Sanitize filename
    original_name = file.filename or "submission"
    ext = os.path.splitext(original_name)[1] or ".pdf"
    unique_name = f"{student_id}_{course_code}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(submissions_dir, unique_name)

    # Write file
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Return relative path for storage in DB
    relative_path = f"uploads/submissions/{unique_name}"
    return relative_path, original_name
