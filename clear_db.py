import sqlite3

db_path = 'pos_data.db'
print(f"Using DB at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM zatca_queue")
    print(f"Cleared zatca_queue. Rows affected: {cursor.rowcount}")
    
    cursor.execute("UPDATE sales SET zatca_status = 'pending' WHERE zatca_status != 'pending'")
    print(f"Reset sales zatca_status. Rows affected: {cursor.rowcount}")
    
    conn.commit()
    conn.close()
    print("Database cleared successfully.")
except Exception as e:
    print(f"Error clearing DB: {e}")
