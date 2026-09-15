const fs = require('fs');
const path = require('path');
const db = require('./electron/database.cjs');

console.log('--- TEST ONBOARDING CHAIN ---');

// Initialize DB
const testDbDir = path.join(__dirname, 'test_db');
if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir);
db.initDatabase(testDbDir);

// 1. Mock DB state to pre-onboarding
const device = db.getZatcaDevice();
if (!device) {
    db.getDbInstance().prepare('INSERT INTO zatca_device (device_id, private_key_pem) VALUES (?, ?)').run('POS-TEST', 'PHASE1_NO_KEY');
}

// Ensure settings exist
db.getDbInstance().prepare("INSERT OR IGNORE INTO business_settings (key, value) VALUES ('zatca_mode', 'phase2')").run();

// 2. Create a pre-onboarding invoice
console.log('Creating pre-onboarding invoice...');
const preSale = db.saveSale({
    total: 115, subtotal: 100, tax: 15,
    invoice: 'PRE-001',
    payment: 'Cash'
});
console.log('Pre-onboarding sale result:', preSale);

// Check ICV
const preDevice = db.getZatcaDevice();
console.log('Device ICV after pre-onboarding sale:', preDevice.current_icv); // Should be 0

// Check Queue
const queueCountPre = db.getDbInstance().prepare('SELECT count(*) as c FROM zatca_queue').get().c;
console.log('zatca_queue count after pre-onboarding sale:', queueCountPre); // Should be 0

// 3. Onboard (Mock production CSID)
console.log('Mocking onboarding...');
db.updateZatcaDevice({
    id: preDevice.id,
    production_csid: 'mock_csid',
    production_cert_pem: 'mock_cert',
    private_key_pem: 'mock_key'
});

// 4. Create a production invoice
console.log('Creating production invoice...');
const prodSale = db.saveSale({
    total: 115, subtotal: 100, tax: 15,
    invoice: 'PROD-001',
    payment: 'Cash'
});
console.log('Production sale result:', prodSale);

// Check ICV
const prodDevice = db.getZatcaDevice();
console.log('Device ICV after production sale:', prodDevice.current_icv); // Should be 1

// Check PIH
const prodQueue = db.getDbInstance().prepare('SELECT * FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
console.log('Production sale hash_chain (genesis hash expected):', prodQueue.xml_hash);
console.log('Device last_pih after production sale:', prodDevice.last_pih);

console.log('--- TEST FINISHED ---');
