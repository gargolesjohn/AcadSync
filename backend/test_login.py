import bcrypt
from app.database import SessionLocal
from app.models.user import User

def test_login():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == "ADM-00001").first()
        if not user:
            print("User ADM-00001 not found.")
            return
        
        pwd = "admin123"
        is_valid = bcrypt.checkpw(pwd.encode('utf-8'), user.password_hash.encode('utf-8'))
        print(f"User: {user.id}")
        print(f"Hash in DB: {user.password_hash}")
        print(f"Testing password: {pwd}")
        print(f"Is valid: {is_valid}")
    finally:
        db.close()

if __name__ == "__main__":
    test_login()
