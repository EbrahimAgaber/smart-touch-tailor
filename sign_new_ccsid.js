const fs = require('fs');
const zatcaPhase2 = require('./electron/zatca_phase2_impl.cjs');

try {
    let unsignedXml = fs.readFileSync('unsigned.xml', 'utf8');
    if (!unsignedXml.includes('<ext:UBLExtensions>')) {
        unsignedXml = unsignedXml.replace('<cbc:ProfileID>', '<ext:UBLExtensions></ext:UBLExtensions>\n    <cbc:ProfileID>');
    }

    const privateKeyPem = fs.readFileSync('new_priv.pem', 'utf8');
    const certPem = fs.readFileSync('new_cert.pem', 'utf8');

    const timestamp = new Date().toISOString(); 
    
    const signedXml = zatcaPhase2.signInvoiceXML(unsignedXml, privateKeyPem, certPem, timestamp);
    
    fs.writeFileSync('new_node_signed.xml', signedXml);
    console.log("Successfully signed new_node_signed.xml");
} catch (e) {
    console.error("Error signing:", e);
}
