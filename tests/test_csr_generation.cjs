const forge = require('node-forge');
const asn1 = forge.asn1;
const zatca = require('../electron/zatca_phase2.cjs');

console.log('Generating key pair...');
const { privateKeyPem, publicKeyPem } = zatca.generateDeviceKeyPair();

console.log('Generating CSR...');
const info = {
    EGS_SN: '1-SmartTouch|2-POS|3-001',
    UID: '310000000000003',
    ORG: 'Smart Touch POS',
    OU: 'Main Branch',
    IND: 'Retail',
    title: '1100',
    address: 'Riyadh'
};

const { csrBase64, csrPem } = zatca.generateCSR(privateKeyPem, publicKeyPem, info);

console.log('CSR PEM:');
console.log(csrPem);

/*
console.log('Decoding CSR...');
const csr = forge.pki.certificationRequestFromPem(csrPem);

console.log('Subject Attributes:');
csr.subject.attributes.forEach(attr => {
    console.log(`  ${attr.shortName || attr.name} (${attr.type}): ${attr.value}`);
});

console.log('Extensions:');
const extensions = csr.getAttribute({ name: 'extensionRequest' }).extensions;
extensions.forEach(ext => {
    console.log(`  Extension: ${ext.name || ext.id} (critical: ${ext.critical})`);
    if (ext.name === 'subjectAltName') {
        console.log(`    SAN:`, ext.altNames);
    }
});
*/

console.log('\nDecoding raw ASN.1 to verify exact OIDs in SAN directoryName...');
const der = forge.pem.decode(csrPem)[0].body;
const obj = asn1.fromDer(forge.util.createBuffer(der));

function findOids(node, found = []) {
    if (node.type === asn1.Type.OID) {
        found.push(asn1.derToOid(node.value));
    }
    if (node.value && Array.isArray(node.value)) {
        node.value.forEach(child => findOids(child, found));
    } else if (node.type === asn1.Type.OCTETSTRING) {
        try {
            const inner = asn1.fromDer(forge.util.createBuffer(node.value));
            findOids(inner, found);
        } catch (e) {
            // not asn1
        }
    }
    return found;
}

const allOids = findOids(obj);
console.log('All OIDs present in CSR:');
console.log(allOids);

const expectedOids = [
    '2.5.4.6', // C
    '2.5.4.10', // O
    '2.5.4.11', // OU
    '2.5.4.3', // CN
    '2.5.4.26', // registeredAddress
    '2.5.4.15', // businessCategory
    '2.5.4.45', // UID
    '2.5.4.5', // serialNumber
    '2.5.4.12', // title
    '2.5.29.17', // subjectAltName
    '1.3.6.1.4.1.311.20.2' // Certificate Template Name
];

let missing = expectedOids.filter(oid => !allOids.includes(oid));
if (missing.length === 0) {
    console.log('✅ All required OIDs are present in the CSR!');
} else {
    console.log('❌ Missing OIDs:', missing);
}
