import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
print("Connecting to database at:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("UPDATE business_settings SET value='sandbox' WHERE key='zatca_env'")
    conn.commit()
    print("Successfully updated zatca_env to 'sandbox' in business_settings!")

    cursor.execute("SELECT key, value FROM business_settings WHERE key='zatca_env'")
    row = cursor.fetchone()
    print(f"Current database setting - {row[0]}: {row[1]}")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
