const zatca = require('./electron/zatca_phase2_impl.cjs');
const fs = require('fs');

async function run() {
    try {
        console.log("Generating Keys...");
        const keys = zatca.generateDeviceKeyPair();
        console.log("Keys generated.");

        const finalInfo = {
            env: 'sandbox',
            EGS_SN: '1-SmartTouch|2-POS|3-001',
            UID: '310000000000003',
            title: '1100',
            address: 'Riyadh',
            IND: 'Retail',
            CN: 'ZATCA-EGS',
            OU: 'Head Office',
            O: 'SmartTouch'
        };

        console.log("Generating CSR...");
        const csrResult = zatca.generateCSR(keys.privateKeyPem, keys.publicKeyPem, finalInfo);
        console.log("CSR generated.");

        console.log("Getting Compliance CSID with OTP 123456...");
        const csid = await zatca.getComplianceCSID(csrResult.csrBase64, '123456', 'sandbox');
        console.log("CSID Success:", csid);

    } catch(e) {
        console.error("Error:", e);
    }
}
run();
