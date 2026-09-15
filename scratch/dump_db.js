const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
const db = require('better-sqlite3')(dbPath);
const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get();
console.log("=== DEVICE ===");
console.log(device);
console.log("=== SETTINGS ===");
console.log(settings);
