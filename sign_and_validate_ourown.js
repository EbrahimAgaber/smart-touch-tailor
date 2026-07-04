const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const forge = require('node-forge');

const {
    signAndPackageInvoice,
    extractCertDetails
} = require('./electron/zatca_phase2.cjs');

const inputXmlPath = path.join(__dirname, 'ZATCA_INV-ourown.xml');
const outputXmlPath = path.join(__dirname, 'ZATCA_INV-ourown_signed.xml');

console.log('1. Generating new secp256r1 key pair...');
const keys = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // secp256r1
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const privateKeyPem = keys.privateKey;  // generateKeyPairSync returns privateKey/publicKey

console.log('2. Creating mock self-signed certificate for signing...');
const nodePrivKey = crypto.createPrivateKey(privateKeyPem);
const publicKeyPem = keys.publicKey; // already PEM from encoding option above

const pubKeyDer = Buffer.from(
    publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/[\n\r]/g, ''),
    'base64'
);
const spkiAsn1 = forge.asn1.fromDer(forge.util.createBuffer(pubKeyDer.toString('binary')));
const OID_ecdsaWithSHA256 = '1.2.840.10045.4.3.2';
if (!forge.pki.oids[OID_ecdsaWithSHA256]) forge.pki.oids[OID_ecdsaWithSHA256] = 'ecdsaWithSHA256';

const now = new Date();
const oneYearLater = new Date(now);
oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

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
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(oid).getBytes()),
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

const tbsAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x02'),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01'),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
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
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer('2.5.29.19').getBytes()),
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                    forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [])).getBytes()),
            ]),
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer('2.5.29.15').getBytes()),
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BOOLEAN, false, '\xff'),
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                    forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, '\x05\xc0')).getBytes()),
            ]),
        ]),
    ]),
]);

const tbsDer = Buffer.from(forge.asn1.toDer(tbsAsn1).getBytes(), 'binary');
const tbsHash = crypto.createHash('sha256').update(tbsDer).digest();
const certSigDer = crypto.sign(null, tbsHash, { key: nodePrivKey, dsaEncoding: 'der' });

const certAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    tbsAsn1,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, '\x00' + certSigDer.toString('binary')),
]);
const certDer = Buffer.from(forge.asn1.toDer(certAsn1).getBytes(), 'binary');
const certPem = '-----BEGIN CERTIFICATE-----\n' + certDer.toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';

console.log('3. Reading ZATCA_INV-ourown.xml...');
let xml = fs.readFileSync(inputXmlPath, 'utf8');

// Ensure UBLExtensions placeholder exists
if (!xml.includes('<ext:UBLExtensions>')) {
    xml = xml.replace('<cbc:ProfileID>', '<ext:UBLExtensions></ext:UBLExtensions>\n<cbc:ProfileID>');
}

// Regex extractions
const totalMatch = xml.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
const taxMatch   = xml.match(/<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
const dateMatch  = xml.match(/<cbc:IssueDate[^>]*>([^<]+)<\/cbc:IssueDate>/);
const timeMatch  = xml.match(/<cbc:IssueTime[^>]*>([^<]+)<\/cbc:IssueTime>/);

const total = totalMatch ? parseFloat(totalMatch[1]).toFixed(2) : "26.00";
const tax   = taxMatch ? parseFloat(taxMatch[1]).toFixed(2) : "3.40";
const date  = dateMatch ? dateMatch[1].trim() : "2026-06-25";
const time  = timeMatch ? timeMatch[1].trim().replace(/Z$/, '') : "18:58:49";
const timestamp = `${date}T${time}`;

console.log('4. Signing invoice using our engine (zatca_phase2_impl.cjs)...');
const { signedXml, invoiceHash } = signAndPackageInvoice({
    xml,
    device: {
        private_key_pem: privateKeyPem,
        production_cert_pem: certPem,
        production_csid: JSON.stringify({ binarySecurityToken: "mock", secret: "mock" })
    },
    settings: {
        business_name_ar: "Maximum Speed Tech Supply LTD",
        vat_number: "300075585600003"
    },
    timestamp,
    total,
    tax
});

fs.writeFileSync(outputXmlPath, signedXml.replace(/\r\n/g, '\n'), 'utf8');
console.log(`\n✔  Wrote signed XML to: ${outputXmlPath}`);

console.log('\n5. Validating signed XML with ZATCA SDK (fatoora.bat)...');
try {
    const fatooraCmd = `.\\zatca-einvoicing-sdk-Java-238-R3.4.8\\Apps\\fatoora.bat -validate -invoice "${outputXmlPath}"`;
    console.log(`Running: ${fatooraCmd}`);
    const validateOutput = execSync(fatooraCmd, { encoding: 'utf8', cwd: __dirname });
    console.log(validateOutput);
} catch (err) {
    console.log("Validation output/error:");
    console.log(err.stdout);
    console.log(err.stderr);
}
