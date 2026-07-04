'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
// ─── LICENSE VALIDATION V5 (main process only — SECRET never leaves here) ─────
// V5 key system: static passkeys, no HWID binding, deterministic per (tier,billing,addon).
// Spec: Section 2 of the V5 migration document.
const _licCrypto = require("crypto");
const _LICENSE_SECRET = "b90c951d3a54e546ada274fc6f2dd459f6cd751ce64ab491dc71f93b51b53a0b";
const { tierCanAccess, addonCanAccess, getStaffLimit } = require('./license_plans.cjs');
const hardware = require('./hardware.cjs');

// ── V5 duration decode: 3-char base-36 string → days ─────────────────────────
function _b36ToDays(b36) {
    return parseInt(b36, 36);
}

// ── Compute activation-anchored expiry from settings ─────────────────────────
// fingerprint = first 6 chars of the key (e.g. "V5PM01")
function _getActivatedAt(settings, fingerprint) {
    const key = `activated_at_${fingerprint}`;
    const val = settings && settings[key];
    return val ? new Date(val) : null;
}

function _writeActivatedAt(settings, fingerprint) {
    const key = `activated_at_${fingerprint}`;
    if (!settings[key]) {
        settings[key] = new Date().toISOString();
    }
}

// ── V5 Base Key Validator ─────────────────────────────────────────────────────
// Format: V5 [TIER:1][BILLING:1][DUR_B36:3][SIG:9] = 16 chars total
// TIER:    S G P E O X
// BILLING: L M Y T O
function _validateLicenseV5(key, settings) {
    if (!key) return { valid: false, reason: 'bad_format' };
    const k = key.trim().toUpperCase();
    if (k.length !== 16)          return { valid: false, reason: 'bad_format' };
    if (k.slice(0, 2) !== 'V5')   return { valid: false, reason: 'bad_format' };

    const tierCode    = k[2];
    const billingCode = k[3];
    const durationB36 = k.slice(4, 7);
    const sigProvided = k.slice(7);   // 9 chars

    const VALID_TIERS    = ['S','G','P','E','O','X'];
    const VALID_BILLINGS = ['L','M','Y','T','O'];
    if (!VALID_TIERS.includes(tierCode))       return { valid: false, reason: 'bad_format' };
    if (!VALID_BILLINGS.includes(billingCode)) return { valid: false, reason: 'bad_format' };

    // Recompute SIG
    const payload    = `V5|${tierCode}|${billingCode}|${durationB36}`;
    const raw        = _licCrypto.createHmac('sha256', _LICENSE_SECRET).update(payload).digest('hex');
    const num        = BigInt('0x' + raw.slice(0, 20));
    const expectedSig = num.toString(36).toUpperCase().padStart(9, '0').slice(-9);
    if (sigProvided !== expectedSig) return { valid: false, reason: 'invalid_key' };

    // Decode billing/tier metadata
    const BILLING_NAME = { L: 'lifetime', M: 'monthly', Y: 'yearly', T: 'trial', O: 'owner' };
    const TIER_NAME    = { S: 'starter',  G: 'growth',  P: 'pro',    E: 'enterprise', O: 'owner', X: 'trial' };
    const billing   = BILLING_NAME[billingCode];
    const tierName  = TIER_NAME[tierCode];
    const days      = _b36ToDays(durationB36);
    const isLifetime = days === 0;

    // Activation-anchored expiry
    const fingerprint = k.slice(0, 6);
    let daysLeft = Infinity;
    let expired  = false;

    if (!isLifetime) {
        let activatedAt = _getActivatedAt(settings, fingerprint);
        if (!activatedAt) {
            // First time seeing this key — write activatedAt now
            if (settings) _writeActivatedAt(settings, fingerprint);
            activatedAt = new Date();
        }
        const expiryTs = activatedAt.getTime() + days * 86400000;
        daysLeft = Math.ceil((expiryTs - Date.now()) / 86400000);
        if (daysLeft <= 0) {
            expired = true;
            if (billing === 'trial') {
                return { valid: false, reason: 'trial_expired' };
            }
            return { valid: false, reason: 'expired' };
        }
    }

    return {
        valid: true,
        keyType:  'base',
        tier:     tierCode,
        tierName,
        billing,
        plan:     billing,
        daysLeft,
        isOwner:  tierCode === 'O',
        activeAddons: [],
    };
}

// ── V5 Addon Key Validator ────────────────────────────────────────────────────
// Format: VA [ADDON:1][BILLING:1][DUR_B36:3][SIG:11] = 18 chars total
// ADDON:   R F Z S W
// BILLING: L M Y
function _validateAddonKeyV5(key, settings) {
    if (!key) return { valid: false, reason: 'bad_format' };
    const k = key.trim().toUpperCase();
    if (k.length !== 18)         return { valid: false, reason: 'bad_format' };
    if (k.slice(0, 2) !== 'VA')  return { valid: false, reason: 'bad_format' };

    const addonCode   = k[2];
    const billingCode = k[3];
    const durationB36 = k.slice(4, 7);
    const sigProvided = k.slice(7);   // 11 chars

    const VALID_ADDONS   = ['R','F','Z','S','W'];
    const VALID_BILLINGS = ['L','M','Y'];
    if (!VALID_ADDONS.includes(addonCode))     return { valid: false, reason: 'bad_format' };
    if (!VALID_BILLINGS.includes(billingCode)) return { valid: false, reason: 'bad_format' };

    // Recompute SIG
    const payload    = `VA|${addonCode}|${billingCode}|${durationB36}`;
    const raw        = _licCrypto.createHmac('sha256', _LICENSE_SECRET).update(payload).digest('hex');
    const num        = BigInt('0x' + raw.slice(0, 20));
    const expectedSig = num.toString(36).toUpperCase().padStart(11, '0').slice(-11);
    if (sigProvided !== expectedSig) return { valid: false, reason: 'invalid_key' };

    const BILLING_NAME = { L: 'lifetime', M: 'monthly', Y: 'yearly' };
    const ADDON_ID     = { R: 'restaurant', F: 'finance', Z: 'zatca_p2', S: 'sync', W: 'whitelabel' };
    const billing  = BILLING_NAME[billingCode];
    const addonId  = ADDON_ID[addonCode];
    const days     = _b36ToDays(durationB36);
    const isLifetime = days === 0;

    const fingerprint = k.slice(0, 6);
    let daysLeft = Infinity;
    let expired  = false;

    if (!isLifetime) {
        let activatedAt = _getActivatedAt(settings, fingerprint);
        if (!activatedAt) {
            if (settings) _writeActivatedAt(settings, fingerprint);
            activatedAt = new Date();
        }
        const expiryTs = activatedAt.getTime() + days * 86400000;
        daysLeft = Math.ceil((expiryTs - Date.now()) / 86400000);
        if (daysLeft <= 0) {
            expired = true;
            // Expired addons are silently dropped from activeAddons merge but not from storage
            return { valid: false, addonCode, addonId, billing, daysLeft: 0, expired: true };
        }
    }

    return {
        valid:    true,
        addonCode,
        addonId,
        billing,
        daysLeft,
        expired:  false,
    };
}

