#!/usr/bin/env node
'use strict';
/**
 * run-validator.js  v4
 * ════════════════════════════════════════════════════════════════════════════
 * Orchestrates ZATCA fatoora -validate with:
 *
 * BYPASS 1 — Windows path NPE:
 *   Copies target XML into Apps/ and passes bare filename only.
 *
 * BYPASS 2 — Automatic cert/key injection from the signed invoice:
 *   The SDK's -validate uses Data/Certificates/cert.pem and
 *   ec-secp256k1-priv-key.pem to verify the invoice.
 *   We extract the cert embedded in the invoice's ds:X509Certificate
 *   element and inject it (in the exact format the SDK expects) before
 *   validating. The private key is extracted from a sidecar file written
 *   by sign_invoice.js, or passed as a CLI argument.
 *
 *   SDK cert format   : bare base64, NO PEM headers, NO newlines
 *   SDK key format    : raw ECPrivateKey DER bytes in base64 (NO PKCS8 wrapper)
 *
 * Usage:
 *   node run-validator.js [invoice.xml] [private-key.pem]
 *
 *   invoice.xml      defaults to sample_fixed_invoice.xml
 *   private-key.pem  defaults to last_signing_key.pem (written by sign_invoice.js)
 *                    If neither exists, SDK dummy certs are used (sig check fails).
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ROOT  = __dirname;
const SDK_ROOT      = path.join(PROJECT_ROOT, 'zatca-einvoicing-sdk-Java-238-R3.4.8');
const SDK_APPS      = path.join(SDK_ROOT, 'Apps');
const SDK_CERTS_DIR = path.join(SDK_ROOT, 'Data', 'Certificates');
const VALIDATE_BAT  = path.join(PROJECT_ROOT, 'validate.bat');
const TEMP_IN_APPS  = path.join(SDK_APPS, '_validate_target_.xml');
const SDK_CERT_FILE = path.join(SDK_CERTS_DIR, 'cert.pem');
const SDK_KEY_FILE  = path.join(SDK_CERTS_DIR, 'ec-secp256k1-priv-key.pem');

// ── CLI args ──────────────────────────────────────────────────────────────────
const inputArg = process.argv[2] || 'sample_fixed_invoice.xml';
const keyArg   = process.argv[3] || 'last_signing_key.pem';   // written by sign_invoice.js

const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(PROJECT_ROOT, inputArg);
const keyFile   = path.isAbsolute(keyArg)   ? keyArg   : path.join(PROJECT_ROOT, keyArg);

// ── Guards ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(inputFile)) { console.error(`❌ Invoice not found: ${inputFile}`); process.exit(1); }
if (!fs.existsSync(VALIDATE_BAT)) { console.error(`❌ validate.bat not found`); process.exit(1); }

// ── Extract cert from signed XML (ds:X509Certificate element) ────────────────
function extractCertFromXml(xmlPath) {
    const xml = fs.readFileSync(xmlPath, 'utf8');
    const m = xml.match(/<ds:X509Certificate>([\s\S]+?)<\/ds:X509Certificate>/);
    if (!m) throw new Error('Could not find ds:X509Certificate in invoice XML');
    return m[1].replace(/[\n\r\s]/g, '');  // bare base64, no whitespace
}

// ── Convert PKCS8 EC PEM → raw ECPrivateKey DER base64 (what SDK expects) ────
function pkcs8ToRawEcBase64(pkcs8Pem) {
    const der = Buffer.from(
        pkcs8Pem
            .replace(/-----BEGIN PRIVATE KEY-----/g, '')
            .replace(/-----END PRIVATE KEY-----/g, '')
            .replace(/[\n\r]/g, ''),
        'base64'
    );

    // ASN.1 minimal parser to find the OCTET STRING wrapping ECPrivateKey
    // PKCS8: SEQUENCE { INTEGER(0), SEQUENCE(AlgId), OCTET STRING { ECPrivateKey } }
    let off = 0;
    const readLen = (buf, o) => {
        const f = buf[o++];
        if (f < 0x80) return { len: f, end: o };
        const nb = f & 0x7f;
        let l = 0;
        for (let i = 0; i < nb; i++) l = (l << 8) | buf[o++];
        return { len: l, end: o };
    };

    // skip outer SEQUENCE
    off++; const outer = readLen(der, off); off = outer.end;
    // skip INTEGER (version)
    off++; const vLen = readLen(der, off); off = vLen.end + vLen.len;
    // skip SEQUENCE (AlgorithmIdentifier)
    off++; const algLen = readLen(der, off); off = algLen.end + algLen.len;
    // now at OCTET STRING (0x04) containing the raw ECPrivateKey DER
    if (der[off] !== 0x04) throw new Error(`Expected OCTET STRING at offset ${off}, got 0x${der[off].toString(16)}`);
    off++;
    const ecLen = readLen(der, off);
    const ecKeyDer = der.slice(ecLen.end, ecLen.end + ecLen.len);
    return ecKeyDer.toString('base64');
}

// ── Header ────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════');
console.log(' ZATCA Fatoora Validator  v4  (path-bypass + auto cert-inject)');
console.log('════════════════════════════════════════════════════════════');
console.log(` Invoice : ${inputFile}`);

// ── Extract cert from XML ─────────────────────────────────────────────────────
let bareCertB64;
try {
    bareCertB64 = extractCertFromXml(inputFile);
    console.log(` Cert    : extracted from invoice XML (${bareCertB64.length} base64 chars)`);
} catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
}

// ── Extract private key ───────────────────────────────────────────────────────
let rawKeyB64 = null;
if (fs.existsSync(keyFile)) {
    try {
        const keyPem = fs.readFileSync(keyFile, 'utf8');
        rawKeyB64 = pkcs8ToRawEcBase64(keyPem);
        console.log(` Key     : ${keyFile} → raw ECPrivateKey (${rawKeyB64.length} chars)`);
    } catch (e) {
        console.warn(`⚠  Could not convert private key: ${e.message}`);
        console.warn('   Signature check will use SDK dummy key');
    }
} else {
    console.log(` Key     : ${keyFile} not found — using SDK dummy key`);
    console.log('            Run: node sign_invoice.js first (it writes last_signing_key.pem)');
}

// ── Back up SDK certs and inject ours ────────────────────────────────────────
const origCert = fs.readFileSync(SDK_CERT_FILE);
const origKey  = fs.readFileSync(SDK_KEY_FILE);

const cleanup = () => {
    try { fs.writeFileSync(SDK_CERT_FILE, origCert); } catch(e) {}
    try { fs.writeFileSync(SDK_KEY_FILE,  origKey);  } catch(e) {}
    try { if (fs.existsSync(TEMP_IN_APPS)) fs.unlinkSync(TEMP_IN_APPS); } catch(e) {}
};
process.on('exit', cleanup);
process.on('SIGINT',  () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

try {
    fs.writeFileSync(SDK_CERT_FILE, bareCertB64, 'utf8');
    if (rawKeyB64) fs.writeFileSync(SDK_KEY_FILE, rawKeyB64, 'utf8');
    console.log(' ✔  Injected cert (and key if available) into Data/Certificates/');
} catch (e) {
    console.error(`❌ Failed to inject certs: ${e.message}`);
    process.exit(1);
}

// ── Copy invoice into Apps/ ───────────────────────────────────────────────────
console.log('────────────────────────────────────────────────────────────\n');
try {
    fs.copyFileSync(inputFile, TEMP_IN_APPS);
    console.log(`✔  Copied invoice → Apps/_validate_target_.xml\n`);
} catch (e) {
    console.error(`❌ Failed to copy invoice: ${e.message}`);
    process.exit(1);
}

// ── Run validator ─────────────────────────────────────────────────────────────
let exitCode = 0;
console.log('── Fatoora output ──────────────────────────────────────────\n');
try {
    const out = execSync(
        `"${VALIDATE_BAT}" "${TEMP_IN_APPS}"`,
        { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'], timeout: 120_000 }
    );
    process.stdout.write(out);
} catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    exitCode = err.status || 1;
}

// cleanup() called via process.on('exit')

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════');
if (exitCode === 0) {
    console.log(' ✅  Validator exit 0 — review output above');
} else {
    console.log(` ℹ  Validator exit ${exitCode}`);
    console.log('\n WHAT EACH ERROR TYPE MEANS:');
    console.log('  XSD/EN/KSA PASSED  ✅ = XML structure + business rules OK');
    console.log('  SIGNATURE FAILED   = cert mismatch OR wrong hash/signature format');
    console.log('  QR FAILED          = QR TLV data mismatches invoice fields');
    console.log('  ECDSAUtil error    = cert self-signature encoding issue');
    console.log('  RSAPublicKeyImpl   = ❌ still hitting SDK samples (path bug)');
    console.log('  base64 char 5f(_)  = ❌ DER signature still present (not P1363)');
}
console.log('════════════════════════════════════════════════════════════\n');
process.exit(exitCode);
