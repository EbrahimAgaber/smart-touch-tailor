const forge = require('node-forge');
const crypto = require('crypto');

// Generate a dummy cert to test parsing
const keys = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [{
  name: 'commonName',
  value: 'Test'
}];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

const pem = forge.pki.certificateToPem(cert);
console.log('PEM generated');

// Parse it back
const parsedCert = forge.pki.certificateFromPem(pem);
console.log('Parsed cert signature:');
// node-forge stores certificate signature as a binary string in cert.signature
const sigHex = forge.util.bytesToHex(parsedCert.signature);
const sigBase64 = forge.util.encode64(parsedCert.signature);
console.log('Hex:', sigHex.substring(0, 32) + '...');
console.log('Base64:', sigBase64.substring(0, 32) + '...');

// Get public key
const pubKey = crypto.createPublicKey(pem);
const pubKeyPem = pubKey.export({ type: 'spki', format: 'pem' });
console.log('Public key PEM:\n', pubKeyPem.substring(0, 80) + '...');
const pubKeyDer = pubKey.export({ type: 'spki', format: 'der' });
console.log('Public key DER Base64:', pubKeyDer.toString('base64').substring(0, 32) + '...');
