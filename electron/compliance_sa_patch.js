
// This script patches compliance_sa.cjs:
// 1. Inserts file-import + auto-match code before the exports block
// 2. Adds new exports

const fs = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, 'compliance_sa.cjs');
const appendFile = path.join(__dirname, 'compliance_sa_append.cjs');

let main = fs.readFileSync(mainFile, 'utf8');
const append = fs.readFileSync(appendFile, 'utf8');

const EXPORT_MARKER = "// ─────────────────────────────────────────────────────────────────────────────\n// EXPORTS";

if (main.includes('importBankStatementFile')) {
    console.log('Already patched — skipping');
    process.exit(0);
}

const insertAt = main.lastIndexOf(EXPORT_MARKER);
if (insertAt === -1) {
    console.error('Could not find EXPORTS marker');
    process.exit(1);
}

const newMain = 
    main.slice(0, insertAt) +
    append + '\n\n' +
    main.slice(insertAt);

// Also extend the module.exports block
const patchedExports = newMain.replace(
    "    // GAP-07 Retention\n    getRetentionManifest,\n};",
    `    // GAP-07 Retention
    getRetentionManifest,
    // GAP-06b Bank File Import + Auto-Match
    importBankStatementFile,
    autoMatchBankLines,
};`
);

fs.writeFileSync(mainFile, patchedExports, 'utf8');
console.log('Patched compliance_sa.cjs successfully');
