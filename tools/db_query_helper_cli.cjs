// tools/db_query_helper_cli.cjs
// Run via: node_modules\electron\dist\electron.exe --no-sandbox tools/db_query_helper_cli.cjs -- device-status
// Writes output to tools/db_out.txt for capture
'use strict';

process.env.ELECTRON_ENABLE_LOGGING = '1';

const path = require('path');
const fs   = require('fs');

const outPath = path.join(__dirname, 'db_out.txt');
const lines = [];

function out(...args) {
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    lines.push(line);
    process.stdout.write(line + '\n');
}

const { app } = require('electron');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    const DB_PATH = path.join(__dirname, '..', 'pos_data.db');
    const Database = require('better-sqlite3');
    // cmd is the first arg after --
    const argSep = process.argv.indexOf('--');
    const cmd = argSep >= 0 ? process.argv[argSep + 1] : (process.argv[2] || 'device-status');

    try {
        const db = new Database(DB_PATH, { readonly: false });

        if (cmd === 'device-status') {
            out('\n=== STEP 1.1: zatca_device ===');
            const rows = db.prepare('SELECT id, length(production_cert_pem) as cert_len, length(private_key_pem) as key_len, production_csid IS NOT NULL as has_csid, created_at FROM zatca_device').all();
            out('Rows:', rows.length);
            rows.forEach(r => out(r));
            if (rows.length === 0) out('  → CLEAN SLATE: No device registered yet');
            rows.forEach(r => {
                const ok = r.has_csid && r.cert_len > 0 && r.key_len > 0;
                out(`  ID ${r.id}: has_cert=${r.cert_len>0?1:0}, has_key=${r.key_len>0?1:0}, has_csid=${r.has_csid} → ${ok?'READY':'NOT READY'}`);
            });
        }

        else if (cmd === 'queue-status') {
            out('\n=== Queue counts by status ===');
            const counts = db.prepare("SELECT status, COUNT(*) as c FROM zatca_queue GROUP BY status ORDER BY c DESC").all();
            if (counts.length === 0) out('  → Queue is empty');
            counts.forEach(r => out(`  ${r.status}: ${r.c}`));
            out('\n=== Last 10 queue items ===');
            const last = db.prepare("SELECT invoice_number, icv, status, attempts, submitted_at FROM zatca_queue ORDER BY icv DESC LIMIT 10").all();
            if (last.length === 0) out('  → No items');
            last.forEach(r => out(r));
        }

        else if (cmd === 'halt-status') {
            out('\n=== Halt Flag Status ===');
            try {
                const row = db.prepare("SELECT key, value FROM business_settings WHERE key='zatca_queue_halted'").get();
                out(row ? row : 'No halt flag row (default = not halted / 0)');
            } catch(e) { out('business_settings error:', e.message); }
        }

        else if (cmd === 'force-halt') {
            out('\n=== Force-halting queue ===');
            db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('zatca_queue_halted', '1')").run();
            const row = db.prepare("SELECT key, value FROM business_settings WHERE key='zatca_queue_halted'").get();
            out('Set:', row);
        }

        else if (cmd === 'force-resume') {
            out('\n=== Resuming queue ===');
            db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('zatca_queue_halted', '0')").run();
            const row = db.prepare("SELECT key, value FROM business_settings WHERE key='zatca_queue_halted'").get();
            out('Cleared:', row);
        }

        else if (cmd === 'simulate-failed') {
            out('\n=== Simulating failed invoice ===');
            const last = db.prepare("SELECT id, invoice_number, status FROM zatca_queue ORDER BY id DESC LIMIT 1").get();
            if (last) {
                db.prepare("UPDATE zatca_queue SET status='failed', attempts=3, submitted_at=datetime('now','-2 hours') WHERE id=?").run(last.id);
                out(`Marked invoice ${last.invoice_number} (id=${last.id}) as failed with 3 attempts`);
                const updated = db.prepare("SELECT invoice_number, icv, status, attempts, submitted_at FROM zatca_queue WHERE id=?").get(last.id);
                out('Updated row:', updated);
            } else { out('No queue rows found'); }
        }

        else if (cmd === 'backoff-check') {
            out('\n=== Backoff eligibility (failed rows) ===');
            const failed = db.prepare("SELECT invoice_number, attempts, submitted_at FROM zatca_queue WHERE status='failed'").all();
            if (failed.length === 0) { out('No failed rows'); }
            failed.forEach(r => {
                const backoffMs = Math.min(60000 * Math.pow(2, r.attempts), 21600000);
                const lastAt = r.submitted_at ? new Date(r.submitted_at).getTime() : 0;
                const eligibleAt = new Date(lastAt + backoffMs).toISOString();
                const ready = (Date.now() - lastAt) >= backoffMs;
                out(`  ${r.invoice_number}: attempts=${r.attempts}, backoff=${backoffMs/1000}s, eligible_at=${eligibleAt}, RETRY_READY=${ready}`);
            });
        }

        else if (cmd === 'simulate-cert-corrupt') {
            out('\n=== Corrupting cert for CERT_PARSE_ERROR test ===');
            const dev = db.prepare("SELECT id, production_cert_pem FROM zatca_device LIMIT 1").get();
            if (dev && dev.production_cert_pem) {
                fs.writeFileSync(path.join(__dirname, 'cert_backup.pem'), dev.production_cert_pem);
                db.prepare("UPDATE zatca_device SET production_cert_pem='INVALID_CERT_FOR_TESTING' WHERE id=?").run(dev.id);
                out(`Cert corrupted for device id=${dev.id}. Backup: tools/cert_backup.pem`);
            } else { out(dev ? 'Device has no cert (not onboarded)' : 'No device found'); }
        }

        else if (cmd === 'restore-cert') {
            out('\n=== Restoring cert from backup ===');
            const backupPath = path.join(__dirname, 'cert_backup.pem');
            if (fs.existsSync(backupPath)) {
                const pem = fs.readFileSync(backupPath, 'utf8');
                const dev = db.prepare("SELECT id FROM zatca_device LIMIT 1").get();
                if (dev && pem.length > 0) {
                    db.prepare("UPDATE zatca_device SET production_cert_pem=? WHERE id=?").run(pem, dev.id);
                    out(`Cert restored for device id=${dev.id}`);
                } else { out('No device or empty backup'); }
            } else { out('No cert_backup.pem found in tools/'); }
        }

        else if (cmd === 'cleared-check') {
            out('\n=== Cleared (B2B) invoices ===');
            const cleared = db.prepare("SELECT invoice_number, icv, status, stamped_xml IS NOT NULL as has_stamped FROM zatca_queue WHERE status='cleared' ORDER BY id DESC LIMIT 5").all();
            if (cleared.length === 0) out('No cleared invoices yet');
            cleared.forEach(r => out(r));
        }

        else if (cmd === 'business-settings') {
            out('\n=== Business Settings ===');
            const settings = db.prepare("SELECT * FROM business_settings").all();
            if (settings.length === 0) out('No business settings found');
            settings.forEach(r => out(r));
        }

        else if (cmd === 'set-business-settings') {
            out('\n=== Setting Business Settings ===');
            db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('vat_number', '399999999900003')").run();
            db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('business_name_ar', 'شركة الاختبار للتجارة')").run();
            db.prepare("INSERT OR REPLACE INTO business_settings (key, value) VALUES ('zatca_env', 'sandbox')").run();
            const settings = db.prepare("SELECT * FROM business_settings").all();
            settings.forEach(r => out(r));
        }

        else { out('Unknown command:', cmd); }

        db.close();
    } catch (e) {
        out('DB Helper error:', e.message, e.stack);
    }

    // Flush output to file
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    app.quit();
});
