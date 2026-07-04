const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);

  const queue = db.prepare('SELECT signed_xml FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
  if (queue && queue.signed_xml) {
    const xml = queue.signed_xml;
    // Extract CompanyID (VAT Number)
    const vatMatch = xml.match(/<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/);
    console.log("XML CompanyID (VAT):", vatMatch ? vatMatch[1] : 'Not found');
    
    // Extract Certificate
    const certMatch = xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
    const certStr = certMatch ? certMatch[1] : null;
    if (certStr) {
      console.log("XML Embedded Cert Prefix:", certStr.substring(0, 50));
      try {
        const crypto = require('crypto');
        const x509 = new crypto.X509Certificate(Buffer.from(certStr, 'base64'));
        console.log("Cert Subject:", x509.subject);
        console.log("Cert Issuer:", x509.issuer);
        console.log("Cert Serial:", BigInt('0x'+x509.serialNumber).toString(10));
      } catch(e) {
        console.log("Failed to parse embedded cert:", e.message);
      }
    } else {
      console.log("No embedded certificate found");
    }
  } else {
    console.log("NO QUEUE ITEM");
  }
  process.exit(0);
});
