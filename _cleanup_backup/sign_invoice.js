#!/usr/bin/env node
'use strict';
/**
 * sign_invoice.js  --  ZATCA Phase 2 test invoice signer
 *
 * Fix applied here: node-forge does NOT support EC keys via pki.publicKeyFromPem().
 * OID 1.2.840.10045.2.1 is the EC public key OID and forge throws "Unknown OID".
 * Solution: build the X.509 cert using forge's low-level ASN.1 API so we never
 * ask forge to parse the EC public key through its RSA-only path.
 * We construct the cert's SubjectPublicKeyInfo directly from the raw DER bytes
 * that Node's crypto already gave us.
 *
 * Usage:
 *   node sign_invoice.js
 *
 * Then validate:
 *   node run-validator.js sample_fixed_invoice.xml
 */

const crypto = require('crypto');
const forge  = require('node-forge');
const fs     = require('fs');
const path   = require('path');

const {
    signInvoiceXML,
    generateZatcaTLV9,
    extractCertDetails,
    derToP1363,
} = require('./electron/zatca_phase2.cjs');

// ── Sanity: confirm P1363 fix is active ──────────────────────────────────────
(function sanityCheckP1363() {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const s = crypto.createSign('SHA256');
    s.update('test');
    const derBuf = s.sign({ key: privateKey });
    const p1363  = derToP1363(derBuf);
    if (p1363.length !== 64) throw new Error(`[sanity] P1363 wrong length: ${p1363.length}`);
    const b64 = p1363.toString('base64');
    if (b64.includes('_')) throw new Error('[sanity] underscore in base64 — still base64url');
    console.log(`✔  P1363 sanity: 64 bytes, base64 clean: ${b64.slice(0, 20)}...`);
})();

// ── 1. Generate secp256k1 key pair ────────────────────────────────────────────
console.log('\n[1/5] Generating secp256k1 key pair...');
const { privateKey: privateKeyPem, publicKey: publicKeyPem } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log('✔  Key pair generated');

// ── 2. Build self-signed X.509 cert WITHOUT forge EC key parsing ──────────────
// node-forge's pki.publicKeyFromPem() is RSA-only and throws on EC OID.
// We build the cert's SubjectPublicKeyInfo block from raw DER bytes instead.
console.log('\n[2/5] Creating self-signed X.509 certificate (forge ASN.1 path)...');

// Extract the raw SPKI DER bytes from Node's publicKey PEM
const pubKeyDer = Buffer.from(
    publicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/[\n\r]/g, ''),
    'base64'
);

// Build the SubjectPublicKeyInfo as a raw forge BitString so forge never
// tries to parse the EC OID through its RSA-only path
const spkiAsn1 = forge.asn1.fromDer(forge.util.createBuffer(pubKeyDer.toString('binary')));

const now = new Date();
const oneYearLater = new Date(now);
oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

// forge.pki.createCertificate() lets us set publicKey as the raw ASN.1 object
// by bypassing the normal publicKeyFromPem path entirely.
const cert = forge.pki.createCertificate();

// Assign public key directly as the ASN.1 SubjectPublicKeyInfo structure
// forge internally stores this as cert.publicKey — we set it via the forge
// cert.publicKeyBytes back-door used for non-RSA keys
cert.publicKey = {
    // forge needs these fields to serialise the cert; we provide a custom
    // toBitString() that returns the raw DER we already have
    toBitString: () => forge.util.createBuffer(pubKeyDer.toString('binary')).getBytes(),
    // The algorithm OID for EC: 1.2.840.10045.2.1, parameters: secp256k1 1.3.132.0.10
    oid: '1.2.840.10045.2.1',
};

cert.serialNumber = '01';
cert.validity.notBefore = now;
cert.validity.notAfter  = oneYearLater;

const attrs = [
    { name: 'commonName',            value: 'Test-ZATCA'  },
    { name: 'organizationName',      value: 'Smart Touch POS' },
    { name: 'countryName',           value: 'SA' },
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
]);

// ── Self-sign using Node crypto (forge's EC sign path is also unreliable) ─────
// We sign the TBS (to-be-signed) portion of the cert with Node crypto,
// then inject the signature bytes back via forge's ASN.1 layer.

// Serialise the cert WITHOUT signature first (forge does this internally
// when we call cert.sign(), but here we need the TBS cert bytes).
// The cleanest approach: let forge build the full cert structure normally
// but using a dummy signer, then we replace the signature.

// Actually the cleanest working approach with forge + EC:
// Use forge to build the cert structure and call sign() with a forge
// private key object that delegates to Node crypto internally.

// Build a forge private key shim that wraps Node's EC privateKey:
const nodePrivKey = crypto.createPrivateKey(privateKeyPem);

