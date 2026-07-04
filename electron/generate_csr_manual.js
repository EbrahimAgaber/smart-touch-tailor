const fs = require('fs');
const zatca = require('./zatca_phase2.cjs');

console.log("Generating new ECDSA secp256k1 key pair...");
const { privateKeyPem, publicKeyPem } = zatca.generateDeviceKeyPair();

console.log("Building ZATCA Sandbox CSR...");
const info = {
    isSandbox: true,
    ORG: 'Test Company',
    OU: 'Riyadh Branch',
    CN: 'Sandbox-Test-EGS',
    EGS_SN: '1-TEST|2-POS|3-001',
    UID: '300000000000003',
    IND: 'Retail'
};

const { csrPem } = zatca.generateCSR(privateKeyPem, publicKeyPem, info);

fs.writeFileSync('sandbox-key.pem', privateKeyPem);
fs.writeFileSync('sandbox-csr.pem', csrPem);

console.log("\n================ PRIVATE KEY ================\n" + privateKeyPem);
console.log("\n================ CSR (Sandbox) ================\n" + csrPem);
console.log("\nKeys have been saved to sandbox-key.pem and sandbox-csr.pem in this directory.");
