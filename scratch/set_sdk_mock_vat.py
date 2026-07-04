import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Update settings to ZATCA SDK standard mock VAT number
    cursor.execute("UPDATE business_settings SET value='300075585600003' WHERE key='vat_number'")
    conn.commit()
    print("Updated database VAT number to ZATCA SDK mock: 300075585600003")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
