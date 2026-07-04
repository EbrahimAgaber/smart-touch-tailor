const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken.replace(/\s+/g, '');

const buf = Buffer.from(token, 'base64');
console.log("Total Buffer Length:", buf.length);

if (buf[0] !== 0x30) {
    console.log("Not an ASN.1 Sequence! First byte:", buf[0]);
    process.exit(1);
}

let length = 0;
let headerSize = 2;

if (buf[1] & 0x80) {
    const numBytes = buf[1] & 0x7F;
    headerSize += numBytes;
    for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | buf[2 + i];
    }
} else {
    length = buf[1];
}

const totalCertSize = headerSize + length;
console.log("Extracted ASN.1 Sequence Length:", totalCertSize);

if (buf.length > totalCertSize) {
    console.log("Garbage/Extra bytes detected at the end! Truncating...");
}

const cleanCertBuf = buf.slice(0, totalCertSize);
const cleanBase64 = cleanCertBuf.toString('base64');
const cleanPem = `-----BEGIN CERTIFICATE-----\n${(cleanBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

const crypto = require('crypto');
try {
    const x509 = new crypto.X509Certificate(cleanPem);
    console.log("X.509 Parse SUCCESS!");
    console.log("Issuer:", x509.issuer);
    console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
} catch (e) {
    console.log("X.509 Parse Failed:", e.message);
}
