const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;

console.log("Token length:", token.length);

const compCertPem = `-----BEGIN CERTIFICATE-----\n${(token.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
console.log("PEM:\n" + compCertPem.substring(0, 100) + "...");

const crypto = require('crypto');
try {
    const x509 = new crypto.X509Certificate(compCertPem);
    console.log("PEM parse SUCCESS");
    console.log("Issuer:", x509.issuer);
    console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
} catch (e) {
    console.error("PEM parse failed:", e.message);
    // Let's try raw DER if PEM fails
    try {
        const derBuffer = Buffer.from(token, 'base64');
        const x509Der = new crypto.X509Certificate(derBuffer);
        console.log("DER parse SUCCESS");
        console.log("Issuer:", x509Der.issuer);
        console.log("Serial:", BigInt('0x' + x509Der.serialNumber.replace(/:/g, '')).toString(10));
    } catch (e2) {
        console.error("DER parse failed:", e2.message);
    }
}
