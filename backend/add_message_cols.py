import sqlite3

try:
    conn = sqlite3.connect('acadsync.db')
    cursor = conn.cursor()
    cursor.execute('ALTER TABLE messages ADD COLUMN is_unsent BOOLEAN DEFAULT 0')
    conn.commit()
    print("Successfully added is_unsent column.")
except Exception as e:
    print("Error:", e)
finally:
    if conn:
        conn.close()
