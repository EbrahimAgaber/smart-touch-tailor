const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(process.env.APPDATA, 'البصمة الذكية'));

app.whenReady().then(async () => {
    console.log('=== COMPLETING MISSING COMPLIANCE STEPS AND RETRYING PRODUCTION CSID ===');
    try {
        const db = require('../electron/database.cjs');
        const zatcaPhase2 = require('../electron/zatca_phase2_impl.cjs');
        const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
        const cryptoMod = require('crypto');

        const userDataPath = path.join(process.env.APPDATA, 'البصمة الذكية');
        db.initDatabase(userDataPath);

        let device = db.getZatcaDevice();
        if (!device || !device.compliance_csid) {
            throw new Error("No compliance CSID found in database.");
        }

        const compCsid = JSON.parse(device.compliance_csid);
        const reqId = String(compCsid.requestID || compCsid.requestId);
        const settings = db.getSettings();

        // Prepare parameters
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

        const baseInvoice = {
            timestamp: new Date().toISOString(),
            total: '115.00',
            items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
            seller: settings.business_name_ar,
            vatNo: certVatNumber,
            vatRate: 0.15,
            address,
        };

        const runOne = async (label, invoiceData) => {
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
                compCsid.binarySecurityToken, compCsid.secret, 'simulation'
            );
            const passed = !response.error && (response.validationResults?.status === 'PASS' || response.validationResults?.status === 'WARNING' || response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED');
            if (!passed) {
                console.error(`  FAIL: ${label}`, response.data || response);
                throw new Error(`Compliance failed for ${label}`);
            } else {
                console.log(`  PASS: ${label}`);
            }
        };

        const testBuyer = { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' };

        // 1) Standard Credit Note
        await runOne('B2B Standard Credit Note 381', {
            ...baseInvoice,
            invoice: `COMPLY-CNB2B-${Date.now()}`,
            typeCode: '381',
            buyer: testBuyer,
            billingRef: cryptoMod.randomUUID(),
        });

        // 2) Standard Debit Note
        await runOne('B2B Standard Debit Note 383', {
            ...baseInvoice,
            invoice: `COMPLY-DNB2B-${Date.now()}`,
            typeCode: '383',
            buyer: testBuyer,
            billingRef: cryptoMod.randomUUID(),
        });

        console.log('All missing compliance steps executed successfully.');

        // 3) Request Production CSID
        console.log('Issuing Production CSID from ZATCA Simulation...');
        try {
            const prodCsid = await zatcaPhase2.issueProductionCSID(
                reqId, 
                compCsid.binarySecurityToken, 
                compCsid.secret, 
                'simulation'
            );
            console.log('Production CSID response received successfully!');
            
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
            console.log('=== SIMULATION ONBOARDING COMPLETED SUCCESSFULLY! ===');
        } catch (err) {
            console.error(err.message);
            if (err.response && err.response.data) {
                console.error("FULL ERROR DATA:", JSON.stringify(err.response.data, null, 2));
            }
        }
    } catch (e) {
        console.error(e.message);
    } finally {
        app.quit();
    }
});
