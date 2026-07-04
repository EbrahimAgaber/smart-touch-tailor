const { generateDeviceKeyPair, generateCSR } = require('../electron/zatca_phase2.cjs');
const fs = require('fs');
const { execSync } = require('child_process');

try {
    console.log("Generating key pair with native crypto...");
    const { privateKeyPem, publicKeyPem } = generateDeviceKeyPair();
    
    fs.writeFileSync('temp_private_key_js.pem', privateKeyPem);
    
    console.log("Generating CSR with node-forge + crypto...");
    const info = {
        env: 'sandbox',
        EGS_SN: '1-SmartTouch|2-POS|3-001',
        UID: '310000000000003',
        title: '1100',
        address: 'Riyadh',
        IND: 'Retail',
        CN: 'ZATCA-EGS',
        OU: '3100000000',
        ORG: 'Smart Touch POS'
    };

    const { csrPem, csrBase64 } = generateCSR(privateKeyPem, publicKeyPem, info);
    fs.writeFileSync('temp_csr_js.pem', csrPem);

    console.log("\n[PRIVATE_KEY_VALIDATION]");
    try {
        const keyOut = execSync('openssl ec -in temp_private_key_js.pem -noout -text', { encoding: 'utf8' });
        console.log(keyOut);
    } catch (e) {
        console.log("Error:", e.stderr || e.message);
    }

    console.log("\n[CSR_VALIDATION]");
    try {
        const csrOut = execSync('openssl req -in temp_csr_js.pem -noout -text', { encoding: 'utf8' });
        console.log(csrOut);
    } catch (e) {
        console.log("Error:", e.stderr || e.message);
    }

} catch(e) {
    console.log("\n[STACK_TRACE]");
    console.log(e.stack || e);
}
