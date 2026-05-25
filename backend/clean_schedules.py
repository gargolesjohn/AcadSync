import os
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.schedule import Schedule
from app.models.user import User

def clean_schedules():
    db = SessionLocal()
    try:
        # Find all schedules
        all_schedules = db.query(Schedule).all()
        
        count = len(all_schedules)
        if count == 0:
            print("No schedules found to clean.")
        else:
            for s in all_schedules:
                db.delete(s)
            db.commit()
            print(f"Successfully deleted {count} schedules.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_schedules()
