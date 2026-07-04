const { app } = require('electron');
const db = require('better-sqlite3')('C:\\Users\\bin-g\\AppData\\Roaming\\البصمة الذكية\\pos_data.db');
const { generateSignedXMLString } = require('zatca-xml-js/lib/zatca/signing/index.js');
const fs = require('fs');

app.whenReady().then(() => {
    const queue = db.prepare('SELECT signed_xml FROM zatca_queue ORDER BY id DESC LIMIT 1').get();
    if (!queue) process.exit(0);

    // Create a pure XML with placeholders that zatca-xml-js expects
    let pureXml = queue.signed_xml
        .replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, 'SET_UBL_EXTENSIONS_STRING')
        .replace(/<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/, 'SET_QR_CODE_DATA');
    
    // Some basic formatting adjustment because zatca-xml-js expects specific layout?
    
    const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
    
    try {
        const result = generateSignedXMLString({
            invoice_xml: pureXml,
            certificate_string: device.production_cert_pem,
            private_key_string: device.private_key_pem
        });
        
        fs.writeFileSync('zatca_signed.xml', result.signed_invoice_string);
        console.log("SUCCESS");
    } catch(e) {
        console.log("ERROR", e);
    }
    process.exit(0);
});
