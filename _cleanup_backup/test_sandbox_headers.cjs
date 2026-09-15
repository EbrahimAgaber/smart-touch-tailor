const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

async function testHeaders() {
    // Generate a fresh key and CSR
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1'
    });
    const privateKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

    const zatca = require('./electron/zatca_phase2_impl.cjs');
    
    console.log("Generating CSR...");
    const { csrBase64 } = zatca.generateCSR(privateKeyPem, publicKeyPem, {
        EGS_SN: '1-TST|2-TST|3-311111111111113',
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

    const url = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance';
    console.log("Posting to:", url);

    try {
        const response = await axios.post(url, { csr: csrBase64 }, {
            headers: {
                'OTP': '123456',
                'Accept-Version': 'V2',
                'Accept-Language': 'en',
                'Content-Type': 'application/json'
            }
        });
        console.log("SUCCESS!", response.data);
    } catch (err) {
        console.log("FAILED!");
        if (err.response) {
            console.log("Status:", err.response.status);
            console.log("Headers:", err.response.headers);
            console.log("Raw Data:", err.response.data);
            if (typeof err.response.data === 'object') {
                console.log("JSON Data:", JSON.stringify(err.response.data, null, 2));
            }
        } else {
            console.log("Error Message:", err.message);
        }
    }
}

testHeaders();
