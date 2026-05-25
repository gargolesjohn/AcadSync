import requests

BASE_URL = "http://localhost:8000/v1"
# We need a token. I'll use the ADM-00001 user.
# But I don't want to deal with login in a script if I can avoid it.
# I'll just check the backend logic again.

import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.section import Section
from app.models.user import User

db = SessionLocal()
sections = db.query(Section).all()
for s in sections:
    print(f"Section: {s.name}")
    print(f"  Courses: {[c.name for c in s.courses]}")
    print(f"  Instructors: {[i.name for i in s.instructors]}")
db.close()