// ── Multi-key accumulation ────────────────────────────────────────────────────
// Called by license:check. Validates base key + all addon keys, merges results.
function _checkAllLicenses(settings) {
    const baseKey  = settings && settings.activation_key;
    if (!baseKey) return { valid: false, reason: 'no_key' };

    const baseResult = _validateLicenseV5(baseKey, settings);

    // Parse addon keys array
    let addonKeys = [];
    try {
        addonKeys = JSON.parse(settings.addon_keys || '[]');
        if (!Array.isArray(addonKeys)) addonKeys = [];
    } catch (_) { addonKeys = []; }

    const activeAddons   = [];   // strings like 'restaurant', 'finance', 'zatca_p2'
    const addonStatuses  = [];   // { code, billing, daysLeft, expired }

    for (const ak of addonKeys) {
        if (!ak) continue;
        const ar = _validateAddonKeyV5(ak, settings);
        addonStatuses.push({
            code:     ar.addonId || ar.addonCode || '?',
            billing:  ar.billing || null,
            daysLeft: ar.daysLeft ?? null,
            expired:  ar.expired || !ar.valid,
        });
        // Only accumulate non-expired valid addons
        if (ar.valid && !ar.expired) {
            activeAddons.push(ar.addonId);
        }
    }

    if (!baseResult.valid) {
        return { ...baseResult, addonStatuses };
    }

    return {
        ...baseResult,
        activeAddons,
        addonStatuses,
    };
}

// ── V5 license:validate routing ───────────────────────────────────────────────
// hwid parameter accepted for API compatibility but ignored (V5 has no HWID binding).
function _validateLicenseMain(key, _hwid, settings) {
    if (!key) return { valid: false, reason: 'bad_format' };
    const k = key.trim().toUpperCase();

    // V5 base key
    if (k.length === 16 && k.startsWith('V5')) {
        return _validateLicenseV5(k, settings || {});
    }

    // V5 addon key
    if (k.length === 18 && k.startsWith('VA')) {
        return _validateAddonKeyV5(k, settings || {});
    }

    // Legacy v3 (14 chars, starts with digit)
    if (k.length === 14 && /^\d/.test(k)) {
        return { valid: false, reason: 'legacy_key' };
    }

    // Legacy v4 (16 chars, does NOT start with V5 — starts with digit/letter other than V5)
    if (k.length === 16) {
        return { valid: false, reason: 'legacy_key' };
    }

    // Legacy v4A (19 chars, starts with A)
    if (k.length === 19 && k[0] === 'A') {
        return { valid: false, reason: 'legacy_key' };
    }

    // Old OWNER key (10 chars, starts with OWNER)
    if (k.length === 10 && k.startsWith('OWNER')) {
        return { valid: false, reason: 'legacy_key' };
    }

    return { valid: false, reason: 'invalid_key' };
}

let _activeLicense = null;

// ── _isLicenseActive — binary, no grace period ────────────────────────────────
function _isLicenseActive() {
    return !!(
        _activeLicense &&
        _activeLicense.valid &&
        (_activeLicense.daysLeft === Infinity || (_activeLicense.daysLeft !== null && _activeLicense.daysLeft > 0))
    );
}

