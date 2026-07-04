const zatcaPhase2 = require('./electron/zatca_phase2_impl.cjs');
const db = require('./electron/database.cjs');
db.initDatabase(__dirname);
const database = db.getDbInstance();

const device = database.prepare('SELECT * FROM zatca_device LIMIT 1').get();
const settingsRows = database.prepare('SELECT * FROM business_settings').all();
const settings = {};
for (const r of settingsRows) settings[r.key] = r.value;

const crypto = require('crypto');
const pubKey = crypto.createPublicKey(device.private_key_pem || device.private_key);
const pubKeyPem = pubKey.export({ type: 'spki', format: 'pem' });

try {
    const { csrBase64, csrPem } = zatcaPhase2.generateCSR(
        device.private_key_pem || device.private_key, pubKeyPem,
        { 
            EGS_SN: device.device_id || 'POS-01', 
            UID: settings.vat_number,
            ORG: settings.business_name_ar || 'Test Org', 
            OU: settings.zatca_ou || 'Head Office', 
            IND: settings.zatca_ind || 'Retail' 
        }
    );
    console.log('SUCCESS CSR:', csrPem.substring(0, 50));
} catch(e) {
    console.error('ERROR:', e.message);
}
