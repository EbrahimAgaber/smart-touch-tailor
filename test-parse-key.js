const forge = require('node-forge');
const crypto = require('crypto');

const keys = crypto.generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const msg = forge.pem.decode(keys.privateKey)[0];
const asn1Obj = forge.asn1.fromDer(msg.body);
const ecPrivateKeyAsn1 = forge.asn1.fromDer(asn1Obj.value[2].value);
const dBytes = ecPrivateKeyAsn1.value[1].value;
const dHex = forge.util.bytesToHex(dBytes);

console.log('Extracted D (hex):', dHex);
console.log('Length:', dHex.length);
