/**
 * fix_pending_queue.cjs
 * 
 * ONE-TIME fix script for the 39 stuck pending ZATCA invoices.
 * 
 * These invoices were created BEFORE the device was onboarded,
 * so their signed_xml has no proper signature envelope / CSID.
 * ZATCA will reject them if submitted as-is.
 * 
 * This script marks them as 'legacy_pre_onboarding' so they are
 * skipped by the reporter and the queue can process new invoices
 * correctly after onboarding completes.
 * 
 * Usage (from project root):
 *   node fix_pending_queue.cjs
 * 
 * Or with a custom DB path:
 *   node fix_pending_queue.cjs "C:\Users\YourName\AppData\Roaming\your-app\pos_data.db"
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ─── Locate the database ──────────────────────────────────────────────────────
function findDb() {
    // 1. CLI argument
    if (process.argv[2]) return process.argv[2];

    // 2. Dev DB in project root
    const devPath = path.join(__dirname, 'pos_data.db');
    if (fs.existsSync(devPath)) return devPath;

    // 3. Electron userData path (Windows)
    const appDataBase = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const candidates = [
        path.join(appDataBase, 'my-pos', 'pos_data.db'),
        path.join(appDataBase, 'smart-pos', 'pos_data.db'),
        path.join(appDataBase, 'Electron', 'pos_data.db'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }

    console.error('❌ Could not find pos_data.db. Pass the path as the first argument.');
    process.exit(1);
}

const dbPath = findDb();
console.log(`\n📂 Using database: ${dbPath}\n`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ─── Step 1: Show current state ───────────────────────────────────────────────
const device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();

console.log('═══════════════════════════════════════════════════════');
console.log('  ZATCA Device Status');
console.log('═══════════════════════════════════════════════════════');
if (!device) {
    console.log('  ⚠️  No device record found in zatca_device table.');
} else {
    console.log(`  Device ID         : ${device.device_id}`);
    console.log(`  Current ICV       : ${device.current_icv}`);
    console.log(`  Has Private Key   : ${!!device.private_key_pem}`);
    console.log(`  Has Compliance    : ${!!device.compliance_csid}`);
    console.log(`  Has Production    : ${!!device.production_csid}`);
    console.log(`  Has Cert PEM      : ${!!device.production_cert_pem}`);
    console.log(`  Cert Expires At   : ${device.cert_expires_at || 'N/A'}`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Queue Status');
console.log('═══════════════════════════════════════════════════════');
const queueStats = db.prepare(`
    SELECT status, COUNT(*) as cnt 
    FROM zatca_queue 
    GROUP BY status 
    ORDER BY cnt DESC
`).all();
for (const row of queueStats) {
    const icon = row.status === 'pending' ? '⏳' :
                 row.status === 'reported' ? '✅' :
                 row.status === 'rejected' ? '❌' :
                 row.status === 'failed'   ? '⚠️' : '📋';
    console.log(`  ${icon}  ${row.status.padEnd(25)} : ${row.cnt}`);
}

// Check halt flag
try {
    const haltRow = db.prepare("SELECT zatca_queue_halted FROM settings LIMIT 1").get();
    console.log(`\n  Queue Halted Flag : ${haltRow?.zatca_queue_halted == 1 ? '🔴 YES (halted)' : '✅ NO'}`);
} catch (_) {
    console.log('\n  Queue Halted Flag : column not found (no halt applied)');
}

// ─── Step 2: Decide action ───────────────────────────────────────────────────
const pendingCount = db.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='pending'").get().c;
const failedCount  = db.prepare("SELECT COUNT(*) as c FROM zatca_queue WHERE status='failed'").get().c;
const preOnboardTotal = pendingCount + failedCount;

console.log('\n═══════════════════════════════════════════════════════');

if (!device || !device.production_csid) {
    console.log('⚠️  Device is NOT onboarded yet.\n');
    console.log('   The ' + preOnboardTotal + ' pending/failed invoices were signed WITHOUT a ZATCA');
    console.log('   certificate. They CANNOT be submitted to ZATCA.\n');
    console.log('   ACTION: Marking them as [legacy_pre_onboarding] so they are');
    console.log('   skipped by the reporter. New invoices after onboarding will');
    console.log('   be submitted correctly.\n');

    if (preOnboardTotal > 0) {
        const result = db.prepare(`
            UPDATE zatca_queue 
            SET status = 'legacy_pre_onboarding',
                zatca_response_json = '{"note":"Marked as legacy by fix_pending_queue.cjs — device was not onboarded when these invoices were created. ZATCA cannot verify these invoices."}'
            WHERE status IN ('pending', 'failed')
        `).run();
        console.log(`  ✅ Marked ${result.changes} invoices as [legacy_pre_onboarding].`);
    } else {
        console.log('  ✅ No pending/failed invoices to fix.');
    }

    // Reset halt flag if set
    try {
        db.prepare("ALTER TABLE settings ADD COLUMN zatca_queue_halted INTEGER DEFAULT 0").run();
    } catch(_) {}
    db.prepare("UPDATE settings SET zatca_queue_halted = 0").run();
    console.log('  ✅ Queue halt flag cleared (if it was set).');

} else {
    console.log('✅ Device IS onboarded.\n');
    console.log(`   Production CSID found. ${preOnboardTotal} pending/failed invoices exist.\n`);

    if (preOnboardTotal > 0) {
        // Check if these were signed with a cert (by checking for UBLExtensions in XML)
        const sample = db.prepare("SELECT signed_xml FROM zatca_queue WHERE status='pending' LIMIT 1").get();
        const hasSig = sample?.signed_xml?.includes('UBLExtensions') && 
                       sample?.signed_xml?.includes('SignatureValue');

        if (!hasSig) {
            console.log('   ⚠️  Pending invoices appear to have NO signature (no UBLExtensions/SignatureValue).');
            console.log('   These were created before onboarding and will be rejected by ZATCA.\n');
            console.log('   ACTION: Marking as [legacy_pre_onboarding] so queue can progress.\n');
            
            const result = db.prepare(`
                UPDATE zatca_queue 
                SET status = 'legacy_pre_onboarding',
                    zatca_response_json = '{"note":"Marked as legacy by fix_pending_queue.cjs — no signature found, device was not onboarded when these invoices were created."}'
                WHERE status IN ('pending', 'failed')
            `).run();
            console.log(`  ✅ Marked ${result.changes} invoices as [legacy_pre_onboarding].`);
        } else {
            console.log('   These invoices appear to have signatures. The reporter should process them.');
            console.log('   If they keep failing, run this script again to mark them as legacy.');
        }
    } else {
        console.log('   ✅ No pending/failed invoices. Queue looks clean.');
    }

    // Ensure halt flag is cleared
    try {
        db.prepare("ALTER TABLE settings ADD COLUMN zatca_queue_halted INTEGER DEFAULT 0").run();
    } catch(_) {}
    db.prepare("UPDATE settings SET zatca_queue_halted = 0").run();
    console.log('  ✅ Queue halt flag cleared.');
}

// ─── Step 3: Ensure reporter migration columns exist ─────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log('  Verifying DB schema migrations');
console.log('═══════════════════════════════════════════════════════');

const migrations = [
    "ALTER TABLE zatca_queue ADD COLUMN invoice_subtype TEXT DEFAULT '0200000'",
    "ALTER TABLE zatca_queue ADD COLUMN stamped_xml TEXT",
    "ALTER TABLE zatca_queue ADD COLUMN ecdsa_signature TEXT",
    "ALTER TABLE zatca_queue ADD COLUMN cert_signature TEXT",
    "ALTER TABLE zatca_device ADD COLUMN cert_expires_at DATETIME",
    "ALTER TABLE sales ADD COLUMN zatca_clearance_status TEXT",
    "ALTER TABLE sales ADD COLUMN zatca_cleared_at TEXT",
    "ALTER TABLE sales ADD COLUMN customer_tax_id TEXT",
];

for (const sql of migrations) {
    try {
        db.prepare(sql).run();
        const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
        console.log(`  ✅ Column added or already exists: ${col}`);
    } catch (_) {
        const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
        console.log(`  ✓  Already exists: ${col}`);
    }
}

// ─── Step 4: Final state ─────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log('  Final Queue State');
console.log('═══════════════════════════════════════════════════════');
const finalStats = db.prepare(`
    SELECT status, COUNT(*) as cnt 
    FROM zatca_queue 
    GROUP BY status 
    ORDER BY cnt DESC
`).all();
for (const row of finalStats) {
    const icon = row.status === 'pending'               ? '⏳' :
                 row.status === 'reported'              ? '✅' :
                 row.status === 'rejected'              ? '❌' :
                 row.status === 'legacy_pre_onboarding' ? '📦' :
                 row.status === 'failed'                ? '⚠️' : '📋';
    console.log(`  ${icon}  ${row.status.padEnd(28)} : ${row.cnt}`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('  NEXT STEPS');
console.log('═══════════════════════════════════════════════════════');
if (!device?.production_csid) {
    console.log('\n  1. Open POS → Settings → هيئة الزكاة');
    console.log('  2. Select "بيئة المحاكاة" (Simulation)');
    console.log('  3. Go to portal.zatca.gov.sa → Add new device → get OTP');
    console.log('  4. Enter OTP in POS and click "تفعيل وربط الجهاز"');
    console.log('  5. Run Simulation Tests (3 test invoices)');
    console.log('  6. If all pass → switch to Production environment');
    console.log('  7. Get a new OTP from ZATCA portal for Production');
    console.log('  8. Onboard again for Production environment\n');
    console.log('  NOTE: New invoices created AFTER onboarding will be');
    console.log('  submitted correctly. The 39 legacy invoices cannot be');
    console.log('  recovered — they were unsigned. Your VAT returns should');
    console.log('  still include these sales (they are in your sales table).\n');
} else {
    console.log('\n  Queue is ready. Restart the POS app and the reporter');
    console.log('  will begin submitting pending invoices automatically.\n');
}

db.close();
console.log('✅ Script complete.\n');