// forge.pki.createCertificate().sign() calls privateKey.sign(md)
// We provide a shim object whose sign() method uses Node crypto
const forgePrivKeyShim = {
    sign: (md) => {
        // md.digest().getBytes() gives us the hash bytes forge computed
        const hashBytes  = md.digest().getBytes();
        const hashBuf    = Buffer.from(hashBytes, 'binary');

        // Sign the hash with Node crypto (raw hash, no re-hashing)
        const sig = crypto.sign(null, hashBuf, { key: nodePrivKey, dsaEncoding: 'der' });
        return sig.toString('binary');
    },
    algorithm: 'RSASSA-PKCS1-V1_5-SIGN', // forge checks this internally; we override below
};

// Override the algorithm on the cert to ecdsa-with-SHA256
// forge.pki.oids has the EC signature OID
const OID_ecdsaWithSHA256 = '1.2.840.10045.4.3.2';
const OID_sha256           = '2.16.840.1.101.3.4.2.1';
const OID_ecPublicKey      = '1.2.840.10045.2.1';
const OID_secp256k1        = '1.3.132.0.10';

// Register OIDs with forge if not already registered
if (!forge.pki.oids[OID_ecdsaWithSHA256]) forge.pki.oids[OID_ecdsaWithSHA256] = 'ecdsaWithSHA256';
if (!forge.pki.oids['ecdsaWithSHA256'])   forge.pki.oids['ecdsaWithSHA256']   = OID_ecdsaWithSHA256;

// Build the cert entirely in ASN.1 to avoid forge's internal key-type checks
// This is the most reliable path for non-RSA certs with forge:
function buildEcCertAsn1(tbsFields, sigDer) {
    // sigDer is a Buffer containing the DER-encoded ECDSA signature
    // We encode it as a BIT STRING (prepend 0x00 unused-bits byte)
    const sigBitString = '\x00' + sigDer.toString('binary');
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        tbsFields,
        // AlgorithmIdentifier: ecdsaWithSHA256
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
        ]),
        // SignatureValue BIT STRING
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false, sigBitString),
    ]);
}

function buildTbsCertAsn1() {
    const encodeDate = (d) => {
        // UTCTime for dates < 2050
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

    const OID_CN  = '2.5.4.3';
    const OID_O   = '2.5.4.10';
    const OID_C   = '2.5.4.6';
    const nameAttrs = [
        { oid: OID_C,  value: 'SA' },
        { oid: OID_O,  value: 'Smart Touch POS' },
        { oid: OID_CN, value: 'Test-ZATCA' },
    ];

    // Serial number as integer bytes
    const serialBuf = Buffer.from([0x01]);

    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        // version [0] EXPLICIT INTEGER v3 (2)
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x02'),
        ]),
        // serialNumber
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
            serialBuf.toString('binary')),
        // signature AlgorithmIdentifier
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                forge.asn1.oidToDer(OID_ecdsaWithSHA256).getBytes()),
        ]),
        // issuer
        encodeName(nameAttrs),
        // validity
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            encodeDate(now),
            encodeDate(oneYearLater),
        ]),
        // subject (same as issuer — self-signed)
        encodeName(nameAttrs),
        // subjectPublicKeyInfo — inject raw DER bytes directly
        spkiAsn1,
        // extensions [3]
        forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 3, true, [
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                // basicConstraints
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                        forge.asn1.oidToDer('2.5.29.19').getBytes()),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                        forge.asn1.toDer(
                            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [])
                        ).getBytes()),
                ]),
                // keyUsage: digitalSignature(0) + nonRepudiation(1)
                forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
                        forge.asn1.oidToDer('2.5.29.15').getBytes()),
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BOOLEAN, false, '\xff'), // critical
                    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
                        forge.asn1.toDer(
                            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false,
                                '\x05\xc0') // bits 0+1 set = digitalSignature + nonRepudiation, 5 unused bits
                        ).getBytes()),
                ]),
            ]),
        ]),
    ]);
}

// Step 1: build TBS and DER-encode it
const tbsAsn1   = buildTbsCertAsn1();
const tbsDer    = Buffer.from(forge.asn1.toDer(tbsAsn1).getBytes(), 'binary');

// Step 2: SHA-256 hash the TBS, then sign with Node crypto (DER output is fine for cert)
const tbsHash   = crypto.createHash('sha256').update(tbsDer).digest();
const certSigDer = crypto.sign(null, tbsHash, { key: nodePrivKey, dsaEncoding: 'der' });

// Step 3: assemble full cert ASN.1 and convert to PEM
const certAsn1  = buildEcCertAsn1(tbsAsn1, certSigDer);
const certDer   = Buffer.from(forge.asn1.toDer(certAsn1).getBytes(), 'binary');
const certPem   = '-----BEGIN CERTIFICATE-----\n' +
    certDer.toString('base64').match(/.{1,64}/g).join('\n') +
    '\n-----END CERTIFICATE-----\n';

