const crypto = require('crypto');
const forge = require('node-forge');
const EC = require('elliptic').ec;
const fs = require('fs');

const ec = new EC('secp256k1');

// Generate key in plain Node (to get a valid secp256k1 PKCS#8 PEM)
const keys = crypto.generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const payload = Buffer.from('test payload to sign', 'utf8');
fs.writeFileSync('payload.dat', payload);
fs.writeFileSync('pub.pem', keys.publicKey);

// --- Old Path: Native crypto.sign ---
const nativeSig = crypto.sign('SHA256', payload, keys.privateKey);
fs.writeFileSync('native.sig', nativeSig);

// --- New Path: Extraction via forge ASN.1 + elliptic ---
// 1. Extract raw D scalar using low-level ASN.1 walk
const msg = forge.pem.decode(keys.privateKey)[0];
const asn1Obj = forge.asn1.fromDer(msg.body);
// PKCS#8 PrivateKeyInfo.privateKey is value[2]
const ecPrivateKeyAsn1 = forge.asn1.fromDer(asn1Obj.value[2].value);
// ECPrivateKey.privateKey is value[1] (OCTET STRING)
const dBytes = ecPrivateKeyAsn1.value[1].value;
const dHex = forge.util.bytesToHex(dBytes);

// 2. Hash payload (native SHA-256 works in Electron)
const hash = crypto.createHash('sha256').update(payload).digest();

// 3. Sign using elliptic
const keyPair = ec.keyFromPrivate(dHex, 'hex');
// ZATCA expects standard DER-encoded signatures
const ellipticSigArray = keyPair.sign(hash).toDER();
const ellipticSig = Buffer.from(ellipticSigArray);
fs.writeFileSync('elliptic.sig', ellipticSig);

console.log('Test artifacts generated: pub.pem, native.sig, elliptic.sig, payload.dat');
