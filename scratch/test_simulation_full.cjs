const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Load our actual implementation
const zatca = require('../electron/zatca_phase2.cjs');

async function runSimulationTest() {
    const keys = zatca.generateDeviceKeyPair();
    
    console.log("Generating Simulation CSR...");
    const { csrBase64, csrPem } = zatca.generateCSR(keys.privateKeyPem, null, {
        EGS_SN: '1-SmartTouch|2-POS-9013|3-300075585600003',
        UID: '300075585600003',
        CN: '1-SmartTouch-2-POS-9013-3-300075585600003',
        ORG: 'Maximum Speed Tech Supply LTD',
        OU: 'Head Office',
        IND: 'Retail',
        title: '1100',
        address: 'Riyadh',
        isSandbox: false,
        environment: 'simulation'
    });

    console.log("Submit to Simulation Compliance API...");
    const url = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance';
    
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

runSimulationTest();