// Verify it parses cleanly with Node crypto
const x509check = new crypto.X509Certificate(certPem);
console.log('✔  Certificate created');
console.log(`   Subject : ${x509check.subject.replace(/\n/g, ', ')}`);
console.log(`   Valid to: ${x509check.validTo}`);

// ── 3. Build unsigned UBL invoice ─────────────────────────────────────────────
console.log('\n[3/5] Building unsigned UBL invoice...');

const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const issueDate = timestamp.split('T')[0];
const issueTime = timestamp.split('T')[1].replace('Z', '');
const uuid      = crypto.randomUUID();
const pihHash   = crypto.createHash('sha256').update('0').digest('hex');
const pihB64    = Buffer.from(pihHash).toString('base64');

const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
<!-- UBLEXTENSIONS_PLACEHOLDER -->
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>INV-TEST-001</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>1</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pihB64}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">__QR_PLACEHOLDER__</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">1010010000</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>&#x645;&#x624;&#x633;&#x633;&#x629; &#x62A;&#x62C;&#x627;&#x631;&#x64A;&#x629;</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>Street</cbc:StreetName>
                <cbc:BuildingNumber>1234</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>District</cbc:CitySubdivisionName>
                <cbc:CityName>Riyadh</cbc:CityName>
                <cbc:PostalZone>12345</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>300000000000003</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>&#x645;&#x624;&#x633;&#x633;&#x629; &#x62A;&#x62C;&#x627;&#x631;&#x64A;&#x629;</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party></cac:Party>
    </cac:AccountingCustomerParty>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">86.96</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">86.96</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">100.00</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="SAR">100.00</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">100.00</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>Test Product</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">86.9565</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="PCE">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:InvoiceLine>
</Invoice>`;

console.log('✔  Unsigned XML built');

// ── 4. Sign ───────────────────────────────────────────────────────────────────
console.log('\n[4/5] Signing invoice (P1363 ECDSA)...');

const { envelope, invoiceHashBase64, signatureBase64 } = signInvoiceXML(
    unsignedXml,
    privateKeyPem,
    certPem,
    timestamp
);

const sigBuf = Buffer.from(signatureBase64, 'base64');
if (sigBuf.length !== 64) {
    console.error(`\n❌ Signature length is ${sigBuf.length} bytes — expected 64 (P1363)`);
    process.exit(1);
}
if (signatureBase64.includes('_')) {
    console.error('\n❌ Signature contains underscore — still base64url, not standard base64');
    process.exit(1);
}
console.log(`✔  Signature: ${sigBuf.length} bytes P1363, base64 clean`);
console.log(`   First 20: ${signatureBase64.slice(0, 20)}...`);

// ── QR TLV ───────────────────────────────────────────────────────────────────
const { pubKeyPem: extractedPubKey, certSignature } = extractCertDetails(certPem);
const qrTlv = generateZatcaTLV9(
    '\u0645\u0624\u0633\u0633\u0629 \u062a\u062c\u0627\u0631\u064a\u0629',
    '300000000000003',
    timestamp,
    '100.00',
    '13.04',
    invoiceHashBase64,
    signatureBase64,
    extractedPubKey,
    certSignature
);

// ── 5. Assemble & write ───────────────────────────────────────────────────────
console.log('\n[5/5] Assembling signed XML...');

const signedXml = unsignedXml
    .replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', envelope)
    .replace('__QR_PLACEHOLDER__', qrTlv);

const outputPath = path.join(__dirname, 'sample_fixed_invoice.xml');
fs.writeFileSync(outputPath, signedXml, 'utf8');

const stat = fs.statSync(outputPath);
console.log(`✔  Wrote: ${outputPath}  (${(stat.size / 1024).toFixed(1)} KB)`);

// Write private key sidecar so run-validator.js can auto-inject it
const keyPath = path.join(__dirname, 'last_signing_key.pem');
fs.writeFileSync(keyPath, privateKeyPem, 'utf8');
console.log(`✔  Wrote: ${keyPath}  (run-validator.js will inject this automatically)`);

console.log('\n════════════════════════════════════════════════════════════');
console.log(' ✅  Invoice signed successfully');
console.log('════════════════════════════════════════════════════════════');
console.log(` Invoice hash : ${invoiceHashBase64}`);
console.log(` Signature    : ${signatureBase64.slice(0, 30)}... (${sigBuf.length}B P1363)`);
console.log(` UUID         : ${uuid}`);
console.log('\nNext: node run-validator.js sample_fixed_invoice.xml\n');
