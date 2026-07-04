const { app } = require('electron');
app.whenReady().then(async () => {
    try {
        const db = require('../electron/database.cjs');
        const z = require('../electron/zatca_phase2_impl.cjs');
        db.initDatabase('C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية');
        const otp = '123456';
        const env = 'sandbox';
        let d = db.getZatcaDevice();
        if(!d || !d.private_key_pem) {
            const keys = z.generateDeviceKeyPair();
            db.updateZatcaDevice({ id: d ? d.id : 1, device_id: 'POS-9013', private_key_pem: keys.privateKeyPem });
            d = db.getZatcaDevice();
        }
        const s = db.getSettings();
        const vat = s.vat_number || '399999999900003';
        const egsSn = '1-SmartTouch|2-POS-9013|3-' + vat;
        const info = { EGS_SN: egsSn, UID: vat, CN: egsSn.replace(/\|/g, '-'), ORG: s.business_name_ar || 'Test', OU: 'Head Office', IND: 'Retail', title: '1100', address: 'Riyadh', environment: env };
        console.log('CSR Generation...');
        const { csrBase64, csrPem, privateKeyPem } = z.generateCSR(d.private_key_pem, null, info);
        db.updateZatcaDevice({ id: d.id, csr_pem: csrPem, private_key_pem: privateKeyPem || d.private_key_pem });
        console.log('Issue Compliance CSID...');
        const comp = await z.issueComplianceCSID(csrBase64, otp, env);
        db.updateZatcaDevice({ id: d.id, compliance_csid: JSON.stringify(comp) });
        console.log('Issue Production CSID...');
        const prod = await z.issueProductionCSID(comp.requestID || comp.requestId, comp.binarySecurityToken, comp.secret, env);
        db.updateZatcaDevice({ id: d.id, production_csid: JSON.stringify(prod) });
        const cleanToken = prod.binarySecurityToken.replace(/[\n\r\s]/g, '');
        const certPem = '-----BEGIN CERTIFICATE-----\n' + cleanToken + '\n-----END CERTIFICATE-----';
        db.updateZatcaDevice({ id: d.id, production_cert_pem: certPem, cert_expires_at: new Date().toISOString(), current_icv: 0 });
        console.log('DONE');
        app.quit();
    } catch(e) {
        console.error(e);
        app.quit();
    }
});
