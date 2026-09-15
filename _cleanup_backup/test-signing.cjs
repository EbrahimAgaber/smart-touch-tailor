const crypto = require('crypto');
const forge = require('node-forge');

console.log('--- Environment ---');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron || 'N/A');
console.log('OpenSSL version:', process.versions.openssl);

try {
  // Generate secp256k1 key
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const dummyCriDer = Buffer.from('dummy data to sign', 'utf8');

  console.log('\n--- Test 1: Sign.sign(pem) ---');
  try {
    const signer1 = crypto.createSign('SHA256');
    signer1.update(dummyCriDer);
    const sig1 = signer1.sign(privateKey);
    console.log('SUCCESS. Signature length:', sig1.length);
  } catch (err) {
    console.error('FAILED:', err.message);
  }

  console.log('\n--- Test 2: crypto.sign(alg, data, pem) ---');
  try {
    const sig2 = crypto.sign('SHA256', dummyCriDer, privateKey);
    console.log('SUCCESS. Signature length:', sig2.length);
  } catch (err) {
    console.error('FAILED:', err.message);
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
    console.error('FAILED:', err.message);
  }

  console.log('\n--- Test 4: node-forge ECDSA ---');
  try {
    const md = forge.md.sha256.create();
    md.update(dummyCriDer.toString('binary'));
    const privateKeyForge = forge.pki.privateKeyFromPem(privateKey);
    // Note: node-forge has limited ECDSA support depending on version. Let's try.
    const sig5 = privateKeyForge.sign(md);
    console.log('SUCCESS. Signature length:', sig5.length);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
} catch (e) {
  console.error('FATAL:', e.message);
}

if (process.versions.electron) {
  const { app } = require('electron');
  app.quit();
}
