import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Restore original production values
    cursor.execute("UPDATE business_settings SET value='production' WHERE key='zatca_env'")
    cursor.execute("UPDATE business_settings SET value='311167090900003' WHERE key='vat_number'")
    cursor.execute("UPDATE business_settings SET value='مؤسسة ابراهيم سالم بن عوده البلوي للمقاولات العامة' WHERE key='business_name_ar'")
    conn.commit()
    print("Database settings successfully restored to live Production values!")

    # Verify
    cursor.execute("SELECT key, value FROM business_settings WHERE key IN ('zatca_env', 'vat_number', 'business_name_ar')")
    for key, val in cursor.fetchall():
        print(f"Verified setting - {key}: {val}")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
