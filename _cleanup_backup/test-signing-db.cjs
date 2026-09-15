const crypto = require('crypto');
const forge = require('node-forge');
const Database = require('better-sqlite3');
const path = require('path');

// Assuming the DB is at pos_data.db in userData dir, but we can query the app data or just use the local pos_data.db if it exists.
// The user said there is pos_data.db. Let's try to load it.
let dbPath = path.join(__dirname, 'pos_data_backup.db');

console.log('--- Environment ---');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron || 'N/A');
console.log('OpenSSL version:', process.versions.openssl);
console.log('DB Path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT private_key_pem FROM zatca_device LIMIT 1').get();
  if (!row || !row.private_key_pem) {
    throw new Error("No private key found in zatca_device table.");
  }
  
  const privateKey = row.private_key_pem;
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
