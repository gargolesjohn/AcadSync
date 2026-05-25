import sys
import os
from datetime import datetime

# Ensure we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.models.schedule import Schedule
from app.seed.default_data import get_default_assignments, get_default_submissions, get_default_schedules

def restore_data():
    db = SessionLocal()
    try:
        # Check if already restored
        count_assign = db.query(Assignment).count()
        count_sched = db.query(Schedule).count()
        
        if count_assign == 0:
            print("Restoring assignments...")
            for a_data in get_default_assignments():
                a = Assignment(**a_data)
                db.add(a)
            db.flush()
            
            print("Restoring submissions...")
            for s_data in get_default_submissions():
                s = Submission(**s_data)
                db.add(s)
            
        if count_sched == 0:
            print("Restoring schedules...")
            for s_data in get_default_schedules():
                s = Schedule(**s_data)
                db.add(s)
                
        db.commit()
        print("Successfully restored dummy data.")
    except Exception as e:
        print(f"Error restoring data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    restore_data()
