"""Default seed data migrated from the prototype's JavaScript constants."""

from datetime import datetime, timedelta

from app.security import hash_password
from app.utils.constants import ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_STUDENT


def get_default_users():
    """Return default user records with bcrypt-hashed passwords."""
    return [
        {
            "id": "ADM-00001",
            "password_hash": hash_password("admin123"),
            "name": "Admin Sarah",
            "role": ROLE_ADMIN,
            "department_section": "Registrar Office",
            "avatar": "AS",
            "email": "sarah.admin@acadsync.edu.ph",
            "phone": "+63 912 000 0001",
            "bio": "Registrar administrator.",
        },
        {
            "id": "ADM-00002",
            "password_hash": hash_password("admin456"),
            "name": "Admin John Reyes",
            "role": ROLE_ADMIN,
            "department_section": "IT Department",
            "avatar": "JR",
            "email": "john.reyes@acadsync.edu.ph",
            "phone": "+63 912 000 0002",
            "bio": "IT systems administrator.",
        },
        {
            "id": "INS-00001",
            "password_hash": hash_password("teach123"),
            "name": "Prof. Michael Lim",
            "role": ROLE_INSTRUCTOR,
            "department_section": "IT Department",
            "avatar": "ML",
            "email": "michael.lim@acadsync.edu.ph",
            "phone": "+63 912 000 0003",
            "bio": "Web and software development faculty.",
        },
        {
            "id": "INS-00002",
            "password_hash": hash_password("teach456"),
            "name": "Prof. Ana Santos",
            "role": ROLE_INSTRUCTOR,
            "department_section": "IT Department",
            "avatar": "AS",
            "email": "ana.santos@acadsync.edu.ph",
            "phone": "+63 912 000 0004",
            "bio": "Database systems faculty.",
        },
        {
            "id": "STU24-00001",
            "password_hash": hash_password("student123"),
            "name": "Princess Grace Siervo",
            "role": ROLE_STUDENT,
            "department_section": "BSCS 1-A",
            "section_id": 1,
            "enrollment_status": "Regular",
            "avatar": "PS",
            "email": "princess.siervo@student.acadsync.edu.ph",
            "phone": "+63 912 000 0005",
            "bio": "4th year BSIT student, Dean's Lister.",
            "status": "Active",
        },
        {
            "id": "STU23-00002",
            "password_hash": hash_password("student456"),
            "name": "Juan Dela Cruz",
            "role": ROLE_STUDENT,
            "department_section": "BSCS 1-A",
            "section_id": 1,
            "enrollment_status": "Irregular",
            "avatar": "JD",
            "email": "juan.delacruz@student.acadsync.edu.ph",
            "phone": "+63 912 000 0006",
            "bio": "4th year BSIT student.",
            "status": "Active",
        },
        {
            "id": "STU22-00003",
            "password_hash": hash_password("student789"),
            "name": "Maria Clara",
            "role": ROLE_STUDENT,
            "department_section": "BSIT 2-B",
            "section_id": 2,
            "enrollment_status": "Dropped",
            "avatar": "MC",
            "email": "maria.clara@student.acadsync.edu.ph",
            "phone": "+63 912 000 0007",
            "bio": "2nd year BSIT student.",
            "status": "Active",
        },
    ]


def get_default_announcements():
    """Return default announcement records."""
    base_date = datetime.utcnow() - timedelta(days=7)
    return [
        {
            "author_id": "ADM-00001",
            "title": "Enrollment Period Extended",
            "body": "Late enrollment is now open until May 5, 2026. Visit the registrar for assistance.",
            "announcement_type": "CAMPUS",
            "color": "indigo",
            "target_audience": "ALL",
            "created_at": base_date + timedelta(days=0),
        },
        {
            "author_id": "ADM-00002",
            "title": "System Maintenance Tonight",
            "body": "AcadSync will be offline from 11PM to 2AM for scheduled maintenance.",
            "announcement_type": "URGENT",
            "color": "red",
            "target_audience": "ALL",
            "created_at": base_date + timedelta(days=0),
        },
        {
            "author_id": "ADM-00001",
            "title": "Faculty Meeting Reminder",
            "body": "All faculty members are required to attend the monthly meeting on April 28.",
            "announcement_type": "FACULTY",
            "color": "amber",
            "target_audience": "FACULTY",
            "created_at": base_date + timedelta(days=-1),
        },
        {
            "author_id": "ADM-00001",
            "title": "Midterm Grades Released",
            "body": "Check your student portal for updated grades. Contact your instructor for concerns.",
            "announcement_type": "ACADEMIC",
            "color": "emerald",
            "target_audience": "STUDENTS",
            "created_at": base_date + timedelta(days=-2),
        },
    ]


