from sqlalchemy import create_engine, text, inspect as sa_inspect
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.section import Section
from app.security import hash_password

def migrate_and_fix():
    # 1. Force add missing columns
    inspector = sa_inspect(engine)
    with engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name in inspector.get_table_names():
                existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                for col in table.columns:
                    if col.name not in existing_cols:
                        try:
                            col_type = col.type.compile(engine.dialect)
                            sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"
                            conn.execute(text(sql))
                            print(f"Added column {table_name}.{col.name}")
                        except Exception as e:
                            print(f"Failed to add {col.name}: {e}")
        conn.commit()

    # 2. Fix admin
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == "ADM-00001").first()
        if admin:
            admin.password_hash = hash_password("admin123")
            admin.is_active = True
            admin.status = "Active"
            db.commit()
            print("Admin ADM-00001 fixed with password 'admin123'")
        else:
            print("Admin not found, seeding...")
            from app.seed.default_data import get_default_users, get_default_sections
            for s in get_default_sections():
                db.add(Section(**s))
            db.commit()
            for u in get_default_users():
                db.add(User(**u))
            db.commit()
            print("Database seeded with default users.")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_and_fix()
