const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
const db = require('better-sqlite3')(dbPath);

const vatNumber = '311354901300003';
const businessName = 'بوفية نهر الكنوز للوجبات السريعة';

const stmt = db.prepare('UPDATE business_settings SET value = ? WHERE key = ?');

// Use transaction for safe multi-update
db.transaction(() => {
    // If keys don't exist, this might do nothing depending on schema, but usually it exists.
    // Let's do INSERT OR REPLACE or check first.
    
    // Check and update/insert VAT
    const hasVat = db.prepare('SELECT 1 FROM business_settings WHERE key = "vat_number"').get();
    if (hasVat) {
        db.prepare('UPDATE business_settings SET value = ? WHERE key = "vat_number"').run(vatNumber);
    } else {
        db.prepare('INSERT INTO business_settings (key, value) VALUES (?, ?)').run('vat_number', vatNumber);
    }
    
    // Check and update/insert business_name_ar
    const hasName = db.prepare('SELECT 1 FROM business_settings WHERE key = "business_name_ar"').get();
    if (hasName) {
        db.prepare('UPDATE business_settings SET value = ? WHERE key = "business_name_ar"').run(businessName);
    } else {
        db.prepare('INSERT INTO business_settings (key, value) VALUES (?, ?)').run('business_name_ar', businessName);
    }
})();

console.log('Database business settings updated successfully.');
console.log('VAT Number:', vatNumber);
console.log('Business Name:', businessName);
