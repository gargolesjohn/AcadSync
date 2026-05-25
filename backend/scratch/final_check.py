import requests

# We need to simulate a login to get a token.
# But I can just check the backend code one more time.

import sys
sys.path.append('.')
from app.database import SessionLocal
from app.models.section import Section

db = SessionLocal()
sections = db.query(Section).all()
for s in sections:
    print(f"Section ID: {s.id}, Name: {s.name}")
    print(f"  Courses: {[c.name for c in s.courses]}")
    print(f"  Instructors: {[i.name for i in s.instructors]}")
db.close()
