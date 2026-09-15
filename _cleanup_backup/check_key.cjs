const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  const device = db.prepare('SELECT csid_cert_pem, production_cert_pem, production_api_secret, csid_private_key FROM zatca_device LIMIT 1').get() || {};
  console.log('PrivateKey:', device.production_api_secret || device.csid_private_key ? (device.production_api_secret || device.csid_private_key).substring(0, 50) + '...' : 'NONE');
  process.exit(0);
});
