import os
import sys

# Add the app directory to the path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.assignment import Assignment

def main():
    db = SessionLocal()
    try:
        a4 = db.query(Assignment).filter(Assignment.id == 4).first()
        a5 = db.query(Assignment).filter(Assignment.id == 5).first()
        print(f"Assignment 4: {a4.title}, Course: {a4.course_name}, Code: {a4.course_code}")
        print(f"Assignment 5: {a5.title}, Course: {a5.course_name}, Code: {a5.course_code}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
