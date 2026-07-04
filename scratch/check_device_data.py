import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, device_id, csr_pem, compliance_csid, production_csid FROM zatca_device")
    rows = cursor.fetchall()
    print("--- ZATCA DEVICE DATA ---")
    for r in rows:
        print(f"ID: {r[0]}")
        print(f"Device ID: {r[1]}")
        print(f"CSR: {r[2][:100] if r[2] else 'NULL'}...")
        print(f"Compliance CSID: {r[3]}")
        print(f"Production CSID: {r[4]}")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
