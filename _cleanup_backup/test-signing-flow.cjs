const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');

console.log('--- Environment ---');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron || 'N/A');
console.log('OpenSSL version:', process.versions.openssl);

const dummyCriDer = Buffer.from('dummy data to sign', 'utf8');
let privateKey;

if (!process.versions.electron) {
  // Generate key in Node.js
  const keys = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = keys.privateKey;
  fs.writeFileSync('temp_test_key.pem', privateKey);
  console.log('Generated key and saved to temp_test_key.pem');
} else {
  // Read key in Electron
  privateKey = fs.readFileSync('temp_test_key.pem', 'utf8');
  console.log('Read key from temp_test_key.pem. Length:', privateKey.length);
}

if (process.versions.electron) {
  console.log('\n--- Test 1: Sign.sign(pem) ---');
  try {
    const signer1 = crypto.createSign('SHA256');
    signer1.update(dummyCriDer);
    const sig1 = signer1.sign(privateKey);
    console.log('SUCCESS. Signature length:', sig1.length);
  } catch (err) {
    console.error('FAILED Test 1:', err.message);
  }

  console.log('\n--- Test 2: crypto.sign(alg, data, pem) ---');
  try {
    const sig2 = crypto.sign('SHA256', dummyCriDer, privateKey);
    console.log('SUCCESS. Signature length:', sig2.length);
  } catch (err) {
    console.error('FAILED Test 2:', err.message);
  }

  console.log('\n--- Test 3: Sign with KeyObject ---');
  try {
    const keyObj = crypto.createPrivateKey(privateKey);
    const signer3 = crypto.createSign('SHA256');
    signer3.update(dummyCriDer);
    const sig3 = signer3.sign(keyObj);
    const sig4 = crypto.sign('SHA256', dummyCriDer, keyObj);
    console.log('SUCCESS. Signature lengths:', sig3.length, sig4.length);
  } catch (err) {
    console.error('FAILED Test 3:', err.message);
  }

  console.log('\n--- Test 4: node-forge ECDSA ---');
  try {
    // node-forge does not support secp256k1 natively for signing without addons, but we can try its basic EC
    const md = forge.md.sha256.create();
    md.update(dummyCriDer.toString('binary'));
    const privateKeyForge = forge.pki.privateKeyFromPem(privateKey);
    const sig5 = privateKeyForge.sign(md);
    console.log('SUCCESS. Signature length:', sig5.length);
  } catch (err) {
    console.error('FAILED Test 4:', err.message);
  }
}

if (process.versions.electron) {
  const { app } = require('electron');
  app.quit();
}
