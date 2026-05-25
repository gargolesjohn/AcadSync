import sqlite3
import os

db_path = "acadsync.db"

if not os.path.exists(db_path):
    print("Database not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Get all records
    cursor.execute("SELECT id, student_id, attendance_date, created_at, schedule_id, status FROM attendance_records")
    records = cursor.fetchall()
    
    # Drop old table
    cursor.execute("DROP TABLE attendance_records")
    
    # Recreate table with new constraint
    cursor.execute("""
    CREATE TABLE attendance_records ( 
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,  
        student_id VARCHAR(20) NOT NULL, 
        schedule_id INTEGER NOT NULL,
        attendance_date DATE NOT NULL, 
        status VARCHAR(20) DEFAULT 'Pending' NOT NULL, 
        created_at DATETIME, 
        CONSTRAINT _student_date_schedule_uc UNIQUE (student_id, attendance_date, schedule_id), 
        FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY(schedule_id) REFERENCES schedules (id) ON DELETE CASCADE
    )
    """)
    
    # Insert records back
    for r in records:
        # r: id, student_id, attendance_date, created_at, schedule_id, status
        # Note: schedule_id might have been NULL in some very old schema, but we set it to NOT NULL now.
        sched_id = r[4] if r[4] is not None else 1
        stat = r[5] if r[5] is not None else 'Pending'
        cursor.execute(
            "INSERT INTO attendance_records (id, student_id, schedule_id, attendance_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (r[0], r[1], sched_id, r[2], stat, r[3])
        )
    
    # Recreate indexes
    cursor.execute("CREATE INDEX idx_attendance_student_id ON attendance_records (student_id)")
    cursor.execute("CREATE INDEX idx_attendance_date ON attendance_records (attendance_date)")
    cursor.execute("CREATE INDEX idx_attendance_schedule_id ON attendance_records (schedule_id)")
    
    conn.commit()
    print("Successfully migrated attendance_records table.")

except Exception as e:
    print(f"Error during migration: {e}")
    conn.rollback()

finally:
    conn.close()
