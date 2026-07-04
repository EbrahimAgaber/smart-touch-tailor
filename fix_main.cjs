const fs = require('fs');

let c = fs.readFileSync('electron/main.cjs', 'utf8');

// 1. Remove requires
c = c.replace(/const\s+zatcaPhase2\s*=\s*require\(['"]\.\/zatca_phase2\.cjs['"]\);/g, '');
c = c.replace(/const\s+zatcaReporter\s*=\s*require\(['"]\.\/zatca_reporter\.cjs['"]\);/g, '');

// 2. Add new require near the top if not present
if (!c.includes("registerZatcaHandlers")) {
    c = c.replace(
        "const db = require('./database.cjs');",
        "const db = require('./database.cjs');\nconst { registerZatcaHandlers } = require('./zatca-ipc-handlers.cjs');"
    );
}

// 3. Add registerZatcaHandlers(db) into registerIpcHandlers
if (!c.includes("registerZatcaHandlers(db)")) {
    c = c.replace(
        "function registerIpcHandlers() {",
        "function registerIpcHandlers() {\n    registerZatcaHandlers(db);"
    );
}

// 4. Remove all legacy zatca ipcMain.handlers using string replacements/regexes
// We will look for ipcMain.handle('zatca:...' and remove until the next empty line or next handle.
// Since it's tricky, we can just replace the whole zatca block if it's well-commented, 
// or selectively remove the ones that cause errors. Actually, just removing the references to zatcaPhase2 inside them 
// or stripping them entirely.
// Let's strip the specific large blocks:
const block1Start = c.indexOf("    ipcMain.handle('zatca:getTLV'");
const block1End = c.indexOf("    // ── Export Engine", block1Start);
if (block1Start !== -1 && block1End !== -1) {
    c = c.slice(0, block1Start) + c.slice(block1End);
}

// Remove standalone simulator function
const simStart = c.indexOf("// NOTE: uses zatcaPhase2.signInvoiceXML");
const simEnd = c.indexOf("module.exports = {", simStart);
if (simStart !== -1 && simEnd !== -1) {
    c = c.slice(0, simStart) + c.slice(simEnd);
}

// Remove reporter start
c = c.replace(/zatcaReporter\.startReporter\(60000\);/g, '');

fs.writeFileSync('electron/main.cjs', c, 'utf8');
console.log('Fixed main.cjs');
