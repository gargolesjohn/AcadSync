import os
import sys

# Ensure the backend directory is in the path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import sqlite3
import pymysql
from sqlalchemy import create_engine, text
from app.database import Base
from app.models import *  # This registers all models with Base

def migrate():
    # 1. Connect to MySQL server to create the database if it doesn't exist
    print("[1/4] Checking MySQL server connection...")
    try:
        conn = pymysql.connect(host='127.0.0.1', user='root', password='')
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS acadsync")
        conn.commit()
        conn.close()
        print("[OK] MySQL server is running and 'acadsync' database is ready.")
    except Exception as e:
        print("[ERROR] Could not connect to MySQL server on localhost.")
        print("Please ensure your MySQL server (e.g. XAMPP) is running and accessible with 'root' user (no password).")
        print(f"Error details: {e}")
        return

    # 2. Setup engines
    print("[2/4] Setting up database engines...")
    sqlite_url = "sqlite:///./backend/acadsync.db"
    mysql_url = "mysql+pymysql://root:@127.0.0.1:3306/acadsync"

    sqlite_engine = create_engine(sqlite_url)
    mysql_engine = create_engine(mysql_url)

    # 3. Create tables in MySQL
    print("[3/4] Creating tables in MySQL...")
    Base.metadata.create_all(bind=mysql_engine)

    # 4. Migrate data
    print("[4/4] Migrating data from SQLite to MySQL...")

    try:
        with mysql_engine.begin() as mysql_conn:
            mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
            
            with sqlite_engine.connect() as sqlite_conn:
                for table in Base.metadata.sorted_tables:
                    print(f"  -> Migrating table '{table.name}'...")
                    
                    mysql_conn.execute(table.delete())
                    
                    rows = sqlite_conn.execute(table.select()).fetchall()
                    
                    if rows:
                        # Fetch column names to convert to dicts properly
                        keys = sqlite_conn.execute(table.select()).keys()
                        dicts = [dict(zip(keys, row)) for row in rows]
                        mysql_conn.execute(table.insert(), dicts)
                        
                    print(f"     Migrated {len(rows)} records.")
                    
            mysql_conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
        
        print("\n[SUCCESS] Migration completed successfully! All accounts and data are now in MySQL.")
        print("You can now run 'start_acadsync.bat' to start the application using MySQL.")
        
    except Exception as e:
        print(f"\n[ERROR] An error occurred during data migration: {e}")
    finally:
        sqlite_engine.dispose()
        mysql_engine.dispose()

if __name__ == "__main__":
    migrate()
