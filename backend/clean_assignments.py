import os
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.assignment import Assignment
from app.models.submission import Submission

def clean_assignments():
    db = SessionLocal()
    try:
        # Delete all submissions first due to foreign key constraints
        all_submissions = db.query(Submission).all()
        sub_count = len(all_submissions)
        for s in all_submissions:
            db.delete(s)
            
        # Delete all assignments
        all_assignments = db.query(Assignment).all()
        ass_count = len(all_assignments)
        for a in all_assignments:
            db.delete(a)
            
        db.commit()
        print(f"Successfully deleted {sub_count} submissions and {ass_count} assignments.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_assignments()
