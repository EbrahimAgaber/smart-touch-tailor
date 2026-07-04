const fs = require('fs');
const zatcaPhase2 = require('./electron/zatca_phase2_impl.cjs');

(async () => {
    try {
        console.log("Generating CSR...");
        const csrConfig = {
            env: "sandbox",
            UID: "312345678901233",
            CN: "Test",
            ORG: "Test Org",
            OU: "3123456789",
            address: "Test Address",
            IND: "Test Category",
            EGS_SN: "1-Test|2-Test|3-Test",
            title: "1100"
        };
        const csrRes = zatcaPhase2.generateCSR("dummy", "dummy", csrConfig);
        
        fs.writeFileSync('new_priv.pem', csrRes.privateKeyPem);
        fs.writeFileSync('new_pub.pem', csrRes.publicKeyPem);
        
        console.log("Fetching CCSID from Sandbox with mock OTP 123345...");
        const ccsidData = await zatcaPhase2.getComplianceCSID(csrRes.csrBase64, '123345', 'sandbox');
        
        if (ccsidData && ccsidData.binarySecurityToken) {
            console.log("CCSID Fetched successfully!");
            // Zatca returns a base64 encoded string, which when decoded is STILL a base64 string
            const firstDecoded = Buffer.from(ccsidData.binarySecurityToken, 'base64').toString('utf8');
            const certPem = `-----BEGIN CERTIFICATE-----\n${firstDecoded.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
            fs.writeFileSync('new_cert.pem', certPem);
            console.log("Wrote new_cert.pem");
        } else {
            console.log("Failed to fetch CCSID: ", JSON.stringify(ccsidData));
        }
    } catch (e) {
        console.error("Error:", e);
    }
})();
