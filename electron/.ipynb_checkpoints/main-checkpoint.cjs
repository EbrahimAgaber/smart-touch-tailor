'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
// ─── LICENSE VALIDATION (main process only — SECRET never leaves here) ────────
const _licCrypto = require("crypto");
const _LICENSE_SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b"; // must match gen-key.js
const _LICENSE_EPOCH  = new Date("2025-01-01").getTime();

function _hwidFingerprint(hwid) {
    const h = _licCrypto.createHmac("sha256", _LICENSE_SECRET).update("HWID-FP:" + hwid).digest("hex");
    return parseInt(h.slice(0, 8), 16).toString(36).toUpperCase().slice(-4).padStart(4, "0");
}

function _validateLicenseMain(key, hwid) {
    if (!key || !hwid) return { valid: false, reason: "bad_format" };
    const cleanKey = key.trim().toUpperCase();

    // v3 Format (14 chars): [PLAN:1][EXP_B36:3][HWID_FP:4][SIG:6]
    if (cleanKey.length === 14) {
        const planCode   = cleanKey[0];
        const expiryB36  = cleanKey.slice(1, 4);
        const keyFp      = cleanKey.slice(4, 8);
        const sigB36     = cleanKey.slice(8);
        const planMap    = { "0": "trial", "1": "monthly", "2": "yearly", "3": "lifetime" };
        const plan       = planMap[planCode];
        if (!plan) return { valid: false, reason: "bad_format" };

        const expectedFp = _hwidFingerprint(hwid);
        if (keyFp !== expectedFp) return { valid: false, reason: "wrong_device" };

        const daysSince   = parseInt(expiryB36, 36);
        const expiry      = daysSince === 0 ? 0 : _LICENSE_EPOCH + (daysSince * 86400000);
        const payload     = `${hwid}|${planCode}|${daysSince}|${keyFp}`;
        const sigHex      = _licCrypto.createHmac("sha256", _LICENSE_SECRET).update(payload).digest("hex");
        const expectedSig = parseInt(sigHex.slice(0, 10), 16).toString(36).toUpperCase().slice(-6).padStart(6, "0");
        if (sigB36 !== expectedSig) return { valid: false, reason: "invalid_key" };

        const now = Date.now();
        if (expiry !== 0 && now > expiry) return { valid: false, reason: "expired", expiredAt: new Date(expiry), plan };
        const daysLeft = expiry === 0 ? Infinity : Math.ceil((expiry - now) / 86400000);
        return { valid: true, plan, expiry, daysLeft };
    }

    // Owner key (10 chars starting with OWNER)
    if (cleanKey.length === 10 && cleanKey.startsWith("OWNER")) {
        const phrase      = "OWNER-MASTER-2026-V3";
        const sigHex      = _licCrypto.createHmac("sha256", _LICENSE_SECRET).update(phrase).digest("hex");
        const expectedSig = parseInt(sigHex.slice(0, 8), 16).toString(36).toUpperCase().slice(-5).padStart(5, "0");
        if (cleanKey === `OWNER${expectedSig}`) return { valid: true, plan: "owner", expiry: 0, daysLeft: Infinity };
    }

    // Legacy v2 / ALB- formats intentionally rejected.
    return { valid: false, reason: "invalid_key" };
}

let _activeLicense = null;

// ── Grace period: give existing clients 48 h to re-activate after a v2→v3 update ──
const _GRACE_HOURS = 48;
const _GRACE_FLAG  = "license_grace_until";

function _getGraceExpiry(userData) {
    try {
        const flagPath = path.join(userData || "", _GRACE_FLAG + ".txt");
        if (fs.existsSync(flagPath)) {
            return parseInt(fs.readFileSync(flagPath, "utf8").trim()) || 0;
        }
    } catch(_) {}
    return 0;
}

function _setGrace(userData) {
    try {
        const until    = Date.now() + _GRACE_HOURS * 3600000;
        const flagPath = path.join(userData || "", _GRACE_FLAG + ".txt");
        fs.writeFileSync(flagPath, String(until), "utf8");
        console.log("[License] Grace period set until", new Date(until).toISOString());
        return until;
    } catch(_) { return 0; }
}

function _clearGrace(userData) {
    try {
        const flagPath = path.join(userData || "", _GRACE_FLAG + ".txt");
        if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
    } catch(_) {}
}

function _isLicenseActive() {
    // Active valid license
    if (_activeLicense && _activeLicense.valid &&
        (_activeLicense.expiry === 0 || Date.now() < _activeLicense.expiry)) return true;
    // Fall back to grace period (existing clients migrating from v2 keys)
    try {
        const graceUntil = _getGraceExpiry(app ? app.getPath("userData") : "");
        return graceUntil > 0 && Date.now() < graceUntil;
    } catch(_) { return false; }
}

// Wrap any IPC handler: returns a license-required error if no valid license or grace
function _gated(fn) {
    return async (e, ...args) => {
        if (!_isLicenseActive()) {
            return { success: false, error: "LICENSE_REQUIRED", message: "الترخيص غير صالح أو منتهي الصلاحية — يرجى تجديد الاشتراك" };
        }
        return fn(e, ...args);
    };
}
// ──────────────────────────────────────────────────────────────────────────────