def get_default_messages():
    """Return default message records."""
    base_date = datetime.utcnow() - timedelta(days=7)
    return [
        {
            "from_id": "INS-00001",
            "to_id": "STU24-00001",
            "subject": "Re: Project Extension Request",
            "body": "I've approved your extension request. Please submit by Friday. Make sure to include all required documentation.",
            "is_read": False,
            "created_at": base_date + timedelta(days=0),
        },
        {
            "from_id": "ADM-00001",
            "to_id": "STU24-00001",
            "subject": "Document Ready for Pickup",
            "body": "Your Certificate of Registration is ready. Please visit the registrar office during business hours (8AM–5PM, Mon–Fri).",
            "is_read": True,
            "created_at": base_date + timedelta(days=-1),
        },
        {
            "from_id": "STU24-00001",
            "to_id": "INS-00001",
            "subject": "Project Extension Request",
            "body": "Good day, Prof. Lim. May I request a 3-day extension for the final project?",
            "is_read": True,
            "created_at": base_date + timedelta(days=-1),
        },
        {
            "from_id": "STU24-00001",
            "to_id": "ADM-00001",
            "subject": "Request for Certificate of Enrollment",
            "body": "Good day. I would like to request a Certificate of Enrollment for scholarship purposes.",
            "is_read": True,
            "created_at": base_date + timedelta(days=-2),
        },
    ]


def get_default_assignments():
    """Return default assignment records."""
    return [
        {
            "instructor_id": "INS-00001",
            "course_code": "IT401",
            "course_name": "Advanced Web Development",
            "title": "Final Project - E-Commerce Website",
            "description": "Build a fully functional e-commerce platform with cart and checkout features.",
            "due_date": datetime(2026, 4, 30, 23, 59, 59),
            "max_points": 100,
        },
        {
            "instructor_id": "INS-00002",
            "course_code": "IT402",
            "course_name": "Database Systems",
            "title": "SQL Optimization Lab",
            "description": "Optimize the given queries and document your approach. Include execution plans.",
            "due_date": datetime(2026, 4, 28, 23, 59, 59),
            "max_points": 50,
        },
    ]


def get_default_submissions():
    """Return default submission records (linked to assignment 2)."""
    return [
        {
            "assignment_id": 2,  # SQL Optimization Lab
            "student_id": "STU24-00001",
            "file_path": "uploads/submissions/STU24-00001_IT402_optimization_lab.pdf",
            "file_original_name": "optimization_lab.pdf",
            "grade": None,
            "submitted_at": datetime(2026, 4, 22, 10, 0, 0),
        },
    ]


def get_default_schedules():
    """Return default schedule records."""
    return [
        {
            "user_id": "INS-00001",
            "course_code": "IT401",
            "course_label": "Advanced Web Development",
            "day_of_week": "Monday",
            "start_time": "09:00",
            "end_time": "12:00",
            "room_location": "Lab 1",
            "section_or_instructor": "BSIT 2-B"
        },
        {
            "user_id": "INS-00002",
            "course_code": "IT402",
            "course_label": "Database Systems",
            "day_of_week": "Tuesday",
            "start_time": "13:00",
            "end_time": "16:00",
            "room_location": "Lab 2",
            "section_or_instructor": "BSCS 1-A"
        },
        {
            "user_id": "STU24-00001",
            "course_code": "IT402",
            "course_label": "Database Systems",
            "day_of_week": "Tuesday",
            "start_time": "13:00",
            "end_time": "16:00",
            "room_location": "Lab 2",
            "section_or_instructor": "Prof. Ana Santos"
        },
        {
            "user_id": "STU24-00001",
            "course_code": "IT401",
            "course_label": "Advanced Web Development",
            "day_of_week": "Monday",
            "start_time": "09:00",
            "end_time": "12:00",
            "room_location": "Lab 1",
            "section_or_instructor": "Prof. Michael Lim"
        }
    ]


def get_default_preferences():
    """Return default user preference records."""
    return [
        {"user_id": uid, "dark_mode": True, "accent_color": "indigo"}
        for uid in ["ADM-00001", "ADM-00002", "INS-00001", "INS-00002", "STU24-00001", "STU23-00002", "STU22-00003"]
    ]


def get_default_sections():
    """Return default section records."""
    return [
        {
            "id": 1,
            "name": "BSCS 1-A",
            "year_level": "1st Year",
            "status": "Active",
        },
        {
            "id": 2,
            "name": "BSIT 2-B",
            "year_level": "2nd Year",
            "status": "Active",
        },
        {
            "id": 3,
            "name": "BSCS 3-C",
            "year_level": "3rd Year",
            "status": "Inactive",
        }
    ]
