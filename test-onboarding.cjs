const { app } = require('electron');
const db = require('./electron/database.cjs');
const zatcaPhase2 = require('./electron/zatca_phase2.cjs');

app.whenReady().then(async () => {
    db.initDatabase('C:/Users/bin-g/AppData/Roaming/البصمة الذكية');
    const device = db.getZatcaDevice();
    const settings = db.getSettings();
    const { generateUBL21XML } = require('./electron/zatca_utils.cjs');
    const cryptoMod = require('crypto');

    // NEW token from the real UI attempt
    const compCsid = {
        "requestID": 1234567890123,
        "dispositionMessage": "ISSUED",
        "binarySecurityToken": "TUlJQ0VqQ0NBYmVnQXdJQkFnSUdBWjhxWFVnTE1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nall3TnpBek1qTTBNalU1V2hjTk16RXdOekF6TWpFd01EQXdXakJmTVFzd0NRWURWUVFHRXdKVFFURVVNQklHQTFVRUN3d0xTR1ZoWkNCUFptWnBZMlV4SmpBa0JnTlZCQW9NSFUxaGVHbHRkVzBnVTNCbFpXUWdWR1ZqYUNCVGRYQndiSGtnVEZSRU1SSXdFQVlEVlFRRERBbGFRVlJEUVMxRlIxTXdWakFRQmdjcWhrak9QUUlCQmdVcmdRUUFDZ05DQUFSVm5ZQ296OHBPZGhEM0dTWU80ZE9qQW1BR3E1K1MzZmlyS0lqRi9XSFRObS84K1hpOE5VeE92RUdqODlXRDhLeTBIY0lVZUhxc3BWRzl6TE8xbGRjVG80R3JNSUdvTUF3R0ExVWRFd0VCL3dRQ01BQXdnWmNHQTFVZEVRU0JqekNCaktTQmlUQ0JoakVrTUNJR0ExVUVCQXdiTVMxVGJXRnlkRlJ2ZFdOb2ZESXRVRTlUZkRNdFVFOVRMVEF4TVI4d0hRWUtDWkltaVpQeUxHUUJBUXdQTXprNU9UazVPVGs1T1RBd01EQXpNUTB3Q3dZRFZRUU1EQVF4TVRBd01SMHdHd1lEVlFRYURCVERtTUtudzVuQ2hNT1l3cm5EbWNLRXc1akNwekVQTUEwR0ExVUVEd3dHVW1WMFlXbHNNQW9HQ0NxR1NNNDlCQU1DQTBrQU1FWUNJUURJR2l1eFM5a1dNQStWZmNheDFBa3RDZkVpTVFjQmgrdFQrb1BaOVZ1SWdnSWhBS1psUjlBTGk0NVdaNXRCR3hEZGFRTmtoWTlJeWhRSEUwbjlUV3o3OVNNNA==",
        "secret": "/t0wfAn92esrNwa4Q16JjkEBZ3i6ekNFJzFucv1Ri08=",
        "errors": null
    };

    const token = compCsid.binarySecurityToken || '';
    const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
    const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;

    const results = [];

    const runOne = async (label, invoiceData) => {
        try {
            const uuid = cryptoMod.randomUUID();
            const xml = generateUBL21XML({
                ...invoiceData, uuid,
                prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
                icv: 1,
            });
            const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
                xml, device.private_key_pem, compCertPem, invoiceData.timestamp
            );
            const { pubKeyPem: compPubKeyPem, certSignature: compCertSignature } = zatcaPhase2.extractCertDetails(compCertPem);
            const tlv = zatcaPhase2.generateZatcaTLV9(
                settings.business_name_ar, settings.vat_number,
                invoiceData.timestamp, invoiceData.total || '115.00', '0',
                invoiceHashBase64, signatureBase64, compPubKeyPem, compCertSignature
            );
            let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);
            signedXml = zatcaPhase2.injectQRPayload(signedXml, tlv);
            const xmlBase64 = Buffer.from(signedXml).toString('base64');

            // isSandbox = true (zatcaEnv !== 'production')
            const response = await zatcaPhase2.checkComplianceInvoice(
                invoiceHashBase64, xmlBase64, uuid,
                compCsid.binarySecurityToken, compCsid.secret, true
            );
            const passed = !response.error && (
                response.validationResults?.status === 'PASS' ||
                response.validationResults?.status === 'WARNING' ||
                response.reportingStatus === 'REPORTED' ||
                response.clearanceStatus === 'CLEARED'
            );
            results.push({ label, passed, raw: response });
        } catch (err) {
            results.push({ label, passed: false, raw: { error: err.message, stack: err.stack } });
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

    console.log('\n=== FULL complianceCheck.results ===');
    console.log(JSON.stringify(results, null, 2));
    console.log('\nallPassed:', results.every(r => r.passed));

    app.quit();
});
