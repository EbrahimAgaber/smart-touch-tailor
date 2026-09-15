#!/usr/bin/env node
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const forge  = require('node-forge');

const {
    signAndPackageInvoice,
    extractCertDetails
} = require('./electron/zatca_phase2.cjs');

// ── Check CLI args ─────────────────────────────────────────────────────────────
const unsignedPath = process.argv[2];
if (!unsignedPath) {
    console.error('❌ Error: Please specify the path to the unsigned XML file.');
    console.error('Usage: node sign_custom_invoice.js <path-to-unsigned.xml> [output-path.xml]');
    process.exit(1);
}

const resolvedInput = path.isAbsolute(unsignedPath) ? unsignedPath : path.resolve(process.cwd(), unsignedPath);
if (!fs.existsSync(resolvedInput)) {
    console.error(`❌ Error: File not found: ${resolvedInput}`);
    process.exit(1);
}

const outputPath = process.argv[3] 
    ? (path.isAbsolute(process.argv[3]) ? process.argv[3] : path.resolve(process.cwd(), process.argv[3]))
    : path.join(path.dirname(resolvedInput), path.basename(resolvedInput, '.xml') + '_signed.xml');

// ── Load or generate signing key ───────────────────────────────────────────────
const keyPath = path.join(__dirname, 'last_signing_key.pem');
let privateKeyPem;
if (fs.existsSync(keyPath)) {
    privateKeyPem = fs.readFileSync(keyPath, 'utf8');
    console.log('✔  Loaded existing private key from last_signing_key.pem');
} else {
    console.log('Generating new secp256k1 key pair...');
    const keys = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding:  { type: 'spki',  format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKeyPem = keys.privateKeyPem;
    fs.writeFileSync(keyPath, privateKeyPem, 'utf8');
    console.log(`✔  Generated and saved keys to last_signing_key.pem`);
}

// ── Create self-signed X.509 cert (using ASN.1 directly to bypass forge OID bug) ─
const nodePrivKey = crypto.createPrivateKey(privateKeyPem);
const pubKeyObj = crypto.createPublicKey({ key: privateKeyPem, format: 'pem' });
const publicKeyPem = pubKeyObj.export({ type: 'spki', format: 'pem' });

const pubKeyDer = Buffer.from(
    publicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/[\n\r]/g, ''),
    'base64'
);
const spkiAsn1 = forge.asn1.fromDer(forge.util.createBuffer(pubKeyDer.toString('binary')));

const OID_ecdsaWithSHA256 = '1.2.840.10045.4.3.2';
if (!forge.pki.oids[OID_ecdsaWithSHA256]) forge.pki.oids[OID_ecdsaWithSHA256] = 'ecdsaWithSHA256';

const now = new Date();
const oneYearLater = new Date(now);
oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

