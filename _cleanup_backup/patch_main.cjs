const fs = require('fs');

const mainPath = 'c:\\my-pos\\v2\\electron\\main.cjs';
let content = fs.readFileSync(mainPath, 'utf8');

// Remove old imports
content = content.replace("const zatcaPhase2 = require('./zatca_phase2.cjs');\n", "");
content = content.replace("const zatcaReporter = require('./zatca_reporter.cjs');\n", "");

// Add new import
content = content.replace(
    "const syncEngine = require('./syncEngine.cjs');\n",
    "const syncEngine = require('./syncEngine.cjs');\nconst { registerZatcaHandlers } = require('./zatca-ipc-handlers.cjs');\n"
);

// Find the start of IPC handlers registration
const registerIdx = content.indexOf('function registerIpcHandlers() {');
if (registerIdx !== -1) {
    const afterRegister = content.slice(registerIdx);
    const firstIpcMain = afterRegister.indexOf('ipcMain.handle');
    if (firstIpcMain !== -1) {
        const insertPos = registerIdx + firstIpcMain;
        content = content.slice(0, insertPos) + "    registerZatcaHandlers(db);\n" + content.slice(insertPos);
    }
}

// Remove the old ZATCA block (from // ── ZATCA Phase 2 ────── to the next section or end of file)
// There are multiple ZATCA handlers, like zatca:getDevice, zatca:onboardDevice, etc.
const zatcaHandlersRegex = /ipcMain\.handle\('zatca:.*?\);/gs;
// Some are async and span multiple lines.
const removeAllZatcaHandles = (str) => {
    return str.replace(/ipcMain\.handle\('zatca:[^]*?(?=\n\s*ipcMain\.handle|\n\s*\/\/ ──)/g, "");
};

content = removeAllZatcaHandles(content);

// Remove zatcaReporter.startReporter(60000);
content = content.replace("zatcaReporter.startReporter(60000);\n", "");

// Also remove runComplianceInvoices function which uses old phase 2
const runCompRegex = /async function runComplianceInvoices[\s\S]*?(?=\n\s*\/\/ ──)/;
content = content.replace(runCompRegex, '');

fs.writeFileSync(mainPath, content, 'utf8');
console.log('main.cjs patched successfully');
