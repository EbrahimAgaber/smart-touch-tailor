/**
 * reset_zatca_chain.cjs
 *
 * Resets the ZATCA e-invoicing cryptographic chain so Invoice #1
 * can be regenerated cleanly with the correct genesis PIH.
 *
 * Safe to run before ANY invoice has been reported to the ZATCA portal.
 * After running, the next sale will produce ICV=1 with the genesis PIH.
 *
 * Usage (inside Electron context to avoid ABI issues):
 *   node reset_zatca_chain.cjs
 *   -- OR --
 *   Run via: npx electron . --run-reset  (if you wire it into main.js)
 *
 * For standalone Node execution you must first rebuild better-sqlite3:
 *   npx electron-rebuild -f -w better-sqlite3
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Locate the database ──────────────────────────────────────────────────────
// Adjust DB_PATH if your file is named differently or lives elsewhere.
const DB_PATH = path.join(__dirname, 'pos_data.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`\n❌  Database not found at: ${DB_PATH}`);
  console.error('    Update DB_PATH in this script and retry.\n');
  process.exit(1);
}

// ── Load better-sqlite3 ──────────────────────────────────────────────────────
let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  console.error('\n❌  Failed to load better-sqlite3:', err.message);
  console.error('    If you see an ABI/NODE_MODULE_VERSION error, run:');
  console.error('      npx electron-rebuild -f -w better-sqlite3\n');
  process.exit(1);
}

const db = new Database(DB_PATH, { verbose: null });

// ── Show BEFORE state ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('  ZATCA Chain Reset — Smart Touch POS v2');
console.log('══════════════════════════════════════════════\n');

const before = db.prepare('SELECT * FROM zatca_device').all();
console.log('BEFORE:');
console.table(before);

// ── Perform the reset inside a transaction ───────────────────────────────────
const resetChain = db.transaction(() => {
  const result = db.prepare(`
    UPDATE zatca_device
    SET    last_pih    = NULL,
           current_icv = 0
  `).run();

  if (result.changes === 0) {
    throw new Error('No rows were updated. Is zatca_device empty?');
  }
  return result.changes;
});

let changed;
try {
  changed = resetChain();
} catch (err) {
  console.error('\n❌  Reset failed:', err.message);
  db.close();
  process.exit(1);
}

// ── Show AFTER state ─────────────────────────────────────────────────────────
const after = db.prepare('SELECT * FROM zatca_device').all();
console.log(`\nAFTER  (${changed} row(s) updated):`);
console.table(after);

db.close();

console.log('✅  Chain reset complete.');
console.log('    last_pih    → NULL  (genesis fallback will be used)');
console.log('    current_icv → 0     (next invoice will be ICV = 1)\n');
