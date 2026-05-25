from sqlalchemy import inspect as sa_inspect
from app.database import engine

inspector = sa_inspect(engine)
tables = inspector.get_table_names()
print(f"Tables in DB: {tables}")

for table in ["sections", "courses", "section_instructors", "section_courses"]:
    if table in tables:
        cols = [c["name"] for c in inspector.get_columns(table)]
        print(f"Table '{table}' columns: {cols}")
    else:
        print(f"MISSING TABLE: {table}")
