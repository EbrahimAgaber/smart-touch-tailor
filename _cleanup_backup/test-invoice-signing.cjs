const fs = require('fs');
const path = require('path');
const zatca = require('./electron/zatca_phase2.cjs');

console.log('--- Environment ---');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron || 'N/A');

async function run() {
  try {
    const privateKey = fs.readFileSync('temp_test_key.pem', 'utf8');
    const dummyCert = '-----BEGIN CERTIFICATE-----\nMIID...dummy\n-----END CERTIFICATE-----';
    
    // Very simple dummy invoice that has <ext:UBLExtensions> to pass injectUBLExtensions check
    const dummyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions></ext:UBLExtensions>
  <cbc:ID>1</cbc:ID>
</Invoice>`;

    console.log('\n--- Testing signInvoiceXML inside Electron ---');
    try {
      const result = zatca.signInvoiceXML(dummyXml, privateKey, dummyCert, new Date().toISOString());
      console.log('SUCCESS! Signature:', result.signatureBase64);
    } catch (err) {
      console.error('FAILED signInvoiceXML:', err.message);
    }

    console.log('\n--- Testing crypto.createHash(sha256) inside Electron ---');
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update('test', 'utf8').digest('hex');
      console.log('SUCCESS! SHA256 works. Hash:', hash);
    } catch (err) {
      console.error('FAILED SHA256:', err.message);
    }

  } catch (e) {
    console.error('FATAL:', e.message);
  }

  if (process.versions.electron) {
    const { app } = require('electron');
    app.quit();
  }
}

run();
