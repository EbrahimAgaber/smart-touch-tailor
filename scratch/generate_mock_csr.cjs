/**
 * Generate a fresh secp256r1 (prime256v1) key pair and CSR configured for 
 * ZATCA's Integration Sandbox website (using mock VAT 311111111111113).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'zatca_secp256r1_key.pem');
const CSR_PATH = path.join(__dirname, '..', 'zatca_secp256r1.csr');

const zatca = require('../electron/zatca_phase2_impl.cjs');

console.log('Generating fresh EC key pair (prime256v1)...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
});
const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

fs.writeFileSync(KEY_PATH, privateKeyPem, 'utf8');
console.log(`✔ Private key saved to: ${KEY_PATH}`);

console.log('Generating CSR with Integration Sandbox mock configuration...');
const { csrBase64, csrPem } = zatca.generateCSR(privateKeyPem, publicKeyPem, {
    EGS_SN: '1-TST|2-TST|3-SN-' + Date.now(),
    UID: '311111111111113',
    CN: 'TST-886431145-311111111111113',
    ORG: 'Maximum Speed Tech Supply LTD',
    OU: '1000000001',
    IND: 'Supply activities',
    title: '1100',
    address: 'RRRD2929',
    isSandbox: true,
    environment: 'sandbox'
});

fs.writeFileSync(CSR_PATH, csrPem, 'utf8');
console.log(`✔ CSR saved to: ${CSR_PATH}`);

console.log('\n=== CSR Base64 (Copy this string to ZATCA Integration Sandbox page) ===');
console.log(csrBase64);
console.log('=======================================================================\n');
