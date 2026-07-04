const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken.replace(/\s+/g, '');

const pkcs7Pem = `-----BEGIN PKCS7-----\n${(token.match(/.{1,64}/g) || []).join('\n')}\n-----END PKCS7-----`;

const forge = require('node-forge');
try {
    const p7 = forge.pkcs7.messageFromPem(pkcs7Pem);
    console.log("PKCS7 parse SUCCESS!");
    console.log("Certificates found:", p7.certificates.length);
    
    if (p7.certificates.length > 0) {
        const cert = p7.certificates[0]; // Leaf certificate is usually first
        const certPem = forge.pki.certificateToPem(cert);
        
        const crypto = require('crypto');
        const x509 = new crypto.X509Certificate(certPem);
        console.log("X509 extraction SUCCESS!");
        console.log("Issuer:", x509.issuer);
        console.log("Serial:", BigInt('0x' + x509.serialNumber.replace(/:/g, '')).toString(10));
    }
} catch (e) {
    console.error("PKCS7 parse failed:", e.message);
}
