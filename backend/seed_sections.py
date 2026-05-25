from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.user import User
from app.models.section import Section
from app.security import hash_password

def seed_sections():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Section).first():
            return

        # 1. BSCS 1-A (1st Year, Active)
        sec1 = Section(name="BSCS 1-A", year_level="1st Year", status="Active")
        db.add(sec1)
        db.flush()

        # 2. BSIT 2-B (2nd Year, Active)
        sec2 = Section(name="BSIT 2-B", year_level="2nd Year", status="Active")
        db.add(sec2)
        db.flush()

        # 3. BSCS 3-C (3rd Year, Inactive)
        sec3 = Section(name="BSCS 3-C", year_level="3rd Year", status="Inactive")
        db.add(sec3)
        db.flush()

        # Update some students
        students = db.query(User).filter(User.role == "student").limit(10).all()
        
        # BSCS 1-A (Regular and Irregular)
        for i, s in enumerate(students[:4]):
            s.section_id = sec1.id
            s.department_section = sec1.name
            s.enrollment_status = "Regular" if i % 2 == 0 else "Irregular"
        
        # BSIT 2-B (include one Dropped)
        for i, s in enumerate(students[4:7]):
            s.section_id = sec2.id
            s.department_section = sec2.name
            s.enrollment_status = "Dropped" if i == 0 else "Regular"
            
        # BSCS 3-C (all Regular)
        for s in students[7:10]:
            s.section_id = sec3.id
            s.department_section = sec3.name
            s.enrollment_status = "Regular"

        db.commit()
        print("Sample sections seeded successfully!")
    except Exception as e:
        print(f"Error seeding sections: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_sections()
