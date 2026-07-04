const crypto = require('crypto');
const axios = require('axios');
const forge = require('node-forge');

// Load our bridged generateCSR implementation
const { generateCSR } = require('../electron/zatca_phase2_impl.cjs');

async function testSandboxOnboarding() {
    console.log("Generating fresh EC secp256k1 keys...");
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1'
    });

    const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

    console.log("Generating CSR with official ZATCA Sandbox mock values...");
    const { csrBase64, csrPem } = generateCSR(privateKeyPem, publicKeyPem, {
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

    console.log("Generated CSR (first 100 chars of base64):", csrBase64.substring(0, 100));

    const url = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance';
    console.log("Calling Sandbox Compliance API at:", url);

    try {
        const response = await axios.post(url, { csr: csrBase64 }, {
            headers: {
                'OTP': '123456',
                'Accept-Version': 'V2',
                'Accept-Language': 'en',
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        console.log("SUCCESS! Compliance CSID obtained:");
        console.log(response.data);
    } catch (err) {
        console.error("FAILED!");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Headers:", err.response.headers);
            console.error("Data:", typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data);
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

testSandboxOnboarding();
