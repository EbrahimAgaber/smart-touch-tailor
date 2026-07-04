const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;

const crypto = require('crypto');
try {
    const derBuffer = Buffer.from(token, 'base64');
    const x509 = new crypto.X509Certificate(derBuffer);
    console.log("X509Certificate with DER Buffer SUCCESS!");
    console.log("Issuer:", x509.issuer);
    console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
} catch (e) {
    console.error("DER Buffer parse failed:", e.message);
}
