import sys
import os
from datetime import datetime

# Ensure we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.schedule import Schedule
from app.models.user import User

def add_test_schedule():
    db = SessionLocal()
    try:
        # Create for Prof Lim
        prof_sched = Schedule(
            user_id="INS-00001",
            course_code="IT-TEST",
            course_label="Software Engineering (Test)",
            day_of_week="Sunday",
            start_time="13:00",
            end_time="16:00",
            room_location="Room 101",
            section_or_instructor="BSCS 1-A"
        )
        db.add(prof_sched)
        
        # Create for Student
        stu_sched = Schedule(
            user_id="STU24-00001",
            course_code="IT-TEST",
            course_label="Software Engineering (Test)",
            day_of_week="Sunday",
            start_time="13:00",
            end_time="16:00",
            room_location="Room 101",
            section_or_instructor="Prof. Michael Lim"
        )
        db.add(stu_sched)
        
        db.commit()
        print("Successfully added test schedules for Sunday.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_test_schedule()
