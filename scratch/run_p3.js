const { app } = require('electron');
const cryptoMod = require('crypto');

app.whenReady().then(async () => {
    try {
        const db = require('../electron/database.cjs');
        const zatcaPhase2 = require('../electron/zatca_phase2_impl.cjs');
        const { generateUBL21XML } = require('../electron/zatca_utils.cjs');

        db.initDatabase('C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية');
        const device = db.getZatcaDevice();
        const settings = db.getSettings();
        
        if (!device || !device.compliance_csid) {
            throw new Error("No compliance CSID found in DB. Did Phase 2 complete?");
        }
        const compCsid = JSON.parse(device.compliance_csid);
        const zatcaEnv = 'sandbox';
        
        console.log('Running Compliance Invoice Checklist...');
        
        const results = [];
        const cleanToken = compCsid.binarySecurityToken.replace(/[\n\r\s]/g, '');
        const compCertPem = '-----BEGIN CERTIFICATE-----\n' + cleanToken + '\n-----END CERTIFICATE-----';
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
                console.log(`\n--- Running check for: ${label} ---`);
                const uuid = cryptoMod.randomUUID();
                const xml = generateUBL21XML({
                    ...invoiceData,
                    uuid,
                    prevHash: 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==',
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
                    compCsid.binarySecurityToken, compCsid.secret, zatcaEnv
                );
                
                const passed = !response.error && (response.validationResults?.status === 'PASS' || response.validationResults?.status === 'WARNING' || response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED');
                results.push({ label, passed, details: response.error ? (response.data || response) : (response.validationResults || { status: 'PASS' }) });
                console.log(`Result for ${label}: ${passed ? 'PASS' : 'FAIL'}`);
                if(!passed) {
                    console.log(`Details: ${JSON.stringify(response.error ? response.data : response.validationResults, null, 2)}`);
                }
            } catch (err) {
                console.log(`Result for ${label}: FAIL (Exception)`);
                console.error(err);
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
            typeCode: '388',
            buyer: { vatNo: '311111111111113', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
        });
        await runOne('Credit Note 381', {
            ...baseInvoice,
            invoice: `COMPLY-CN-${Date.now()}`,
            typeCode: '381',
            billingRef: cryptoMod.randomUUID(),
            total: '-115.00',
            items: [{ Name: 'Return', Qty: -1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
        });
        await runOne('Debit Note 383', {
            ...baseInvoice,
            invoice: `COMPLY-DN-${Date.now()}`,
            typeCode: '383',
            billingRef: cryptoMod.randomUUID(),
            total: '115.00',
            items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
        });

        console.log('\n--- FINAL SUMMARY ---');
        results.forEach(r => {
            console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.label}`);
        });

        app.quit();
    } catch(e) {
        console.error("FATAL:", e);
        app.quit();
    }
});
