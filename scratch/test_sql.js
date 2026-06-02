const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
    CREATE TABLE staff (
        id INTEGER PRIMARY KEY,
        name TEXT,
        role TEXT,
        pin TEXT
    )
`);

db.prepare('INSERT INTO staff (name, role, pin) VALUES (?,?,?)').run('Admin User', 'Admin', 'old-pin');
db.prepare('INSERT INTO staff (name, role, pin) VALUES (?,?,?)').run('Cashier User', 'Cashier', 'old-pin');

try {
    const admin = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
    console.log('Admin found:', admin);
    
    const cashier = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
    console.log('Cashier found:', cashier);
    
    if (admin && cashier) {
        console.log('SUCCESS: Queries executed correctly and found the users.');
    } else {
        console.log('FAILURE: Users not found.');
    }
} catch (e) {
    console.error('SQL Error:', e.message);
}
