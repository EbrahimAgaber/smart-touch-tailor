// tools/db_query_helper.cjs
// Run via: node_modules\electron\dist\electron.exe tools/db_query_helper.cjs
// Uses Electron's runtime so better-sqlite3 native addon loads correctly.
'use strict';

const path = require('path');
const fs   = require('fs');

// ── Suppress Electron GUI — run headless ─────────────────────────────────────
const { app } = require('electron');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    const DB_PATH = path.join(__dirname, '..', 'pos_data.db');
    const Database = require('better-sqlite3');

    try {
        const db = new Database(DB_PATH, { readonly: false });

        // ── READ COMMANDS ─────────────────────────────────────────────────────
        const cmd = process.argv[2] || 'status';

        if (cmd === 'device-status') {
            console.log('\n=== STEP 1.1: zatca_device ===');
            const rows = db.prepare(
                'SELECT id, length(production_cert_pem) as cert_len, length(private_key_pem) as key_len, production_csid IS NOT NULL as has_csid, created_at FROM zatca_device'
            ).all();
            console.log('Rows:', rows.length);
            rows.forEach(r => console.log(JSON.stringify(r)));

            console.log('\n=== STEP 1.3: Cert/key presence ===');
            rows.forEach(r => {
                const ok = r.has_csid && r.cert_len > 0 && r.key_len > 0;
                console.log(`ID ${r.id}: has_cert=${r.cert_len > 0 ? 1 : 0}, has_key=${r.key_len > 0 ? 1 : 0}, has_csid=${r.has_csid} → ${ok ? 'READY' : 'NOT READY'}`);
            });
        }

        else if (cmd === 'queue-status') {
            console.log('\n=== Queue Status ===');
            const counts = db.prepare(`
                SELECT status, COUNT(*) as c
                FROM zatca_queue
                GROUP BY status
                ORDER BY c DESC
            `).all();
            console.log(JSON.stringify(counts, null, 2));

            console.log('\n=== Last 10 queue items (icv desc) ===');
            const last = db.prepare(`
                SELECT invoice_number, icv, status, attempts,
                       submitted_at, length(signed_xml) as xml_len
                FROM zatca_queue ORDER BY icv DESC LIMIT 10
            `).all();
            last.forEach(r => console.log(JSON.stringify(r)));
        }

        else if (cmd === 'halt-status') {
            console.log('\n=== Halt Flag ===');
            try {
                const row = db.prepare("SELECT key, value FROM business_settings WHERE key = 'zatca_queue_halted'").get();
                console.log(row ? JSON.stringify(row) : 'No halt flag row (default = not halted)');
            } catch(e) {
                console.log('business_settings error:', e.message);
            }
        }

        else if (cmd === 'force-halt') {
            console.log('\n=== Force-halting queue ===');
            try {
                db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('zatca_queue_halted', '1')").run();
                const row = db.prepare("SELECT key, value FROM business_settings WHERE key = 'zatca_queue_halted'").get();
                console.log('Halt flag set:', JSON.stringify(row));
            } catch(e) {
                console.log('Error:', e.message);
            }
        }

        else if (cmd === 'force-resume') {
            console.log('\n=== Resuming queue ===');
            try {
                db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('zatca_queue_halted', '0')").run();
                const row = db.prepare("SELECT key, value FROM business_settings WHERE key = 'zatca_queue_halted'").get();
                console.log('Halt flag cleared:', JSON.stringify(row));
            } catch(e) {
                console.log('Error:', e.message);
            }
        }

        else if (cmd === 'simulate-failed') {
            console.log('\n=== Simulating failed invoice ===');
            const last = db.prepare("SELECT id, invoice_number, status FROM zatca_queue ORDER BY id DESC LIMIT 1").get();
            if (last) {
                db.prepare("UPDATE zatca_queue SET status='failed', attempts=3, submitted_at=datetime('now', '-2 hours') WHERE id=?").run(last.id);
                console.log(`Marked invoice ${last.invoice_number} (id=${last.id}) as failed with 3 attempts`);
            } else {
                console.log('No queue rows found');
            }
        }

        else if (cmd === 'simulate-cert-corrupt') {
            console.log('\n=== Corrupting cert to trigger CERT_PARSE_ERROR ===');
            const dev = db.prepare("SELECT id FROM zatca_device LIMIT 1").get();
            if (dev) {
                // Backup first
                const orig = db.prepare("SELECT production_cert_pem FROM zatca_device WHERE id=?").get(dev.id);
                fs.writeFileSync(path.join(__dirname, 'cert_backup.pem'), orig.production_cert_pem || '');
                db.prepare("UPDATE zatca_device SET production_cert_pem='INVALID_CERT_FOR_TESTING' WHERE id=?").run(dev.id);
                console.log(`Cert corrupted for device id=${dev.id}. Backup saved to tools/cert_backup.pem`);
            } else {
                console.log('No device found');
            }
        }

        else if (cmd === 'restore-cert') {
            console.log('\n=== Restoring cert from backup ===');
            const backupPath = path.join(__dirname, 'cert_backup.pem');
            if (fs.existsSync(backupPath)) {
                const pem = fs.readFileSync(backupPath, 'utf8');
                const dev = db.prepare("SELECT id FROM zatca_device LIMIT 1").get();
                if (dev && pem) {
                    db.prepare("UPDATE zatca_device SET production_cert_pem=? WHERE id=?").run(pem, dev.id);
                    console.log(`Cert restored for device id=${dev.id}`);
                } else {
                    console.log('Device or backup missing');
                }
            } else {
                console.log('No cert_backup.pem found');
            }
        }

        else if (cmd === 'backoff-check') {
            console.log('\n=== Backoff eligibility for failed rows ===');
            const failed = db.prepare(`
                SELECT invoice_number, attempts, submitted_at,
                    (min(60 * (1 << min(attempts, 17)), 21600)) as backoff_seconds
                FROM zatca_queue WHERE status = 'failed'
            `).all();
            if (failed.length === 0) console.log('No failed rows');
            failed.forEach(r => {
                const eligibleAt = r.submitted_at
                    ? new Date(new Date(r.submitted_at).getTime() + r.backoff_seconds * 1000).toISOString()
                    : 'unknown';
                console.log(`${r.invoice_number}: attempts=${r.attempts}, backoff=${r.backoff_seconds}s, retry_eligible_at=${eligibleAt}`);
            });
        }

        else if (cmd === 'cleared-check') {
            console.log('\n=== Cleared (B2B) invoices ===');
            const cleared = db.prepare(`
                SELECT invoice_number, icv, status, stamped_xml IS NOT NULL as has_stamped
                FROM zatca_queue WHERE status = 'cleared' ORDER BY id DESC LIMIT 5
            `).all();
            console.log(cleared.length === 0 ? 'No cleared invoices' : JSON.stringify(cleared, null, 2));
        }

        db.close();
    } catch (e) {
        console.error('DB Helper error:', e.message);
    }

    app.quit();
});
