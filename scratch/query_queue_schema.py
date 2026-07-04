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

# Get schema of zatca_queue
cursor.execute("PRAGMA table_info(zatca_queue)")
columns = [row['name'] for row in cursor.fetchall()]
print("zatca_queue columns:", columns)

# Get some rows
cursor.execute("SELECT * FROM zatca_queue ORDER BY id DESC LIMIT 5")
rows = [dict(row) for row in cursor.fetchall()]
for r in rows:
    # Truncate signed_xml for display
    if r.get('signed_xml'):
        r['signed_xml'] = r['signed_xml'][:50] + '...'
    print(r)

conn.close()
