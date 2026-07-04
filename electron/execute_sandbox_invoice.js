const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
    try {
        const db = require('./database.cjs');
        db.initDatabase(path.join(__dirname, '..'));
        
        const settings = db.getSettings();
        const device = db.getZatcaDevice();
        
        const zatcaPhase2 = require('./zatca_phase2.cjs');
        const { generateUBL21XML } = require('./zatca_utils.cjs');
        const cryptoMod = require('crypto');

        let csidToUse = null;
        let isCompliance = false;

        if (device && device.production_csid) {
            csidToUse = JSON.parse(device.production_csid);
        } else if (device && device.compliance_csid) {
            csidToUse = JSON.parse(device.compliance_csid);
            isCompliance = true;
            console.log("Using Compliance CSID for Sandbox submission.");
        } else {
            console.error("No Production or Compliance CSID found in device settings. Cannot submit to sandbox.");
            process.exit(1);
        }

        const uuid = cryptoMod.randomUUID();
        const saleTimestamp = new Date().toISOString();
        
        // Generate a test invoice
        const xml = generateUBL21XML({
            invoice: 'INV-TEST-SUBMIT-001',
            icv: 1, 
            timestamp: saleTimestamp, 
            total: 115, 
            items: [{ Name: 'Sandbox Test Product', Qty: 1, Price: 100 }], 
            uuid: uuid, 
            prevHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 
            seller: settings.store_name || 'Test Store', 
            vatNo: settings.vat_number || '300000000000003',
            vatRate: 0.15, 
            discount: 0,
            typeCode: '388',
            billingRef: null,
            buyer: null,
            paymentMethod: 'cash',
            crn: '1010010000',
            address: {
                street: 'Street',
                building: '1234',
                district: 'District',
                city: 'Riyadh',
                postal: '12345',
                crn: '1010010000',
                country: 'SA'
            }
        });

        // Parse cert
        const token = csidToUse.binarySecurityToken || '';
        const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
        const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
        
        const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
            xml, device.private_key_pem, compCertPem, saleTimestamp
        );
        
        let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);
        
        const { pubKeyPem: extPubKey, certSignature } = zatcaPhase2.extractCertDetails(compCertPem);
        const tlv = zatcaPhase2.generateZatcaTLV9(
            settings.store_name || 'Test Store', settings.vat_number || '300000000000003', saleTimestamp, 115, 15,
            invoiceHashBase64, signatureBase64, extPubKey, certSignature
        );
        
        signedXml = zatcaPhase2.injectQRPayload(signedXml, tlv);
        const xmlBase64 = Buffer.from(signedXml).toString('base64');
        
        fs.writeFileSync(path.join(__dirname, 'sandbox_submit_test.xml'), signedXml);

        console.log("Submitting to Sandbox API...");
        let response;
        if (isCompliance) {
            response = await zatcaPhase2.checkComplianceInvoice(invoiceHashBase64, xmlBase64, uuid, csidToUse.binarySecurityToken, csidToUse.secret, true);
        } else {
            response = await zatcaPhase2.reportInvoice(xmlBase64, uuid, invoiceHashBase64, true, csidToUse.binarySecurityToken, csidToUse.secret);
        }
        
        console.log("API Response:", JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Error generating/submitting sandbox invoice:", e);
    }
    app.quit();
});
