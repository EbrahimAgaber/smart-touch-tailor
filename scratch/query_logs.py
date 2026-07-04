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

print("--- RECENT AUDIT LOGS ---")
try:
    cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50")
    logs = [dict(row) for row in cursor.fetchall()]
    for log in logs:
        print(f"[{log.get('created_at')}] {log.get('action')}: {log.get('message')}")
except Exception as e:
    print("Error reading audit_logs:", e)

print("\n--- ZATCA QUEUE RECENT ITEMS ---")
try:
    cursor.execute("SELECT id, sale_id, invoice_number, status, error_message, updated_at FROM zatca_queue ORDER BY id DESC LIMIT 20")
    queue = [dict(row) for row in cursor.fetchall()]
    for q in queue:
        print(f"ID: {q['id']}, Sale: {q['sale_id']}, Inv: {q['invoice_number']}, Status: {q['status']}, Updated: {q['updated_at']}")
        if q['error_message']:
            print(f"  Error: {q['error_message']}")
except Exception as e:
    print("Error reading zatca_queue:", e)

conn.close()
