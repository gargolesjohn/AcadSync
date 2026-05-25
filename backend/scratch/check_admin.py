from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
try:
    user = db.query(User).filter(User.id == "ADM-00001").first()
    if user:
        print(f"ID: {user.id}")
        print(f"Name: {user.name}")
        print(f"Role: {user.role}")
        print(f"Is Active: {user.is_active}")
        print(f"Status: {user.status}")
    else:
        print("Admin user not found.")
finally:
    db.close()
