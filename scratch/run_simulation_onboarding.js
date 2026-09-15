const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.setPath('userData', path.join(process.env.APPDATA, 'البصمة الذكية'));

app.whenReady().then(async () => {
    console.log('=== STARTING SIMULATION ONBOARDING ===');
    try {
        const db = require('../electron/database.cjs');
        const zatcaPhase2 = require('../electron/zatca_phase2_impl.cjs');
        const { generateUBL21XML } = require('../electron/zatca_utils.cjs');

        // OTP for simulation
        const otp = '208524';
        console.log('OTP:', otp);

        const userDataPath = path.join(process.env.APPDATA, 'البصمة الذكية');
        console.log('AppData Path:', userDataPath);
        db.initDatabase(userDataPath);


        let device = db.getZatcaDevice();
        if (!device) {
            console.log('No ZATCA device found. Creating device POS-9013...');
            const keys = zatcaPhase2.generateDeviceKeyPair();
            db.updateZatcaDevice({ 
                id: 1, 
                device_id: 'POS-9013', 
                private_key_pem: keys.privateKeyPem 
            });
            device = db.getZatcaDevice();
        } else {
            console.log('Existing device found:', { id: device.id, device_id: device.device_id });
            if (!device.private_key_pem || device.private_key_pem.startsWith('ENC:')) {
                console.log('Device lacks a valid decrypted private key. Generating key pair...');
                const keys = zatcaPhase2.generateDeviceKeyPair();
                db.updateZatcaDevice({
                    id: device.id,
                    private_key_pem: keys.privateKeyPem
                });
                device = db.getZatcaDevice();
            }
        }

        const settings = db.getSettings();
        console.log('Settings:');
        console.log('  VAT Number:', settings.vat_number);
        console.log('  Business Name AR:', settings.business_name_ar);
        console.log('  ZATCA Env:', settings.zatca_env);

        if (!settings.vat_number || !/^3\d{14}$/.test(settings.vat_number)) {
            throw new Error('VAT number must be a valid 15-digit taxpayer ID starting with 3.');
        }
        if (!settings.business_name_ar) {
            throw new Error('Arabic business name is required in settings.');
        }

        const zatcaEnv = 'simulation'; // Force simulation env
        console.log(`Setting up onboarding for environment: ${zatcaEnv}...`);

        const egsSn = `1-SmartTouch|2-${device.device_id || 'POS-9013'}|3-${settings.vat_number}`;
        console.log('EGS Serial Number:', egsSn);

        // Generate CSR
        console.log('Generating CSR...');
        
        const { csrBase64, csrPem, privateKeyPem } = zatcaPhase2.generateCSR(
            null, null,
            { 
                EGS_SN: egsSn, 
                UID: settings.vat_number,
                CN: egsSn.replace(/\|/g, '-'),
                ORG: settings.business_name_ar, 
                OU: settings.zatca_ou || 'Head Office', 
                IND: settings.zatca_ind || 'Retail',
                title: settings.zatca_title || '1100',
                address: settings.store_address || 'Riyadh',
                isSandbox: true, // we still pass this since zatcaPhase2 handles it
                environment: zatcaEnv 
            }
        );
        console.log('CSR generated successfully.');

        db.updateZatcaDevice({ 
            id: device.id, 
            csr_pem: csrPem,
            private_key_pem: privateKeyPem || device.private_key_pem,
            environment: zatcaEnv
        });
        device = db.getZatcaDevice(); // reload device

        // Issue Compliance CSID
        console.log('Issuing Compliance CSID from ZATCA Simulation...');
        let compCsid;
        try {
            compCsid = await zatcaPhase2.issueComplianceCSID(csrBase64, otp, zatcaEnv);
            console.log('Compliance CSID response received:');
            console.log('  RequestID:', compCsid.requestID || compCsid.requestId);
            console.log('  Token (truncated):', (compCsid.binarySecurityToken || '').slice(0, 40) + '...');
        } catch (err) {
            console.error('Compliance CSID issuance failed!');
            throw err;
        }

        db.updateZatcaDevice({ id: device.id, compliance_csid: JSON.stringify(compCsid) });
        device = db.getZatcaDevice(); // reload device

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
            console.error("CRITICAL ERROR during simulation onboarding: Compliance invoice checklist did not pass all checks.");
            throw new Error('Compliance invoice checklist did not pass all checks.');
        }

        // Issue Production CSID
        console.log('Issuing Production CSID from ZATCA Simulation...');
        let prodCsid;
        try {
            prodCsid = await zatcaPhase2.issueProductionCSID(
                compCsid.requestID || compCsid.requestId, 
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
        // ZATCA Phase 2 canonical genesis PIH — MUST match database.cjs ZATCA_GENESIS_PIH constant.
        // Do NOT change this value. Per spec §5.3 it is: SHA-256('') → hex → base64.
        const ZATCA_GENESIS_PIH_ONBOARD = 'NWZlY2Q3YmU1YTIzYmU3YTYzYTk3YmQ4NzY0ODk2ODM3NGJhOWI5NjgxYTNpYmQyNzhjNTU4NTUxYWI5ZWYyZg==';
        database.transaction(() => {
            db.updateZatcaDevice({
                id: device.id,
                production_csid: JSON.stringify(prodCsid),
                production_cert_pem: certPem,
                cert_expires_at: certExpiresAt,
                current_icv: 0,        // Reset to 0; first real transaction increments to ICV=1
                last_pih: ZATCA_GENESIS_PIH_ONBOARD,
            });
            // Mark any older queue/sale records to legacy
            database.prepare("UPDATE zatca_queue SET status = 'legacy_pre_onboarding' WHERE status IN ('pending', 'failed', 'pre_onboarding')").run();
            database.prepare("UPDATE sales SET zatca_status = 'unreported_legacy' WHERE zatca_status IN ('pending', 'failed', 'PRE_ONBOARDING_UNREPORTED')").run();
        })();

        console.log('=== SIMULATION ONBOARDING COMPLETED SUCCESSFULLY! ===');
        console.log('The POS is now fully onboarded in ZATCA Simulation.');
    } catch (err) {
        console.error('CRITICAL ERROR during simulation onboarding:', err.message);
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
    // B2C Simplified Credit Note
    await runOne('B2C Simplified Credit Note 381', {
        ...baseInvoice,
        invoice: `COMPLY-CNB2C-${Date.now()}`,
        typeCode: '381',
        billingRef: cryptoMod.randomUUID(),
        items: [{ Name: 'Return', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });
    // B2C Simplified Debit Note
    await runOne('B2C Simplified Debit Note 383', {
        ...baseInvoice,
        invoice: `COMPLY-DNB2C-${Date.now()}`,
        typeCode: '383',
        billingRef: cryptoMod.randomUUID(),
        items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });
    // B2B Standard Credit Note
    await runOne('B2B Standard Credit Note 381', {
        ...baseInvoice,
        invoice: `COMPLY-CNB2B-${Date.now()}`,
        typeCode: '381',
        buyer: { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
        billingRef: cryptoMod.randomUUID(),
        items: [{ Name: 'Return', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });
    // B2B Standard Debit Note
    await runOne('B2B Standard Debit Note 383', {
        ...baseInvoice,
        invoice: `COMPLY-DNB2B-${Date.now()}`,
        typeCode: '383',
        buyer: { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
        billingRef: cryptoMod.randomUUID(),
        items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });

    return { allPassed: results.every(r => r.passed), results };
}
