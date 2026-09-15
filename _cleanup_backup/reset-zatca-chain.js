/**
 * reset-zatca-chain.js
 *
 * Resets the ZATCA Phase 2 cryptographic chain (ICV + PIH) to genesis state
 * on the LIVE Electron userData database, wherever it actually lives under
 * %APPDATA%.
 *
 * Why sql.js instead of better-sqlite3:
 *   better-sqlite3 ships native bindings compiled against a specific Node
 *   ABI. The copy bundled inside your Electron app is almost certainly
 *   compiled against Electron's V8/Node ABI, NOT your system Node's ABI.
 *   Running it from plain `node script.js` will throw a NODE_MODULE_VERSION
 *   mismatch error. sql.js is pure WebAssembly — it doesn't care what
 *   runtime loaded it, so it works identically in Node, Electron, or a
 *   browser. We just read the .db file into a buffer, let sql.js mutate it
 *   in memory, then write the resulting buffer back to disk.
 *
 * USAGE:
 *   1. cd into this folder
 *   2. npm install sql.js
 *   3. node reset-zatca-chain.js
 *      (add --dry-run to scan + report without writing anything)
 *      (add --yes to skip the confirmation prompt)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_CONFIRM = process.argv.includes('--yes');

const REQUIRED_TABLES = ['zatca_device', 'sales', 'zatca_queue'];

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Step 1: Find every plausible .db file under %APPDATA%
// ---------------------------------------------------------------------------
function findCandidateDbFiles() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  if (!fs.existsSync(appData)) {
    throw new Error(`APPDATA path does not exist: ${appData}. Are you running this on Windows / via the right shell?`);
  }

  const candidates = [];

  function walk(dir, depth) {
    if (depth > 4) return; // don't go infinitely deep
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return; // permission denied / junction loops, etc.
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip obviously irrelevant huge vendor dirs to keep this fast
        if (['node_modules', '.git', 'Cache', 'GPUCache', 'Code Cache'].includes(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.db') || lower.endsWith('.sqlite') || lower.endsWith('.sqlite3')) {
          candidates.push(full);
        }
      }
    }
  }

  walk(appData, 0);
  return candidates;
}

// Exclude obvious backup/snapshot copies — we only ever want the live file.
function isBackupPath(filePath) {
  const normalized = filePath.toLowerCase();
  return (
    normalized.includes(`${path.sep}backups${path.sep}`.toLowerCase()) ||
    normalized.includes('.bak')
  );
}

// ---------------------------------------------------------------------------
// Step 2: Open each candidate with sql.js and check if it has our schema
// ---------------------------------------------------------------------------
async function loadSqlJs() {
  const initSqlJs = require('sql.js');
  return await initSqlJs();
}

function hasRequiredTables(db) {
  const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table';`);
  if (!res.length) return false;
  const tableNames = res[0].values.map((row) => row[0]);
  return REQUIRED_TABLES.every((t) => tableNames.includes(t));
}

function rowsToObjects(execResult) {
  if (!execResult.length) return [];
  const { columns, values } = execResult[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function printTable(label, objects) {
  console.log(`\n--- ${label} ---`);
  if (!objects.length) {
    console.log('(no rows)');
    return;
  }
  console.table(objects);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('Scanning %APPDATA% for candidate database files...');
  const candidates = findCandidateDbFiles();

  if (!candidates.length) {
    console.log('No .db/.sqlite files found under %APPDATA%. Nothing to do.');
    return;
  }

  console.log(`Found ${candidates.length} candidate file(s):`);
  candidates.forEach((c) => console.log('  -', c));

  const SQL = await loadSqlJs();

  const schemaMatches = [];

  for (const file of candidates) {
    if (isBackupPath(file)) continue; // never consider backup/snapshot copies as the live file
    try {
      const buffer = fs.readFileSync(file);
      const db = new SQL.Database(buffer);
      if (hasRequiredTables(db)) {
        const stat = fs.statSync(file);
        schemaMatches.push({ file, buffer, db, mtime: stat.mtimeMs });
      } else {
        db.close();
      }
    } catch (e) {
      // Not a valid sqlite file, or unreadable — skip it
      continue;
    }
  }

  if (!schemaMatches.length) {
    console.log('\nNo non-backup candidate file contains all required tables (zatca_device, sales, zatca_queue).');
    console.log('The live database may be in a folder this script could not read, or under a different name.');
    console.log('Tip: open your Electron app and check app.getPath("userData") in the main process to get the exact folder.');
    return;
  }

  // Rank by most-recently-modified — the live, actively-written file should win.
  schemaMatches.sort((a, b) => b.mtime - a.mtime);

  console.log(`\nFound ${schemaMatches.length} non-backup file(s) matching the ZATCA schema, ranked by last-modified:`);
  schemaMatches.forEach((m, i) => {
    console.log(`  ${i === 0 ? '👉' : '  '} ${new Date(m.mtime).toISOString()}  ${m.file}`);
  });

  // Close the db handles for everything except the top (most recent) match.
  for (let i = 1; i < schemaMatches.length; i++) {
    schemaMatches[i].db.close();
  }

  const { file: target, db: targetDb, buffer: targetBuffer } = schemaMatches[0];

  console.log(`\n✅ Target database identified (most recently modified, non-backup): ${target}`);
  if (schemaMatches.length > 1) {
    console.log('⚠️  Multiple non-backup matches were found — double check the path above is correct before confirming.');
  }

  // -------------------------------------------------------------------------
  // Step 3: Show current state BEFORE making any changes
  // -------------------------------------------------------------------------
  console.log('\n=== CURRENT STATE (before reset) ===');
  printTable('zatca_device', rowsToObjects(targetDb.exec('SELECT * FROM zatca_device;')));
  printTable(
    'zatca_queue (row count)',
    rowsToObjects(targetDb.exec('SELECT COUNT(*) AS queue_rows FROM zatca_queue;'))
  );
  printTable(
    'sales (pending zatca_status count)',
    rowsToObjects(
      targetDb.exec(`SELECT COUNT(*) AS pending_sales FROM sales WHERE zatca_status = 'pending';`)
    )
  );

  if (DRY_RUN) {
    console.log('\n--dry-run flag set: no changes will be written. Exiting.');
    targetDb.close();
    return;
  }

  if (!SKIP_CONFIRM) {
    const answer = await ask(
      `\nThis will overwrite the live database at:\n  ${target}\nA timestamped .bak will be created first.\nProceed? (yes/no): `
    );
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('Aborted by user. No changes made.');
      targetDb.close();
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Backup the original file first (non-negotiable for a live DB)
  // -------------------------------------------------------------------------
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${target}.${timestamp}.bak`;
  fs.writeFileSync(backupPath, targetBuffer);
  console.log(`\n💾 Backup written: ${backupPath}`);

  // -------------------------------------------------------------------------
  // Step 5: Run the reset inside a transaction
  // -------------------------------------------------------------------------
  try {
    targetDb.run('BEGIN TRANSACTION;');
    targetDb.run('DELETE FROM zatca_queue;');
    targetDb.run(`UPDATE sales SET zatca_status = 'legacy' WHERE zatca_status = 'pending';`);
    targetDb.run('UPDATE zatca_device SET current_icv = 0, last_pih = NULL;');
    targetDb.run('COMMIT;');
  } catch (e) {
    targetDb.run('ROLLBACK;');
    console.error('❌ Error during mutation — rolled back, original file untouched. Backup is still at:', backupPath);
    throw e;
  }

  // -------------------------------------------------------------------------
  // Step 6: Export the mutated buffer and overwrite the live file
  // -------------------------------------------------------------------------
  const newBuffer = targetDb.export();
  fs.writeFileSync(target, Buffer.from(newBuffer));
  console.log(`\n✅ Reset written to: ${target}`);

  // -------------------------------------------------------------------------
  // Step 7: Re-open the SAVED file fresh and verify, per the directive
  // -------------------------------------------------------------------------
  const verifyBuffer = fs.readFileSync(target);
  const verifyDb = new SQL.Database(verifyBuffer);

  console.log('\n=== VERIFICATION (re-read from disk) ===');
  printTable('zatca_device', rowsToObjects(verifyDb.exec('SELECT * FROM zatca_device;')));
  printTable(
    'zatca_queue (row count, should be 0)',
    rowsToObjects(verifyDb.exec('SELECT COUNT(*) AS queue_rows FROM zatca_queue;'))
  );
  printTable(
    'sales (pending zatca_status count, should be 0)',
    rowsToObjects(
      verifyDb.exec(`SELECT COUNT(*) AS pending_sales FROM sales WHERE zatca_status = 'pending';`)
    )
  );

  const deviceCheck = rowsToObjects(verifyDb.exec('SELECT current_icv, last_pih FROM zatca_device;'))[0];
  const queueCheck = rowsToObjects(verifyDb.exec('SELECT COUNT(*) AS c FROM zatca_queue;'))[0];
  const pendingCheck = rowsToObjects(
    verifyDb.exec(`SELECT COUNT(*) AS c FROM sales WHERE zatca_status = 'pending';`)
  )[0];

  const ok =
    deviceCheck &&
    Number(deviceCheck.current_icv) === 0 &&
    (deviceCheck.last_pih === null) &&
    Number(queueCheck.c) === 0 &&
    Number(pendingCheck.c) === 0;

  console.log(ok ? '\n🎉 RESET CONFIRMED: ICV = 0, last_pih = NULL, queue empty, no pending sales.' : '\n⚠️  Verification did not fully match expected state — review the tables above.');

  targetDb.close();
  verifyDb.close();
})().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
