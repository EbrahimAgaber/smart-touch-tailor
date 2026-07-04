const fs = require('fs');
const path = require('path');

// We require the real zatca_phase2 implementation dynamically.
// We must resolve it absolute to make sure it loads correctly.
const zatca = require('./zatca_phase2_impl.cjs');

const action = process.argv[2];
const inFile = process.argv[3];
const outFile = process.argv[4];

try {
    const input = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    let resultData;

    if (action === 'generateCSR') {
        resultData = zatca.generateCSR(input.privateKeyPem, input.publicKeyPem, input.info);
    } else if (action === 'signInvoiceXML') {
        resultData = zatca.signInvoiceXML(input.xmlString, input.privateKeyPem, input.certPem, input.timestamp);
    } else if (action === 'extractCertDetails') {
        resultData = zatca.extractCertDetails(input.certPem);
    } else if (action === 'generateDeviceKeyPair') {
        resultData = zatca.generateDeviceKeyPair();
    } else if (action === 'signAndPackageInvoice') {
        resultData = zatca.signAndPackageInvoice(input);
    } else {
        throw new Error(`Unknown bridge action: ${action}`);
    }

    fs.writeFileSync(outFile, JSON.stringify({ data: resultData }), 'utf8');
    process.exit(0);
} catch (e) {
    fs.writeFileSync(outFile, JSON.stringify({ error: e.message }), 'utf8');
    process.exit(1);
}
