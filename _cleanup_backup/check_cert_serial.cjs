const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  const device = db.prepare('SELECT production_cert_pem FROM zatca_device LIMIT 1').get();
  
  const crypto = require('crypto');
  const x509 = new crypto.X509Certificate(Buffer.from(device.production_cert_pem));
  
  console.log("DB CERT ISSUER:", x509.issuer);
  console.log("DB CERT SERIAL HEX:", x509.serialNumber);
  console.log("DB CERT SERIAL DEC:", BigInt(`0x${x509.serialNumber}`).toString(10));
  process.exit(0);
});
