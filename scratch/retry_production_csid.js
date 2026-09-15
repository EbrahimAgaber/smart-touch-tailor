const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(process.env.APPDATA, 'البصمة الذكية'));

app.whenReady().then(async () => {
    console.log('=== RETRYING PRODUCTION CSID ISSUANCE ===');
    try {
        const db = require('../electron/database.cjs');
        const zatcaPhase2 = require('../electron/zatca_phase2_impl.cjs');

        const userDataPath = path.join(process.env.APPDATA, 'البصمة الذكية');
        db.initDatabase(userDataPath);

        let device = db.getZatcaDevice();
        if (!device || !device.compliance_csid) {
            throw new Error("No compliance CSID found in database.");
        }

        const compCsid = JSON.parse(device.compliance_csid);
        const reqId = String(compCsid.requestID || compCsid.requestId);
        
        console.log('Request ID as string:', reqId);
        
        try {
            const prodCsid = await zatcaPhase2.issueProductionCSID(
                reqId, 
                compCsid.binarySecurityToken, 
                compCsid.secret, 
                'simulation'
            );
            console.log('Production CSID response received successfully!');
            console.log(JSON.stringify(prodCsid, null, 2));
            
            // Update db
            let certExpiresAt = null;
            let certPem = '';
            try {
                const cleanToken = prodCsid.binarySecurityToken.replace(/[\n\r\s]/g, '');
                certPem = `-----BEGIN CERTIFICATE-----\n${cleanToken}\n-----END CERTIFICATE-----`;
                const forge = require('node-forge');
                const certObj = forge.pki.certificateFromPem(certPem);
                certExpiresAt = certObj.validity.notAfter.toISOString();
                console.log('Certificate expires at:', certExpiresAt);
            } catch (e) {}

            const database = db.getDbInstance();
            const ZATCA_GENESIS_PIH_ONBOARD = 'NWZlY2Q3YmU1YTIzYmU3YTYzYTk3YmQ4NzY0ODk2ODM3NGJhOWI5NjgxYTNpYmQyNzhjNTU4NTUxYWI5ZWYyZg==';
            database.transaction(() => {
                db.updateZatcaDevice({
                    id: device.id,
                    production_csid: JSON.stringify(prodCsid),
                    production_cert_pem: certPem,
                    cert_expires_at: certExpiresAt,
                    current_icv: 0,
                    last_pih: ZATCA_GENESIS_PIH_ONBOARD,
                });
                database.prepare("UPDATE zatca_queue SET status = 'legacy_pre_onboarding' WHERE status IN ('pending', 'failed', 'pre_onboarding')").run();
                database.prepare("UPDATE sales SET zatca_status = 'unreported_legacy' WHERE zatca_status IN ('pending', 'failed', 'PRE_ONBOARDING_UNREPORTED')").run();
            })();
            console.log('Successfully completed onboarding in simulation!');
        } catch (err) {
            console.error(err.message);
            // Print full error if it has response data
            if (err.response && err.response.data) {
                console.error("FULL ERROR DATA:", JSON.stringify(err.response.data, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        app.quit();
    }
});
