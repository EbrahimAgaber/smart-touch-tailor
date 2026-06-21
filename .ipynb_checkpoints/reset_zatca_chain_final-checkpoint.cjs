// C:\my-pos\v2\reset_zatca_chain_final.cjs
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

console.log("================================================");
// 1. Scan and find the true production DB inside AppData
const username = "bin-g"; // Tailored to your system profile
const standardPaths = [
    process.env.POS_DB_PATH, // Overridden via environment variable
    path.join('C:', 'Users', username, 'AppData', 'Roaming', 'smart-touch-pos', 'pos_data.db'),
    path.join('C:', 'Users', username, 'AppData', 'Roaming', 'Smart Touch POS', 'pos_data.db'),
    path.join('C:', 'Users', username, 'AppData', 'Roaming', 'SmartTouchPOS', 'pos_data.db'),
    path.join(process.cwd(), 'pos_data.db') // Fallback back to project root
];

let selectedDbPath = null;
for (const p of standardPaths) {
    if (p && fs.existsSync(p)) {
        // Double check it's not the tiny placeholder file in project root
        const stats = fs.statSync(p);
        if (stats.size > 2048) { // Genuine SQLite files with a schema will be larger
            selectedDbPath = p;
            break;
        }
    }
}

if (!selectedDbPath) {
    console.error("❌ ERROR: Could not locate a valid pos_data.db file with data.");
    console.log("Please search for it manually using PowerShell:");
    console.log("Get-ChildItem \"$env:APPDATA\" -Recurse -Filter \"pos_data.db\" -ErrorAction SilentlyContinue");
    process.exit(1);
}

console.log(`🎯 Target DB Found: ${selectedDbPath}`);

// 2. Load the binary file buffer into memory for sql.js processing
const fileBuffer = fs.readFileSync(selectedDbPath);

initSqlJs().then(function(SQL) {
    const db = new SQL.Database(fileBuffer);
    
    try {
        // Preview BEFORE State
        console.log('\n--- BEFORE RESET ---');
        const beforeRes = db.exec("SELECT id, current_icv, last_pih FROM zatca_device;");
        if (beforeRes.length > 0) {
            console.table(beforeRes[0].values.map(v => ({ id: v[0], current_icv: v[1], last_pih: v[2] })));
        } else {
            console.log("⚠️ No records found in 'zatca_device' table.");
        }

        // Execute the precise transaction reset mutation
        db.run("BEGIN TRANSACTION;");
        db.run("UPDATE zatca_device SET last_pih = NULL, current_icv = 0;");
        db.run("COMMIT;");
        console.log("\n⚡ Database updated in-memory successfully!");

        // Preview AFTER State
        console.log('--- AFTER RESET ---');
        const afterRes = db.exec("SELECT id, current_icv, last_pih FROM zatca_device;");
        if (afterRes.length > 0) {
            console.table(afterRes[0].values.map(v => ({ id: v[0], current_icv: v[1], last_pih: v[2] })));
        }

        // Save binary back to disk safely
        const updatedData = db.export();
        const buffer = Buffer.from(updatedData);
        fs.writeFileSync(selectedDbPath, buffer);
        console.log("\n✅ Binary file completely saved back to disk. Chain has been cleanly reset!");
        console.log("Go ahead and generate Invoice #1 through your application UI now!");

    } catch (err) {
        console.error("❌ SQL Execution Error:", err.message);
    }
});