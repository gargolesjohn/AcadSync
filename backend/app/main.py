"""FastAPI application entry point."""

import os
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api.router import api_router
from app.models import *  # Import all models to register with Base


def seed_database():
    """Populate database with default data if empty."""
    from app.models.user import User
    from app.models.announcement import Announcement
    from app.models.message import Message
    from app.models.assignment import Assignment
    from app.models.submission import Submission
    from app.models.schedule import Schedule
    from app.models.user_preference import UserPreference
    from app.models.section import Section
    from app.seed.default_data import (
        get_default_users, get_default_announcements, get_default_messages,
        get_default_assignments, get_default_submissions, get_default_schedules,
        get_default_preferences, get_default_sections,
    )

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            print("[INFO] Seeding database with default data...")
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
            print("[OK] Database seeded successfully!")
        else:
            print("[INFO] Database already has data, skipping seed.")
    finally:
        db.close()


# Drop old attendance_records table if it doesn't have the upgraded schedule_id column
if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import inspect as sa_inspect, text
    inspector = sa_inspect(engine)
    if "attendance_records" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("attendance_records")}
        if "schedule_id" not in cols:
            print("[MIGRATE] Dropping old attendance_records table for upgraded schema...")
            with engine.connect() as conn:
                conn.execute(text("DROP TABLE attendance_records"))
                conn.commit()

# Create tables (only creates NEW tables, doesn't add columns to existing ones)
Base.metadata.create_all(bind=engine)

# Auto-migrate: add any missing columns to existing tables (SQLite only)
if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import inspect as sa_inspect, text
    inspector = sa_inspect(engine)
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name in inspector.get_table_names():
                existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(engine.dialect)
                        default_val = ""
                        if col.default is not None:
                            default_val = f" DEFAULT {col.default.arg!r}" if hasattr(col.default, 'arg') else ""
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_val}"
                        conn.execute(text(sql))
                        print(f"[MIGRATE] Added column {table_name}.{col.name} ({col_type})")
        conn.commit()

# Seed data
seed_database()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Campus Communication Hub API",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    from app.utils.websocket_manager import manager
    user_id = await manager.connect(websocket, token)
    if not user_id:
        return
    try:
        while True:
            # Keep client connection open, discard any incoming messages
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        manager.disconnect(user_id, websocket)


# --- Serve frontend static files in production ---
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    # Serve favicon and other root-level static files
    @app.get("/favicon.ico")
    @app.get("/favicon.svg")
    @app.get("/robots.txt")
    async def static_root_files(request: Request):
        file_name = request.url.path.lstrip("/")
        file_path = FRONTEND_DIST / file_name
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    # SPA catch-all: serve index.html for any non-API route
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API or docs routes
        if full_path.startswith("v1/") or full_path in ("docs", "redoc", "openapi.json"):
            return None
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "note": "Frontend not built. Run 'npm run build' in the frontend directory.",
        }
