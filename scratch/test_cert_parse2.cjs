const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken.replace(/\s+/g, '');

const compCertPem = `-----BEGIN CERTIFICATE-----\n${(token.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const crypto = require('crypto');
try {
    const x509 = new crypto.X509Certificate(compCertPem);
    console.log("PEM parse SUCCESS");
    console.log("Issuer:", x509.issuer);
    console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
} catch (e) {
    console.error("PEM parse failed:", e.message);
}
