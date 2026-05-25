"""Application constants."""

# Roles
ROLE_ADMIN = "admin"
ROLE_INSTRUCTOR = "instructor"
ROLE_PROGRAM_HEAD = "program_head"
ROLE_REGISTRAR = "registrar"
ROLE_STUDENT = "student"

ALL_ROLES = [ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_REGISTRAR, ROLE_STUDENT]

# Announcement targets
TARGET_ALL = "ALL"
TARGET_STUDENTS = "STUDENTS"
TARGET_FACULTY = "FACULTY"

# Announcement types and their colors
ANNOUNCEMENT_TYPE_COLORS = {
    "ACADEMIC": "emerald",
    "URGENT": "red",
    "CAMPUS": "indigo",
    "FACULTY": "amber",
}

VALID_ANNOUNCEMENT_TYPES = list(ANNOUNCEMENT_TYPE_COLORS.keys())
VALID_TARGETS = [TARGET_ALL, TARGET_STUDENTS, TARGET_FACULTY]
VALID_ACCENT_COLORS = ["indigo", "violet", "rose", "teal", "amber"]
