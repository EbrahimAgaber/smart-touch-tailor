const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'البصمة الذكية');
const dbPath = path.join(userDataPath, 'pos_data.db');
console.log('Connecting to database at:', dbPath);

const db = new Database(dbPath);

try {
    const settings = db.prepare('SELECT * FROM settings').all();
    console.log('--- SETTINGS ---');
    settings.forEach(s => {
        console.log(`${s.key}: ${s.value}`);
    });

    const devices = db.prepare('SELECT * FROM zatca_devices').all();
    console.log('--- ZATCA DEVICES ---');
    devices.forEach(d => {
        console.log({
            id: d.id,
            device_id: d.device_id,
            csr_pem: d.csr_pem ? 'PRESENT' : 'NULL',
            compliance_csid: d.compliance_csid ? 'PRESENT' : 'NULL',
            production_csid: d.production_csid ? 'PRESENT' : 'NULL',
            private_key_pem: d.private_key_pem ? 'PRESENT' : 'NULL',
        });
        if (d.private_key_pem) {
            console.log('Private Key Start:', d.private_key_pem.substring(0, 50));
        }
    });
} catch (err) {
    console.error('Error reading DB:', err);
} finally {
    db.close();
}