function buildTbsCertAsn1() {
    const encodeDate = (d) => {
        const pad = (n) => n.toString().padStart(2, '0');
        const y = d.getUTCFullYear() % 100;
        const str = `${pad(y)}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
        return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTCTIME, false, str);
    };

    const encodeName = (attrs) => forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true,
        attrs.map(({ oid, value }) =>
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                        forge.asn1.oidToDer(oid).getBytes()),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, value),
                ]),
            ])
        )
    );

    const nameAttrs = [
        { oid: '2.5.4.6',  value: 'SA' },
        { oid: '2.5.4.10', value: 'Smart Touch POS' },
        { oid: '2.5.4.3',  value: 'Test-ZATCA' },
    ];

    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x02'),
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01'),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
        ]),
        encodeName(nameAttrs),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            encodeDate(now),
            encodeDate(oneYearLater),
        ]),
        encodeName(nameAttrs),
        spkiAsn1,
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 3, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                        forge.asn1.oidToDer('2.5.29.19').getBytes()),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                        forge.asn1.toDer(
                            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [])
                        ).getBytes()),
                ]),
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                        forge.asn1.oidToDer('2.5.29.15').getBytes()),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BOOLEAN, false, '\xff'),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                        forge.asn1.toDer(
                            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, '\x05\xc0')
                        ).getBytes()),
                ]),
            ]),
        ]),
    ]);
}

function buildEcCertAsn1(tbsFields, sigDer) {
    const sigBitString = '\x00' + sigDer.toString('binary');
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        tbsFields,
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, sigBitString),
    ]);
}

const tbsAsn1 = buildTbsCertAsn1();
const tbsDer = Buffer.from(forge.asn1.toDer(tbsAsn1).getBytes(), 'binary');
const tbsHash = crypto.createHash('sha256').update(tbsDer).digest();
const certSigDer = crypto.sign(null, tbsHash, { key: nodePrivKey, dsaEncoding: 'der' });

const certAsn1 = buildEcCertAsn1(tbsAsn1, certSigDer);
const certDer = Buffer.from(forge.asn1.toDer(certAsn1).getBytes(), 'binary');
const certPem = '-----BEGIN CERTIFICATE-----\n' +
    certDer.toString('base64').match(/.{1,64}/g).join('\n') +
    '\n-----END CERTIFICATE-----\n';

// ── Read unsigned XML and extract values ──────────────────────────────────────
let xml = fs.readFileSync(resolvedInput, 'utf8');

// Ensure UBLExtensions placeholder exists
if (!xml.includes('<ext:UBLExtensions>')) {
    xml = xml.replace('<cbc:ProfileID>', '<ext:UBLExtensions></ext:UBLExtensions>\n<cbc:ProfileID>');
}

// Regex extractions
const totalMatch = xml.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
const taxMatch   = xml.match(/<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
const dateMatch  = xml.match(/<cbc:IssueDate[^>]*>([^<]+)<\/cbc:IssueDate>/);
const timeMatch  = xml.match(/<cbc:IssueTime[^>]*>([^<]+)<\/cbc:IssueTime>/);
const supplierNameMatch = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:Name>([^<]+)<\/cbc:Name>/);
const supplierVatMatch  = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>([^<]+)<\/cbc:CompanyID>/);

if (!totalMatch || !taxMatch || !dateMatch || !timeMatch) {
    console.error('❌ Error: Could not parse invoice total, tax, or date/time from the XML file.');
    console.error('Please ensure it is a valid UBL 2.1 invoice XML.');
    process.exit(1);
}

const total = parseFloat(totalMatch[1]).toFixed(2);
const tax   = parseFloat(taxMatch[1]).toFixed(2);
const date  = dateMatch[1].trim();
const time  = timeMatch[1].trim().replace(/Z$/, '');
const timestamp = `${date}T${time}`;

const supplierName = supplierNameMatch ? supplierNameMatch[1].trim() : 'مؤسسة تجارية';
const supplierVat  = supplierVatMatch ? supplierVatMatch[1].trim() : '300000000000003';

console.log(`Invoice values parsed successfully:`);
console.log(`  - Supplier:  ${supplierName}`);
console.log(`  - VAT Reg:   ${supplierVat}`);
console.log(`  - Total:     ${total} SAR`);
console.log(`  - Tax:       ${tax} SAR`);
console.log(`  - Timestamp: ${timestamp}`);

// Mock Device structure
const mockDevice = {
    private_key_pem: privateKeyPem,
    production_cert_pem: certPem,
    production_csid: JSON.stringify({
        binarySecurityToken: certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/[\n\r]/g, ''),
        secret: 'mock-secret'
    })
};

// Mock Settings structure
const mockSettings = {
    business_name_ar: supplierName,
    vat_number: supplierVat
};

// ── Run Sign and Package ──────────────────────────────────────────────────────
console.log('\nSigning invoice...');
const { signedXml, invoiceHash } = signAndPackageInvoice({
    xml,
    device: mockDevice,
    settings: mockSettings,
    timestamp,
    total,
    tax
});

fs.writeFileSync(outputPath, signedXml.replace(/\r\n/g, '\n'), 'utf8');
console.log(`\n✔  Wrote signed XML: ${outputPath}`);
console.log(`✔  Wrote signing key: ${keyPath}`);
console.log('\nNext steps to validate manually:');
console.log(`  1. Copy-Item "${outputPath}" c:\\my-pos\\v2\\zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps\\validate_invoice.xml`);
console.log(`  2. cd c:\\my-pos\\v2\\zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps`);
console.log(`  3. $env:FATOORA_HOME="c:\\my-pos\\v2\\zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps"`);
console.log(`  4. .\\fatoora.bat -validate -invoice validate_invoice.xml`);
