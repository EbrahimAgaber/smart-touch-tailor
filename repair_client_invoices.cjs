/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  repair_client_invoices.cjs
 *  Al-Basma POS  |  ZATCA Phase 2 Aggressive Queue Repair Utility
 * ───────────────────────────────────────────────────────────────────────────
 *  PURPOSE
 *  -------
 *  This script forcefully extracts the corrupted XML payloads for the 37 pending
 *  invoices on the client machine, strips away the invalid cryptographic signatures,
 *  fixes the structural XSD schema errors, recalculates the true hash, regenerates 
 *  the QR codes, and injects the perfect Production CSID signature.
 * 
 *  USAGE
 *  -----
 *    node repair_client_invoices.cjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');
const zatca   = require('./electron/zatca_phase2.cjs');

const DB_PATH = path.join(__dirname, 'pos_data.db');

if (!fs.existsSync(DB_PATH)) {
    console.error(`[REPAIR] ✗ Database not found at: ${DB_PATH}`);
    process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 1. Verify Production CSID exists
const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
if (!device || !device.production_csid || !device.production_cert_pem) {
    console.error('[REPAIR] ✗ Device does not have a Production CSID yet.');
    process.exit(1);
}

const PRIVATE_KEY = device.private_key_pem;
const CERT_PEM    = device.production_cert_pem;
const { pubKeyPem, certSignature } = zatca.extractCertDetails(CERT_PEM);

// Fetch settings
const settings = (() => {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
})();

// 2. Fetch all corrupted / pending invoices
const invoices = db.prepare(`
    SELECT  q.id, q.invoice_number, q.signed_xml, s.timestamp AS sale_timestamp, 
            s.total_amount, s.tax_amount 
    FROM zatca_queue q
    JOIN sales s ON s.id = q.sale_id
    WHERE q.status IN ('pending', 'error')
`).all();

console.log(`[REPAIR] Found ${invoices.length} invoices needing repair...`);

const updateRow = db.prepare(`
    UPDATE zatca_queue 
    SET signed_xml = ?, xml_hash = ?, status = 'pending' 
    WHERE id = ?
`);

let success = 0;
let failed = 0;

for (const row of invoices) {
    try {
        let xml = row.signed_xml;
        if (!xml) continue;

        // --- STEP A: Forcefully strip the old corrupted UBLExtensions ---
        xml = xml.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/, '<!-- UBLEXTENSIONS_PLACEHOLDER -->');
        if (!xml.includes('<!-- UBLEXTENSIONS_PLACEHOLDER -->')) {
            xml = xml.replace('<cbc:ProfileID>', '<!-- UBLEXTENSIONS_PLACEHOLDER -->\n<cbc:ProfileID>');
        }

        // --- STEP B: Forcefully strip the old QR code payload ---
        xml = xml.replace(/<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">[\s\S]*?<\/cbc:EmbeddedDocumentBinaryObject>/, '<!-- QR_PLACEHOLDER -->');
        if (!xml.includes('<!-- QR_PLACEHOLDER -->')) {
            xml = xml.replace(/<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain"\/>/, '<!-- QR_PLACEHOLDER -->');
        }

        // --- STEP C: Fix the XSD Schema Error ---
        xml = xml.replace(/<cbc:SignatureMethodCode>/g, '<cbc:SignatureMethod>');
        xml = xml.replace(/<\/cbc:SignatureMethodCode>/g, '<\/cbc:SignatureMethod>');

        // --- STEP D: Recalculate true hash and sign ---
        const signingTimestamp = row.sale_timestamp
            ? String(row.sale_timestamp).replace(' ', 'T').replace(/\.\d+$/, '') + (row.sale_timestamp.includes('Z') ? '' : 'Z')
            : new Date().toISOString();

        const { envelope, invoiceHashBase64, signatureBase64 } = zatca.signInvoiceXML(
            xml, PRIVATE_KEY, CERT_PEM, signingTimestamp
        );

        // --- STEP E: Regenerate correct QR Code ---
        const total = parseFloat(row.total_amount) || 0;
        const vatAmt = parseFloat(row.tax_amount) || 0;
        
        const tlv = zatca.generateZatcaTLV9(
            settings.business_name_ar || 'مؤسسة تجارية',
            settings.vat_number || '311111111111113',
            signingTimestamp,
            total,
            vatAmt,
            invoiceHashBase64,
            signatureBase64,
            pubKeyPem,
            certSignature
        );

        // --- STEP F: Inject back into XML ---
        let finalXml = xml.replace('<!-- UBLEXTENSIONS_PLACEHOLDER -->', envelope);
        finalXml = finalXml.replace('<!-- QR_PLACEHOLDER -->', `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${tlv}</cbc:EmbeddedDocumentBinaryObject>`);

        // Update DB
        updateRow.run(finalXml, invoiceHashBase64, row.id);
        
        success++;
        console.log(`  [OK] Invoice ${row.invoice_number} fully repaired and re-signed.`);
    } catch (err) {
        failed++;
        console.error(`  [FAIL] Invoice ${row.invoice_number}: ${err.message}`);
    }
}

console.log(`\n[REPAIR COMPLETE] Successfully repaired ${success} out of ${invoices.length} invoices.`);
db.close();
