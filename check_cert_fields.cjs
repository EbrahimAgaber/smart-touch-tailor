const crypto = require('crypto');
const fs = require('fs');
const forge = require('node-forge');

const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
const db = require('better-sqlite3')(dbPath);
const device = db.prepare('SELECT production_cert_pem FROM zatca_device LIMIT 1').get();

let safeCert = device.production_cert_pem;
if (safeCert.includes('BEGIN PKCS7')) {
    let cleanB64 = safeCert.replace(/-----BEGIN PKCS7-----/g, '').replace(/-----END PKCS7-----/g, '').replace(/[\r\n\s]/g, '').trim();
    const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(cleanB64, 'base64').toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Obj);
    const innerDer = forge.asn1.toDer(p7.certificates[0]).getBytes();
    const x509B64 = Buffer.from(innerDer, 'binary').toString('base64');
    safeCert = `-----BEGIN CERTIFICATE-----\n${x509B64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
}

const x509Obj = new crypto.X509Certificate(safeCert);
console.log("NATIVE ISSUER:", x509Obj.issuer);
console.log("NATIVE SERIAL HEX:", x509Obj.serialNumber);
console.log("NATIVE SERIAL DEC:", BigInt(`0x${x509Obj.serialNumber}`).toString(10));
