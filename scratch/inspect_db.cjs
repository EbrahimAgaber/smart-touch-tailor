const Database = require('better-sqlite3');
const dbPath = 'pos_data.db';

try {
    const db = new Database(dbPath);
    console.log("--- zatca_device ---");
    const device = db.prepare("SELECT * FROM zatca_device").all();
    console.log(JSON.stringify(device, null, 2));

    console.log("\n--- business_settings (ZATCA keys) ---");
    const settings = db.prepare("SELECT * FROM business_settings WHERE key LIKE '%zatca%' OR key LIKE '%vat%' OR key LIKE '%company%' OR key LIKE '%name%' OR key = 'crn' OR key = 'store_address'").all();
    console.log(JSON.stringify(settings, null, 2));
} catch (err) {
    console.error("Error reading database:", err);
}
