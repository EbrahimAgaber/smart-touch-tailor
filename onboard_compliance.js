const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(process.env.APPDATA, 'البصمة الذكية'));

app.whenReady().then(async () => {
    console.log('=== STARTING MANUAL ONBOARDING AND COMPLIANCE PHASE ===');
    try {
        const db = require('./electron/database.cjs');
        const zatcaPhase2 = require('./electron/zatca_phase2_impl.cjs');
        const { generateUBL21XML } = require('./electron/zatca_utils.cjs');

        const userDataPath = path.join(process.env.APPDATA, 'البصمة الذكية');
        console.log('AppData Path:', userDataPath);
        db.initDatabase(userDataPath);

        const scratchDir = "C:\\Users\\bin-g\\.gemini\\antigravity\\brain\\b4f8ba7e-1bf3-42d9-9bae-9be57ceeee52\\scratch";
        const keyPath = path.join(scratchDir, 'openssl_secp256r1_privkey.pem');
        const csrPath = path.join(scratchDir, 'openssl_secp256r1_csr.csr');
        const tokenPath = path.join(scratchDir, 'compliance_response.json');

        if (!fs.existsSync(keyPath)) {
            throw new Error(`Manual secp256r1 private key not found at ${keyPath}`);
        }
        if (!fs.existsSync(csrPath)) {
            throw new Error(`Manual secp256r1 CSR not found at ${csrPath}`);
        }
        if (!fs.existsSync(tokenPath)) {
            throw new Error(`Compliance response JSON token not found at ${tokenPath}.\nPlease create this file with your Sandbox Swagger UI output first!`);
        }

        const privateKeyPem = fs.readFileSync(keyPath, 'utf8').trim();
        const csrPem = fs.readFileSync(csrPath, 'utf8').trim();
        const compCsid = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

        if (!compCsid.binarySecurityToken || !compCsid.secret) {
            throw new Error("compliance_response.json must contain 'binarySecurityToken' and 'secret' fields.");
        }

        const requestID = compCsid.requestID || compCsid.requestId || 0;
        console.log('Loaded Compliance Tokens:');
        console.log('  RequestID:', requestID);
        console.log('  Token (truncated):', compCsid.binarySecurityToken.substring(0, 40) + '...');

        let device = db.getZatcaDevice();
        if (!device) {
            console.log('No ZATCA device found. Creating device POS-9013...');
            db.updateZatcaDevice({ 
                id: 1, 
                device_id: 'POS-9013', 
                private_key_pem: privateKeyPem,
                csr_pem: csrPem,
                compliance_csid: JSON.stringify(compCsid)
            });
            device = db.getZatcaDevice();
        } else {
            console.log('Existing device found:', { id: device.id, device_id: device.device_id });
            console.log('Updating device with manual secp256r1 key, CSR, and CCSID...');
            db.updateZatcaDevice({
                id: device.id,
                private_key_pem: privateKeyPem,
                csr_pem: csrPem,
                compliance_csid: JSON.stringify(compCsid)
            });
            device = db.getZatcaDevice();
        }

        const settings = db.getSettings();
        console.log('Settings:');
        console.log('  VAT Number:', settings.vat_number);
        console.log('  Business Name AR:', settings.business_name_ar);
        console.log('  ZATCA Env:', settings.zatca_env);

        const zatcaEnv = 'sandbox'; // Force sandbox/developer-portal env

        // Run Compliance Invoice Checklist
        console.log('Running Compliance Invoice Checklist (signing & validating 4 required test invoices)...');
        const checklistRes = await runComplianceInvoiceChecklist({
            device,
            settings,
            compCsid,
            isSandbox: zatcaEnv,
            generateUBL21XML,
            zatcaPhase2
        });

        console.log('Compliance Checklist Results:');
        for (const r of checklistRes.results) {
            console.log(`  - [${r.passed ? 'PASS' : 'FAIL'}] ${r.label}`);
            if (!r.passed) {
                console.log('    Details:', JSON.stringify(r.details));
            }
        }

        if (!checklistRes.allPassed) {
            throw new Error('Compliance invoice checklist did not pass all checks.');
        }

        // Issue Production CSID
        console.log('Issuing Production CSID from ZATCA Sandbox...');
        let prodCsid;
        try {
            prodCsid = await zatcaPhase2.issueProductionCSID(
                requestID, 
                compCsid.binarySecurityToken, 
                compCsid.secret, 
                zatcaEnv
            );
            console.log('Production CSID response received successfully!');
        } catch (err) {
            console.error('Production CSID request failed!');
            throw err;
        }

        let certExpiresAt = null;
        let certPem = '';
        try {
            const cleanToken = prodCsid.binarySecurityToken.replace(/[\n\r\s]/g, '');
            certPem = `-----BEGIN CERTIFICATE-----\n${cleanToken}\n-----END CERTIFICATE-----`;
            const forge = require('node-forge');
            const certObj = forge.pki.certificateFromPem(certPem);
            certExpiresAt = certObj.validity.notAfter.toISOString();
            console.log('Certificate expires at:', certExpiresAt);
        } catch (certParseErr) {
            console.warn('Could not parse cert expiration date:', certParseErr.message);
        }

        // Update database with final production CSID
        console.log('Updating database with production CSID & certificate...');
        const database = db.getDbInstance();
        database.transaction(() => {
            db.updateZatcaDevice({
                id: device.id,
                production_csid: JSON.stringify(prodCsid),
                production_cert_pem: certPem,
                cert_expires_at: certExpiresAt,
                current_icv: 0,
                last_pih: 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==',
            });
            // Mark any older queue/sale records to legacy
            database.prepare("UPDATE zatca_queue SET status = 'legacy_pre_onboarding' WHERE status IN ('pending', 'failed', 'pre_onboarding')").run();
            database.prepare("UPDATE sales SET zatca_status = 'unreported_legacy' WHERE zatca_status IN ('pending', 'failed', 'PRE_ONBOARDING_UNREPORTED')").run();
        })();

        console.log('=== SANDBOX ONBOARDING COMPLETED SUCCESSFULLY! ===');
        console.log('The POS is now fully onboarded in ZATCA Sandbox.');
    } catch (err) {
        console.error('CRITICAL ERROR during manual onboarding process:', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        app.quit();
    }
});

async function runComplianceInvoiceChecklist({ device, settings, compCsid, isSandbox, generateUBL21XML, zatcaPhase2 }) {
    const results = [];
    const cryptoMod = require('crypto');

    let cleanToken = compCsid.binarySecurityToken.replace(/[\n\r\s]/g, '');
    try {
        const decoded = Buffer.from(cleanToken, 'base64').toString('utf8');
        if (decoded.trim().startsWith('MII')) {
            cleanToken = decoded.trim().replace(/[\n\r\s]/g, '');
        }
    } catch (e) {}
    const compCertPem = `-----BEGIN CERTIFICATE-----\n${(cleanToken.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
    const certDetails = zatcaPhase2.extractCertDetails(compCertPem);
    const certVatNumber = certDetails.vatNumber || settings.vat_number;

    const address = {
        street:   settings.address_street   || 'شارع الملك',
        building: settings.address_building || '1234',
        district: settings.address_district || 'الصحافة',
        city:     settings.address_city     || 'الرياض',
        postal:   settings.address_postal   || '12345',
        country:  'SA',
    };

    const runOne = async (label, invoiceData) => {
        try {
            console.log(`  Running check for: ${label}...`);
            const uuid = cryptoMod.randomUUID();
            const xml = generateUBL21XML({
                ...invoiceData,
                uuid,
                prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
                icv: 1,
            });
            const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
                xml, device.private_key_pem, compCertPem, invoiceData.timestamp
            );
            let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);

            const tlvBase64 = zatcaPhase2.generateZatcaTLV9(
                settings.business_name_ar || 'Seller',
                certVatNumber,
                invoiceData.timestamp || new Date().toISOString(),
                invoiceData.total || '0.00',
                (invoiceData.items || []).reduce((acc, it) => acc + ((it.Price * it.Qty) - (it.Price * it.Qty / 1.15)), 0).toFixed(2),
                invoiceHashBase64,
                signatureBase64,
                certDetails.pubKeyPem,
                certDetails.certSignature
            );
            signedXml = zatcaPhase2.injectQRPayload(signedXml, tlvBase64);

            const xmlBase64 = Buffer.from(signedXml).toString('base64');

            const response = await zatcaPhase2.checkComplianceInvoice(
                invoiceHashBase64, xmlBase64, uuid,
                compCsid.binarySecurityToken, compCsid.secret, isSandbox
            );
            const passed = !response.error && (response.validationResults?.status === 'PASS' || response.validationResults?.status === 'WARNING' || response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED');
            results.push({ label, passed, details: response.error ? (response.data || response) : (response.validationResults || { status: 'PASS' }) });
        } catch (err) {
            results.push({ label, passed: false, details: { error: err.message } });
        }
    };

    const ts = new Date().toISOString();
    const baseInvoice = {
        invoice: `COMPLY-${Date.now()}`,
        timestamp: ts,
        total: '115.00',
        items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
        seller: settings.business_name_ar,
        vatNo: certVatNumber,
        vatRate: 0.15,
        address,
    };

    await runOne('B2C Simplified (Reporting)', { ...baseInvoice, invoice: `COMPLY-B2C-${Date.now()}` });
    await runOne('B2B Standard (Clearance)', {
        ...baseInvoice,
        invoice: `COMPLY-B2B-${Date.now()}`,
        subtype: '0100000',
        buyer: { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
    });
    await runOne('Credit Note 381', {
        ...baseInvoice,
        invoice: `COMPLY-CN-${Date.now()}`,
        typeCode: '381',
        subtype: '0100000',
        billingRef: cryptoMod.randomUUID(),
        total: '115.00',
        items: [{ Name: 'Return', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });
    await runOne('Debit Note 383', {
        ...baseInvoice,
        invoice: `COMPLY-DN-${Date.now()}`,
        typeCode: '383',
        subtype: '0100000',
        billingRef: cryptoMod.randomUUID(),
        total: '115.00',
        items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });

    return { allPassed: results.every(r => r.passed), results };
}
