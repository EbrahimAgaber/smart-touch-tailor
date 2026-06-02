const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

function hashPin(pin) {
    return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
}

// Try to find the database in the common location
const userDataPath = path.join(process.env.APPDATA, 'البصمة الذكية');
const dbPath = path.join(userDataPath, 'pos_data.db');

console.log('Checking database at:', dbPath);

try {
    const db = new Database(dbPath);
    const staff = db.prepare('SELECT id, name, role, pin FROM staff').all();
    console.log('Staff count:', staff.length);
    
    staff.forEach(s => {
        const pin4 = "1234";
        const pin0 = "0000";
        const hashed4 = hashPin(pin4);
        const hashed0 = hashPin(pin0);
        
        console.log(`User: ${s.name} (${s.role})`);
        console.log(`  Stored PIN: ${s.pin}`);
        if (s.pin === hashed4) console.log(`  MATCHES 1234`);
        if (s.pin === hashed0) console.log(`  MATCHES 0000`);
    });
} catch (e) {
    console.error('Error:', e.message);
}
