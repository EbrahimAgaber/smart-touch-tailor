import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Set settings to standard ZATCA Sandbox profile values
    cursor.execute("UPDATE business_settings SET value='sandbox' WHERE key='zatca_env'")
    cursor.execute("UPDATE business_settings SET value='300075585600003' WHERE key='vat_number'")
    cursor.execute("UPDATE business_settings SET value='Maximum Speed Tech Supply LTD' WHERE key='business_name_ar'")
    cursor.execute("UPDATE business_settings SET value='Maximum Speed Tech Supply LTD' WHERE key='business_name_en'")
    conn.commit()
    print("Database updated to official ZATCA Sandbox testing parameters!")

    # Verify
    cursor.execute("SELECT key, value FROM business_settings WHERE key IN ('zatca_env', 'vat_number', 'business_name_ar')")
    for key, val in cursor.fetchall():
        print(f"Setting - {key}: {val}")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
