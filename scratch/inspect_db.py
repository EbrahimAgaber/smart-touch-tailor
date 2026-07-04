import sqlite3
import json
import os
import sys

# Configure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

db_paths = [
    'pos_data.db', 
    'pos.db',
    r'C:\Users\bin-g\AppData\Roaming\البصمة الذكية\pos_data.db'
]

for path in db_paths:
    print(f"================ INSPECTING {path} ================")
    if not os.path.exists(path):
        print(f"Path does not exist: {path}")
        continue
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check tables list
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row['name'] for row in cursor.fetchall()]
        print("Tables:", tables)
        
        if 'zatca_device' in tables:
            cursor.execute("SELECT * FROM zatca_device")
            devices = [dict(row) for row in cursor.fetchall()]
            for d in devices:
                # Truncate large certs for readability
                if d.get('private_key_pem'):
                    d['private_key_pem'] = d['private_key_pem'][:30] + '...'
                if d.get('production_csid'):
                    d['production_csid'] = d['production_csid'][:50] + '...'
                if d.get('production_cert_pem'):
                    d['production_cert_pem'] = d['production_cert_pem'][:30] + '...'
            print("zatca_device:")
            print(json.dumps(devices, indent=2, ensure_ascii=False))
            
        if 'business_settings' in tables:
            cursor.execute("SELECT key, value FROM business_settings WHERE key LIKE '%zatca%' OR key LIKE '%vat%' OR key LIKE '%company%' OR key LIKE '%name%' OR key = 'crn' OR key = 'store_address'")
            settings = [dict(row) for row in cursor.fetchall()]
            print("business_settings:")
            print(json.dumps(settings, indent=2, ensure_ascii=False))
            
        conn.close()
    except Exception as e:
        print(f"Error reading {path}: {e}")
