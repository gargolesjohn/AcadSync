from app.database import SessionLocal
from app.models.course import Course

def seed_courses():
    db = SessionLocal()
    courses = [
        {"code": "PROG1", "name": "Programming 1"},
        {"code": "DB1", "name": "Database Management"},
        {"code": "WEB1", "name": "Web Development"},
        {"code": "NET1", "name": "Networking"},
        {"code": "OS1", "name": "Operating Systems"},
        {"code": "DSA1", "name": "Data Structures & Algorithms"},
    ]
    
    for c in courses:
        existing = db.query(Course).filter(Course.code == c["code"]).first()
        if not existing:
            db.add(Course(**c))
    
    db.commit()
    print("Courses seeded successfully!")
    db.close()

if __name__ == "__main__":
    seed_courses()