async function _getHWID() {
    const { execSync } = require("child_process");
    const os = require("os");
    try {
        const out = execSync("wmic csproduct get uuid").toString();
        const uuidLines = out.split("\n").filter(l => l.trim() && !l.toLowerCase().includes("uuid"));
        const uuid = uuidLines[0] ? uuidLines[0].trim() : "";
        if (uuid && uuid !== "UNKNOWN" && !uuid.startsWith("FFFF")) return uuid;
    } catch(e) {}
    try {
        const serialOut = execSync("wmic bios get serialnumber").toString();
        const serialLines = serialOut.split("\n").filter(l => l.trim() && !l.toLowerCase().includes("serial"));
        const serial = serialLines[0] ? serialLines[0].trim() : "";
        if (serial && serial !== "To be filled by O.E.M." && serial.length > 3) {
            return `${os.hostname()}-${serial}`;
        }
    } catch(e) {}
    return "GENERIC-HWID-" + require("os").hostname();
}

const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
const { autoUpdater } = require('electron-updater');
const db = require('./database.cjs');
const syncEngine = require('./syncEngine.cjs');
const zatcaPhase2 = require('./zatca_phase2.cjs');
const zatcaReporter = require('./zatca_reporter.cjs');

if (!app) { console.error('FATAL: Electron app object undefined.'); process.exit(1); }

process.on('uncaughtException', (err) => console.error('CRITICAL MAIN PROCESS ERROR:', err));
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION:', reason));

let mainWindow;
let posWindow = null; // Dedicated POS window (optional second window)

