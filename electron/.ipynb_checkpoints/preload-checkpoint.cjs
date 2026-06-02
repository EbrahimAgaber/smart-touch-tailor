const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Products ──────────────────────────────────
  getMenu:              ()       => ipcRenderer.invoke('db:getMenu'),
  addMenuItem:          (d)      => ipcRenderer.invoke('db:addMenuItem', d),
  editMenuItem:         (d)      => ipcRenderer.invoke('db:editMenuItem', d),
  deleteMenuItem:       (id)     => ipcRenderer.invoke('db:deleteMenuItem', id),
  updateStock:          (d)      => ipcRenderer.invoke('db:updateStock', d),
  updateProductCost:    (d)      => ipcRenderer.invoke('db:updateProductCost', d),
  importCSV:            (p)      => ipcRenderer.invoke('db:importCSV', p),

  // ── Held Orders ───────────────────────────────
  getHeldOrders:        ()       => ipcRenderer.invoke('db:getHeldOrders'),
  holdOrder:            (d)      => ipcRenderer.invoke('db:holdOrder', d),
  deleteHeldOrder:      (id)     => ipcRenderer.invoke('db:deleteHeldOrder', id),

  // ── Sales ─────────────────────────────────────
  saveSale:             (d)      => ipcRenderer.invoke('db:saveSale', d),
  voidSale:             (d)      => ipcRenderer.invoke('db:voidSale', d),
  getSalesHistory:      (f)      => ipcRenderer.invoke('db:getSalesHistory', f),
  getSaleByInvoice:     (id)     => ipcRenderer.invoke('db:getSaleByInvoice', id),
  updateSaleStatus:     (d)      => ipcRenderer.invoke('db:updateSaleStatus', d),
  exportSalesCSV:       (f)      => ipcRenderer.invoke('db:exportSalesCSV', f),
  updateHeldOrderStatus: (id, s) => ipcRenderer.invoke('db:updateHeldOrderStatus', { id, status: s }),

  // ── Tables ────────────────────────────────────
  getTables:            ()       => ipcRenderer.invoke('db:getTables'),
  addTable:             (d)      => ipcRenderer.invoke('db:addTable', d),
  updateTable:          (d)      => ipcRenderer.invoke('db:updateTable', d),
  updateTablePosition:  (id, x, y) => ipcRenderer.invoke('db:updateTablePosition', { id, x, y }),
  deleteTable:          (id)     => ipcRenderer.invoke('db:deleteTable', id),

  // ── Expenditures ─────────────────────────────
  addExpenditure:       (d)      => ipcRenderer.invoke('db:addExpenditure', d),
  editExpenditure:      (d)      => ipcRenderer.invoke('db:editExpenditure', d),
  deleteExpenditure:    (id)     => ipcRenderer.invoke('db:deleteExpenditure', id),
  getExpenditures:      (f)      => ipcRenderer.invoke('db:getExpenditures', f),

  // ── Reports ───────────────────────────────────
  getFinancialReport:   (r)      => ipcRenderer.invoke('db:getFinancialReport', r),
  getFinancialTimeline: (r)      => ipcRenderer.invoke('db:getFinancialTimeline', r),
  getVATReport:         (r)      => ipcRenderer.invoke('db:getVATReport', r),
  getYesterdayStats:    ()       => ipcRenderer.invoke('db:getYesterdayStats'),
  getLowStockAlerts:    ()       => ipcRenderer.invoke('db:getLowStockAlerts'),

  // ── Settings ──────────────────────────────────
  getSettings:          ()       => ipcRenderer.invoke('settings:get'),
  saveSettings:         (d)      => ipcRenderer.invoke('settings:save', d),
  pickImageFile:        ()       => ipcRenderer.invoke('dialog:pickImage'),
  pickCSVFile:          ()       => ipcRenderer.invoke('dialog:pickCSV'),

  // ── Accounting ────────────────────────────────
  getAccounts:          ()       => ipcRenderer.invoke('db:getAccounts'),
  addAccount:           (d)      => ipcRenderer.invoke('db:addAccount', d),
  getGeneralLedger:     (f)      => ipcRenderer.invoke('db:getGeneralLedger', f),
  getTrialBalance:      ()       => ipcRenderer.invoke('db:getTrialBalance'),

  // Accounting Engine (Phase 1)
  acct: {
    getJournalEntries:       (f)  => ipcRenderer.invoke('acct:getJournalEntries', f),
    getJournalEntry:         (id) => ipcRenderer.invoke('acct:getJournalEntry', id),
    postJournalEntry:        (d)  => ipcRenderer.invoke('acct:postJournalEntry', d),
    reverseJournalEntry:     (d)  => ipcRenderer.invoke('acct:reverseJournalEntry', d),
    getBalanceSheet:         (d)  => ipcRenderer.invoke('acct:getBalanceSheet', d),
    getCashFlow:             (d)  => ipcRenderer.invoke('acct:getCashFlow', d),
    getIncomeStatement:      (d)  => ipcRenderer.invoke('acct:getIncomeStatement', d),
    postOpeningBalances:     (d)  => ipcRenderer.invoke('acct:postOpeningBalances', d),
    hasOpeningBalances:      ()   => ipcRenderer.invoke('acct:hasOpeningBalances'),
    getAccountsHierarchical: ()   => ipcRenderer.invoke('acct:getAccountsHierarchical'),
    addAccountNew:           (d)  => ipcRenderer.invoke('acct:addAccountNew', d),
    getPeriods:              ()   => ipcRenderer.invoke('acct:getPeriods'),
    savePeriod:              (d)  => ipcRenderer.invoke('acct:savePeriod', d),
    lockPeriod:              (d)  => ipcRenderer.invoke('acct:lockPeriod', d),
    unlockPeriod:            (d)  => ipcRenderer.invoke('acct:unlockPeriod', d),
    nextJvRef:               ()   => ipcRenderer.invoke('acct:nextJvRef'),
  },

  // Shifts
  getOpenShift:         ()       => ipcRenderer.invoke('shift:getOpen'),
  openShift:            (d)      => ipcRenderer.invoke('shift:open', d),
  closeShift:           (d)      => ipcRenderer.invoke('shift:close', d),

  // ── Customers (CRM) ───────────────────────────
  getCustomers:         (f)      => ipcRenderer.invoke('db:getCustomers', f),
  addCustomer:          (d)      => ipcRenderer.invoke('db:addCustomer', d),
  updateCustomer:       (d)      => ipcRenderer.invoke('db:updateCustomer', d),
  getCustomerHistory:   (id)     => ipcRenderer.invoke('db:getCustomerHistory', id),
  redeemLoyaltyPoints:  (d)      => ipcRenderer.invoke('db:redeemLoyaltyPoints', d),
  recordWhatsAppShare:  (d)      => ipcRenderer.invoke('db:recordWhatsAppShare', d),

  // ── Staff ─────────────────────────────────────
  getStaff:             ()       => ipcRenderer.invoke('db:getStaff'),
  addStaff:             (d)      => ipcRenderer.invoke('db:addStaff', d),
  updateStaff:          (d)      => ipcRenderer.invoke('db:updateStaff', d),
  deleteStaff:          (id)     => ipcRenderer.invoke('db:deleteStaff', id),
  updateStaffPermissions:(d)     => ipcRenderer.invoke('db:updateStaffPermissions', d),
  verifyStaffPin:       (p, id)  => ipcRenderer.invoke('db:verifyStaffPin', { pin: p, staffId: id }),
  getAuditLogs:         (l)      => ipcRenderer.invoke('db:getAuditLogs', l),

  // ── Suppliers ─────────────────────────────────
  getSuppliers:         ()       => ipcRenderer.invoke('db:getSuppliers'),
  addSupplier:          (d)      => ipcRenderer.invoke('db:addSupplier', d),
  updateSupplier:       (d)      => ipcRenderer.invoke('db:updateSupplier', d),
  deleteSupplier:       (id)     => ipcRenderer.invoke('db:deleteSupplier', id),

  // ── Stock History & Purchases ─────────────────
  getStockHistory:      (id)     => ipcRenderer.invoke('db:getStockHistory', id),
  adjustStock:          (d)      => ipcRenderer.invoke('db:adjustStock', d),
  getPurchaseOrders:    ()       => ipcRenderer.invoke('db:getPurchaseOrders'),
  createPurchaseOrder:  (d)      => ipcRenderer.invoke('db:createPurchaseOrder', d),
  receivePurchaseOrder: (id)     => ipcRenderer.invoke('db:receivePurchaseOrder', id),
  getPurchaseItems:     (id)     => ipcRenderer.invoke('db:getPurchaseItems', id),
  createReturn:         (d)      => ipcRenderer.invoke('db:createReturn', d),

  // ── Promotions ────────────────────────────────
  getPromotions:        ()       => ipcRenderer.invoke('db:getPromotions'),
  savePromotion:        (d)      => ipcRenderer.invoke('db:savePromotion', d),
  deletePromotion:      (id)     => ipcRenderer.invoke('db:deletePromotion', id),
  togglePromotion:      (d)      => ipcRenderer.invoke('db:togglePromotion', d),

  // ── Printing / Utility ────────────────────────
  printHTML:            (html)   => ipcRenderer.invoke('printHTML', html),
  getHWID:              ()       => ipcRenderer.invoke('system:getHWID'),

  // ── License (secure — validation in main process) ─────────────────────────
  validateLicense:      (key)    => ipcRenderer.invoke('license:validate', { key }),
  checkLicense:         ()       => ipcRenderer.invoke('license:check'),
  getLicenseGraceStatus:()       => ipcRenderer.invoke('license:graceStatus'),

  // Push events from main process → renderer
  onLicenseGrace:       (cb)     => {
    const sub = (_, data) => cb(data);
    ipcRenderer.on('license:grace', sub);
    return () => ipcRenderer.removeListener('license:grace', sub);
  },
  onLicenseExpired:     (cb)     => {
    const sub = (_, data) => cb(data);
    ipcRenderer.on('license:expired', sub);
    return () => ipcRenderer.removeListener('license:expired', sub);
  },

  // ── ZATCA / Compliance ────────────────────────
  getZatcaTLV:          (d)      => ipcRenderer.invoke('zatca:getTLV', d),
  getZatcaDevice:       ()       => ipcRenderer.invoke('zatca:getDevice'),
  getZatcaQueueStatus:  ()       => ipcRenderer.invoke('zatca:getQueueStatus'),
  retryZatcaQueue:      ()       => ipcRenderer.invoke('zatca:retryQueue'),
  onboardZatcaDevice:   (d)      => ipcRenderer.invoke('zatca:onboardDevice', d),
  getSignedXML:         (d)      => ipcRenderer.invoke('zatca:getSignedXML', d),
  saveFile:             (d)      => ipcRenderer.invoke('dialog:saveFile', d),

  // ── Export Engine (P-019) ─────────────────────────────────────────────────
  exportToPDF:          (d)      => ipcRenderer.invoke('export:toPDF', d),
  exportToExcel:        (d)      => ipcRenderer.invoke('export:toExcel', d),

  // ── Backups ───────────────────────────────────
  exportBackup:         ()       => ipcRenderer.invoke('db:exportBackup'),
  restoreBackup:        ()       => ipcRenderer.invoke('db:restoreBackup'),

  // ── Window Management ─────────────────────────────────────────
  openPos:              ()       => ipcRenderer.invoke('window:openPos'),

  // ── Synchronization ───────────────────────────
  getSyncStatus:        ()       => ipcRenderer.invoke('sync:getStatus'),
  setSyncMode:          (d)      => ipcRenderer.invoke('sync:setMode', d),
  forceSync:            ()       => ipcRenderer.invoke('sync:forceSync'),
  openExternal:         (url)    => ipcRenderer.invoke('system:openExternal', url),

  // ── Accounting Phase 2 & 3 ──────────────────
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
    matchBankLines:               (d)  => ipcRenderer.invoke('p2:matchBankLines', d),
    unmatchBankLine:              (d)  => ipcRenderer.invoke('p2:unmatchBankLine', d),
    getBankRecMatches:            (d)  => ipcRenderer.invoke('p2:getBankRecMatches', d),
    getUnmatchedBankTransactions: (d)  => ipcRenderer.invoke('p2:getUnmatchedBankTransactions', d),
    getCheques:                   (d)  => ipcRenderer.invoke('p2:getCheques', d),
    saveCheque:                   (d)  => ipcRenderer.invoke('p2:saveCheque', d),
    updateChequeStatus:           (d)  => ipcRenderer.invoke('p2:updateChequeStatus', d),
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
    getInventoryBatches:         (d)  => ipcRenderer.invoke('p2:getInventoryBatches', d),
    // Subsidiary Ledgers
    getCustomerSubsidiaryLedger: (d)  => ipcRenderer.invoke('p2:getCustomerSubsidiaryLedger', d),
    getSupplierSubsidiaryLedger: (d)  => ipcRenderer.invoke('p2:getSupplierSubsidiaryLedger', d),
    getSubsidiaryControlCheck:   ()   => ipcRenderer.invoke('p2:getSubsidiaryControlCheck'),
    // Budget
    getBudgetVsActual:           (d)  => ipcRenderer.invoke('p2:getBudgetVsActual', d),
    saveBudgetEntry:             (d)  => ipcRenderer.invoke('p2:saveBudgetEntry', d),
    getCostCentres:              ()   => ipcRenderer.invoke('p2:getCostCentres'),
    saveCostCentre:              (d)  => ipcRenderer.invoke('p2:saveCostCentre', d),
    getBreakEvenInputs:          ()   => ipcRenderer.invoke('p2:getBreakEvenInputs'),
    // Gap-filling additions
    getAccountDrillDown:         (d)  => ipcRenderer.invoke('p2:getAccountDrillDown', d),
    getCostCentreReport:         (d)  => ipcRenderer.invoke('p2:getCostCentreReport', d),
    getDeferredRevenueSchedules: ()   => ipcRenderer.invoke('p2:getDeferredRevenueSchedules'),
    addDeferredRevenueSchedule:  (d)  => ipcRenderer.invoke('p2:addDeferredRevenueSchedule', d),
    runDeferredRevenueRecognition:(d) => ipcRenderer.invoke('p2:runDeferredRevenueRecognition', d),
  },

  // ── Updater ───────────────────────────────────────────
  getVersion:           ()       => ipcRenderer.invoke('updater:getVersion'),
  checkForUpdates:      ()       => ipcRenderer.invoke('updater:check'),
  installUpdate:        ()       => ipcRenderer.invoke('updater:install'),
  onUpdateStatus:       (cb)     => {
    const subscription = (event, data) => cb(data);
    ipcRenderer.on('updater:status', subscription);
    return () => ipcRenderer.removeListener('updater:status', subscription);
  },
});
