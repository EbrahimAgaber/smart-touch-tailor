/**
 * reset_zatca_chain_sqljs.cjs
 *
 * Resets the ZATCA e-invoicing cryptographic chain.
 * Uses sql.js (pure WebAssembly) — no native addon, works on any Node version.
 *
 * Run:
 *   node reset_zatca_chain_sqljs.cjs
 *
 * If sql.js is not installed:
 *   npm install sql.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Locate the real database ─────────────────────────────────────────────────
// Electron writes pos_data.db to app.getPath('userData'), which on Windows is:
//   C:\Users\<user>\AppData\Roaming\<app-name>\pos_data.db
//
// We search common app-name candidates automatically.
const APP_NAME_CANDIDATES = [
    'smart-touch-pos',
    'Smart Touch POS',
    'SmartTouchPOS',
    'smart-touch',
    'my-pos',
    'pos',
];

function findDatabase() {
    // 1. Explicit override via environment variable
    if (process.env.POS_DB_PATH && fs.existsSync(process.env.POS_DB_PATH)) {
        return process.env.POS_DB_PATH;
    }

    // 2. Search AppData\Roaming
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    for (const name of APP_NAME_CANDIDATES) {
        const candidate = path.join(appData, name, 'pos_data.db');
        if (fs.existsSync(candidate)) return candidate;
    }

    // 3. Fallback: project directory (dev mode with USER_DATA_PATH override)
    const devPath = path.join(__dirname, 'pos_data.db');
    if (fs.existsSync(devPath)) {
        const { exec } = db_exec_from(devPath);
        // Only use project-level db if it actually has the zatca_device table
        try {
            const SQL = require('sql.js'); // quick check — real init happens below
        } catch(_) {}
        return devPath;
    }

    return null;
}

// Helper — not used, just for clarity above
function db_exec_from() {}

const DB_PATH = findDatabase();

if (!DB_PATH) {
    console.error('\n❌  Could not find pos_data.db.');
    console.error('    Searched in:');
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    for (const name of APP_NAME_CANDIDATES) {
        console.error('      ' + path.join(appData, name, 'pos_data.db'));
    }
    console.error('\n    To override, set the POS_DB_PATH environment variable:');
    console.error('      $env:POS_DB_PATH = "C:\\path\\to\\pos_data.db"');
    console.error('      node reset_zatca_chain_sqljs.cjs\n');
    process.exit(1);
}

console.log(`\n📂  Using database: ${DB_PATH}`);

// ── Load sql.js ──────────────────────────────────────────────────────────────
let initSqlJs;
try {
    initSqlJs = require('sql.js');
} catch (err) {
    console.error('\n❌  sql.js not found. Run:  npm install sql.js\n');
    process.exit(1);
}

(async () => {
    const SQL = await initSqlJs();

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    // Verify the table exists
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='zatca_device'");
    if (!tables.length || !tables[0].values.length) {
        console.error('\n❌  zatca_device table not found in this database.');
        console.error('    This may be the wrong file. Check the path above.\n');
        db.close();
        process.exit(1);
    }

    // ── BEFORE state ──────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════');
    console.log('  ZATCA Chain Reset — Smart Touch POS v2');
    console.log('══════════════════════════════════════════════\n');

    const beforeRows = db.exec('SELECT id, device_id, current_icv, last_pih FROM zatca_device');
    console.log('BEFORE:');
    if (!beforeRows.length) {
        console.log('  (no rows in zatca_device)');
    } else {
        const { columns, values } = beforeRows[0];
        console.table(values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]]))));
    }

    // ── Perform the reset ─────────────────────────────────────────────────────
    db.run('UPDATE zatca_device SET last_pih = NULL, current_icv = 0');

    const changes = db.getRowsModified();
    if (changes === 0) {
        console.error('\n❌  No rows updated — is zatca_device empty?\n');
        db.close();
        process.exit(1);
    }

    // ── AFTER state ───────────────────────────────────────────────────────────
    const afterRows = db.exec('SELECT id, device_id, current_icv, last_pih FROM zatca_device');
    console.log(`\nAFTER  (${changes} row(s) updated):`);
    const { columns, values } = afterRows[0];
    console.table(values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]]))));

    // ── Write back to disk ────────────────────────────────────────────────────
    const exported = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(exported));
    db.close();

    console.log('✅  Chain reset complete.');
    console.log('    last_pih    → NULL  (genesis PIH fallback will be used)');
    console.log('    current_icv → 0     (next invoice will be ICV = 1)\n');
})();
