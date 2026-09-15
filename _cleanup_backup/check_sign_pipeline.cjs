const { app } = require('electron');
const dbPath = 'C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db';
const db = require('better-sqlite3')(dbPath);
const { signAndPackageInvoice } = require('./electron/zatca_phase2_impl.cjs');
app.whenReady().then(() => {
    const queue = db.prepare('SELECT * FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
    const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
    
    // Grab original XML
    let xml = queue.signed_xml;
    // We need the original unsigned XML to pass into signAndPackageInvoice, but we only have signed.
    // Strip everything after <ext:UBLExtensions>
    if (xml.includes('<ext:UBLExtensions>')) {
        xml = xml.split('<ext:UBLExtensions>')[0] + '</Invoice>';
    }
    
    try {
        const { signedXml, invoiceHash } = signAndPackageInvoice({
            xml,
            device,
            settings: { vat_number: '300000000000003' },
            timestamp: new Date().toISOString(),
            total: 100,
            tax: 15,
            db
        });
        console.log("PIPELINE SUCCESS!");
        console.log("SIGNED HASH:", invoiceHash);
    } catch(e) {
        console.log("PIPELINE ERROR:", e);
    }
    process.exit(0);
});
