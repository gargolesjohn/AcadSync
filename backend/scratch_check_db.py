import os
import sys

# Add the app directory to the path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.submission import Submission
from app.models.assignment import Assignment
from app.models.grade import Grade

def main():
    db = SessionLocal()
    try:
        # Check submissions for student STU24-00001
        print("--- Submissions for STU24-00001 ---")
        submissions = db.query(Submission).filter(Submission.student_id == "STU24-00001").all()
        for s in submissions:
            a = db.query(Assignment).filter(Assignment.id == s.assignment_id).first()
            a_title = a.title if a else "Unknown"
            print(f"ID: {s.id}, Assignment: {a_title}, Grade: {s.grade}")
            
        print("\n--- Grades for STU24-00001 ---")
        grades = db.query(Grade).filter(Grade.student_id == "STU24-00001").all()
        for g in grades:
            print(f"Subject: {g.subject}, Activities Data: {g.activities_data}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
