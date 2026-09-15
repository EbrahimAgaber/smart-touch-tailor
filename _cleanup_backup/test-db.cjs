const db = require('better-sqlite3')('C:/Users/bin-g/AppData/Roaming/البصمة الذكية/pos_data.db');
const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();

console.log('--- DEVICE ---');
console.log('ID:', device ? device.id : null);
console.log('compliance_csid exists:', !!(device && device.compliance_csid));
if (device && device.compliance_csid) {
    const csid = JSON.parse(device.compliance_csid);
    console.log('Binary token length:', csid.binarySecurityToken ? csid.binarySecurityToken.length : 0);
}

console.log('\n--- SETTINGS ---');
console.log('VAT:', settings.vat_number);
console.log('CRN:', settings.crn);
console.log('Env:', settings.zatca_env);

require('electron').app.quit();
