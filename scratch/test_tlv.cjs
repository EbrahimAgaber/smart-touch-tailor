const forge = require('node-forge');
const { generateZatcaTLV9, extractCertDetails } = require('../electron/zatca_phase2.cjs');

const seller = 'مؤسسة تجارية';
const vatNo = '300000000000003';
const timestamp = '2026-06-30T16:06:54Z';
const total = 115.00;
const vatAmt = 15.00;

// Fake base64 for testing lengths
const xmlHash = Buffer.alloc(32, 1).toString('base64');
const ecdsaSig = Buffer.alloc(70, 2).toString('base64');
const pubKeyPem = '-----BEGIN PUBLIC KEY-----\n' + Buffer.alloc(91, 3).toString('base64') + '\n-----END PUBLIC KEY-----';
const certSignature = Buffer.alloc(70, 4).toString('base64');

console.log('Lengths:');
console.log('Tag 6 (Hash):', Buffer.from(xmlHash, 'base64').length);
console.log('Tag 7 (Sig):', Buffer.from(ecdsaSig, 'base64').length);
console.log('Tag 8 (PubKey):', Buffer.alloc(91, 3).length);
console.log('Tag 9 (CertSig):', Buffer.from(certSignature, 'base64').length);

const tlv = generateZatcaTLV9(seller, vatNo, timestamp, total, vatAmt, xmlHash, ecdsaSig, pubKeyPem, certSignature);
console.log("QR Base64:", tlv);
console.log("QR Buffer length:", Buffer.from(tlv, 'base64').length);
