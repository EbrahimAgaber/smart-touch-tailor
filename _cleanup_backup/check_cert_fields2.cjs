const crypto = require('crypto');
const fs = require('fs');

const certPem = fs.readFileSync('C:\\my-pos\\v2\\cert_dump.txt', 'utf8');

let cleanB64 = certPem.replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/[\r\n\s]/g, '')
    .trim();

try {
    const decodedStr = Buffer.from(cleanB64, 'base64').toString('utf8');
    if (decodedStr.startsWith('MII')) {
        cleanB64 = decodedStr;
    }
} catch (e) {}

let x509Obj;
try {
    x509Obj = new crypto.X509Certificate(Buffer.from(cleanB64, 'base64'));
} catch (err) {
    const forge = require('node-forge');
    const asn1Obj = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(cleanB64, 'base64').toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1Obj);
    const innerDer = forge.asn1.toDer(p7.certificates[0]).getBytes();
    x509Obj = new crypto.X509Certificate(Buffer.from(innerDer, 'binary'));
}

const issuerArr = x509Obj.issuer.split('\n').reverse();
const issuerName = issuerArr.join(', ');
let serialNumber = x509Obj.serialNumber;
if (serialNumber.includes(':')) {
    serialNumber = serialNumber.replace(/:/g, '');
}
const serialDec = BigInt('0x' + serialNumber).toString(10);

console.log("IssuerName:", issuerName);
console.log("SerialNumber:", serialDec);
