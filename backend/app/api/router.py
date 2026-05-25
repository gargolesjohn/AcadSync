"""Main API router aggregating all endpoint routers."""

from fastapi import APIRouter
from app.api import auth, users, messages, announcements, assignments, submissions, schedules, preferences, admin, courses, grades, attendance

api_router = APIRouter(prefix="/v1")

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(messages.router, prefix="/messages", tags=["Messages"])
api_router.include_router(announcements.router, prefix="/announcements", tags=["Announcements"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["Assignments"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["Submissions"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["Preferences"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(courses.router, prefix="/courses", tags=["Courses"])
api_router.include_router(grades.router, prefix="/grades", tags=["Grades"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])