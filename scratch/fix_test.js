const crypto = require('crypto');
const zatca = require('../electron/zatca_phase2.cjs');
const { generateUBL21XML, generateUUID } = require('../electron/zatca_utils.cjs');
const fs = require('fs');

let certPem = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/cert.pem', 'utf8').trim();
if (!certPem.includes('BEGIN CERTIFICATE')) {
    certPem = `-----BEGIN CERTIFICATE-----\n${certPem}\n-----END CERTIFICATE-----`;
}
let privateKeyPem = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/ec-secp256k1-priv-key.pem', 'utf8').trim();
if (!privateKeyPem.includes('BEGIN EC PRIVATE KEY')) {
    privateKeyPem = `-----BEGIN EC PRIVATE KEY-----\n${privateKeyPem}\n-----END EC PRIVATE KEY-----`;
}

try {
    const saleTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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

    const invoiceHash = zatca.hashXML(xml);
    const signatureBase64 = zatca.signXMLHash(xml, privateKeyPem);
    const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/[\n\r]/g, '');
    const env = zatca.buildSignatureEnvelope(invoiceHash, signatureBase64, certBase64, saleTimestamp, certPem);
    
    let signedXml = xml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', env);
    
    const { pubKeyPem: extPubKey, certSignature } = zatca.extractCertDetails(certPem);
    const tlv = zatca.generateZatcaTLV9(
        'مؤسسة تجارية', '300000000000003', saleTimestamp, 115.00, 15.00,
        invoiceHash, signatureBase64, extPubKey, certSignature
    );
    signedXml = signedXml.replace('<!-- QR_PLACEHOLDER -->', `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlv}</cbc:EmbeddedDocumentBinaryObject>`);

    signedXml = signedXml.trim();

    fs.writeFileSync('sample_fixed_invoice.xml', signedXml);
    console.log("Written to sample_fixed_invoice.xml");

} catch (e) {
    console.error("Error generating sale:", e);
}
