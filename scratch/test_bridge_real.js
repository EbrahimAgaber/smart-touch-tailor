const zatca = require('../electron/zatca_phase2.cjs');

try {
    const keys = zatca.generateDeviceKeyPair();
    console.log("Calling generateCSR in test mode...");
    const res = zatca.generateCSR(
        keys.privateKeyPem,
        keys.publicKeyPem,
        {
            EGS_SN: '1-SmartTouch|2-POS-01|3-311167090900003',
            UID: '311167090900003',
            ORG: 'Test Org',
            OU: '3111670909',
            IND: 'Retail'
        }
    );
    console.log("Success! CSR:", res.csrBase64.substring(0, 50));
} catch (e) {
    console.error("Test failed!");
    console.error(e.message);
}
