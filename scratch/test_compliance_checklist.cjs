const { app } = require('electron');
const path = require('path');

app.setPath('userData', path.join(process.env.APPDATA, 'البصمة الذكية'));

app.whenReady().then(async () => {
    const db = require('../electron/database.cjs');
    const zatcaPhase2 = require('../electron/zatca_phase2.cjs');
    
    db.initDatabase(app.getPath('userData'));
    const device = db.getZatcaDevice();
    const settings = db.getSettings();
    
    if (!device || !device.compliance_csid) {
        console.error("No compliance_csid found in database. Cannot run checklist.");
        process.exit(1);
    }
    
    const compCsid = JSON.parse(device.compliance_csid);
    const zatcaEnv = settings.zatca_env || 'sandbox';
    
    const cryptoMod = require('crypto');
    const { generateUBL21XML } = require('../electron/zatca_utils.cjs');

    const results = [];
    const isSandbox = zatcaEnv !== 'production';

    const runOne = async (label, invoiceData) => {
        try {
            const uuid = cryptoMod.randomUUID();
            const xml = generateUBL21XML({
                ...invoiceData,
                uuid,
                prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
                icv: 1,
            });
            // Ensure the double-base64 token is properly decoded and formatted as a valid PEM string
            const token = compCsid.binarySecurityToken || '';
            const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
            const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
            const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
                xml, device.private_key_pem, compCertPem, invoiceData.timestamp
            );
            const { pubKeyPem, certSignature } = zatcaPhase2.extractCertDetails(compCertPem);
            const tlv = zatcaPhase2.generateZatcaTLV9(
                settings.business_name_ar || 'مؤسسة تجارية',
                settings.vat_number || settings.tax_number || '300000000000003',
                invoiceData.timestamp, invoiceData.total, invoiceData.total * 0.15,
                invoiceHashBase64,
                signatureBase64,
                pubKeyPem,
                certSignature
            );
            
            let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);
            signedXml = zatcaPhase2.injectQRPayload(signedXml, tlv);
            
            const xmlBase64 = Buffer.from(signedXml).toString('base64');

            const response = await zatcaPhase2.checkComplianceInvoice(
                invoiceHashBase64, xmlBase64, uuid,
                compCsid.binarySecurityToken, compCsid.secret, isSandbox
            );
            const passed = !response.error && (response.validationResults?.status === 'PASS' || response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED');
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
        vatNo: settings.vat_number,
        vatRate: 0.15,
        address: {
            street: settings.address_street || settings.street || 'شارع',
            building: settings.address_building || settings.building || '1111',
            district: settings.address_district || settings.district || 'حي',
            city: settings.address_city || settings.city || 'الرياض',
            postal: settings.address_postal || settings.postal || '12345',
            additional_street: settings.address_additional_street || '',
            country: settings.address_country || settings.country || 'SA'
        }
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

    console.log(JSON.stringify(results, null, 2));
    const allPassed = results.every(r => r.passed);
    console.log("Overall passed:", allPassed);
    process.exit(allPassed ? 0 : 1);
});
