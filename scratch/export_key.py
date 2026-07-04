import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT private_key_pem FROM zatca_device WHERE id=1")
    row = cursor.fetchone()
    if row and row[0]:
        with open('scratch/privkey.pem', 'w', encoding='utf-8') as f:
            f.write(row[0])
        print("Wrote private key to scratch/privkey.pem")
    else:
        print("No private key found!")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
