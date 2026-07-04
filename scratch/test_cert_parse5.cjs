const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken.replace(/\s+/g, '');

const derBuffer = Buffer.from(token, 'base64');
const forge = require('node-forge');

let offset = 0;
let certIndex = 1;
const derString = derBuffer.toString('binary');

while (offset < derString.length) {
    try {
        // false = non-strict mode, returns the first ASN.1 object and ignores the rest
        const asn1 = forge.asn1.fromDer(derString.substring(offset), false);
        const cert = forge.pki.certificateFromAsn1(asn1);
        console.log(`\n--- Certificate ${certIndex} ---`);
        console.log("Issuer:", cert.issuer.attributes.map(a => a.value).join(', '));
        console.log("Subject:", cert.subject.attributes.map(a => a.value).join(', '));
        console.log("Serial:", BigInt('0x' + cert.serialNumber).toString(10));
        
        // Find how many bytes this certificate took
        const certDerLength = forge.asn1.toDer(asn1).length();
        offset += certDerLength;
        certIndex++;
    } catch (e) {
        console.error(`Error parsing at offset ${offset}:`, e.message);
        break;
    }
}
