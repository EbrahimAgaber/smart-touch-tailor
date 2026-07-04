const fs = require('fs');
const axios = require('axios');

async function onboardSdkCsr() {
    const csrPem = fs.readFileSync('scratch/sdk_csr.csr', 'utf8');
    const csrBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();

    console.log("Clean base64 length of SDK CSR:", csrBase64.length);
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
        console.log("SUCCESS! Compliance CSID obtained using SDK CSR:");
        console.log(response.data);
    } catch (err) {
        console.error("FAILED!");
        if (err.response && err.response.data) {
            console.error("ZATCA Error Response:", JSON.stringify(err.response.data));
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

onboardSdkCsr();
