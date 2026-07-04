import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Update settings for Sandbox testing
    cursor.execute("UPDATE business_settings SET value='310000000000003' WHERE key='vat_number'")
    cursor.execute("UPDATE business_settings SET value='Test Sandbox Company' WHERE key='business_name_ar'")
    cursor.execute("UPDATE business_settings SET value='Test Sandbox Company' WHERE key='business_name_en'")
    conn.commit()
    print("Updated database settings to ZATCA Sandbox defaults!")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
