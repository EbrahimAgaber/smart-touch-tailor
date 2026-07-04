const { app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const db = require('../electron/database.cjs');
const bridge = require('../electron/zatca-bridge.cjs');
const { EGS } = require('zatca-xml-js');

app.on('ready', async () => {
    try {
        console.log('=== STARTING MANUAL SANDBOX ONBOARDING ===');
        const userData = app.getPath('userData');
        console.log('AppData Path:', userData);
        db.initDatabase(userData);

        // Read the Sandbox API response that the user saved
        const desktopPath = path.join(os.homedir(), 'Desktop', 'sandbox_response.json');
        if (!fs.existsSync(desktopPath)) {
            console.error('ERROR: Could not find sandbox_response.json on your Desktop!');
            console.error('Please create this file and paste the exact JSON response from the Sandbox portal (the one containing binarySecurityToken) into it.');
            process.exit(1);
        }

        const sandboxResponse = JSON.parse(fs.readFileSync(desktopPath, 'utf8'));
        if (!sandboxResponse.binarySecurityToken || !sandboxResponse.secret) {
            console.error('ERROR: Invalid JSON. Missing binarySecurityToken or secret.');
            process.exit(1);
        }

        console.log('Loaded Compliance Credentials:');
        console.log('RequestID:', sandboxResponse.requestID);

        // Update the DB with the compliance token (manual bypass)
        db.getDbInstance().prepare(`
            UPDATE zatca_device 
            SET compliance_csid = ?, compliance_secret = ?, compliance_rid = ?, status = 'COMPLIANCE_ISSUED'
            WHERE id = 1
        `).run(sandboxResponse.binarySecurityToken, sandboxResponse.secret, sandboxResponse.requestID);

        console.log('Running Compliance Invoice Checklist (signing & validating 4 required test invoices)...');
        // This will call checkInvoiceCompliance via the library internally
        await bridge.runComplianceChecks(db.getDbInstance());

        console.log('Issuing Production CSID from ZATCA Sandbox...');
        await bridge.issueProductionCSID(db.getDbInstance());

        console.log('=== SANDBOX ONBOARDING COMPLETED SUCCESSFULLY! ===');
        console.log('The POS is now fully integrated, compliant, and active in the ZATCA Sandbox.');
        
        process.exit(0);
    } catch (e) {
        console.error('CRITICAL ERROR:', e.message);
        if (e.response && e.response.data) {
            console.error('ZATCA Details:', JSON.stringify(e.response.data));
        }
        process.exit(1);
    }
});
