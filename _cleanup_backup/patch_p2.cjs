/**
 * ═══════════════════════════════════════════════════════════════════
 *  POS v2 — Phase 2 & 3 PATCH SCRIPT
 *  Run this ONCE from C:\my-pos\v2 with:
 *    node patch_p2.cjs
 *
 *  What it does:
 *  1. Adds `require('./accounting_p2.cjs')` to database.cjs
 *  2. Adds `accountingP2.initP2(db)` call inside initDatabase()
 *  3. Appends Phase 2 exports to database.cjs module.exports
 *  4. Appends Phase 2 IPC handlers to main.cjs
 *  5. Appends Phase 2 preload bridge to preload.cjs
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const root = __dirname;

function patchFile(filePath, patches) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = 0;
    for (const { find, replace, label } of patches) {
        if (content.includes(find)) {
            content = content.replace(find, replace);
            changed++;
            console.log(`  ✔ ${label}`);
        } else {
            console.warn(`  ⚠ SKIP (already applied or not found): ${label}`);
        }
    }
    if (changed > 0) fs.writeFileSync(filePath, content, 'utf8');
    return changed;
}

// ────────────────────────────────────────────────────────────────────
// 1. database.cjs
// ────────────────────────────────────────────────────────────────────
console.log('\n[1/3] Patching electron/database.cjs ...');
patchFile(path.join(root, 'electron', 'database.cjs'), [
    {
        label: 'Add accountingP2 require',
        find: `const accounting = require('./accounting.cjs');`,
        replace: `const accounting = require('./accounting.cjs');\nconst accountingP2 = require('./accounting_p2.cjs');`,
    },
    {
        label: 'Init accountingP2 after accountingP1 init',
        find: `accounting.initAccounting(db);\n    console.log('[Accounting] Engine initialized.');`,
        replace: `accounting.initAccounting(db);\n    console.log('[Accounting] Phase 1 engine initialized.');\n    accountingP2.initP2(db);\n    console.log('[AccountingP2] Phase 2 engine initialized.');`,
    },
    {
        label: 'Append Phase 2 exports',
        find: `    recordWhatsAppShare,\n};`,
        replace: `    recordWhatsAppShare,
    // Accounting Engine (Phase 2 & 3)
    p2: accountingP2,
    // AR
    getARAgingReport:          accountingP2.getARAgingReport,
    getCustomerStatement:      accountingP2.getCustomerStatement,
    recordCustomerPayment:     accountingP2.recordCustomerPayment,
    checkCreditLimit:          accountingP2.checkCreditLimit,
    // Fixed Assets
    getFixedAssets:            accountingP2.getFixedAssets,
    addFixedAsset:             accountingP2.addFixedAsset,
    updateFixedAsset:          accountingP2.updateFixedAsset,
    disposeFixedAsset:         accountingP2.disposeFixedAsset,
    runDepreciation:           accountingP2.runDepreciation,
    getDepreciationSchedule:   accountingP2.getDepreciationSchedule,
    // Bank Reconciliation
    getBankAccounts:           accountingP2.getBankAccounts,
    saveBankAccount:           accountingP2.saveBankAccount,
    getBankReconciliations:    accountingP2.getBankReconciliations,
    saveBankReconciliation:    accountingP2.saveBankReconciliation,
    getBankTransactions:       accountingP2.getBankTransactions,
    // VAT (P-013)
    getVATReturnBoxes:         accountingP2.getVATReturnBoxes,
    // Accruals
    getPrepaidSchedules:       accountingP2.getPrepaidSchedules,
    addPrepaidSchedule:        accountingP2.addPrepaidSchedule,
    runPrepaidAmortisation:    accountingP2.runPrepaidAmortisation,
    getRecurringExpenses:      accountingP2.getRecurringExpenses,
    addRecurringExpense:       accountingP2.addRecurringExpense,
    // Payroll
    getEmployees:              accountingP2.getEmployees,
    saveEmployee:              accountingP2.saveEmployee,
    deleteEmployee:            accountingP2.deleteEmployee,
    createPayrollRun:          accountingP2.createPayrollRun,
    postPayrollRun:            accountingP2.postPayrollRun,
    getPayrollRuns:            accountingP2.getPayrollRuns,
    // Audit
    addEnhancedAuditLog:       accountingP2.addEnhancedAuditLog,
    getEnhancedAuditLogs:      accountingP2.getEnhancedAuditLogs,
    // Inventory Costing
    addInventoryBatch:         accountingP2.addInventoryBatch,
    getInventoryBatches:       accountingP2.getInventoryBatches,
    postStockCount:            accountingP2.postStockCount,
    getStockCountHistory:      accountingP2.getStockCountHistory,
    // Subsidiary Ledgers
    getCustomerSubsidiaryLedger:  accountingP2.getCustomerSubsidiaryLedger,
    getSupplierSubsidiaryLedger:  accountingP2.getSupplierSubsidiaryLedger,
    getSubsidiaryControlCheck:    accountingP2.getSubsidiaryControlCheck,
    // Budget / Cost Centres
    getBudgetVsActual:         accountingP2.getBudgetVsActual,
    saveBudgetEntry:           accountingP2.saveBudgetEntry,
    getCostCentres:            accountingP2.getCostCentres,
    saveCostCentre:            accountingP2.saveCostCentre,
};`,
    },
]);

// ────────────────────────────────────────────────────────────────────
// 2. main.cjs — append IPC handlers after the last acct: handler
// ────────────────────────────────────────────────────────────────────
console.log('\n[2/3] Patching electron/main.cjs ...');
patchFile(path.join(root, 'electron', 'main.cjs'), [
    {
        label: 'Append Phase 2 IPC handlers',
        find: `    ipcMain.handle('acct:nextJvRef',              () => { try { return db.nextJvRef(); } catch(_) { return 'JV-AUTO'; } });`,
        replace: `    ipcMain.handle('acct:nextJvRef',              () => { try { return db.nextJvRef(); } catch(_) { return 'JV-AUTO'; } });

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
    // Subsidiary Ledgers
    ipcMain.handle('p2:getCustomerSubsidiaryLedger', (e, d) => { try { return db.getCustomerSubsidiaryLedger(d.customerId, d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getSupplierSubsidiaryLedger', (e, d) => { try { return db.getSupplierSubsidiaryLedger(d.supplierId, d.startDate, d.endDate); } catch(err) { return { error: err.message }; } });
    ipcMain.handle('p2:getSubsidiaryControlCheck',   ()     => { try { return db.getSubsidiaryControlCheck(); } catch(err) { return { error: err.message }; } });
    // Budget
    ipcMain.handle('p2:getBudgetVsActual',      (e, d) => { try { return db.getBudgetVsActual(d.period); } catch(err) { return []; } });
    ipcMain.handle('p2:saveBudgetEntry',        _gated((e, d) => { try { return db.saveBudgetEntry(d.period, d.account_code, d.budgeted_amount); } catch(err) { return { success: false, error: err.message }; } }));
    ipcMain.handle('p2:getCostCentres',         ()     => { try { return db.getCostCentres(); } catch(err) { return []; } });
    ipcMain.handle('p2:saveCostCentre',         _gated((e, d) => { try { return db.saveCostCentre(d); } catch(err) { return { success: false, error: err.message }; } }));`,
    },
]);

// ────────────────────────────────────────────────────────────────────
// 3. preload.cjs — add p2 namespace
// ────────────────────────────────────────────────────────────────────
console.log('\n[3/3] Patching electron/preload.cjs ...');
patchFile(path.join(root, 'electron', 'preload.cjs'), [
    {
        label: 'Append p2 namespace to window.api',
        find: `  // ── Updater ───────────────────────────────────`,
        replace: `  // ── Accounting Phase 2 & 3 ──────────────────────
  p2: {
    // AR
    getARAgingReport:            (d)  => ipcRenderer.invoke('p2:getARAgingReport', d),
    getCustomerStatement:        (d)  => ipcRenderer.invoke('p2:getCustomerStatement', d),
    recordCustomerPayment:       (d)  => ipcRenderer.invoke('p2:recordCustomerPayment', d),
    checkCreditLimit:            (d)  => ipcRenderer.invoke('p2:checkCreditLimit', d),
    // Fixed Assets
    getFixedAssets:              ()   => ipcRenderer.invoke('p2:getFixedAssets'),
    addFixedAsset:               (d)  => ipcRenderer.invoke('p2:addFixedAsset', d),
    updateFixedAsset:            (d)  => ipcRenderer.invoke('p2:updateFixedAsset', d),
    disposeFixedAsset:           (d)  => ipcRenderer.invoke('p2:disposeFixedAsset', d),
    runDepreciation:             (d)  => ipcRenderer.invoke('p2:runDepreciation', d),
    getDepreciationSchedule:     (d)  => ipcRenderer.invoke('p2:getDepreciationSchedule', d),
    // Bank Reconciliation
    getBankAccounts:             ()   => ipcRenderer.invoke('p2:getBankAccounts'),
    saveBankAccount:             (d)  => ipcRenderer.invoke('p2:saveBankAccount', d),
    getBankReconciliations:      (d)  => ipcRenderer.invoke('p2:getBankReconciliations', d),
    saveBankReconciliation:      (d)  => ipcRenderer.invoke('p2:saveBankReconciliation', d),
    getBankTransactions:         (d)  => ipcRenderer.invoke('p2:getBankTransactions', d),
    // VAT
    getVATReturnBoxes:           (d)  => ipcRenderer.invoke('p2:getVATReturnBoxes', d),
    // Accruals
    getPrepaidSchedules:         ()   => ipcRenderer.invoke('p2:getPrepaidSchedules'),
    addPrepaidSchedule:          (d)  => ipcRenderer.invoke('p2:addPrepaidSchedule', d),
    runPrepaidAmortisation:      (d)  => ipcRenderer.invoke('p2:runPrepaidAmortisation', d),
    getRecurringExpenses:        ()   => ipcRenderer.invoke('p2:getRecurringExpenses'),
    addRecurringExpense:         (d)  => ipcRenderer.invoke('p2:addRecurringExpense', d),
    // Payroll
    getEmployees:                ()   => ipcRenderer.invoke('p2:getEmployees'),
    saveEmployee:                (d)  => ipcRenderer.invoke('p2:saveEmployee', d),
    deleteEmployee:              (id) => ipcRenderer.invoke('p2:deleteEmployee', id),
    createPayrollRun:            (d)  => ipcRenderer.invoke('p2:createPayrollRun', d),
    postPayrollRun:              (d)  => ipcRenderer.invoke('p2:postPayrollRun', d),
    getPayrollRuns:              (d)  => ipcRenderer.invoke('p2:getPayrollRuns', d),
    // Audit
    getEnhancedAuditLogs:        (f)  => ipcRenderer.invoke('p2:getEnhancedAuditLogs', f),
    // Inventory Costing
    postStockCount:              (d)  => ipcRenderer.invoke('p2:postStockCount', d),
    getStockCountHistory:        (d)  => ipcRenderer.invoke('p2:getStockCountHistory', d),
    // Subsidiary Ledgers
    getCustomerSubsidiaryLedger: (d)  => ipcRenderer.invoke('p2:getCustomerSubsidiaryLedger', d),
    getSupplierSubsidiaryLedger: (d)  => ipcRenderer.invoke('p2:getSupplierSubsidiaryLedger', d),
    getSubsidiaryControlCheck:   ()   => ipcRenderer.invoke('p2:getSubsidiaryControlCheck'),
    // Budget
    getBudgetVsActual:           (d)  => ipcRenderer.invoke('p2:getBudgetVsActual', d),
    saveBudgetEntry:             (d)  => ipcRenderer.invoke('p2:saveBudgetEntry', d),
    getCostCentres:              ()   => ipcRenderer.invoke('p2:getCostCentres'),
    saveCostCentre:              (d)  => ipcRenderer.invoke('p2:saveCostCentre', d),
  },

  // ── Updater ───────────────────────────────────`,
    },
]);

console.log('\n✅  Patch complete. Rebuild the app with: npm run build or npm run electron:dev\n');
