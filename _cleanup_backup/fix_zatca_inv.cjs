#!/usr/bin/env node
/**
 * fix_zatca_inv.cjs
 *
 * Fixes ZATCA_INV-1781539765405.xml by:
 *  1. Removing the duplicate CRN PartyIdentification block (XPTY0004 fix)
 *  2. Using the genesis PIH (or real chain hash from DB)
 *  3. Running the invoice through the full Phase 2 signing pipeline
 *  4. Writing the signed, valid XML back as ZATCA_INV-1781539765405.xml
 *     (and a backup as ZATCA_INV-1781539765405.xml.bak)
 *
 * Run: node fix_zatca_inv.cjs
 * Then: fatoora -validate -invoice "C:\my-pos\v2\ZATCA_INV-1781539765405.xml"
 */
'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const {
    signInvoiceXML,
    generateZatcaTLV9,
    extractCertDetails,
    derToP1363,
} = require('./electron/zatca_phase2.cjs');

// ─── paths ────────────────────────────────────────────────────────────────────
const INVOICE_PATH = path.join(__dirname, 'ZATCA_INV-1781539765405.xml');
const KEY_PATH     = path.join(__dirname, 'last_signing_key.pem');

// ─── 1. Read existing private key ────────────────────────────────────────────
if (!fs.existsSync(KEY_PATH)) {
    console.error('❌  last_signing_key.pem not found. Run sign_invoice.js first to generate keys.');
    process.exit(1);
}
const privateKeyPem = fs.readFileSync(KEY_PATH, 'utf8');
console.log('✔  Loaded private key from last_signing_key.pem');

// ─── 2. Derive public key & build self-signed cert (same logic as sign_invoice.js) ─
const forge = require('node-forge');

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

const now          = new Date();
const oneYearLater = new Date(now);
oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

const OID_ecdsaWithSHA256 = '1.2.840.10045.4.3.2';
if (!forge.pki.oids[OID_ecdsaWithSHA256]) forge.pki.oids[OID_ecdsaWithSHA256] = 'ecdsaWithSHA256';
if (!forge.pki.oids['ecdsaWithSHA256'])   forge.pki.oids['ecdsaWithSHA256']   = OID_ecdsaWithSHA256;

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
        { oid: '2.5.4.10', value: 'Whatssp' },
        { oid: '2.5.4.3',  value: 'ZATCA-EGS' },
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

const nodePrivKey = crypto.createPrivateKey(privateKeyPem);
const tbsAsn1    = buildTbsCertAsn1();
const tbsDer     = Buffer.from(forge.asn1.toDer(tbsAsn1).getBytes(), 'binary');
const tbsHash    = crypto.createHash('sha256').update(tbsDer).digest();
const certSigDer = crypto.sign(null, tbsHash, { key: nodePrivKey, dsaEncoding: 'der' });
const certAsn1   = buildEcCertAsn1(tbsAsn1, certSigDer);
const certDer    = Buffer.from(forge.asn1.toDer(certAsn1).getBytes(), 'binary');
const certPem    = '-----BEGIN CERTIFICATE-----\n' +
    certDer.toString('base64').match(/.{1,64}/g).join('\n') +
    '\n-----END CERTIFICATE-----\n';

const x509check = new crypto.X509Certificate(certPem);
console.log(`✔  Certificate built — Subject: ${x509check.subject.replace(/\n/g, ', ')}`);

// ─── 3. Build the corrected unsigned XML ────────────────────────────────────
//
//  ROOT CAUSE #1 (XPTY0004 / KSA FAIL):
//    The original XML has TWO <cac:PartyIdentification> blocks:
//      schemeID="TIN" AND schemeID="CRN"
//    ZATCA XSL line 451 calls fn:string-length() on the result of selecting
//    ALL PartyIdentification/ID nodes — Saxon XPath 2.0 strict typing rejects
//    a sequence of 2 nodes as argument to string-length().
//    FIX: For B2C simplified invoices (subtype 0200000), emit ONLY the TIN block.
//
//  ROOT CAUSE #2 (SIGNATURE FAIL):
//    No UBLExtensions / XAdES signature block in the XML at all.
//    FIX: Run through signInvoiceXML().
//
//  ROOT CAUSE #3 (QR FAIL):
//    QR contains only a 5-tag Phase 1 TLV with no signature/hash.
//    FIX: generateZatcaTLV9() with real invoice hash + ECDSA sig.
//
//  ROOT CAUSE #4 (PIH FAIL / KSA-13):
//    PIH must be the SHA-256 hash of the PREVIOUS invoice's canonical XML,
//    base64-encoded. The value in the original XML is arbitrary/invalid.
//    FIX: Use genesis hash (SHA-256 of "0" as bytes, hex→base64) for first
//    invoice in chain, OR read from DB. Genesis is safe for SDK local testing.
//
const genesisHash = Buffer.from(
    crypto.createHash('sha256').update(Buffer.from('0')).digest('hex')
).toString('base64');

