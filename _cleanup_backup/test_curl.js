const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const zatca = require('./electron/zatca_phase2_impl.cjs');

// Generate keys
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1'
});
const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

// Generate CSR with mock VAT 399999999900003
console.log("Generating CSR...");
const { csrBase64 } = zatca.generateCSR(privateKeyPem, publicKeyPem, {
    EGS_SN: '1-TST|2-TST|3-399999999900003',
    UID: '399999999900003',
    CN: 'TST-886431145-399999999900003',
    ORG: 'Maximum Speed Tech Supply LTD',
    OU: 'Riyadh Branch',
    IND: 'Supply activities',
    title: '1100',
    address: 'RRRD2929',
    isSandbox: true,
    environment: 'sandbox'
});

// Prepare the JSON body file
const jsonPath = path.join(__dirname, 'scratch', 'payload.json');
fs.writeFileSync(jsonPath, JSON.stringify({ csr: csrBase64 }), 'utf8');

// Build curl command
const curlCmd = `curl -i -X POST https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance/csids ^
  -H "Accept-Version: V2" ^
  -H "Accept-Language: en" ^
  -H "Content-Type: application/json" ^
  -H "OTP: 123456" ^
  -d @${jsonPath}`;

console.log("Executing curl command...");
try {
    const output = execSync(curlCmd, { encoding: 'utf8' });
    console.log("=== curl output ===");
    console.log(output);
} catch (err) {
    console.error("curl execution failed:", err.message);
    if (err.stdout) console.log("stdout:", err.stdout);
    if (err.stderr) console.log("stderr:", err.stderr);
}
