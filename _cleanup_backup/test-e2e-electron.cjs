// Test full generateCSR + generateDeviceKeyPair inside Electron
// This exercises the full broken path that was failing with DECODE_ERROR
const zatca = require('./electron/zatca_phase2.cjs');
const crypto = require('crypto');

console.log('--- Environment ---');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron || 'N/A');
console.log('OpenSSL version:', process.versions.openssl);

async function run() {
    console.log('\n--- Test: generateDeviceKeyPair ---');
    let keys;
    try {
        // NOTE: This calls crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' })
        // which itself may fail in Electron's BoringSSL
        keys = zatca.generateDeviceKeyPair();
        console.log('SUCCESS. Private key PEM length:', keys.privateKeyPem.length);
        console.log('Public key PEM length:', keys.publicKeyPem.length);
    } catch(e) {
        console.error('FAILED generateDeviceKeyPair:', e.message);
        if (process.versions.electron) { require('electron').app.quit(); }
        return;
    }

    console.log('\n--- Test: generateCSR (the call that was previously DECODE_ERROR) ---');
    try {
        const result = zatca.generateCSR(keys.privateKeyPem, keys.publicKeyPem, {
            environment: 'sandbox',
            ORG: 'Smart Touch POS',
            OU: 'Main Branch',
            CN: 'ZATCA-EGS',
            EGS_SN: '1-SmartTouch|2-POS|3-001',
            UID: '310000000000003',
            IND: 'Retail',
        });
        console.log('SUCCESS. CSR PEM length:', result.csrPem.length);
        console.log('CSR Base64 length:', result.csrBase64.length);
        console.log('CSR PEM header:', result.csrPem.slice(0, 50));
    } catch(e) {
        console.error('FAILED generateCSR:', e.message);
    }

    console.log('\n--- Test: signInvoiceXML (was UNKNOWN_GROUP) ---');
    try {
        const dummyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
 xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions></ext:UBLExtensions>
  <cbc:ID>1</cbc:ID>
</Invoice>`;
        // Use a dummy cert PEM (we just need IssuerSerial parsing to not block — it warns but continues)
        const dummyCert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQDU+pQ4pHgSpDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
o4qne60TB3pSMmXcAGFAXqbOPiTK0QwxVdJLZdwKbz3m4TTwP21VmE7RjzLWrKRR
AkfxFQ4hMKDnZSjQnQFrGFP2WPuoG4fgcRMNV1cQRbB4aN+p3mmZ1z2rVCVFzlVE
Wb+Ry+OIBqhBXlM1HJJ5DcHhIHaS+EZrMHTzAAIDAQABMA0GCSqGSIb3DQEBCwUA
A4IBAQB/ltLWBiGhDvW4iUGCXjxK1GlGfJGi89aePVhbCqVHGY2TSL1bJuqpBL7r
tlOg4qFtWVkWqRBQRSQHp8lhBwbQfHxUxQXLAFP5V3ioV8HgZ2aCr5jXSuYz7tIR
pQ3mhPw6yB2Y1zRA5B3JLZR
-----END CERTIFICATE-----`;
        const result = zatca.signInvoiceXML(dummyXml, keys.privateKeyPem, dummyCert, new Date().toISOString());
        console.log('SUCCESS. Signature Base64 length:', result.signatureBase64.length);
        console.log('Invoice hash:', result.invoiceHashBase64);
    } catch(e) {
        console.error('FAILED signInvoiceXML:', e.message);
    }

    if (process.versions.electron) {
        require('electron').app.quit();
    }
}

run();
