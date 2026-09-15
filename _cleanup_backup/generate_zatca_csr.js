/**
 * Generate a proper secp256r1 CSR for ZATCA onboarding.
 * 
 * This script:
 * 1. Generates a new secp256r1 (prime256v1) EC key pair
 * 2. Builds a CSR with the exact ZATCA-required extensions (OID 2.16.840.1.114564.5.2)
 * 3. Saves the private key PEM to disk
 * 4. Outputs the CSR base64 (stripped) ready to paste into the ZATCA Sandbox portal
 */

const crypto = require('crypto');
const forge  = require('node-forge');
const fs     = require('fs');
const path   = require('path');

// ── Device identity — must match what is enrolled in ZATCA portal ─────────────
const DEVICE_SERIAL  = '1-AlBasma|2-v2|3-SN1782511221.6472';
const VAT_NUMBER     = '311111111111113';
const BRANCH_NAME    = '1100';
const BRANCH_INDUS   = 'Retail';
const BRANCH_CITY    = 'Jeddah';
const CERT_TYPE_EXT  = 'TSTZATCA-Code-Signing'; // sandbox test value

// ── Output paths ──────────────────────────────────────────────────────────────
const KEY_PATH = path.join(__dirname, 'zatca_secp256r1_key.pem');
const CSR_PATH = path.join(__dirname, 'zatca_secp256r1.csr');

// ── 1. Generate key pair ──────────────────────────────────────────────────────
console.log('Generating secp256r1 key pair...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
});
fs.writeFileSync(KEY_PATH, privateKey, 'utf8');
console.log(`✔  Private key saved: ${KEY_PATH}`);

// ── 2. Build CSR using node-forge ASN.1 directly ─────────────────────────────
// We use raw ASN.1 because forge's createCertificationRequest doesn't support EC keys.

const OID_EC_PUBKEY   = '1.2.840.10045.2.1';
const OID_SECP256R1   = '1.2.840.10045.3.1.7';
const OID_SHA256ECDSA = '1.2.840.10045.4.3.2';

// Register OIDs if missing
if (!forge.pki.oids[OID_SHA256ECDSA]) forge.pki.oids[OID_SHA256ECDSA] = 'ecdsaWithSHA256';

// Extract raw public key DER (SPKI)
const pubKeyDerB64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/[\n\r]/g, '');
const spkiAsn1 = forge.asn1.fromDer(forge.util.createBuffer(
    Buffer.from(pubKeyDerB64, 'base64').toString('binary')
));

// Helper: encode an RDN attribute
const rdn = (oid, value) => forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID,  false, forge.asn1.oidToDer(oid).getBytes()),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, value),
    ]),
]);

// Subject: CN, O, OU, C
const subject = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    rdn('2.5.4.6',  'SA'),                    // C
    rdn('2.5.4.11', '1000000001'),            // OU
    rdn('2.5.4.10', 'Al-Basma Trading'), // O
    rdn('2.5.4.3',  'Al-Basma POS Test'),            // CN
]);

// ── ZATCA custom SAN extension (OID 2.5.29.17) with SubjectAltName ────────────
// SAN carries ZATCA device info as DirectoryName attributes
// The OID 2.16.840.1.114564.5.2 is the ZATCA private OID for device identity
const zatcaDeviceOID = '2.16.840.1.114564.5.2';
if (!forge.pki.oids[zatcaDeviceOID]) forge.pki.oids[zatcaDeviceOID] = 'zatcaDevice';

const sanSequence = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    // DirectoryName [4] EXPLICIT
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 4, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
            rdn('2.5.4.4',  DEVICE_SERIAL),          // SN = EGS serial
            rdn(zatcaDeviceOID, VAT_NUMBER),          // ZATCA VAT OID
            rdn('2.5.4.12', BRANCH_NAME),            // title = branch name
            rdn('2.5.4.26', BRANCH_CITY),            // destinationIndicator = city
            rdn('2.5.4.15', BRANCH_INDUS),           // businessCategory = industry
        ]),
    ]),
]);
const sanExt = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('2.5.29.17').getBytes()),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
        forge.asn1.toDer(sanSequence).getBytes()),
]);

// ── Microsoft szOID_CERTIFICATE_TEMPLATE (for ZATCA cert type) ─────────────
const certTemplateExt = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('1.3.6.1.4.1.311.20.2').getBytes()),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
        forge.asn1.toDer(
            forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BMPSTRING, false,
                Buffer.from(CERT_TYPE_EXT, 'utf16le').toString('binary'))
        ).getBytes()),
]);

// extensionRequest attribute
const extensions = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    certTemplateExt,
    sanExt,
]);

const extensionReqAttr = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
        forge.asn1.oidToDer('1.2.840.113549.1.9.14').getBytes()),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
        extensions,
    ]),
]);

// ── CertificationRequestInfo ───────────────────────────────────────────────────
const csrInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x00'), // version = 0
    subject,
    spkiAsn1, // subjectPublicKeyInfo
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [extensionReqAttr]),
]);

// ── Sign the CertificationRequestInfo ─────────────────────────────────────────
const csrInfoDer = Buffer.from(forge.asn1.toDer(csrInfo).getBytes(), 'binary');
const sigDer = crypto.sign('sha256', csrInfoDer, { key: privateKey, dsaEncoding: 'der' });

// ── Build full CSR ─────────────────────────────────────────────────────────────
const csrAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    csrInfo,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer(OID_SHA256ECDSA).getBytes()),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BITSTRING, false,
        '\x00' + sigDer.toString('binary')),
]);

const csrDer  = Buffer.from(forge.asn1.toDer(csrAsn1).getBytes(), 'binary');
const csrPem  = '-----BEGIN CERTIFICATE REQUEST-----\n'
    + csrDer.toString('base64').match(/.{1,64}/g).join('\n')
    + '\n-----END CERTIFICATE REQUEST-----\n';
const csrB64  = csrDer.toString('base64'); // stripped, no line breaks

fs.writeFileSync(CSR_PATH, csrPem, 'utf8');
console.log(`✔  CSR saved: ${CSR_PATH}`);

// ── Verify curve in output ────────────────────────────────────────────────────
const secp256r1OidBytes = Buffer.from([0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07]);
const secp256k1OidBytes = Buffer.from([0x06,0x05,0x2b,0x81,0x04,0x00,0x0a]);
if (csrDer.includes(secp256r1OidBytes))      console.log('✔  Curve confirmed: secp256r1 (correct for ZATCA)');
else if (csrDer.includes(secp256k1OidBytes)) console.log('✘  Curve is secp256k1 — WRONG!');
else                                          console.log('?  Could not detect curve OID');

console.log('\n=== CSR Base64 — paste this into ZATCA Sandbox portal ===');
console.log(Buffer.from(csrPem, 'utf8').toString('base64'));
console.log(`\nLength: ${Buffer.from(csrPem, 'utf8').toString('base64').length} characters`);
