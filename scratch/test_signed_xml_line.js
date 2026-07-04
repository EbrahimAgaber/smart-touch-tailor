const zatcaPhase2 = require('../electron/zatca_phase2.cjs');
const { generateUBL21XML } = require('../electron/zatca_utils.cjs');
const fs = require('fs');

const address = {
    street:   'شارع الملك',
    building: '1234',
    district: 'الصحافة',
    city:     'الرياض',
    postal:   '12345',
    country:  'SA',
};

const baseInvoice = {
    invoice: `COMPLY-${Date.now()}`,
    timestamp: new Date().toISOString(),
    total: '115.00',
    items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    seller: 'Test Seller',
    vatNo: '399999999900003',
    vatRate: 0.15,
    address,
    icv: 1,
    uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    prevHash: 'NWZkY2M0ZDU2YjY3Y2I0OTlhYTQ3MDk4Y2U5YTEwYmQ4Y2IyMzQyMDFlODFlOTQ4YjJmYTI4Mzg0OTQ1MTBhOQ==',
};

const xml = generateUBL21XML(baseInvoice);

// Use a mock cert/key pair (from the comparison script or device keys)
const keys = zatcaPhase2.generateDeviceKeyPair();
// Create a mock compliance cert PEM
const mockCertPem = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/cert.pem', 'utf8');

const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
    xml, keys.privateKeyPem, mockCertPem, baseInvoice.timestamp
);

let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);
const lines = signedXml.split('\n');
console.log("Total lines in signed XML:", lines.length);
lines.forEach((line, idx) => {
    console.log(`${idx + 1}: ${line}`);
});
