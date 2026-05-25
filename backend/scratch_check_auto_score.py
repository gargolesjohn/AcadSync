import os
import sys
import json

# Add the app directory to the path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.api.grades import get_automated_activities_score

def main():
    db = SessionLocal()
    try:
        score, details = get_automated_activities_score(db, "STU24-00001", "System Software Design")
        print(f"Score: {score}")
        print(f"Details: {json.dumps(details, indent=2)}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
