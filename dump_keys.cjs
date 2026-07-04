const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  const device = db.prepare('SELECT production_cert_pem, production_api_secret, csid_cert_pem FROM zatca_device LIMIT 1').get() || {};
  require('fs').writeFileSync('test_cert.pem', device.production_cert_pem || '');
  require('fs').writeFileSync('test_key.pem', device.production_api_secret || device.csid_cert_pem || '');
  console.log('Wrote cert and key');
  process.exit(0);
});
