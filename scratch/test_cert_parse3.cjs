const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;

const buffer = Buffer.from(token, 'base64');
const str = buffer.toString('utf8');

console.log("Decoded string starts with:");
console.log(str.substring(0, 100));

const forge = require('node-forge');
try {
    const cert = forge.pki.certificateFromPem(str);
    console.log("Parsed via forge as PEM!");
    console.log("Issuer:", cert.issuer.attributes.map(a => a.value).join(', '));
    console.log("Serial:", BigInt('0x' + cert.serialNumber).toString(10));
} catch (e) {
    console.log("Forge PEM parse failed:", e.message);
    try {
        const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
        const cert = forge.pki.certificateFromAsn1(asn1);
        console.log("Parsed via forge as raw ASN.1/DER!");
        console.log("Issuer:", cert.issuer.attributes.map(a => a.value).join(', '));
        console.log("Serial:", BigInt('0x' + cert.serialNumber).toString(10));
    } catch(e2) {
        console.log("Forge DER parse failed:", e2.message);
    }
}
