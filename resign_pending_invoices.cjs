/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  resign_pending_invoices.cjs  —  Task A
 *  Al-Basma POS  |  ZATCA Phase 2 Queue Re-signing Utility
 * ───────────────────────────────────────────────────────────────────────────
 *  PURPOSE
 *  -------
 *  Finds every zatca_queue row that was written as a raw/unsigned skeleton
 *  (created before onboarding or during pre-production testing) and re-signs
 *  it using the active production certificate that now lives in zatca_device.
 *
 *  WHAT COUNTS AS "UNSIGNED / SKELETON"?
 *  ----------------------------------------
 *  A queue row is considered unsigned when its signed_xml column:
 *    (a) contains the literal placeholder  <!-- UBLEXTENSIONS_PLACEHOLDER -->
 *    (b) contains the literal placeholder  <!-- QR_PLACEHOLDER -->
 *    (c) does NOT contain the XAdES signature wrapper text
 *        "urn:oasis:names:specification:ubl:dsig:enveloped:xades"
 *    (d) status is 'pending' or 'error' (never successfully submitted)
 *
 *  USAGE
 *  -----
 *    node resign_pending_invoices.cjs [--dry-run] [--limit N]
 *
 *    --dry-run   : scan & report but do NOT write anything to the database
 *    --limit N   : process at most N rows (default: all)
 *
 *  OUTPUT
 *    Prints a table of results and exits with code 0 on full success,
 *    or code 1 if any row failed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

// ── Resolve project root & db path ──────────────────────────────────────────
const PROJECT_ROOT = __dirname;                          // C:\my-pos\v2
const DB_PATH      = path.join(PROJECT_ROOT, 'pos_data.db');

if (!fs.existsSync(DB_PATH)) {
    console.error(`[RESIGN] ✗ Database not found at: ${DB_PATH}`);
    console.error(`         Make sure you run this script from C:\\my-pos\\v2`);
    process.exit(1);
}

// ── Load ZATCA engine ────────────────────────────────────────────────────────
const zatca = require('./electron/zatca_phase2.cjs');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const LIMIT   = limitArg !== -1 ? parseInt(args[limitArg + 1]) || 9999 : 9999;

// ── Open DB (read-write, WAL) ────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous  = FULL');
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Verify we have a production certificate
// ─────────────────────────────────────────────────────────────────────────────
const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
if (!device) {
    console.error('[RESIGN] ✗ No zatca_device row found — device was never initialised.');
    process.exit(1);
}
if (!device.production_csid || !device.production_cert_pem) {
    console.error('[RESIGN] ✗ Device is not onboarded — production_csid / production_cert_pem are missing.');
    console.error('         Complete the ZATCA onboarding flow first, then run this script.');
    process.exit(1);
}

const PRIVATE_KEY_PEM = device.private_key_pem;
const CERT_PEM        = device.production_cert_pem;

