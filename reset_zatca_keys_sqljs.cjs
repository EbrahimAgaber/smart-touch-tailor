/**
 * reset_zatca_keys_sqljs.cjs
 *
 * Wipes the zatca_device table in a live pos_data.db using sql.js (pure
 * WebAssembly — no native bindings).  This sidesteps the ABI mismatch
 * between system Node (v127 / N-API 9) and the Electron-compiled
 * better-sqlite3 binary (N-API built against Electron v121).
 *
 * Usage:
 *   node reset_zatca_keys_sqljs.cjs "C:\Users\<you>\AppData\Roaming\البصمة الذكية\pos_data.db"
 *
 * Or using PowerShell env expansion:
 *   node reset_zatca_keys_sqljs.cjs "$env:APPDATA\البصمة الذكية\pos_data.db"
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Resolve target DB path ────────────────────────────────────────────────────
const dbPath = process.argv[2];
if (!dbPath) {
    console.error('[reset] ERROR: No database path provided.');
    console.error('  Usage: node reset_zatca_keys_sqljs.cjs "<path-to-pos_data.db>"');
    process.exit(1);
}

const resolvedPath = path.resolve(dbPath);
if (!fs.existsSync(resolvedPath)) {
    console.error(`[reset] ERROR: Database not found at: ${resolvedPath}`);
    process.exit(1);
}

// ── Load sql.js with the bundled WASM binary ──────────────────────────────────
const initSqlJs = require('./node_modules/sql.js/dist/sql-wasm.js');
const wasmPath  = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

(async () => {
    console.log('[reset] Loading sql.js WASM engine ...');
    const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasmPath) });

    // ── Read the whole DB file into memory ────────────────────────────────────
    console.log(`[reset] Reading: ${resolvedPath}`);
    const fileBuffer = fs.readFileSync(resolvedPath);
    const db = new SQL.Database(fileBuffer);

    // ── Diagnostic: show current zatca_device rows ────────────────────────────
    let beforeRows = 0;
    try {
        const result = db.exec('SELECT id, device_id, compliance_csid IS NOT NULL AS has_comp, production_cert_pem IS NOT NULL AS has_prod FROM zatca_device');
        if (result.length && result[0].values.length) {
            console.log('[reset] Current zatca_device rows:');
            result[0].values.forEach(row =>
                console.log(`  id=${row[0]}  device_id=${row[1]}  has_compliance_csid=${row[2]}  has_production_cert_pem=${row[3]}`)
            );
            beforeRows = result[0].values.length;
        } else {
            console.log('[reset] zatca_device is already empty.');
        }
    } catch (e) {
        console.warn('[reset] Could not query zatca_device (table may not exist yet):', e.message);
    }

    // ── Wipe the device table ─────────────────────────────────────────────────
    if (beforeRows > 0) {
        db.run('DELETE FROM zatca_device');
        console.log(`[reset] Deleted ${beforeRows} row(s) from zatca_device.`);
    }

    // ── [FIX-ICV-RESET] Archive stale 'cleared'/'reported' rows from the OLD
    // chain generation before resetting pending/failed ones. The new device
    // row recreated by onboarding always starts current_icv at 0, so the very
    // first fresh invoice will be issued with ICV 1 again. The reporter's ICV
    // conflict guard (zatca_reporter.cjs) computes
    // `MAX(icv) WHERE status IN ('cleared','reported')` across the WHOLE
    // zatca_queue table with no notion of chain generation — so any
    // previously successful ICV-1 row left behind from before the reset will
    // make the new ICV-1 invoice look like a duplicate/conflict
    // ([ZATCA] ICV CONFLICT: invoice ... has ICV 1 but last successful ICV
    // was 1) the moment the reporter picks it up. Tag old successful rows as
    // 'archived_legacy' (the same terminal status zatca_recovery.cjs uses) so
    // they're excluded from that MAX(icv) lookup entirely.
    try {
        db.run("UPDATE zatca_queue SET status = 'archived_legacy' WHERE status IN ('cleared','reported')");
        const archivedResult = db.exec("SELECT COUNT(*) FROM zatca_queue WHERE status = 'archived_legacy'");
        const archivedCount = archivedResult[0]?.values[0]?.[0] ?? 0;
        if (Number(archivedCount) > 0) {
            console.log(`[reset] Archived ${archivedCount} old cleared/reported zatca_queue row(s) from the previous chain generation (prevents false ICV CONFLICT after re-onboarding).`);
        }
    } catch (e) {
        console.warn('[reset] Could not archive old cleared/reported zatca_queue rows:', e.message);
    }

    // ── Reset stale zatca_queue rows so they re-enter the signed path ─────────
    try {
        db.run("UPDATE zatca_queue SET status = 'pre_onboarding' WHERE status IN ('pending','failed','retry_exhausted','legacy_pre_onboarding','icv_conflict','sequence_gap','pih_mismatch','rejected')");
        const queueResult = db.exec("SELECT COUNT(*) FROM zatca_queue WHERE status = 'pre_onboarding'");
        const queueCount = queueResult[0]?.values[0]?.[0] ?? 0;
        if (Number(queueCount) > 0) {
            console.log(`[reset] Reset ${queueCount} zatca_queue row(s) to pre_onboarding.`);
        }
    } catch (e) {
        console.warn('[reset] Could not reset zatca_queue (may be empty or missing):', e.message);
    }

    // ── Clear the DB-backed halt flag — stored in business_settings as key='zatca_queue_halted'
    // (zatca_reporter.cjs _setHalted / _isHalted use business_settings, NOT a settings column)
    try {
        db.run("UPDATE business_settings SET value = '0' WHERE key = 'zatca_queue_halted'");
        console.log('[reset] Cleared zatca_queue_halted flag in business_settings.');
    } catch (e) {
        console.warn('[reset] Could not clear zatca_queue_halted in business_settings:', e.message);
    }
    // Also try the old settings table path in case an older schema is in use
    try {
        db.run("UPDATE settings SET zatca_queue_halted = 0");
    } catch (_) {}

    // ── Reset backoff on any 'failed' queue rows so they submit immediately
    // after re-onboarding rather than sitting in exponential backoff.
    try {
        db.run("UPDATE zatca_queue SET attempts = 0, submitted_at = NULL WHERE status = 'failed'");
        console.log('[reset] Reset backoff attempts on failed zatca_queue rows.');
    } catch (e) {
        console.warn('[reset] Could not reset backoff attempts:', e.message);
    }

    // ── Write the modified DB back to disk ────────────────────────────────────
    const outBuffer = Buffer.from(db.export());
    db.close();

    // Safety: back up the original file before overwriting
    const backupPath = resolvedPath + '.bak.' + Date.now();
    fs.copyFileSync(resolvedPath, backupPath);
    console.log(`[reset] Backup written: ${backupPath}`);

    fs.writeFileSync(resolvedPath, outBuffer);
    console.log(`[reset] Database saved: ${resolvedPath}`);
    console.log('[reset] Done. Re-run onboarding from inside the application.');
})().catch(err => {
    console.error('[reset] FATAL:', err.message);
    process.exit(1);
});
