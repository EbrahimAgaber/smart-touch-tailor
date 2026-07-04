const fs = require('fs');
const db = require('better-sqlite3')('C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db');
const device = db.prepare('SELECT production_cert_pem FROM zatca_device LIMIT 1').get();
fs.writeFileSync('C:\\my-pos\\v2\\cert_dump.txt', device.production_cert_pem);
process.exit(0);