// ── _gated — unchanged signature ─────────────────────────────────────────────
function _gated(fn) {
    return async (e, ...args) => {
        if (!_isLicenseActive()) {
            return { success: false, error: 'LICENSE_REQUIRED', message: 'الترخيص غير صالح أو منتهي الصلاحية — يرجى تجديد الاشتراك' };
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
const { registerZatcaHandlers } = require('./zatca-ipc-handlers.cjs');
const syncEngine = require('./syncEngine.cjs');
const zatcaPhase2 = require('./zatca_phase2_impl.cjs');
const zatcaReporter = require('./zatca_reporter.cjs');
const compliance   = require('./compliance_sa.cjs');

if (!app) { console.error('FATAL: Electron app object undefined.'); process.exit(1); }

process.on('uncaughtException', (err) => console.error('CRITICAL MAIN PROCESS ERROR:', err));
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION:', reason));

let mainWindow;
let posWindow = null; // Dedicated POS window (optional second window)

function registerIpcHandlers() {
    registerZatcaHandlers(db);
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
            const escCell = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const buildRow = (cells) => `<row>${cells.map(c => `<c t="inlineStr"><is><t>${escCell(c)}</t></is></c>`).join('')}</row>`;
            const allRows = [];
            if (meta) {
                const settings = db.getSettings();
                allRows.push(buildRow([settings.business_name_ar || 'البصمة الذكية', '', '', '', '', '']));
                allRows.push(buildRow([`CR: ${settings.crn || ''}`, `VAT: ${settings.vat_number || settings.tax_number || ''}`, '', '', `تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA')}`, '']));
                allRows.push(buildRow([]));
            }
            if (headers) allRows.push(buildRow(headers));
            for (const row of (rows || [])) allRows.push(buildRow(Array.isArray(row) ? row : Object.values(row)));
            const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetView rightToLeft="1"/><sheetData>${allRows.join('')}</sheetData></worksheet>`;
            const wbXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escCell(sheetName||'تقرير')}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
            const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
            const ctXml = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
            const AdmZip = require('adm-zip');
            let zip;
            try { zip = new AdmZip(); } catch(_) {
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
    // IP-6: Payroll Disbursement
    ipcMain.handle('p2:disbursePayroll',        _gated((e, d) => { try { return db.disbursePayroll(d.runId, d.paymentMethod, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    // IP-7: VAT Settlement
    ipcMain.handle('p2:postVATSettlement',      _gated((e, d) => { try { return db.postVATSettlement(d.startDate, d.endDate, d.paymentDate, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
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

    // ── Saudi Compliance IPC (GAP-01 → GAP-08) ───────────────────────────────────────
    // GAP-01 EOSB
    ipcMain.handle('compliance:calculateEOSB', (e, d) => { try { return compliance.calculateEOSB(d); } catch(err) { return { success: false, error: err.message }; } });
    ipcMain.handle('compliance:postEOSB',      _gated((e, d) => { try { return compliance.postEOSBEntry(d.employeeId, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('compliance:getEOSBHistory',()     => { try { return compliance.getEOSBHistory(); } catch(err) { return []; } });
    // GAP-02 WPS
    ipcMain.handle('compliance:exportWPS', _gated(async (e, d) => {
        try {
            const sifContent = compliance.generateWPSSIF(d.runId);
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: `WPS_${d.runId || 'export'}_${new Date().toISOString().slice(0,10)}.sif`,
                filters: [{ name: 'SIF File', extensions: ['sif'] }]
            });
            if (canceled || !filePath) return { success: false };
            fs.writeFileSync(filePath, sifContent, 'utf8');
            return { success: true, filePath };
        } catch(err) { return { success: false, error: err.message }; }
    }));
    // GAP-03 VAT 311 XML
    ipcMain.handle('compliance:exportVAT311', _gated(async (e, d) => {
        try {
            const xmlContent = compliance.generateVAT311XML(d.startDate, d.endDate);
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: `VAT311_${d.startDate}_${d.endDate}.xml`,
                filters: [{ name: 'XML File', extensions: ['xml'] }]
            });
            if (canceled || !filePath) return { success: false };
            fs.writeFileSync(filePath, xmlContent, 'utf8');
            return { success: true, filePath };
        } catch(err) { return { success: false, error: err.message }; }
    }));
    // GAP-04 AP Aging
    ipcMain.handle('compliance:getAPAging',     (e, d) => { try { return compliance.getAPAgingReport(d?.asOfDate); } catch(err) { return { error: err.message }; } });
    // GAP-05 Closing Wizard
    ipcMain.handle('compliance:previewClose',   (e, d) => { try { return compliance.previewClosingWizard(d.periodId); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('compliance:executeClose',   _gated((e, d) => { try { return compliance.executeClosingWizard(d.periodId, d.createdBy); } catch(err) { return { success: false, error: err.message }; } }));
    // GAP-06 Bank Import (legacy row-level import)
    ipcMain.handle('compliance:getBankStatementLines', (e, d) => { try { return compliance.getBankStatementLines(d.bankAccountId, d.importId); } catch(err) { return []; } });
    ipcMain.handle('compliance:matchStatementLine',    _gated((e, d) => { try { return compliance.matchStatementLine(d.lineId, d.journalEntryLineId); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('compliance:getStatementImports',   (e, d) => { try { return compliance.getStatementImports(d?.bankAccountId); } catch(err) { return []; } });
    // GAP-07 Retention
    ipcMain.handle('compliance:getRetentionManifest',  ()     => { try { return compliance.getRetentionManifest(); } catch(err) { return { error: err.message }; } });
    // GAP-08 Bank Statement CSV Ingestion
    ipcMain.handle('compliance:importBankFile', _gated(async (e, d) => {
        try {
            // If no filePath provided, show native file picker
            let filePath = d?.filePath;
            if (!filePath) {
                const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
                    title: 'اختر كشف حساب بنكي (CSV)',
                    filters: [{ name: 'CSV', extensions: ['csv'] }],
                    properties: ['openFile']
                });
                if (canceled || !filePaths.length) return { success: false };
                filePath = filePaths[0];
            }
            return compliance.importBankStatement(d.bankAccountId, filePath);
        } catch(err) { return { success: false, error: err.message }; }
    }));
    ipcMain.handle('compliance:autoMatchBankLines', _gated((e, d) => { try { return compliance.autoMatchBankLines(d.bankAccountId); } catch(err) { return { success: false, error: err.message }; } }));
    // ─────────────────────────────────────────────────────────────────────────────

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
    ipcMain.handle('db:addStaff', _gated(async (e, d) => {
        const staffRows  = db.getDbInstance().prepare('SELECT COUNT(*) as cnt FROM staff WHERE active != 0 OR active IS NULL').get();
        const staffLimit = getStaffLimit(_activeLicense?.tier || 'P');
        if (staffRows.cnt >= staffLimit) {
            return { success: false, error: `STAFF_LIMIT_REACHED:${staffLimit}` };
        }
        return db.addStaff(d);
    }));
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
    ipcMain.handle('db:getSupplierStatement',(e, id) => db.getSupplierStatement(id));
    ipcMain.handle('db:recordSupplierPayment',_gated((e,d)  => db.recordSupplierPayment(d)));
    ipcMain.handle('db:getCustomerStatementBasic',(e, id) => db.getCustomerStatementBasic(id));
    ipcMain.handle('db:recordCustomerPaymentBasic',_gated((e,d)  => db.recordCustomerPaymentBasic(d)));

    // ── Stock History & Purchases ──────────────────────
    ipcMain.handle('db:getStockHistory',      (e, id) => db.getStockHistory(id));
    ipcMain.handle('db:adjustStock',          _gated((e, d)  => db.addStockAdjustment(d)));
    ipcMain.handle('db:getPurchaseOrders',    ()      => db.getPurchaseOrders());
    ipcMain.handle('db:createPurchaseOrder',  _gated((e, d)  => db.createPurchaseOrder(d)));
    ipcMain.handle('db:updatePurchaseOrder',  _gated((e, id, d) => db.updatePurchaseOrder(id, d)));
    ipcMain.handle('db:deletePurchaseOrder',  _gated((e, id) => db.deletePurchaseOrder(id)));
    ipcMain.handle('db:receivePurchaseOrder', _gated((e, id) => db.receivePurchaseOrder(id)));
    ipcMain.handle('db:returnPurchaseOrder',        _gated((e, id)          => db.returnPurchaseOrder(id)));
    ipcMain.handle('db:partialReturnPurchaseOrder', _gated((e, id, items)   => db.partialReturnPurchaseOrder(id, items)));
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
            const win = new BrowserWindow({
                show: false,
                webPreferences: {
                    contextIsolation: true,
                    webSecurity: false,
                }
            });
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            await win.webContents.executeJavaScript(`
                new Promise((resolve) => {
                    const imgs = Array.from(document.images);
                    if (imgs.length === 0) { resolve(); return; }
                    let pending = imgs.length;
                    const done = () => { if (--pending === 0) resolve(); };
                    imgs.forEach(img => {
                        if (img.complete) { done(); }
                        else { img.addEventListener('load', done); img.addEventListener('error', done); }
                    });
                })
            `);
            win.webContents.print({ silent: false, printBackground: true }, () => win.close());
        } catch (err) { console.error('Print Error:', err); }
    });

    ipcMain.handle('zatca:generateQR', async (e, base64TLV) => {
        try {
            const QRCodeLib = require('qrcode');
            const binaryBuffer = Buffer.from(base64TLV, 'base64');
            const byteArray = new Uint8Array(binaryBuffer);
            const dataUrl = await QRCodeLib.toDataURL(
                [{ data: byteArray, mode: 'byte' }],
                {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    margin: 4,
                    scale: 4,
                    color: { dark: '#000000', light: '#ffffff' },
                }
            );
            return dataUrl;
        } catch (err) {
            console.error('[QR] generateQR failed:', err.message);
            return null;
        }
    });

    ipcMain.handle('zatca:getTLV', (e, d) => {
        const _tier    = _activeLicense?.tier;
        const _addons  = _activeLicense?.activeAddons || [];
        if (_tier !== 'P' && _tier !== 'E' && _tier !== 'X' && _tier !== 'O') {
            if (!addonCanAccess(_addons, 'pos.zatca_p2')) {
                const { generateZatcaTLV } = require('./zatca_utils.cjs');
                return generateZatcaTLV(d.seller, d.vatNo, d.timestamp, d.total, d.vatAmt);
            }
        }
        if (d.invoice) {
            try {
                const queueItem = db.getDbInstance().prepare('SELECT signed_xml FROM zatca_queue WHERE invoice_number = ?').get(d.invoice);
                if (queueItem && queueItem.signed_xml) {
                    const match = queueItem.signed_xml.match(/<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([A-Za-z0-9+/=]+)<\/cbc:EmbeddedDocumentBinaryObject>/);
                    if (match && match[1] && match[1].trim().length > 20) return match[1].trim();
                }
            } catch (err) { console.error('[ZATCA] Error querying signed XML from queue:', err); }
        }
        const { generateZatcaTLV9 } = require('./zatca_utils.cjs');
        const device = db.getDbInstance().prepare('SELECT * FROM zatca_device LIMIT 1').get();
        let pubKeyPem = '', certSignature = '';
        if (device && device.production_cert_pem) {
            try {
                const details = zatcaPhase2.extractCertDetails(device.production_cert_pem);
                pubKeyPem = details.pubKeyPem || '';
                certSignature = details.certSignature || '';
            } catch (_) {}
        }
        return generateZatcaTLV9(
            d.seller, d.vatNo, d.timestamp, d.total, d.vatAmt,
            '', '', pubKeyPem, certSignature
        );
    });

    ipcMain.handle('system:getHWID', _getHWID);

    ipcMain.handle('system:getPrinters', async () => {
        try {
            const win = mainWindow || BrowserWindow.getAllWindows()[0];
            if (!win) return [];
            const printers = await win.webContents.getPrintersAsync();
            return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
        } catch (err) {
            console.error('[system:getPrinters]', err.message);
            return [];
        }
    });

    ipcMain.handle('db:createDebitNote', _gated((e, d) => {
        return {
            success: false,
            code: 'FEATURE_PENDING',
            error: 'إشعارات المدين تتطلب شهادة ZATCA خاصة (typeCode 383) وهي قيد التطوير. يرجى إصدار فاتورة منفصلة في الوقت الراهن.',
        };
    }));

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
    ipcMain.handle('zatca:resumeQueue', () => zatcaReporter.resumeQueue());

    ipcMain.handle('zatca:getCertExpiry', () => {
        try {
            const device = db.getZatcaDevice();
            if (!device || !device.production_cert_pem) return { certExpiresAt: null };
            const { checkCertExpiry } = require('./zatca_phase2_impl.cjs');
            const daysRemaining = checkCertExpiry(device.production_cert_pem);
            const expiresAt = new Date(Date.now() + daysRemaining * 86400000);
            return { certExpiresAt: expiresAt.toISOString() };
        } catch (e) {
            console.warn('[ZATCA] getCertExpiry error:', e.message);
            return { certExpiresAt: null, error: e.message };
        }
    });

    ipcMain.handle('zatca:getTLV9', (e, d) => {
        try {
            const _tier   = _activeLicense?.tier;
            const _addons = _activeLicense?.activeAddons || [];
            const hasP2Access =
                (_tier === 'P' || _tier === 'E' || _tier === 'X' || _tier === 'O') ||
                addonCanAccess(_addons, 'pos.zatca_p2');

            if (!hasP2Access) {
                console.warn('[ZATCA] getTLV9 called by non-P2 subscriber — downgrading to Phase 1 5-tag TLV');
                const { generateZatcaTLV } = require('./zatca_utils.cjs');
                return generateZatcaTLV(d.seller, d.vatNo, d.timestamp, d.total, d.vatAmt);
            }

            const { generateZatcaTLV9 } = require('./zatca_utils.cjs');
            const database = db.getDbInstance();
            const device = database.prepare('SELECT * FROM zatca_device LIMIT 1').get();
            let xmlHash = d.xmlHash || null;
            let ecdsaSig = d.ecdsaSig || null;
            let pubKeyPem = d.pubKeyPem || null;
            let certSignature = d.certSignature || null;
            if (d.invoice && (!xmlHash || !ecdsaSig)) {
                const row = database.prepare(
                    'SELECT xml_hash, ecdsa_signature, cert_signature FROM zatca_queue WHERE invoice_number = ? ORDER BY id DESC LIMIT 1'
                ).get(d.invoice);
                if (row) {
                    xmlHash = row.xml_hash || xmlHash;
                    ecdsaSig = row.ecdsa_signature || ecdsaSig;
                    certSignature = row.cert_signature || certSignature;
                }
            }
            if (device && device.production_cert_pem) {
                try {
                    const details = zatcaPhase2.extractCertDetails(device.production_cert_pem);
                    pubKeyPem = details.publicKey || pubKeyPem;
                    certSignature = certSignature || details.signature;
                } catch (_) {}
            }
            const tlvBase64 = generateZatcaTLV9({
                seller: d.seller || '',
                vatNo: d.vatNo || '',
                timestamp: d.timestamp || new Date().toISOString(),
                total: d.total || '0.00',
                vatAmt: d.vatAmt || '0.00',
                xmlHash: xmlHash || '',
                ecdsaSig: ecdsaSig || '',
                pubKeyPem: pubKeyPem || '',
                certSignature: certSignature || '',
            });
            return tlvBase64;
        } catch (err) {
            console.error('[ZATCA] getTLV9 error:', err.message);
            return null;
        }
    });

    ipcMain.handle('zatca:runSimulationTests', async () => {
        const results = [];
        try {
            const device = db.getZatcaDevice();
            if (!device || !device.production_csid) {
                return { success: false, error: 'Device not onboarded — cannot run simulation tests.' };
            }
            const csidData   = JSON.parse(device.production_csid);
            const csidToken  = csidData.binarySecurityToken;
            const csidSecret = csidData.secret;

            const { generateUBL21XML } = require('./zatca_utils.cjs');
            const { signInvoiceXML, generateZatcaTLV9, extractCertDetails, injectUBLExtensions, injectQRPayload } = zatcaPhase2;
            const settings = db.getSettings();
            const cryptoMod = require('crypto');

            const certPem = device.production_cert_pem || '';
            const { pubKeyPem, certSignature } = certPem ? extractCertDetails(certPem) : { pubKeyPem: '', certSignature: '' };

            const runTest = async (label, invoiceData, apiType) => {
                try {
                    const uuid = cryptoMod.randomUUID();
                    const xml = generateUBL21XML({ ...invoiceData, uuid, prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=', icv: 999 });
                    // [FIX-SIM-EXPORT] signXMLHash()/buildSignatureEnvelope() never existed on
                    // zatca_phase2.cjs's exports — use the real exported signInvoiceXML(), which
                    // hashes, signs, and builds the XAdES envelope in a single call, then inject
                    // via the same structural helpers used by signAndPackageInvoice().
                    const { envelope, invoiceHashBase64, signatureBase64 } = signInvoiceXML(
                        xml, device.private_key_pem, certPem, invoiceData.timestamp
                    );
                    const tlv = generateZatcaTLV9(
                        settings.business_name_ar, settings.vat_number,
                        invoiceData.timestamp, invoiceData.total, '0', invoiceHashBase64, signatureBase64, pubKeyPem, certSignature
                    );
                    let signedXml = injectUBLExtensions(xml, envelope);
                    signedXml = injectQRPayload(signedXml, tlv);
                    const xmlBase64 = Buffer.from(signedXml).toString('base64');
                    let response;
                    if (apiType === 'clearance') {
                        response = await zatcaPhase2.clearInvoice(invoiceHashBase64, xmlBase64, uuid, csidToken, csidSecret, true);
                    } else {
                        response = await zatcaPhase2.reportInvoice(invoiceHashBase64, xmlBase64, uuid, csidToken, csidSecret, true);
                    }
                    const passed = !response.error && (response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED' || response.validationResults?.status === 'PASS' || (!response.error && response.invoiceHash));
                    results.push({ label, passed, details: response.error ? (response.data || response) : (response.validationResults || { status: 'PASS' }) });
                } catch (err) {
                    results.push({ label, passed: false, details: { error: err.message } });
                }
            };

            if (!settings.vat_number || !/^3\d{14}$/.test(settings.vat_number)) {
                return { success: false, error: 'يجب ضبط رقم ضريبي صحيح (يبدأ بـ 3 ومكون من 15 رقم) في الإعدادات لإجراء المحاكاة.' };
            }
            if (!settings.business_name_ar) {
                return { success: false, error: 'يجب ضبط اسم المؤسسة في الإعدادات.' };
            }

            const ts = new Date().toISOString();
            const baseInvoice = {
                invoice: `SIM-B2C-${Date.now()}`,
                timestamp: ts,
                total: '115.00',
                items: [{ Name: 'Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
                seller: settings.business_name_ar,
                vatNo: settings.vat_number,
                vatRate: 0.15,
            };

            await runTest('B2C Simplified (Reporting)', { ...baseInvoice, invoice: `SIM-B2C-${Date.now()}` }, 'reporting');
            await runTest('B2B Standard (Clearance)', {
                ...baseInvoice,
                invoice: `SIM-B2B-${Date.now()}`,
                buyer: { vatNo: '300000000000004', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
            }, 'clearance');
            await runTest('Credit Note 381 (Reporting)', {
                ...baseInvoice,
                invoice: `SIM-CN-${Date.now()}`,
                typeCode: '381',
                billingRef: cryptoMod.randomUUID(),
                total: '-115.00',
                items: [{ Name: 'Return', Qty: -1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
            }, 'reporting');
            await runTest('Debit Note 383 (Reporting)', {
                ...baseInvoice,
                invoice: `SIM-DN-${Date.now()}`,
                typeCode: '383',
                billingRef: cryptoMod.randomUUID(),
                total: '115.00',
                items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
            }, 'reporting');

            const allPassed = results.every(r => r.passed);
            return { success: true, allPassed, results };
        } catch (err) {
            return { success: false, error: err.message, results };
        }
    });

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
            if (!settings.vat_number || !/^3\d{14}$/.test(settings.vat_number)) {
                return { success: false, error: 'يجب ضبط رقم ضريبي صحيح (يبدأ بـ 3 ومكون من 15 رقم) في الإعدادات.' };
            }
            if (!settings.business_name_ar) {
                return { success: false, error: 'يجب ضبط اسم المؤسسة في الإعدادات.' };
            }
            // [FIX-ENV-STRING] Pass the actual environment string — not a boolean.
            // Boolean `true` mapped correctly to 'sandbox', but `false` always mapped
            // to 'production', breaking 'simulation' entirely.
            const zatcaEnv = settings.zatca_env || 'sandbox';
            const crypto = require('crypto');
            const pubKey = crypto.createPublicKey(device.private_key_pem);
            const pubKeyPem = pubKey.export({ type: 'spki', format: 'pem' });
            const { csrBase64, csrPem } = zatcaPhase2.generateCSR(
                device.private_key_pem, pubKeyPem,
                { EGS_SN: device.device_id || 'POS-01', UID: settings.vat_number,
                  ORG: settings.business_name_ar, 
                  OU: settings.zatca_ou || 'Head Office', 
                  IND: settings.zatca_ind || 'Retail',
                  env: zatcaEnv,
                  CN: settings.zatca_cn || 'ZATCA-EGS',
                  title: settings.zatca_invoice_type || '1100',
                  address: settings.address_city || settings.city || 'Riyadh' }
            );
            db.updateZatcaDevice({ id: device.id, csr_pem: csrPem });
            const compCsid = await zatcaPhase2.issueComplianceCSID(csrBase64, otp, zatcaEnv);
            if (compCsid.error) return { success: false, error: 'Compliance CSID Failed', details: compCsid.data };
            db.updateZatcaDevice({ id: device.id, compliance_csid: JSON.stringify(compCsid) });

            // ── [MANDATE-3] Simulation-pass guarantee ───────────────────────────────
            // ZATCA requires the EGS to submit and PASS the compliance test invoices
            // (Standard B2B, Simplified B2C, Credit Note, Debit Note) against
            // /compliance/invoices BEFORE /production/csids will issue a PCSID.
            // Skipping this step causes production CSID issuance to be rejected
            // (or — worse — silently issued against an EGS ZATCA considers untested).
            const complianceCheck = await runComplianceInvoiceChecklist({
                device, settings, compCsid, isSandbox: zatcaEnv !== 'production',
            });
            console.log('[ZATCA] FULL_COMPLIANCE_RESPONSE:\\n' + JSON.stringify(complianceCheck, null, 2));
            if (!complianceCheck.allPassed) {
                return {
                    success: false,
                    error: 'Compliance invoice checklist failed — production CSID was NOT requested.',
                    details: complianceCheck.results,
                };
            }

            const prodCsid = await zatcaPhase2.issueProductionCSID(
                compCsid.requestID || compCsid.requestId, compCsid.binarySecurityToken, compCsid.secret, zatcaEnv);
            if (prodCsid.error) return { success: false, error: 'Production CSID Failed', details: prodCsid.data };
            let certExpiresAt = null;
            try {
                const innerBase64 = Buffer.from(prodCsid.binarySecurityToken, 'base64').toString('utf8').replace(/\s+/g, '');
                const certPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
                const forge = require('node-forge');
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

    ipcMain.handle('zatca:getClearanceStatus', (e, saleId) => {
        try {
            const database = db.getDbInstance();
            try { database.prepare('ALTER TABLE sales ADD COLUMN zatca_clearance_status TEXT').run(); } catch (_) {}
            try { database.prepare('ALTER TABLE sales ADD COLUMN zatca_cleared_at TEXT').run(); } catch (_) {}
            const row = database.prepare(
                'SELECT zatca_clearance_status, zatca_cleared_at, customer_tax_id FROM sales WHERE id = ?'
            ).get(saleId);
            if (!row) return { status: null, clearedAt: null };
            return {
                status: row.zatca_clearance_status || null,
                clearedAt: row.zatca_cleared_at || null,
                isB2B: !!(row.customer_tax_id),
            };
        } catch (err) {
            console.error('[ZATCA] getClearanceStatus error:', err.message);
            return { status: null, clearedAt: null };
        }
    });

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

    // ── License — secure IPC (V5) ─────────────────────────────────────────────
    //
    // license:validate — handles both base (V5) and addon (VA) keys.
    //   • VA key: validates, appends to addon_keys[] if valid and not already stored.
    //     Returns { valid, alreadyActive } if already present.
    //   • V5 key: validates, writes activation_key to settings, returns base result.
    ipcMain.handle('license:validate', async (e, { key }) => {
        if (!key) return { valid: false, reason: 'bad_format' };
        const k = key.trim().toUpperCase();
        const settings = db.getSettings();

        if (k.startsWith('VA') && k.length === 18) {
            // Addon key path
            const result = _validateAddonKeyV5(k, settings);
            if (result.valid) {
                // Check if already stored
                let addonKeys = [];
                try { addonKeys = JSON.parse(settings.addon_keys || '[]'); } catch (_) { addonKeys = []; }
                if (!Array.isArray(addonKeys)) addonKeys = [];

                // Deduplicate by matching first 6 chars (fingerprint) to allow re-entry for renewal
                const fp = k.slice(0, 6);
                const existingIdx = addonKeys.findIndex(ak => ak && ak.toUpperCase().startsWith(fp));
                if (existingIdx >= 0) {
                    // Replace old key with new one (renewal case)
                    addonKeys[existingIdx] = k;
                } else {
                    if (addonKeys.length >= 5) {
                        return { valid: false, reason: 'addon_limit_reached' };
                    }
                    addonKeys.push(k);
                }
                // Write activatedAt for this addon key
                const addonSettings = { ...settings };
                _writeActivatedAt(addonSettings, fp);
                await window_api_saveSettings_stub(db, {
                    ...addonSettings,
                    addon_keys: JSON.stringify(addonKeys),
                });
                _activeLicense = _checkAllLicenses(db.getSettings());
            }
            return result;
        }

        // Base key path (V5 or legacy → legacy_key)
        const result = _validateLicenseMain(k, null, settings);
        if (result.valid && result.keyType === 'base') {
            // Write activatedAt for fingerprint
            const fp = k.slice(0, 6);
            const newSettings = { ...settings };
            _writeActivatedAt(newSettings, fp);
            await window_api_saveSettings_stub(db, {
                ...newSettings,
                activation_key: k,
            });
            _activeLicense = _checkAllLicenses(db.getSettings());
        } else if (!result.valid) {
            _activeLicense = null;
        }
        return result;
    });

    // license:check — calls _checkAllLicenses, returns merged result including addonStatuses
    ipcMain.handle('license:check', async () => {
        const settings = db.getSettings();
        const merged = _checkAllLicenses(settings);
        if (merged.valid) {
            _activeLicense = merged;
        } else {
            _activeLicense = null;
        }
        return {
            ...merged,
            expiredAt: undefined,  // V5 does not surface expiredAt
        };
    });

    ipcMain.handle('license:getHWID', _getHWID);

    // license:graceStatus — stub retained for API compatibility; grace is removed.
    ipcMain.handle('license:graceStatus', () => {
        return { active: false, hoursLeft: 0, graceUntil: 0 };
    });

    // license:canAccess — tier + addon gate
    ipcMain.handle('license:canAccess', async (e, featureKey) => {
        if (!_isLicenseActive()) return false;
        const lic = _activeLicense;
        if (lic?.isOwner || lic?.tier === 'O') return true;
        const tier = lic?.tier || 'P';
        if (tierCanAccess(tier, featureKey)) return true;
        return addonCanAccess(lic?.activeAddons || [], featureKey);
    });

    // license:removeAddon (NEW) — removes a matching addon key from addon_keys[] by addonId
    ipcMain.handle('license:removeAddon', async (e, addonId) => {
        try {
            const settings = db.getSettings();
            let addonKeys = [];
            try { addonKeys = JSON.parse(settings.addon_keys || '[]'); } catch (_) { addonKeys = []; }
            if (!Array.isArray(addonKeys)) addonKeys = [];

            const ADDON_CODE_MAP = { restaurant: 'R', finance: 'F', zatca_p2: 'Z', sync: 'S', whitelabel: 'W' };
            const addonCode = ADDON_CODE_MAP[addonId];

            const filtered = addonKeys.filter(ak => {
                if (!ak) return false;
                const ku = ak.toUpperCase();
                // VA[ADDON_CODE] at positions 0-2
                return !(ku.startsWith('VA') && ku[2] === addonCode);
            });

            await window_api_saveSettings_stub(db, { ...settings, addon_keys: JSON.stringify(filtered) });
            _activeLicense = _checkAllLicenses(db.getSettings());
            return { success: true };
        } catch (err) {
            console.error('[license:removeAddon]', err);
            return { success: false, error: err.message };
        }
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
    ipcMain.handle('window:openPos', async () => {
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

// ── Helper: save settings via db directly (IPC handlers can't call window.api) ─
async function window_api_saveSettings_stub(dbModule, data) {
    try { dbModule.saveSettings(data); } catch (err) { console.error('[saveSettings stub]', err); }
}

// ── [MANDATE-3] Compliance invoice checklist runner ────────────────────────────
// Generates + signs the four mandatory test invoice types and submits each to
// /compliance/invoices using the Compliance CSID credentials. ZATCA will not
// issue a Production CSID until all four have returned a PASS validation result.
// NOTE: uses zatcaPhase2.signInvoiceXML / injectUBLExtensions / injectQRPayload
// (the functions actually exported by zatca_phase2.cjs). zatca:runSimulationTests
// previously referenced the non-existent signXMLHash/buildSignatureEnvelope —
// that has since been fixed to use the same signInvoiceXML()-based path.
async function runComplianceInvoiceChecklist({ device, settings, compCsid, isSandbox }) {
    console.log('[ZATCA] QR-FIX-V2-ACTIVE — runComplianceInvoiceChecklist entered via main.cjs, zatcaPhase2 = ./zatca_phase2_impl.cjs');
    const results = [];
    const cryptoMod = require('crypto');
    const { generateUBL21XML } = require('./zatca_utils.cjs');

    const runOne = async (label, invoiceData) => {
        try {
            const uuid = cryptoMod.randomUUID();
            // Compliance checks use a fixed, ZATCA-documented dummy PIH for the
            // first invoice in the chain — production invoices use the real last_pih.
            const xml = generateUBL21XML({
                ...invoiceData,
                uuid,
                prevHash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
                icv: 1,
            });
            // Compliance CSID has no production_cert_pem yet — sign against the
            // compliance cert returned in binarySecurityToken.
            // Ensure the double-base64 token is properly decoded and formatted as a valid PEM string
            const token = compCsid.binarySecurityToken || '';
            const innerBase64 = Buffer.from(token, 'base64').toString('utf8').replace(/\s+/g, '');
            const compCertPem = `-----BEGIN CERTIFICATE-----\n${(innerBase64.match(/.{1,64}/g) || []).join('\n')}\n-----END CERTIFICATE-----`;
            const { envelope, invoiceHashBase64, signatureBase64 } = zatcaPhase2.signInvoiceXML(
                xml, device.private_key_pem, compCertPem, invoiceData.timestamp
            );
            const { pubKeyPem: compPubKeyPem, certSignature: compCertSignature } = zatcaPhase2.extractCertDetails(compCertPem);
            const tlv = zatcaPhase2.generateZatcaTLV9(
                settings.business_name_ar, settings.vat_number,
                invoiceData.timestamp, invoiceData.total || '115.00', '0',
                invoiceHashBase64, signatureBase64, compPubKeyPem, compCertSignature
            );
            let signedXml = zatcaPhase2.injectUBLExtensions(xml, envelope);
            signedXml = zatcaPhase2.injectQRPayload(signedXml, tlv);
            const xmlBase64 = Buffer.from(signedXml).toString('base64');

            const response = await zatcaPhase2.checkComplianceInvoice(
                invoiceHashBase64, xmlBase64, uuid,
                compCsid.binarySecurityToken, compCsid.secret, isSandbox
            );
            const passed = !response.error && (response.validationResults?.status === 'PASS' || response.validationResults?.status === 'WARNING' || response.reportingStatus === 'REPORTED' || response.clearanceStatus === 'CLEARED');
            results.push({ label, passed, details: response.error ? (response.data || response) : (response.validationResults || { status: 'PASS' }) });
        } catch (err) {
            results.push({ label, passed: false, details: { error: err.message } });
        }
    };

    const ts = new Date().toISOString();
    const baseInvoice = {
        invoice: { id: `COMPLY-${Date.now()}` },
        timestamp: ts,
        total: '115.00',
        items: [{ Name: 'Compliance Test Item', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
        seller: settings.business_name_ar,
        vatNo: settings.vat_number,
        vatRate: 0.15,
        address: {
            street: settings.address_street || settings.street || 'شارع',
            building: settings.address_building || settings.building || '1111',
            district: settings.address_district || settings.district || 'حي',
            city: settings.address_city || settings.city || 'الرياض',
            postal: settings.address_postal || settings.postal || '12345',
            additional_street: settings.address_additional_street || '',
            country: settings.address_country || settings.country || 'SA'
        }
    };

    await runOne('B2C Simplified (Reporting)', { ...baseInvoice, invoice: { id: `COMPLY-B2C-${Date.now()}` } });
    await runOne('B2B Standard (Clearance)', {
        ...baseInvoice,
        invoice: { id: `COMPLY-B2B-${Date.now()}` },
        subtype: '0100000',
        buyer: { vatNo: '300000000000003', name: 'Test Buyer', street: 'شارع', building: '1111', district: 'حي', city: 'الرياض', postal: '12345', country: 'SA' },
    });
    await runOne('Credit Note 381', {
        ...baseInvoice,
        invoice: { id: `COMPLY-CN-${Date.now()}` },
        typeCode: '381',
        subtype: '0100000',
        billingRef: cryptoMod.randomUUID(),
        total: '115.00',
        items: [{ Name: 'Return', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });
    await runOne('Debit Note 383', {
        ...baseInvoice,
        invoice: { id: `COMPLY-DN-${Date.now()}` },
        typeCode: '383',
        subtype: '0100000',
        billingRef: cryptoMod.randomUUID(),
        total: '115.00',
        items: [{ Name: 'Adjustment', Qty: 1, Price: 115, Unit: 'PCE', tax_category: 'S' }],
    });

    return { allPassed: results.every(r => r.passed), results };
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
    compliance.initCompliance(db.getDbInstance());
    registerIpcHandlers();
    hardware.registerLabelIPC(db);   // ← Label Engine IPC (P2, P3, P7, P8, P9)
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
    setTimeout(checkZatcaCertExpiry, 5000);
    setInterval(checkZatcaCertExpiry, 24 * 60 * 60 * 1000);

    // ── License startup check (V5 — no grace period) ──
    (async () => {
        const settings = db.getSettings();
        const merged = _checkAllLicenses(settings);
        if (merged.valid) {
            _activeLicense = merged;
            console.log('[License V5] Valid —', merged.tierName, '| daysLeft:', merged.daysLeft);
        } else {
            _activeLicense = null;
            console.log('[License V5] Invalid —', merged.reason);
            // Notify renderer immediately so SecurityGuard can show the wall
            setTimeout(() => {
                mainWindow?.webContents.send('license:expired', { reason: merged.reason });
            }, 2000);
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
