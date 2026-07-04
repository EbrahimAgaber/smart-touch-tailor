const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Load our actual implementation
const zatca = require('../electron/zatca_phase2.cjs');

async function runSandboxTest() {
    const keys = zatca.generateDeviceKeyPair();
    
    console.log("Generating Sandbox CSR...");
    const { csrBase64, csrPem } = zatca.generateCSR(keys.privateKeyPem, null, {
        EGS_SN: '1-TST|2-TST|3-ed22f1d8-e6a2-1118-9b58-d9a8f11e445f',
        UID: '300075585600003',
        CN: 'TST-886431145-300075585600003',
        ORG: 'Maximum Speed Tech Supply LTD',
        OU: 'Riyadh Branch',
        IND: 'Supply activities',
        title: '1100',
        address: 'RRRD2929',
        isSandbox: true,
        environment: 'sandbox'
    });

    console.log("Submit to Sandbox Compliance API...");
    const url = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance';
    
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
        console.log("SUCCESS! CCSID obtained:");
        console.log(response.data);
    } catch (err) {
        console.error("FAILED!");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

runSandboxTest();
