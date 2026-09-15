import sqlite3

db_path = r"C:\Users\bin-g\AppData\Roaming\البصمة الذكية\pos_data.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== DEVICE ===")
cursor.execute("SELECT * FROM zatca_device LIMIT 1")
device = cursor.fetchone()
if device:
    for key in device.keys():
        print(f"{key}: {device[key]}")
else:
    print("No device found")

print("\n=== SETTINGS ===")
cursor.execute("SELECT * FROM business_settings LIMIT 1")
settings = cursor.fetchone()
if settings:
    for key in settings.keys():
        print(f"{key}: {settings[key]}")
else:
    print("No settings found")
