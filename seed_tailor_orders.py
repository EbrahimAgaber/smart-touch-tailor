import sqlite3
import random
import uuid
import datetime
import json

db_path = 'C:/Users/bin-g/AppData/Roaming/البصمة الذكية/pos_data.db'
conn = sqlite3.connect(db_path)
conn.create_function("gen_uuid", 0, lambda: str(uuid.uuid4()))
cur = conn.cursor()

# Fetch baseline data
cur.execute('SELECT id FROM customers WHERE id IS NOT NULL')
customers = [row[0] for row in cur.fetchall()]
if not customers:
    # Create a dummy customer if none
    cur.execute("INSERT INTO customers (name, phone) VALUES ('عميل تفصيل', '0500000000')")
    customers.append(cur.lastrowid)

cur.execute('SELECT id FROM staff')
staff_list = [row[0] for row in cur.fetchall()]
if not staff_list:
    staff_list = [1]
    
cur.execute('SELECT id FROM products WHERE is_fabric = 1 OR category = "أقمشة"')
fabrics = [row[0] for row in cur.fetchall()]
if not fabrics:
    # If no fabrics, fallback to regular products
    cur.execute('SELECT id FROM products')
    fabrics = [row[0] for row in cur.fetchall()]

if not fabrics:
    cur.execute("INSERT INTO products (name, price, is_fabric) VALUES ('قماش ياباني', 50, 1)")
    fabrics = [cur.lastrowid]

print(f"Creating 20 Tailor Case scenarios...")

payment_methods = ['cash', 'card']
order_statuses = ['pending', 'in_progress', 'ready', 'delivered']
stages = ['measuring', 'cutting', 'sewing', 'fitting', 'ready']
garment_types = ['ثوب عادي', 'ثوب كويتي', 'ثوب قطري', 'عباية', 'بدلة']

for i in range(1, 21):
    # Randomize time within the last 7 days
    days_ago = random.randint(0, 14)
    hours_ago = random.randint(0, 23)
    mins_ago = random.randint(0, 59)
    ts = datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=mins_ago)
    timestamp_str = ts.strftime('%Y-%m-%d %H:%M:%S')
    
    target_date = ts + datetime.timedelta(days=random.randint(3, 10))
    target_date_str = target_date.strftime('%Y-%m-%d %H:%M:%S')

    invoice_number = f"TLR-INV-{int(ts.timestamp())}-{i}"
    my_uuid = str(uuid.uuid4())
    
    customer_id = random.choice(customers)
    staff_id = random.choice(staff_list)
    payment_method = random.choice(payment_methods)
    
    # 1. Ensure Measurement Profile exists
    garment_type = random.choice(garment_types)
    cur.execute('SELECT id FROM measurement_profiles WHERE customer_id = ? AND garment_type = ?', (customer_id, garment_type))
    profile = cur.fetchone()
    if not profile:
        measurements = {
            "الطول": random.randint(140, 170),
            "الكتف": random.randint(40, 55),
            "الصدر": random.randint(45, 65),
            "الكم": random.randint(55, 65),
            "الرقبة": random.randint(35, 45)
        }
        cur.execute('''
            INSERT INTO measurement_profiles (customer_id, garment_type, measurements_json, status, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (customer_id, garment_type, json.dumps(measurements, ensure_ascii=False), 'complete', timestamp_str))
        profile_id = cur.lastrowid
    else:
        profile_id = profile[0]

    # Calculate Totals
    num_garments = random.randint(1, 4)
    fabric_id = random.choice(fabrics)
    price_per_garment = random.choice([150, 200, 250, 300])
    subtotal = num_garments * price_per_garment
    tax_rate = 0.15
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount, 2)
    
    deposit_paid = random.choice([0, total_amount / 2, total_amount])
    balance_due = total_amount - deposit_paid
    status = random.choice(order_statuses)
    
    # 2. Insert into `sales` to represent the invoice
    cur.execute('''
        INSERT INTO sales (
            invoice, timestamp, total_amount, subtotal, tax_amount, discount, 
            payment_method, paid, change_amount, status, order_type, uuid, 
            zatca_status, customer_id, staff_id, sync_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        invoice_number, timestamp_str, total_amount, subtotal, tax_amount, 0,
        payment_method, deposit_paid, 0, 'paid' if balance_due == 0 else 'partial', 
        'tailor', my_uuid, 'pending', customer_id, staff_id, my_uuid, int(ts.timestamp() * 1000)
    ))
    sale_id = cur.lastrowid
    
    # Insert Sale Item
    cur.execute('''
        INSERT INTO sales_items (
            sale_id, product_id, item_name, item_price, quantity, modifiers_json, sync_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        sale_id, fabric_id, f"تفصيل {garment_type}", price_per_garment, num_garments, '[]', str(uuid.uuid4()), int(ts.timestamp() * 1000)
    ))

    # 3. Insert into `tailor_orders`
    cur.execute('''
        INSERT INTO tailor_orders (
            customer_id, sale_invoice_id, order_date, target_delivery_date, 
            total_amount, deposit_paid, balance_due, status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        customer_id, sale_id, timestamp_str, target_date_str,
        total_amount, deposit_paid, balance_due, status, f"Test tailor order {i}"
    ))
    tailor_order_id = cur.lastrowid
    
    # 4. Insert Garments
    for g in range(num_garments):
        stage = 'ready' if status == 'ready' or status == 'delivered' else random.choice(stages)
        cur.execute('''
            INSERT INTO tailor_order_garments (
                tailor_order_id, garment_type, measurement_profile_id, fabric_id, production_stage, assigned_tailor_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            tailor_order_id, garment_type, profile_id, fabric_id, stage, staff_id
        ))

conn.commit()
print("Successfully generated 20 Tailor Orders with full workflow mapping (Sales, Measurements, Tailor Orders, Garments).")
conn.close()
