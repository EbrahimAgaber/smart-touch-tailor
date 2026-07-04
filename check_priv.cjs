const { app } = require('electron');
const fs = require('fs');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  const device = db.prepare('SELECT private_key_pem FROM zatca_device LIMIT 1').get();
  fs.writeFileSync('C:\\my-pos\\v2\\priv_key_check.txt', device.private_key_pem);
  process.exit(0);
});
