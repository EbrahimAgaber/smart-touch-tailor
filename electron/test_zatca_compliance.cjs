const fs = require('fs');
const path = require('path');
const zatca = require('./zatca_phase2.cjs');

async function runTest() {
    console.log("Generating key pair with secp256k1...");
    const { privateKeyPem, publicKeyPem } = zatca.generateDeviceKeyPair();
    
    // Read sample XML
    const xmlPath = path.join(__dirname, 'sample_fixed_invoice.xml');
    if (!fs.existsSync(xmlPath)) {
        console.error("No sample XML found.");
        return;
    }
    
    let xmlString = fs.readFileSync(xmlPath, 'utf8');
    
    console.log("Hashing XML...");
    const invoiceHash = zatca.hashXML(xmlString);
    
    console.log("Signing XML...");
    const signatureBase64 = zatca.signXMLHash(xmlString, privateKeyPem);
    
    const certBase64 = Buffer.from("dummy-cert-data").toString('base64');
    const env = zatca.buildSignatureEnvelope(invoiceHash, signatureBase64, certBase64, new Date().toISOString(), "dummy-cert");
    
    if (xmlString.includes('<ext:UBLExtensions>')) {
        xmlString = xmlString.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, env);
    } else {
        xmlString = xmlString.replace('</cbc:CustomizationID>', '</cbc:CustomizationID>\n' + env);
    }
    
    const outPath = path.join(__dirname, 'test_signed_invoice.xml');
    fs.writeFileSync(outPath, xmlString);
    console.log("Signed invoice saved to", outPath);
}

runTest().catch(console.error);
