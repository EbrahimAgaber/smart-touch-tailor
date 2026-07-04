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

# Get rows where status is not legacy_pre_onboarding and not pre_onboarding, or zatca_response_json is not null
cursor.execute("SELECT id, sale_id, invoice_number, status, zatca_response_json, warning_messages FROM zatca_queue WHERE zatca_response_json IS NOT NULL OR status NOT IN ('pre_onboarding', 'legacy_pre_onboarding')")
rows = [dict(row) for row in cursor.fetchall()]
print(f"Found {len(rows)} matching rows:")
for r in rows:
    print(r)

conn.close()
