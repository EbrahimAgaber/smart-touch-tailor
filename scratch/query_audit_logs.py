import sqlite3
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = r'C:\Users\bin-g\AppData\Roaming\البصمة الذكية\pos_data.db'

if not os.path.exists(db_path):
    print("Database path not found")
    sys.exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get schema of audit_logs
cursor.execute("PRAGMA table_info(audit_logs)")
columns = [row['name'] for row in cursor.fetchall()]
print("audit_logs columns:", columns)

# Get some rows that contain onboarding or errors
cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50")
rows = [dict(row) for row in cursor.fetchall()]
for r in rows:
    print(r)

conn.close()