function registerIpcHandlers() {
    // ── Products ───────────────────────────────────────
    ipcMain.handle('db:getMenu',           ()       => db.getMenu());
    ipcMain.handle('db:addMenuItem',       _gated((e, d)   => db.addItem(d)));
    ipcMain.handle('db:editMenuItem',      _gated((e, d)   => db.editItem(d)));
    ipcMain.handle('db:deleteMenuItem',    _gated((e, id)  => db.deleteItem(id)));
    ipcMain.handle('db:updateStock',       _gated((e, d)   => db.updateStock(d?.id, d?.newStock)));
    ipcMain.handle('db:updateProductCost', _gated((e, d)   => db.updateProductCost(d?.id, d?.newCost)));
    ipcMain.handle('db:importCSV',         (e, p)   => db.importProductsFromCSV(p));

    // ── Held Orders ────────────────────────────────────
    ipcMain.handle('db:getHeldOrders',     ()       => db.getHeldOrders());
    ipcMain.handle('db:holdOrder',         _gated((e, d)   => db.holdOrder(d)));
    ipcMain.handle('db:deleteHeldOrder',   (e, id)  => db.deleteHeldOrder(id));
    ipcMain.handle('db:updateHeldOrderStatus', (e, d) => db.updateHeldOrderStatus(d.id, d.status));

    // ── Tables ────────────────────────────────────────
    ipcMain.handle('db:getTables',           ()      => db.getTables());
    ipcMain.handle('db:addTable',            _gated((e, d)  => db.addTable(d)));
    ipcMain.handle('db:updateTable',         _gated((e, d)  => db.updateTable(d)));
    ipcMain.handle('db:updateTablePosition', (e, d)  => db.updateTablePosition(d.id, d.x, d.y));
    ipcMain.handle('db:deleteTable',         _gated((e, id) => db.deleteTable(id)));

    // ── Sales ──────────────────────────────────────────
    ipcMain.handle('db:saveSale', _gated(async (e, d) => {
        try {
            return await db.saveSale(d);
        } catch (err) {
            console.error("Sale Error:", err.message);
            if (err.message.startsWith('INSUFFICIENT_STOCK:')) {
                const payload = JSON.parse(err.message.split('INSUFFICIENT_STOCK:')[1]);
                return { success: false, code: 'INSUFFICIENT_STOCK', payload: [payload], message: 'الكمية غير كافية' };
            }
            return { success: false, error: err.message };
        }
    }));
    ipcMain.handle('db:voidSale',          _gated((e, d)   => db.voidSale(d?.invoiceId, d?.reason)));
    ipcMain.handle('db:getSalesHistory',   (e, f)   => db.getSalesHistory(f));
    ipcMain.handle('db:getSaleByInvoice',  (e, id)  => db.getSaleByInvoice(id));
    ipcMain.handle('db:updateSaleStatus',  (e, d)   => db.updateSaleStatus(d?.invoiceId, d?.status));
    ipcMain.handle('db:exportSalesCSV',    (e, f)   => db.exportSalesCSV(f));

    // ── Expenditures ───────────────────────────────────
    ipcMain.handle('db:addExpenditure',    _gated((e, d)   => db.addExpenditure(d)));
    ipcMain.handle('db:editExpenditure',   _gated((e, d)   => db.editExpenditure(d)));
    ipcMain.handle('db:deleteExpenditure', _gated((e, id)  => db.deleteExpenditure(id)));
    ipcMain.handle('db:getExpenditures',   (e, f)   => db.getExpenditures(f));

    // ── Reports ────────────────────────────────────────
    ipcMain.handle('db:getFinancialReport',   (e, r) => db.getFinancialReport(r));
    ipcMain.handle('db:getFinancialTimeline', (e, r) => db.getFinancialTimeline(r));
    ipcMain.handle('db:getVATReport',         (e, r) => db.getVATReport(r));
    ipcMain.handle('db:getYesterdayStats',    ()     => db.getYesterdayStats());
    ipcMain.handle('db:getLowStockAlerts',    ()     => db.getLowStockAlerts());

    // ── Settings ───────────────────────────────────────
    ipcMain.handle('settings:get',  ()      => db.getSettings());
    ipcMain.handle('settings:save', (e, d)  => db.saveSettings(d));

    // ── Accounting ─────────────────────────────────────
    ipcMain.handle('db:getAccounts',      ()      => db.getAccounts());
    ipcMain.handle('db:addAccount',       (e, d)  => db.addAccount(d));
    ipcMain.handle('db:getGeneralLedger', (e, f)  => db.getGeneralLedger(f));
    ipcMain.handle('db:getTrialBalance',  ()      => db.getTrialBalance());

    // Accounting Engine (Phase 1) ─────────────────────────────────────────────
    ipcMain.handle('acct:getJournalEntries',      (e, f)  => { try { return db.getJournalEntries(f); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('acct:getJournalEntry',        (e, id) => { try { return db.getJournalEntry(id); } catch(_) { return null; } });
    ipcMain.handle('acct:postJournalEntry',       _gated((e, d) => { try { const id = db.postJournalEntry(d); return { success: true, id }; } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:reverseJournalEntry',    _gated((e, d) => { try { const id = db.reverseJournalEntry(d.entryId, d.reason, d.reversalDate, d.createdBy); return { success: true, id }; } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:getBalanceSheet',        (e, d)  => { try { return db.getBalanceSheet(d?.asOfDate, d?.compareDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('acct:getCashFlow',            (e, d)  => { try { return db.getCashFlowStatement(d?.startDate, d?.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('acct:getIncomeStatement',     (e, d)  => { try { return db.getIncomeStatement(d?.startDate, d?.endDate, d?.compareStartDate, d?.compareEndDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('acct:postOpeningBalances',    _gated((e, d) => { try { return db.postOpeningBalances(d.openingDate, d.balances, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:hasOpeningBalances',     () => { try { return db.hasOpeningBalances(); } catch(_) { return false; } });
    ipcMain.handle('acct:getAccountsHierarchical',() => { try { return db.getAccountsHierarchical(); } catch(_) { return []; } });
    ipcMain.handle('acct:addAccountNew',          _gated((e, d) => { try { return db.addAccountNew(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:getPeriods',             () => { try { return db.getPeriods(); } catch(_) { return []; } });
    ipcMain.handle('acct:savePeriod',             _gated((e, d) => { try { return db.savePeriod(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:lockPeriod',             _gated((e, d) => { try { return db.lockPeriod(d.periodId, d.lockType, d.userId); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:unlockPeriod',           _gated((e, d) => { try { return db.unlockPeriod(d.periodId); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('acct:nextJvRef',              () => { try { return db.nextJvRef(); } catch(_) { return 'JV-AUTO'; } });

    // ── Accounting Phase 2 & 3 IPC handlers ─────────────────────────
    // AR
    ipcMain.handle('p2:getARAgingReport',       (e, d) => { try { return db.getARAgingReport(d?.asOfDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getCustomerStatement',   (e, d) => { try { return db.getCustomerStatement(d.customerId, d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:recordCustomerPayment',  _gated((e, d) => { try { return db.recordCustomerPayment(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:checkCreditLimit',       (e, d) => { try { return db.checkCreditLimit(d.customerId, d.amount); } catch(err) { return { error: err.message }; } });
    // Fixed Assets
    ipcMain.handle('p2:getFixedAssets',         ()     => { try { return db.getFixedAssets(); } catch(err) { return []; } });
    ipcMain.handle('p2:addFixedAsset',          _gated((e, d) => { try { return db.addFixedAsset(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:updateFixedAsset',       _gated((e, d) => { try { return db.updateFixedAsset(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:disposeFixedAsset',      _gated((e, d) => { try { return db.disposeFixedAsset(d.assetId, d.disposalDate, d.proceeds, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:runDepreciation',        _gated((e, d) => { try { return db.runDepreciation(d.month, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getDepreciationSchedule',(e, d) => { try { return db.getDepreciationSchedule(d.assetId); } catch(err) { return { error: err.message }; } });
    // Bank Reconciliation
    ipcMain.handle('p2:getBankAccounts',        ()     => { try { return db.getBankAccounts(); } catch(err) { return []; } });
    ipcMain.handle('p2:saveBankAccount',        _gated((e, d) => { try { return db.saveBankAccount(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getBankReconciliations', (e, d) => { try { return db.getBankReconciliations(d.bankAccountId); } catch(err) { return []; } });
    ipcMain.handle('p2:saveBankReconciliation', _gated((e, d) => { try { return db.saveBankReconciliation(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getBankTransactions',    (e, d) => { try { return db.getBankTransactions(d.startDate, d.endDate); } catch(err) { return []; } });
    ipcMain.handle('p2:matchBankLines',           _gated((e, d) => { try { return db.matchBankLines(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:unmatchBankLine',          _gated((e, d) => { try { return db.unmatchBankLine(d.matchId); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getBankRecMatches',        (e, d) => { try { return db.getBankRecMatches(d.reconciliationId); } catch(err) { return []; } });
    ipcMain.handle('p2:getUnmatchedBankTransactions', (e, d) => { try { return db.getUnmatchedBankTransactions(d.bankAccountId, d.startDate, d.endDate, d.reconciliationId); } catch(err) { return []; } });
    ipcMain.handle('p2:getCheques',               (e, d) => { try { return db.getCheques(d?.bankAccountId, d?.status); } catch(err) { return []; } });
    ipcMain.handle('p2:saveCheque',               _gated((e, d) => { try { return db.saveCheque(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:updateChequeStatus',       _gated((e, d) => { try { return db.updateChequeStatus(d.chequeId, d.status); } catch(err) { return { success: false, error: err.message }; } }));
    // Export engine (P-019)
    ipcMain.handle('export:toPDF', async (e, { html, filename }) => {
        try {
            const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: filename || 'report.pdf',
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (canceled || !filePath) { win.close(); return { success: false }; }
            const pdfData = await win.webContents.printToPDF({ landscape: false, printBackground: true });
            win.close();
            fs.writeFileSync(filePath, pdfData);
            return { success: true, filePath };
        } catch(err) { return { success: false, error: err.message }; }
    });
    ipcMain.handle('export:toExcel', async (e, { rows, headers, sheetName, filename, meta }) => {
        try {
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: filename || 'report.xlsx',
                filters: [{ name: 'Excel', extensions: ['xlsx'] }]
            });
            if (canceled || !filePath) return { success: false };
            // Build CSV-like content (no exceljs dependency needed — use tab-separated values in .xlsx wrapper)
            // We write a proper XLSX using Office Open XML minimal structure
            const escCell = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const buildRow = (cells) => `<row>${cells.map(c => `<c t="inlineStr"><is><t>${escCell(c)}</t></is></c>`).join('')}</row>`;
            const allRows = [];
            if (meta) {
                const settings = db.getSettings();
                allRows.push(buildRow([settings.business_name_ar || 'البصمة الذكية', '', '', '', '', '']));
                allRows.push(buildRow([`CR: ${settings.crn || ''}`, `VAT: ${settings.tax_number || ''}`, '', '', `تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA')}`, '']));
                allRows.push(buildRow([]));
            }
            if (headers) allRows.push(buildRow(headers));
            for (const row of (rows || [])) allRows.push(buildRow(Array.isArray(row) ? row : Object.values(row)));
            const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetView rightToLeft="1"/><sheetData>${allRows.join('')}</sheetData></worksheet>`;
            const wbXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escCell(sheetName||'تقرير')}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
            const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
            const ctXml = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
            // Write as ZIP (XLSX = ZIP)
            const AdmZip = require('adm-zip'); // bundled with electron
            let zip;
            try { zip = new AdmZip(); } catch(_) {
                // adm-zip not available — fall back to CSV save
                const csvContent = (headers ? [headers] : []).concat(rows||[]).map(r => (Array.isArray(r)?r:Object.values(r)).map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
                fs.writeFileSync(filePath.replace('.xlsx','.csv'), '\uFEFF' + csvContent, 'utf8');
                return { success: true, filePath: filePath.replace('.xlsx','.csv'), format: 'csv' };
            }
            zip.addFile('[Content_Types].xml', Buffer.from(ctXml));
            zip.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`));
            zip.addFile('xl/workbook.xml', Buffer.from(wbXml));
            zip.addFile('xl/_rels/workbook.xml.rels', Buffer.from(relsXml));
            zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(sheetXml));
            zip.writeZip(filePath);
            return { success: true, filePath };
        } catch(err) { return { success: false, error: err.message }; }
    });
    // VAT
    ipcMain.handle('p2:getVATReturnBoxes',      (e, d) => { try { return db.getVATReturnBoxes(d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    // Accruals
    ipcMain.handle('p2:getPrepaidSchedules',    ()     => { try { return db.getPrepaidSchedules(); } catch(err) { return []; } });
    ipcMain.handle('p2:addPrepaidSchedule',     _gated((e, d) => { try { return db.addPrepaidSchedule(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:runPrepaidAmortisation', _gated((e, d) => { try { return db.runPrepaidAmortisation(d.month, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getRecurringExpenses',   ()     => { try { return db.getRecurringExpenses(); } catch(err) { return []; } });
    ipcMain.handle('p2:addRecurringExpense',    _gated((e, d) => { try { return db.addRecurringExpense(d); } catch(err) { return { success: false, error: err.message }; } }));
    // Payroll
    ipcMain.handle('p2:getEmployees',           ()     => { try { return db.getEmployees(); } catch(err) { return []; } });
    ipcMain.handle('p2:saveEmployee',           _gated((e, d) => { try { return db.saveEmployee(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:deleteEmployee',         _gated((e, id) => { try { return db.deleteEmployee(id); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:createPayrollRun',       _gated((e, d) => { try { return db.createPayrollRun(d.month, d.overrides, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:postPayrollRun',         _gated((e, d) => { try { return db.postPayrollRun(d.runId, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getPayrollRuns',         (e, d) => { try { return db.getPayrollRuns(d?.month); } catch(err) { return []; } });
    // Audit
    ipcMain.handle('p2:getEnhancedAuditLogs',   (e, f) => { try { return db.getEnhancedAuditLogs(f); } catch(err) { return []; } });
    // Inventory
    ipcMain.handle('p2:postStockCount',         _gated((e, d) => { try { return db.postStockCount(d, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getStockCountHistory',   (e, d) => { try { return db.getStockCountHistory(d.productId); } catch(err) { return []; } });
    ipcMain.handle('p2:getInventoryBatches',    (e, d) => { try { return db.getInventoryBatches(d.productId); } catch(err) { return []; } });
    // Subsidiary Ledgers
    ipcMain.handle('p2:getCustomerSubsidiaryLedger', (e, d) => { try { return db.getCustomerSubsidiaryLedger(d.customerId, d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getSupplierSubsidiaryLedger', (e, d) => { try { return db.getSupplierSubsidiaryLedger(d.supplierId, d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getSubsidiaryControlCheck',   ()     => { try { return db.getSubsidiaryControlCheck(); } catch(err) { return { error: err.message }; } });
    // Budget
    ipcMain.handle('p2:getBudgetVsActual',      (e, d) => { try { return db.getBudgetVsActual(d.period); } catch(err) { return []; } });
    ipcMain.handle('p2:saveBudgetEntry',        _gated((e, d) => { try { return db.saveBudgetEntry(d.period, d.account_code, d.budgeted_amount); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getCostCentres',         ()     => { try { return db.getCostCentres(); } catch(err) { return []; } });
    ipcMain.handle('p2:saveCostCentre',         _gated((e, d) => { try { return db.saveCostCentre(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getBreakEvenInputs',     ()     => { try { return db.getBreakEvenInputs(); } catch(err) { return {}; } });

    // Gap-filling additions (P-003, P-014, P-021 extras)
    ipcMain.handle('p2:getAccountDrillDown',       (e, d) => { try { return db.p2.getAccountDrillDown(d.accountCode, d.startDate, d.endDate, d.limit); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getCostCentreReport',       (e, d) => { try { return db.p2.getCostCentreReport(d?.startDate, d?.endDate); } catch(err) { return []; } });
    ipcMain.handle('p2:getDeferredRevenueSchedules',()    => { try { return db.p2.getDeferredRevenueSchedules(); } catch(err) { return []; } });
    ipcMain.handle('p2:addDeferredRevenueSchedule',_gated((e, d) => { try { return db.p2.addDeferredRevenueSchedule(d); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:runDeferredRevenueRecognition',_gated((e, d) => { try { return db.p2.runDeferredRevenueRecognition(d.month, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));

    // Shifts ─────────────────────────────────────────
    ipcMain.handle('shift:getOpen', ()      => db.getOpenShift());
    ipcMain.handle('shift:open',    _gated((e, d)  => db.openShift(d?.cash, d?.staffId)));
    ipcMain.handle('shift:close',   _gated((e, d)  => db.closeShift(d)));

    // ── Customers ──────────────────────────────────────
    ipcMain.handle('db:getCustomers',        (e, f)  => db.getCustomers(f));
    ipcMain.handle('db:addCustomer',         _gated((e, d)  => db.addCustomer(d)));
    ipcMain.handle('db:updateCustomer',      _gated((e, d)  => db.updateCustomer(d)));
    ipcMain.handle('db:getCustomerHistory',  (e, id) => db.getCustomerHistory(id));
    ipcMain.handle('db:redeemLoyaltyPoints', _gated((e, d)  => db.redeemLoyaltyPoints(d?.customerId, d?.points)));
    ipcMain.handle('db:recordWhatsAppShare', (e, d)  => db.recordWhatsAppShare(d?.customerId, d?.invoiceId));

    // ── Staff ──────────────────────────────────────────
    ipcMain.handle('db:getStaff',              ()      => db.getStaff());
    ipcMain.handle('db:addStaff',              _gated((e, d)  => db.addStaff(d)));
    ipcMain.handle('db:updateStaff',           _gated((e, d)  => db.updateStaff(d)));
    ipcMain.handle('db:deleteStaff',           _gated((e, id) => db.deleteStaff(id)));
    ipcMain.handle('db:updateStaffPermissions',(e, d)  => db.updateStaffPermissions(d?.id, d?.perms));
    ipcMain.handle('db:verifyStaffPin',        (e, { pin, staffId }) => db.verifyStaffPin(pin, staffId));
    ipcMain.handle('db:getAuditLogs',          (e, l)  => db.getAuditLogs(l));

    // ── Suppliers ──────────────────────────────────────
    ipcMain.handle('db:getSuppliers',        ()      => db.getSuppliers());
    ipcMain.handle('db:addSupplier',         _gated((e, d)  => db.addSupplier(d)));
    ipcMain.handle('db:updateSupplier',      _gated((e, d)  => db.updateSupplier(d)));
    ipcMain.handle('db:deleteSupplier',      _gated((e, id) => db.deleteSupplier(id)));

    // ── Stock History & Purchases ──────────────────────
    ipcMain.handle('db:getStockHistory',      (e, id) => db.getStockHistory(id));
    ipcMain.handle('db:adjustStock',          _gated((e, d)  => db.addStockAdjustment(d)));
    ipcMain.handle('db:getPurchaseOrders',    ()      => db.getPurchaseOrders());
    ipcMain.handle('db:createPurchaseOrder',  _gated((e, d)  => db.createPurchaseOrder(d)));
    ipcMain.handle('db:receivePurchaseOrder', _gated((e, id) => db.receivePurchaseOrder(id)));
    ipcMain.handle('db:getPurchaseItems',     (e, id) => db.getPurchaseItems(id));
    ipcMain.handle('db:createReturn',         _gated((e, d)  => db.createReturn(d.invoiceId, d.returnItems)));

    // ── Promotions ─────────────────────────────────────
    ipcMain.handle('db:getPromotions',       ()      => db.getPromotions());
    ipcMain.handle('db:savePromotion',       _gated((e, d)  => db.savePromotion(d)));
    ipcMain.handle('db:deletePromotion',     _gated((e, id) => db.deletePromotion(id)));
    ipcMain.handle('db:togglePromotion',     _gated((e, d)  => db.togglePromotion(d.id, d.active)));

    // ── Dialogs ────────────────────────────────────────
    ipcMain.handle('dialog:pickImage', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'اختر صورة الشعار',
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }],
            properties: ['openFile']
        });
        if (canceled || !filePaths.length) return null;
        const data = fs.readFileSync(filePaths[0]);
        const ext = path.extname(filePaths[0]).slice(1).toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `data:${mime};base64,${data.toString('base64')}`;
    });

    ipcMain.handle('dialog:pickCSV', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'اختر ملف CSV للاستيراد',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }],
            properties: ['openFile']
        });
        return canceled || !filePaths.length ? null : filePaths[0];
    });

    ipcMain.handle('dialog:saveFile', async (e, { filename, content, mime }) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: filename || 'export.csv',
            filters: [{ name: 'Files', extensions: [filename?.split('.').pop() || 'csv'] }]
        });
        if (canceled || !filePath) return false;
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    });

    // ── Backup & Restore ───────────────────────────────
    ipcMain.handle('db:exportBackup', async () => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `pos_backup_${new Date().toISOString().slice(0,10)}.db`,
            filters: [{ name: 'Database Backup', extensions: ['db'] }]
        });
        if (canceled || !filePath) return { success: false };
        try {
            const dbPath = path.join(app.getPath('userData'), 'pos_data.db');
            fs.copyFileSync(dbPath, filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db:restoreBackup', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'اختر ملف النسخة الاحتياطية',
            filters: [{ name: 'Database Backup', extensions: ['db'] }],
            properties: ['openFile']
        });
        if (canceled || !filePaths.length) return { success: false };
        try {
            const dbPath = path.join(app.getPath('userData'), 'pos_data.db');
            fs.copyFileSync(filePaths[0], dbPath);
            setTimeout(() => { app.relaunch(); app.exit(0); }, 1000);
            return { success: true, relaunching: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Printing ───────────────────────────────────────
    ipcMain.handle('printHTML', async (e, html) => {
        try {
            const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            win.webContents.print({ silent: false, printBackground: true }, () => win.close());
        } catch (err) { console.error('Print Error:', err); }
    });

    ipcMain.handle('zatca:getTLV', (e, d) => {
        if (d.invoice) {
            try {
                const queueItem = db.getDbInstance().prepare('SELECT signed_xml FROM zatca_queue WHERE invoice_number = ?').get(d.invoice);
                if (queueItem && queueItem.signed_xml) {
                    const match = queueItem.signed_xml.match(/<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([\s\S]*?)<\/cbc:EmbeddedDocumentBinaryObject>/);
                    if (match && match[1]) return match[1].trim();
                }
            } catch (err) { console.error('[ZATCA] Error querying signed XML from queue:', err); }
        }
        const { generateZatcaTLV } = require('./zatca_utils.cjs');
        return generateZatcaTLV(d.seller, d.vatNo, d.timestamp, d.total, d.vatAmt);
    });

    ipcMain.handle('system:getHWID', _getHWID);

    ipcMain.handle('system:openExternal', async (e, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ── ZATCA Phase 2 ──────────────────────────────────
    ipcMain.handle('zatca:getDevice', () => db.getZatcaDevice());
    ipcMain.handle('zatca:getQueueStatus', () => zatcaReporter.getQueueStatus());
    ipcMain.handle('zatca:retryQueue', () => zatcaReporter.retryFailed());
    ipcMain.handle('zatca:onboardDevice', async (e, d) => {
        try {
            const { otp } = d;
            let device = db.getZatcaDevice();
            if (!device || !device.private_key_pem) {
                const keys = zatcaPhase2.generateDeviceKeyPair();
                db.updateZatcaDevice({ id: device ? device.id : 1, device_id: 'POS-01', private_key_pem: keys.privateKeyPem });
                device = db.getZatcaDevice();
            }
            const settings = db.getSettings();
            const isSandbox = settings.zatca_env === 'sandbox';
            const crypto = require('crypto');
            const pubKey = crypto.createPublicKey(device.private_key_pem);
            const pubKeyPem = pubKey.export({ type: 'spki', format: 'pem' });
            const { csrBase64, csrPem } = zatcaPhase2.generateCSR(
                device.private_key_pem, pubKeyPem,
                { EGS_SN: device.device_id || 'POS-01', UID: settings.tax_number || '300000000000003',
                  ORG: settings.business_name_ar || 'مؤسسة', OU: 'Head Office', IND: 'Retail' }
            );
            db.updateZatcaDevice({ id: device.id, csr_pem: csrPem });
            const compCsid = await zatcaPhase2.issueComplianceCSID(csrBase64, otp, isSandbox);
            if (compCsid.error) return { success: false, error: 'Compliance CSID Failed', details: compCsid.data };
            db.updateZatcaDevice({ id: device.id, compliance_csid: JSON.stringify(compCsid) });
            const prodCsid = await zatcaPhase2.issueProductionCSID(
                compCsid.requestID || compCsid.requestId, compCsid.binarySecurityToken, compCsid.secret, isSandbox);
            if (prodCsid.error) return { success: false, error: 'Production CSID Failed', details: prodCsid.data };
            // Parse cert notAfter for expiry monitoring
            let certExpiresAt = null;
            try {
                const forge = require('node-forge');
                const certPem = Buffer.from(prodCsid.binarySecurityToken, 'base64').toString('ascii');
                const certObj = forge.pki.certificateFromPem(certPem);
                certExpiresAt = certObj.validity.notAfter.toISOString();
            } catch (certParseErr) {
                console.warn('[ZATCA] Could not parse cert notAfter:', certParseErr.message);
            }
            db.updateZatcaDevice({
                id: device.id,
                production_csid: JSON.stringify(prodCsid),
                production_cert_pem: Buffer.from(prodCsid.binarySecurityToken, 'base64').toString('ascii'),
                cert_expires_at: certExpiresAt,
            });
            return { success: true, certExpiresAt };
        } catch (err) { return { success: false, error: err.message }; }
    });

    // ── ZATCA: fetch signed XML from queue for a given sale ────────────────
    ipcMain.handle('zatca:getSignedXML', (e, { saleId, invoice }) => {
        try {
            const database = db.getDbInstance();
            const row = database.prepare(
                `SELECT signed_xml FROM zatca_queue
                 WHERE sale_id = ? OR invoice_number = ?
                 ORDER BY id DESC LIMIT 1`
            ).get(saleId, invoice);
            return row ? row.signed_xml : null;
        } catch (err) {
            console.error('[ZATCA] getSignedXML error:', err.message);
            return null;
        }
    });

    // ── License — secure IPC ──────────────────────────
    ipcMain.handle("license:validate", async (e, { key }) => {
        const hwid = await _getHWID();
        const result = _validateLicenseMain(key, hwid);
        if (result.valid) {
            _activeLicense = result;
            _clearGrace(app.getPath("userData")); // Valid key — clear any grace period
        } else {
            _activeLicense = null;
        }
        return { ...result, expiredAt: result.expiredAt ? result.expiredAt.toISOString() : undefined };
    });
    ipcMain.handle("license:check", async () => {
        const settings = db.getSettings();
        const savedKey = settings && settings.activation_key;
        if (!savedKey) return { valid: false, reason: "no_key" };
        const hwid = await _getHWID();
        const result = _validateLicenseMain(savedKey, hwid);
        if (result.valid) { _activeLicense = result; _clearGrace(app.getPath("userData")); }
        else _activeLicense = null;
        return { ...result, expiredAt: result.expiredAt ? result.expiredAt.toISOString() : undefined };
    });
    ipcMain.handle("license:getHWID", _getHWID);
    ipcMain.handle("license:graceStatus", () => {
        const graceUntil = _getGraceExpiry(app.getPath("userData"));
        const hoursLeft  = graceUntil > 0 ? Math.max(0, Math.ceil((graceUntil - Date.now()) / 3600000)) : 0;
        return { active: hoursLeft > 0, hoursLeft, graceUntil };
    });
    // ── End license handlers ──────────────────────────

    // ── Synchronization ───────────────────────────────
    ipcMain.handle('sync:getStatus', () => syncEngine.getStatus());
    ipcMain.handle('sync:setMode', (e, d) => syncEngine.setMode(d?.mode, d?.ip));
    ipcMain.handle('sync:forceSync', () => syncEngine.forceSync());

    // ── Updater ───────────────────────────────────────
    ipcMain.handle('updater:getVersion', () => { return app.getVersion(); });
    ipcMain.handle('updater:check',      () => { autoUpdater.checkForUpdates(); });
    ipcMain.handle('updater:install',    () => { autoUpdater.quitAndInstall(); });

    // ── Window Management ─────────────────────────────
    // Opens a dedicated POS window (or focuses the existing one).
    // The window loads the same renderer but navigates to #/pos via the hash.
    // If the system only has one screen or the user prefers single-window,
    // the fallback in AppLayout (navigate('/pos')) already handles that case.
    ipcMain.handle('window:openPos', async () => {
        // If there's already a POS window, just focus it
        if (posWindow && !posWindow.isDestroyed()) {
            posWindow.focus();
            return { success: true, reused: true };
        }
        try {
            posWindow = new BrowserWindow({
                width: 1280, height: 800,
                minWidth: 900, minHeight: 600,
                title: 'نقطة البيع — البصمة الذكية',
                show: false,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.cjs'),
                    contextIsolation: true,
                    nodeIntegration: false,
                }
            });

            if (process.env.NODE_ENV === 'development') {
                await posWindow.loadURL('http://localhost:5173/#/pos');
            } else {
                await posWindow.loadFile(
                    path.join(__dirname, '../dist/index.html'),
                    { hash: '/pos' }
                );
            }

            posWindow.on('ready-to-show', () => posWindow.show());
            posWindow.on('closed', () => { posWindow = null; });

            return { success: true, reused: false };
        } catch (err) {
            console.error('[window:openPos] Failed to create POS window:', err);
            posWindow = null;
            return { success: false, error: err.message };
        }
    });
}

function createMainWindow() {
    if (mainWindow) return;
    mainWindow = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1100, minHeight: 700,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    db.initDatabase(app.getPath('userData'));
    syncEngine.initSyncEngine(db.getDbInstance());
    registerIpcHandlers();
    createMainWindow();
    zatcaReporter.startReporter(60000);

    // ── ZATCA cert expiry daily check ─────────────────
    const checkZatcaCertExpiry = () => {
        try {
            const device = db.getZatcaDevice();
            if (!device || !device.cert_expires_at) return;
            const daysLeft = Math.floor((new Date(device.cert_expires_at) - Date.now()) / 86_400_000);
            if (daysLeft <= 0) {
                console.error('[ZATCA] Certificate EXPIRED — all submissions will fail with 401');
                mainWindow?.webContents.send('zatca:certExpired', { daysLeft: 0 });
            } else if (daysLeft <= 30) {
                console.warn(`[ZATCA] Certificate expiring in ${daysLeft} day(s)`);
                mainWindow?.webContents.send('zatca:certExpiringSoon', { daysLeft });
            }
        } catch (err) {
            console.error('[ZATCA] Cert expiry check error:', err.message);
        }
    };
    // Run once on startup (after a short delay so the window is ready)
    setTimeout(checkZatcaCertExpiry, 5000);
    // Then daily
    setInterval(checkZatcaCertExpiry, 24 * 60 * 60 * 1000);
    // ─────────────────────────────────────────────────

    // ── License startup check + grace period logic ────
    (async () => {
        const userData = app.getPath('userData');
        const settings = db.getSettings();
        const savedKey = settings && settings.activation_key;
        if (savedKey) {
            const hwid   = await _getHWID();
            const result = _validateLicenseMain(savedKey, hwid);
            if (result.valid) {
                _activeLicense = result;
                _clearGrace(userData);
                console.log("[License] Valid —", result.plan, "| expires:", result.expiry ? new Date(result.expiry).toISOString() : "never");
            } else {
                // Key failed — check if we're already in grace or need to start it
                const graceUntil = _getGraceExpiry(userData);
                if (graceUntil === 0) {
                    // First failure: grant 48-hour grace so client can contact you for a new key
                    const until = _setGrace(userData);
                    console.log("[License] Key invalid (" + result.reason + ") — 48h grace started");
                    // Notify renderer so it can show a non-blocking warning banner
                    setTimeout(() => {
                        mainWindow?.webContents.send("license:grace", {
                            reason: result.reason,
                            hoursLeft: _GRACE_HOURS,
                            graceUntil: until
                        });
                    }, 2000);
                } else if (Date.now() > graceUntil) {
                    console.log("[License] Grace period EXPIRED — all write IPC blocked");
                    setTimeout(() => {
                        mainWindow?.webContents.send("license:expired", { reason: result.reason });
                    }, 2000);
                } else {
                    const hoursLeft = Math.ceil((graceUntil - Date.now()) / 3600000);
                    console.log("[License] In grace period —", hoursLeft, "hours remaining");
                    setTimeout(() => {
                        mainWindow?.webContents.send("license:grace", {
                            reason: result.reason,
                            hoursLeft,
                            graceUntil
                        });
                    }, 2000);
                }
            }
        } else {
            console.log("[License] No activation key found — awaiting activation");
        }
    })();
    // ─────────────────────────────────────────────────

    autoUpdater.on('checking-for-update', () => mainWindow?.webContents.send('updater:status', { status: 'checking' }));
    autoUpdater.on('update-available',    (info) => mainWindow?.webContents.send('updater:status', { status: 'available', info }));
    autoUpdater.on('update-not-available',(info) => mainWindow?.webContents.send('updater:status', { status: 'not-available', info }));
    autoUpdater.on('error',               (err)  => mainWindow?.webContents.send('updater:status', { status: 'error', error: err.message }));
    autoUpdater.on('download-progress',   (p)    => mainWindow?.webContents.send('updater:status', { status: 'downloading', progress: p }));
    autoUpdater.on('update-downloaded',   (info) => mainWindow?.webContents.send('updater:status', { status: 'ready', info }));

    try { autoUpdater.checkForUpdatesAndNotify(); } catch (err) { console.error('Updater error:', err); }

    const runBackup = () => {
        try {
            const backupsDir = path.join(app.getPath('userData'), 'backups');
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);
            const dbPath  = path.join(app.getPath('userData'), 'pos_data.db');
            const destPath = path.join(backupsDir, `pos_data_${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
            if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, destPath);
            const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('pos_data_'));
            if (files.length > 7) files.sort().slice(0, files.length - 7).forEach(f => fs.unlinkSync(path.join(backupsDir, f)));
        } catch (err) { console.error('Auto Backup Error:', err); }
    };
    runBackup();
    setInterval(runBackup, 12 * 60 * 60 * 1000);

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
