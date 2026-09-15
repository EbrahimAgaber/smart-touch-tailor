import sqlite3

db_path = r"C:\Users\bin-g\AppData\Roaming\البصمة الذكية\pos_data.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

vat_number = '311354901300003'
business_name = 'بوفية نهر الكنوز للوجبات السريعة'

# Check and update VAT
cursor.execute("SELECT 1 FROM business_settings WHERE key = 'vat_number'")
if cursor.fetchone():
    cursor.execute("UPDATE business_settings SET value = ? WHERE key = 'vat_number'", (vat_number,))
else:
    cursor.execute("INSERT INTO business_settings (key, value) VALUES (?, ?)", ('vat_number', vat_number))

# Check and update Business Name
cursor.execute("SELECT 1 FROM business_settings WHERE key = 'business_name_ar'")
if cursor.fetchone():
    cursor.execute("UPDATE business_settings SET value = ? WHERE key = 'business_name_ar'", (business_name,))
else:
    cursor.execute("INSERT INTO business_settings (key, value) VALUES (?, ?)", ('business_name_ar', business_name))

conn.commit()
conn.close()

print("Database business settings updated successfully.")
print(f"VAT Number: {vat_number}")
print(f"Business Name: {business_name}")
