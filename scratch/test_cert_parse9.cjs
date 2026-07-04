const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;

// The token from ZATCA is base64 encoded base64 string!
// Decode the first layer of base64 to get the actual inner base64 certificate string
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
console.log("Inner Base64 starts with:", innerBase64.substring(0, 10));

// Now construct a proper PEM from the inner base64 string
const cleanPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const crypto = require('crypto');
try {
    const x509 = new crypto.X509Certificate(cleanPem);
    console.log("X.509 Parse SUCCESS!");
    console.log("Issuer:", x509.issuer);
    console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
} catch (e) {
    console.log("X.509 Parse Failed:", e.message);
}
