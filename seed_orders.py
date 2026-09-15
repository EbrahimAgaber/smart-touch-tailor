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
cur.execute('SELECT id, name, price FROM products WHERE price > 0')
products = cur.fetchall()

cur.execute('SELECT id FROM customers')
customers = [row[0] for row in cur.fetchall()]
customers.append(None) # Allow for walk-in customers

cur.execute('SELECT id FROM staff')
staff_list = [row[0] for row in cur.fetchall()]
if not staff_list:
    staff_list = [1]

payment_methods = ['cash', 'card', 'bank']
order_types = ['counter', 'delivery', 'pickup']

print(f"Creating 20 real case scenarios...")

for i in range(1, 21):
    # Randomize time within the last 7 days
    days_ago = random.randint(0, 7)
    hours_ago = random.randint(0, 23)
    mins_ago = random.randint(0, 59)
    ts = datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=mins_ago)
    timestamp_str = ts.strftime('%Y-%m-%d %H:%M:%S')

    invoice_number = f"TEST-INV-{int(ts.timestamp())}-{i}"
    my_uuid = str(uuid.uuid4())
    
    customer_id = random.choice(customers)
    staff_id = random.choice(staff_list)
    payment_method = random.choice(payment_methods)
    order_type = random.choice(order_types)
    
    # Pick 1 to 5 random items
    num_items = random.randint(1, 5)
    selected_items = random.choices(products, k=num_items)
    
    subtotal = 0.0
    items_data = []
    
    for p in selected_items:
        p_id, p_name, p_price = p
        qty = random.randint(1, 3)
        item_total = p_price * qty
        subtotal += item_total
        items_data.append({
            'product_id': p_id,
            'name': p_name,
            'price': p_price,
            'qty': qty
        })
        
    tax_rate = 0.15 # Assuming 15% VAT for KSA/ZATCA
    tax_amount = round(subtotal * tax_rate, 2)
    total_amount = round(subtotal + tax_amount, 2)
    
    # Insert Sale
    cur.execute('''
        INSERT INTO sales (
            invoice, timestamp, total_amount, subtotal, tax_amount, discount, 
            payment_method, paid, change_amount, status, order_type, uuid, 
            zatca_status, customer_id, staff_id, sync_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        invoice_number, timestamp_str, total_amount, subtotal, tax_amount, 0,
        payment_method, total_amount, 0, 'paid', order_type, my_uuid,
        'pending', customer_id, staff_id, my_uuid, int(ts.timestamp() * 1000)
    ))
    
    sale_id = cur.lastrowid
    
    # Insert Sale Items
    for item in items_data:
        cur.execute('''
            INSERT INTO sales_items (
                sale_id, product_id, item_name, item_price, quantity, modifiers_json, sync_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            sale_id, item['product_id'], item['name'], item['price'], item['qty'], '[]', str(uuid.uuid4()), int(ts.timestamp() * 1000)
        ))

conn.commit()
print("Successfully inserted 20 simulated orders with real data.")
conn.close()
