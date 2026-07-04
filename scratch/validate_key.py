import sqlite3
import os
import sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

sys.stdout.reconfigure(encoding='utf-8')

db_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\pos_data.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT private_key_pem FROM zatca_device WHERE id=1")
    row = cursor.fetchone()
    if not row or not row[0]:
        print("No private key found in database!")
        exit(1)
    
    key_pem = row[0]
    print("Found key in DB.")
    
    # Load private key
    priv_key = serialization.load_pem_private_key(key_pem.encode('utf-8'), password=None)
    print("Successfully loaded private key using cryptography library.")
    print("Curve name:", priv_key.curve.name)
    
    # Generate public key
    pub_key = priv_key.public_key()
    pub_pem = pub_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    print("Generated public key PEM successfully.")

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
