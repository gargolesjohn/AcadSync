import sqlite3

try:
    conn = sqlite3.connect('acadsync.db')
    conn.execute("ALTER TABLE grades ADD COLUMN activities_data VARCHAR DEFAULT '[]'")
    conn.commit()
    conn.close()
    print("Column added successfully")
except Exception as e:
    print("Error:", e)
