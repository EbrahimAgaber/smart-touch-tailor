const fs = require('fs');
const path = require('path');
const { signAndPackageInvoice } = require('./zatca_phase2_patched.cjs');

// Read the ZATCA certificates and add PEM headers
const certRaw = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/cert.pem', 'utf8').trim();
const certPem = `-----BEGIN CERTIFICATE-----\n${certRaw.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;

const privKeyRaw = fs.readFileSync('zatca-einvoicing-sdk-Java-238-R3.4.8/Data/Certificates/ec-secp256k1-priv-key.pem', 'utf8').trim();
const privKeyPem = `-----BEGIN EC PRIVATE KEY-----\n${privKeyRaw.match(/.{1,64}/g).join('\n')}\n-----END EC PRIVATE KEY-----\n`;

// Read unsigned XML
let xml = fs.readFileSync('unsigned.xml', 'utf8');
if (!xml.includes('<ext:UBLExtensions>')) {
    xml = xml.replace('<cbc:ProfileID>', '<ext:UBLExtensions></ext:UBLExtensions>\n    <cbc:ProfileID>');
}

// Read Java signed XML to extract the exact SigningTime it used
const javaSigned = fs.readFileSync('java_signed3.xml', 'utf8');
const timeMatch = javaSigned.match(/<xades:SigningTime>([^<]+)<\/xades:SigningTime>/);
if (!timeMatch) {
    throw new Error('Could not find SigningTime in java_signed3.xml');
}
const exactJavaTimestamp = timeMatch[1]; // e.g. "2026-07-03T00:04:28"

console.log('Using exact Java timestamp:', exactJavaTimestamp);

const mockDevice = {
    private_key_pem: privKeyPem,
    production_cert_pem: certPem,
    production_csid: JSON.stringify({
        binarySecurityToken: certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/[\n\r]/g, ''),
        secret: 'mock-secret'
    })
};

const mockSettings = {
    business_name_ar: 'مؤسسة تجارية',
    vat_number: '300000000000003'
};

const { signedXml } = signAndPackageInvoice({
    xml,
    device: mockDevice,
    settings: mockSettings,
    timestamp: exactJavaTimestamp, // pass the exact timestamp
    total: '12.00',
    tax: '1.57'
});

fs.writeFileSync('node_signed_exact.xml', signedXml);

function extractSignedProperties(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const startTag = '<xades:SignedProperties';
    const endTag = '</xades:SignedProperties>';
    const startIdx = content.indexOf(startTag);
    const endIdx = content.indexOf(endTag) + endTag.length;
    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`Could not find SignedProperties in ${filename}`);
    }
    return content.substring(startIdx, endIdx);
}

const javaProps = extractSignedProperties('java_signed3.xml');
const nodeProps = extractSignedProperties('node_signed_exact.xml');

fs.writeFileSync('java_props.xml', javaProps);
fs.writeFileSync('node_props.xml', nodeProps);

console.log('Done generating exact matching node signed properties.');
