import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT csr_pem FROM zatca_device WHERE id=1")
    row = cursor.fetchone()
    if row and row[0]:
        with open('scratch/csr.pem', 'w', encoding='utf-8') as f:
            f.write(row[0])
        print("Wrote CSR to scratch/csr.pem")
    else:
        print("No CSR found in database!")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
