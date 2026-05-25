from sqlalchemy import inspect as sa_inspect
from app.database import engine

inspector = sa_inspect(engine)
columns = [c["name"] for c in inspector.get_columns("users")]
print(f"Columns in 'users' table: {columns}")

if "enrollment_status" not in columns:
    print("MISSING: enrollment_status")
if "section_id" not in columns:
    print("MISSING: section_id")
if "status" not in columns:
    print("MISSING: status")
