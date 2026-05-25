import os
import sys
import json

# Add the app directory to the path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.grade import Grade

def main():
    db = SessionLocal()
    try:
        grades = db.query(Grade).all()
        for g in grades:
            try:
                acts = json.loads(g.activities_data)
                if isinstance(acts, list) and len(acts) > 0:
                    # Filter out manual acts that don't have IDs but were mistakenly saved as assignments
                    # We can just check if they are "System design" or "Design System" etc.
                    # Actually, if we just clear all activities_data for everyone, it might be safer
                    # since manual acts feature was just added and probably has no real data.
                    # Or we only filter out ones without an ID.
                    new_acts = [a for a in acts if 'id' in a]
                    if len(new_acts) != len(acts):
                        print(f"Cleaning grade {g.id} activities data")
                        g.activities_data = json.dumps(new_acts)
                        db.add(g)
            except:
                pass
        db.commit()
        print("Done cleaning activities data.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
