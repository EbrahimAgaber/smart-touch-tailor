const fs = require('fs');
const axios = require('axios');

async function testSubmit() {
    const csrPem = fs.readFileSync('scratch/nonprod_csr.pem', 'utf8');
    const csrBase64 = csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
        .replace(/-----END CERTIFICATE REQUEST-----/g, '')
        .replace(/[\r\n]/g, '')
        .trim();

    console.log("Submit to sandbox compliance...");
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
        console.log("SUCCESS!", response.data);
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
testSubmit();
