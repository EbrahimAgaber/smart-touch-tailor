const fs = require('fs');
const path = require('path');
const { signAndPackageInvoice } = require('./electron/zatca_phase2_impl.cjs');

const xmlPath = path.join(__dirname, 'ZATCA_INV-albasma.xml');
let xml = fs.readFileSync(xmlPath, 'utf8');

// Ensure UBLExtensions placeholder exists
if (!xml.includes('<ext:UBLExtensions>')) {
    xml = xml.replace('<cbc:ProfileID>', '<ext:UBLExtensions></ext:UBLExtensions>\n<cbc:ProfileID>');
}

// Extract values
const totalMatch = xml.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
const taxMatch   = xml.match(/<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
const dateMatch  = xml.match(/<cbc:IssueDate[^>]*>([^<]+)<\/cbc:IssueDate>/);
const timeMatch  = xml.match(/<cbc:IssueTime[^>]*>([^<]+)<\/cbc:IssueTime>/);
const supplierNameMatch = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:Name>([^<]+)<\/cbc:Name>/);
const supplierVatMatch  = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>([^<]+)<\/cbc:CompanyID>/);

if (!totalMatch || !taxMatch || !dateMatch || !timeMatch) {
    console.error('❌ Error: Could not parse invoice total, tax, or date/time from the XML file.');
    process.exit(1);
}

const total = parseFloat(totalMatch[1]).toFixed(2);
const tax   = parseFloat(taxMatch[1]).toFixed(2);
const date  = dateMatch[1].trim();
const time  = timeMatch[1].trim().replace(/Z$/, '');
const timestamp = `${date}T${time}`;

const supplierName = supplierNameMatch ? supplierNameMatch[1].trim() : 'مؤسسة تجارية';
const supplierVat  = supplierVatMatch ? supplierVatMatch[1].trim() : '300000000000003';

console.log(`Invoice values: Total=${total}, Tax=${tax}, Timestamp=${timestamp}`);

const certRaw = fs.readFileSync('tmp_cert.pem', 'utf8');
const keyRaw = fs.readFileSync('tmp_key.pem', 'utf8');

let formattedCert = certRaw;
const certStr = certRaw.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s/g, '');
const innerBase64 = Buffer.from(certStr, 'base64').toString('utf8');
if (innerBase64.startsWith('MII')) {
    formattedCert = '-----BEGIN CERTIFICATE-----\n' + innerBase64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';
}

// Node v22 can sign with tmp_key.pem directly.
const device = {
    production_csid: JSON.stringify({}),
    production_cert_pem: formattedCert,
    private_key_pem: keyRaw
};

const settings = {
    business_name_ar: supplierName,
    vat_number: supplierVat
};

console.log('\nSigning invoice...');
const { signedXml, invoiceHash } = signAndPackageInvoice({
    xml,
    device,
    settings,
    timestamp,
    total,
    tax
});

const outputPath = path.join(__dirname, 'ZATCA_INV-albasma_signed.xml');
fs.writeFileSync(outputPath, signedXml.replace(/\r\n/g, '\n'), 'utf8');
console.log(`\n✔  Wrote signed XML: ${outputPath}`);
console.log(`Invoice Hash: ${invoiceHash}`);