// Re-use the exact same invoice metadata from the original failing XML
const SELLER_NAME = 'Whatssp';
const VAT_NO      = '300000000000003';
const TIMESTAMP   = '2026-06-15T16:09:25';
const ISSUE_DATE  = '2026-06-15';
const ISSUE_TIME  = '16:09:25';
const UUID        = 'b0a4f955-3c38-42d6-afde-9808b6d6ceff';
const ICV         = '64';

// The corrected unsigned XML — single TIN PartyIdentification only (XPTY0004 fix)
const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
<!-- UBLEXTENSIONS_PLACEHOLDER -->
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>INV-1781539765405</cbc:ID>
    <cbc:UUID>${UUID}</cbc:UUID>
    <cbc:IssueDate>${ISSUE_DATE}</cbc:IssueDate>
    <cbc:IssueTime>${ISSUE_TIME}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${ICV}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${genesisHash}</cbc:EmbeddedDocumentBinaryObject>
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
                <cbc:ID schemeID="TIN">${VAT_NO}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${SELLER_NAME}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>etyyui</cbc:StreetName>
                <cbc:BuildingNumber>8434</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>asfgh</cbc:CitySubdivisionName>
                <cbc:CityName>alula</cbc:CityName>
                <cbc:PostalZone>34412</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${VAT_NO}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${SELLER_NAME}</cbc:RegistrationName>
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
        <cbc:TaxAmount currencyID="SAR">0.91</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">0.91</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">6.09</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">0.91</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">6.09</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">6.09</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">7.00</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="SAR">7.00</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">1</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">6.09</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="SAR">0.91</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="SAR">7.00</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>&#x62D;&#x644;&#x64A;&#x628; &#x645;&#x631;&#x627;&#x639;&#x64A; 1 &#x644;&#x62A;&#x631;</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="SAR">6.0870</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="PCE">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:InvoiceLine>
</Invoice>`;

console.log(`✔  PIH (genesis): ${genesisHash}`);
console.log('✔  Unsigned XML built (single TIN PartyIdentification — XPTY0004 fixed)');

// ─── 4. Sign ─────────────────────────────────────────────────────────────────
console.log('\n[4/5] Signing invoice...');
const signingTimestamp = `${ISSUE_DATE}T${ISSUE_TIME}Z`;

const { envelope, invoiceHashBase64, signatureBase64 } = signInvoiceXML(
    unsignedXml,
    privateKeyPem,
    certPem,
    signingTimestamp
);

const sigBuf = Buffer.from(signatureBase64, 'base64');
if (sigBuf.length !== 64) {
    console.error(`❌  Signature length ${sigBuf.length} bytes — expected 64 (P1363)`);
    process.exit(1);
}
console.log(`✔  Signature: ${sigBuf.length}B P1363 — ${signatureBase64.slice(0, 24)}...`);
console.log(`✔  Invoice hash: ${invoiceHashBase64}`);

// ─── 5. Build 9-tag QR TLV ───────────────────────────────────────────────────
const { pubKeyPem: extractedPubKey, certSignature } = extractCertDetails(certPem);
const qrTlv = generateZatcaTLV9(
    SELLER_NAME,
    VAT_NO,
    signingTimestamp,
    '7.00',
    '0.91',
    invoiceHashBase64,
    signatureBase64,
    extractedPubKey,
    certSignature
);
console.log(`✔  QR TLV (9-tag Phase 2): ${qrTlv.slice(0, 32)}...`);

// ─── 6. Assemble final signed XML ────────────────────────────────────────────
const signedXml = unsignedXml
    .replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', envelope)
    .replace('__QR_PLACEHOLDER__', qrTlv);

// ─── 7. Backup & write ────────────────────────────────────────────────────────
const bakPath = INVOICE_PATH + '.bak';
if (fs.existsSync(INVOICE_PATH)) {
    fs.copyFileSync(INVOICE_PATH, bakPath);
    console.log(`\n✔  Backed up original → ${bakPath}`);
}

fs.writeFileSync(INVOICE_PATH, signedXml, 'utf8');
const stat = fs.statSync(INVOICE_PATH);
console.log(`✔  Written: ${INVOICE_PATH}  (${(stat.size / 1024).toFixed(1)} KB)`);

console.log(`
════════════════════════════════════════════════════════════════
  ✅  ALL 4 FIXES APPLIED
════════════════════════════════════════════════════════════════

  FIX 1 [KSA/XPTY0004]  — Removed duplicate CRN PartyIdentification.
                           Only single TIN block emitted for B2C invoice.
                           Also patched in zatca_utils.cjs (permanent fix).

  FIX 2 [SIGNATURE]     — Full XAdES signature injected via UBLExtensions.
                           Certificate embedded in ds:X509Data.

  FIX 3 [QR]            — 9-tag Phase 2 TLV QR generated with:
                           invoice hash, ECDSA signature, public key, cert sig.

  FIX 4 [PIH/KSA-13]    — PIH replaced with genesis hash (SHA256("0")→hex→b64).
                           Use real previous invoice hash in production chain.

════════════════════════════════════════════════════════════════
  Now validate:
  fatoora -validate -invoice "C:\\my-pos\\v2\\ZATCA_INV-1781539765405.xml"
════════════════════════════════════════════════════════════════
`);
