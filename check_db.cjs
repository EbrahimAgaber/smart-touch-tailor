const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  console.log("Using DB:", dbPath);
  const db = require('better-sqlite3')(dbPath);
  const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get() || {};
  const settings = db.prepare('SELECT * FROM business_settings LIMIT 1').get() || {};
  const queue = db.prepare('SELECT * FROM zatca_queue ORDER BY id DESC LIMIT 1').get();

  console.log("=== VAT NUMBER ===");
  console.log(settings.vat_number);

  console.log("\n=== DEVICE CERT ===");
  if (device.production_cert_pem) {
      console.log(device.production_cert_pem.substring(0, 100) + '\n...\n' + device.production_cert_pem.substring(device.production_cert_pem.length - 100));
      console.log("\nTotal length:", device.production_cert_pem.length);
      console.log("Contains extra spaces/newlines:", /^\s|\s$/.test(device.production_cert_pem));
  } else {
      console.log('NO CERT');
  }

  console.log("\n=== QUEUE XML ===");
  if (queue) {
    const xml = queue.signed_xml || '';
    const match = xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
    console.log("Embedded Cert Hash/Prefix:", match ? match[1].substring(0, 100) : 'Not found');
  } else {
    console.log("NO QUEUE");
  }

  process.exit(0);
});
