const { app } = require('electron');
app.whenReady().then(() => {
  const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
  const db = require('better-sqlite3')(dbPath);
  
  const device = db.prepare('SELECT id, production_cert_pem FROM zatca_device LIMIT 1').get();
  if (!device) {
    console.log("No device found");
    process.exit(0);
  }

  function fixCert(certStr) {
    if (!certStr) return null;
    let cleanB64 = String(certStr).replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/-----BEGIN PKCS7-----/g, '').replace(/-----END PKCS7-----/g, '').replace(/[\r\n\s]/g, '').trim();
    
    // Handle double base64
    try {
        const decodedStr = Buffer.from(cleanB64, 'base64').toString('utf8');
        if (decodedStr.includes('BEGIN')) {
            cleanB64 = decodedStr.replace(/-----BEGIN[^-]+-----/g, '').replace(/-----END[^-]+-----/g, '').replace(/[\r\n\s]/g, '').trim();
        } else if (decodedStr.startsWith('MII')) {
            cleanB64 = decodedStr;
        }
    } catch(e) {}

    // Check if it's already a valid X.509
    const crypto = require('crypto');
    try {
      new crypto.X509Certificate(Buffer.from(cleanB64, 'base64'));
      console.log("ALREADY VALID X509");
      return null;
    } catch(e) {
      const forge = require('node-forge');
      const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(cleanB64, 'base64').toString('binary')));
      const p7 = forge.pkcs7.messageFromAsn1(asn1Obj);
      const innerDer = forge.asn1.toDer(p7.certificates[0]).getBytes();
      const x509B64 = Buffer.from(innerDer, 'binary').toString('base64');
      return `-----BEGIN CERTIFICATE-----\n${x509B64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
    }
  }

  const fixedProd = fixCert(device.production_cert_pem);
  
  if (fixedProd) {
    db.prepare('UPDATE zatca_device SET production_cert_pem = ? WHERE id = ?').run(
      fixedProd,
      device.id
    );
    console.log("FIXED CERTS IN DB");
  } else {
    console.log("No fixes applied");
  }

  process.exit(0);
});
