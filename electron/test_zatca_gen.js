const crypto = require('crypto');
const zatca = require('./zatca_phase2.cjs');
const { generateUBL21XML, generateUUID } = require('./zatca_utils.cjs');
const fs = require('fs');

// Generate dummy key pair and self-signed cert to simulate ZATCA credentials
const { privateKeyPem, publicKeyPem } = zatca.generateDeviceKeyPair();

// Create a self-signed ECDSA cert for testing using OpenSSL
const { execSync } = require('child_process');
fs.writeFileSync('temp_key.pem', privateKeyPem);
execSync('openssl req -x509 -new -nodes -key temp_key.pem -sha256 -days 365 -out temp_cert.pem -subj "/CN=Test-ZATCA"');
const certPem = fs.readFileSync('temp_cert.pem', 'utf8');
fs.unlinkSync('temp_key.pem');
fs.unlinkSync('temp_cert.pem');

try {
    const saleTimestamp = new Date().toISOString();
    const invoiceUUID = generateUUID();
    const xml = generateUBL21XML({
        invoice: 'INV-TEST-001', icv: 1, timestamp: saleTimestamp, total: 115, 
        items: [
            { Name: 'Test Product', Qty: 1, Price: 100 }
        ], 
        uuid: invoiceUUID, prevHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 
        seller: 'مؤسسة تجارية', 
        vatNo: '300000000000003',
        vatRate: 0.15, discount: 0,
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

    fs.writeFileSync('unsigned_invoice.xml', xml);
    // Simulate what database.cjs does
    const { envelope, invoiceHashBase64, signatureBase64 } = zatca.signInvoiceXML(xml, privateKeyPem, certPem, saleTimestamp);
    
    // Fix the whitespace bug that causes hash mismatch:
    // The placeholder had 4 spaces before it. If we don't match the whitespace exactly, 
    // the text nodes left behind after UBLExtensions is stripped by the validator will differ 
    // from our Node.js canonicalization.
    let signedXml = xml.replace('    <!-- UBLEXTENSIONS_PLACEHOLDER -->\n', envelope.trim() + '\n');
    
    const { pubKeyPem: extPubKey, certSignature } = zatca.extractCertDetails(certPem);
    const tlv = zatca.generateZatcaTLV9(
        'مؤسسة تجارية', '300000000000003', saleTimestamp, 115, 15,
        invoiceHashBase64, signatureBase64, extPubKey, certSignature
    );
    signedXml = signedXml.replace('<!-- QR_PLACEHOLDER -->', `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlv}</cbc:EmbeddedDocumentBinaryObject>`);

    console.log("=== GENERATED XML ===");
    console.log(signedXml);
    console.log("=====================");
    fs.writeFileSync('sample_fixed_invoice.xml', signedXml);
    console.log("Written to sample_fixed_invoice.xml");

} catch (e) {
    console.error("Error generating sale:", e);
}
