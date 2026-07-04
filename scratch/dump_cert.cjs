const forge = require('node-forge');
const fs = require('fs');
const db = require('../electron/database.cjs');
db.initDatabase(require('path').join(process.env.APPDATA, 'البصمة الذكية'));
const device = db.getZatcaDevice();
const compCsid = JSON.parse(device.compliance_csid);
const token = compCsid.binarySecurityToken;
const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
const certPem = '-----BEGIN CERTIFICATE-----\n' + (innerBase64.match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----';

fs.writeFileSync('scratch/cert.pem', certPem);

const certDer = Buffer.from(innerBase64, 'base64');
const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(certDer.toString('binary')));
const signatureValue = asn1Obj.value[2];
let rawBytes = signatureValue.value;
if (typeof rawBytes === 'string') {
    rawBytes = Buffer.from(rawBytes, 'binary');
}
console.log("node-forge signature bytes (hex):", rawBytes.toString('hex'));
if (rawBytes[0] === 0x00) {
    console.log("node-forge signature bytes sliced (hex):", rawBytes.slice(1).toString('hex'));
}
