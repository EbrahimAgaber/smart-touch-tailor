import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in cursor.fetchall()]

    if 'business_settings' in tables:
        cursor.execute("SELECT key, value FROM business_settings")
        settings = cursor.fetchall()
        print("\n--- BUSINESS SETTINGS ---")
        for key, val in settings:
            print(f"{key}: {val}")
    
    if 'zatca_device' in tables:
        cursor.execute("SELECT id, device_id, csr_pem, compliance_csid, production_csid, private_key_pem FROM zatca_device")
        devices = cursor.fetchall()
        print("\n--- ZATCA DEVICE ---")
        for d in devices:
            print({
                'id': d[0],
                'device_id': d[1],
                'csr_pem': 'PRESENT' if d[2] else 'NULL',
                'compliance_csid': 'PRESENT' if d[3] else 'NULL',
                'production_csid': 'PRESENT' if d[4] else 'NULL',
                'private_key_pem': 'PRESENT' if d[5] else 'NULL',
            })
            if d[2]:
                print('CSR PEM:\n', d[2])

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