console.log('[RESIGN] ✓ Production certificate found.');
try {
    const daysLeft = zatca.checkCertExpiry(CERT_PEM);
    if (daysLeft < 0) {
        console.warn(`[RESIGN] ⚠ Certificate EXPIRED ${Math.abs(daysLeft)} day(s) ago — re-signed invoices may be rejected!`);
    } else {
        console.log(`[RESIGN]   Certificate valid for ${daysLeft} more day(s).`);
    }
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Fetch all candidate rows
// ─────────────────────────────────────────────────────────────────────────────
const candidates = db.prepare(`
    SELECT  q.id,
            q.sale_id,
            q.invoice_number,
            q.icv,
            q.uuid,
            q.signed_xml,
            q.xml_hash,
            q.invoice_subtype,
            q.status,
            s.timestamp  AS sale_timestamp,
            s.total_amount,
            s.tax_amount
    FROM    zatca_queue q
    JOIN    sales s ON s.id = q.sale_id
    WHERE   q.status IN ('pending', 'error')
    ORDER   BY q.id ASC
    LIMIT   ?
`, ).all(LIMIT);

// Filter to only rows that are genuinely unsigned
function isUnsigned(xml) {
    if (!xml) return true;
    const hasSigNS   = xml.includes('urn:oasis:names:specification:ubl:dsig:enveloped:xades');
    const hasXmlDSig = xml.includes('http://www.w3.org/2000/09/xmldsig#');
    const hasPlaceholder = xml.includes('UBLEXTENSIONS_PLACEHOLDER') || xml.includes('QR_PLACEHOLDER');
    return hasPlaceholder || (!hasSigNS && !hasXmlDSig);
}

const toResign = candidates.filter(r => isUnsigned(r.signed_xml));

if (toResign.length === 0) {
    console.log('[RESIGN] ✓ No unsigned/skeleton rows found. Queue is already fully signed.');
    db.close();
    process.exit(0);
}

console.log(`\n[RESIGN] Found ${toResign.length} unsigned row(s) to process (out of ${candidates.length} pending).\n`);
if (DRY_RUN) {
    console.log('         *** DRY RUN — no changes will be written. ***\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Extract cert details once (shared across all rows)
// ─────────────────────────────────────────────────────────────────────────────
const { pubKeyPem, certSignature } = zatca.extractCertDetails(CERT_PEM);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Re-sign each row
// ─────────────────────────────────────────────────────────────────────────────
const updateRow = db.prepare(`
    UPDATE zatca_queue
    SET    signed_xml  = ?,
           xml_hash    = ?,
           status      = 'pending'
    WHERE  id = ?
`);

const results = [];
let successCount = 0;
let failCount    = 0;

for (const row of toResign) {
    const label = `Queue#${row.id} / ${row.invoice_number}`;
    try {
        // ── Strip any existing partial skeleton structure ──────────────────
        //    The raw XML from the DB was built by generateUBL21XML(), which
        //    already contains a <!-- UBLEXTENSIONS_PLACEHOLDER --> comment and
        //    a <!-- QR_PLACEHOLDER --> comment inside the QR <Attachment> block.
        //    If the skeleton replaced those with empty strings (pre-onboarding
        //    fallback), we need to restore them so signInvoiceXML() can work.
        let rawXml = row.signed_xml;

        // Ensure UBLExtensions placeholder is present for signInvoiceXML()
        if (!rawXml.includes('UBLEXTENSIONS_PLACEHOLDER') && !rawXml.includes('UBLExtensions')) {
            rawXml = rawXml.replace('<cbc:ProfileID>', '    <!-- UBLEXTENSIONS_PLACEHOLDER -->\n    <cbc:ProfileID>');
        }

        // Ensure QR placeholder is present
        if (!rawXml.includes('QR_PLACEHOLDER')) {
            // Remove any stale Phase-1 TLV QR that was written by the pre-onboarding branch
            rawXml = rawXml.replace(
                /<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">[A-Za-z0-9+/=\s]+<\/cbc:EmbeddedDocumentBinaryObject>/,
                '<!-- QR_PLACEHOLDER -->'
            );
        }

        // Determine signing timestamp: prefer the original sale timestamp
        const signingTimestamp = row.sale_timestamp
            ? String(row.sale_timestamp).replace(' ', 'T').replace(/\.\d+$/, '') + (row.sale_timestamp.includes('Z') ? '' : 'Z')
            : new Date().toISOString();

        // ── Run signInvoiceXML() ──────────────────────────────────────────
        const { envelope, invoiceHashBase64, signatureBase64 } = zatca.signInvoiceXML(
            rawXml,
            PRIVATE_KEY_PEM,
            CERT_PEM,
            signingTimestamp
        );

        // ── Inject the signature envelope ─────────────────────────────────
        let signedXml = rawXml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', envelope);

        // ── Build Phase-2 9-tag TLV QR ───────────────────────────────────
        //    We read business settings from the DB for seller/VAT info.
        const settings = (() => {
            const rows = db.prepare('SELECT key, value FROM business_settings').all();
            return Object.fromEntries(rows.map(r => [r.key, r.value]));
        })();

        const vatAmt = parseFloat(row.tax_amount) || 0;
        const total  = parseFloat(row.total_amount) || 0;

        const tlv = zatca.generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            settings.vat_number || settings.tax_number || '300000000000003',
            signingTimestamp,
            total,
            vatAmt,
            invoiceHashBase64,
            signatureBase64,
            pubKeyPem,
            certSignature
        );

        // ── Inject QR ─────────────────────────────────────────────────────
        signedXml = signedXml.replace(
            '<!-- QR_PLACEHOLDER -->',
            `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlv}</cbc:EmbeddedDocumentBinaryObject>`
        );

        // ── Verify the result contains signature elements ─────────────────
        const hasEnvelope = signedXml.includes('urn:oasis:names:specification:ubl:dsig:enveloped:xades');
        const hasQR       = signedXml.includes(tlv.substring(0, 20));
        if (!hasEnvelope || !hasQR) {
            throw new Error('Post-sign validation failed: envelope or QR missing from output XML.');
        }

        // ── Write to DB ───────────────────────────────────────────────────
        if (!DRY_RUN) {
            updateRow.run(signedXml, invoiceHashBase64, row.id);
        }

        successCount++;
        results.push({ id: row.id, invoice: row.invoice_number, status: '✓ OK', note: '' });
        console.log(`  [OK]  ${label}`);

    } catch (err) {
        failCount++;
        results.push({ id: row.id, invoice: row.invoice_number, status: '✗ FAIL', note: err.message });
        console.error(`  [ERR] ${label} — ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log(` RESIGN SUMMARY${DRY_RUN ? '  [DRY RUN — nothing written]' : ''}`);
console.log('══════════════════════════════════════════════════════════════');
console.log(` Candidates scanned : ${candidates.length}`);
console.log(` Unsigned rows found: ${toResign.length}`);
console.log(` ✓ Re-signed OK     : ${successCount}`);
console.log(` ✗ Failed           : ${failCount}`);
console.log('══════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
    console.log('Failed rows:');
    results.filter(r => r.status.startsWith('✗')).forEach(r => {
        console.log(`  Queue#${r.id}  ${r.invoice}  →  ${r.note}`);
    });
    console.log('');
}

db.close();
process.exit(failCount > 0 ? 1 : 0);
