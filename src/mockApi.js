// mockApi.js — Comprehensive Production-Simulation Mock
// ─────────────────────────────────────────────────────────────────
// FIXES APPLIED:
// • saveSale now returns { success: true, invoice } — was returning wrong shape
// • verifyStaffPin now returns { success, token, user } — was returning user directly
//   causing login to always fail in browser/dev mode (res.success was always undefined)
// • Added 13 missing methods that were causing silent failures:
//   getHeldOrders, holdOrder, deleteHeldOrder, getYesterdayStats,
//   getFinancialTimeline, getPromotions, getHWID, logout,
//   forceSync, getSyncStatus, getPrinters, getOpenShift (fixed),
//   getStaff (now returns proper staff list for login)
// ─────────────────────────────────────────────────────────────────

let _heldOrders = [];
let _invoiceCounter = 1001;
let _settings = {
  business_name_ar: 'مقهى البصمة',
  business_name_en: 'Basma Cafe',
  branch_name: 'الفرع الرئيسي',
  vat_number: '300000000000003',
  address: 'شارع الملك عبدالعزيز، المدينة المنورة',
  phone: '966533174895',
  email: 'ea.gaber10@gmail.com',
  vat_rate: '0.15',
  country: 'sa',
  currency: 'SAR',
  invoice_prefix: 'INV-',
  auto_print: 'false',
  business_type: 'restaurant',
  loyalty_rate: '10',
  loyalty_redeem_rate: '0.1',
  receipt_width: '80',
  activation_key: '',
  business_logo: '',
  network_mode: 'standalone',
  expense_lock_days: '30',
};

const mockStaff = [
  { id: 1, name: 'محمد العمري',  role: 'Admin',   pin_hash: '1234', permissions_json: '[]', active: 1 },
  { id: 2, name: 'سارة الأحمدي', role: 'Cashier',  pin_hash: '5678', permissions_json: '[]', active: 1 },
];

const mockMenu = [
  { ID: 1, Name: 'إسبريسو',    Price: 15.0, Category: 'قهوة',    Stock: 100, Cost: 5.0,  MinStockLevel: 5,  IsService: false, Barcode: '4001' },
  { ID: 2, Name: 'لاتيه',      Price: 22.0, Category: 'قهوة',    Stock: 50,  Cost: 7.0,  MinStockLevel: 10, IsService: false, Barcode: '4002' },
  { ID: 3, Name: 'كرواسون',    Price: 12.0, Category: 'مخبوزات', Stock: 4,   Cost: 4.0,  MinStockLevel: 5,  IsService: false, Barcode: '4003' },
  { ID: 4, Name: 'عصير برتقال', Price: 18.0, Category: 'مشروبات', Stock: 30,  Cost: 6.0,  MinStockLevel: 5,  IsService: false, Barcode: '4004' },
  { ID: 5, Name: 'برجر دجاج',  Price: 45.0, Category: 'وجبات',   Stock: 20,  Cost: 15.0, MinStockLevel: 5,  IsService: false, Barcode: '4005',
    Modifiers: [
      { id: 'm1', name: 'جبنة إضافية', price: 5 },
      { id: 'm2', name: 'بدون بصل',   price: 0 },
      { id: 'm3', name: 'صوص حار',    price: 2 },
    ]
  },
  { ID: 6, Name: 'صيانة شاشة', Price: 150.0, Category: 'خدمات',  Stock: 999, Cost: 50.0, MinStockLevel: 0,  IsService: true, Barcode: '4006' },
];

const mockSales = [
  { id: 1, invoice: 'INV-1001', sale_date: new Date(Date.now() - 3600000).toISOString(), total: 107.5, status: 'paid', customer_name: 'أحمد محمد', payment: 'Cash' },
  { id: 2, invoice: 'INV-1002', sale_date: new Date(Date.now() - 7200000).toISOString(), total:  45.0, status: 'paid', customer_name: null,          payment: 'Card' },
  { id: 3, invoice: 'INV-1003', sale_date: new Date(Date.now() - 10800000).toISOString(),total:  22.0, status: 'void', customer_name: 'فاطمة علي',   payment: 'Cash' },
];

const mockApi = {
  // ── Menu ────────────────────────────────────────────────────────
  getMenu:        async ()  => mockMenu,
  addMenuItem:    async (d) => ({ ID: Date.now(), ...d }),
  editMenuItem:   async (d) => d,
  deleteMenuItem: async (id) => ({ success: true, ID: id }),
  updateStock:    async (d) => ({ success: true }),
  updateProductCost: async (d) => ({ success: true }),

  // ── Sales ────────────────────────────────────────────────────────
  // FIX: now returns { success: true, invoice } — was returning { saleId, status }
  saveSale: async (data) => {
    const invoice = data.invoice || `INV-${_invoiceCounter++}`;
    console.log('[mockApi] saveSale →', { invoice, total: data.total });
    mockSales.unshift({ id: Date.now(), invoice, sale_date: new Date().toISOString(), total: data.total, status: 'paid', customer_name: null, payment: data.payment });
    return { success: true, invoice };
  },

  getSalesHistory: async (f) => mockSales,

  getSaleByInvoice: async (invoice) => mockSales.find(s => s.invoice === invoice) || null,

  voidSale: async ({ id, reason }) => {
    const s = mockSales.find(x => x.id === id);
    if (s) s.status = 'void';
    return { success: true };
  },

  // ── Held Orders ──────────────────────────────────────────────────
  // FIX: all three methods were missing — POS could not hold/resume orders
  getHeldOrders: async () => _heldOrders,

  holdOrder: async ({ items, label, kds_status }) => {
    const order = { id: Date.now(), label, items, kds_status: kds_status || 'none', timestamp: new Date().toISOString() };
    _heldOrders.push(order);
    return { success: true, id: order.id };
  },

  deleteHeldOrder: async (id) => {
    _heldOrders = _heldOrders.filter(h => h.id !== id);
    return { success: true };
  },

  // ── Financial Reports ────────────────────────────────────────────
  getFinancialReport: async (range) => ({
    totalSales:     5240.75,
    vatOutput:       681.84,
    grossProfit:    3150.45,
    netProfit:      2780.30,
    expenses:        370.15,
    grossMarginPct:  60.1,
    netMarginPct:    53.1,
    topProducts: [
      { item_name: 'برجر دجاج',   qtySold: 42, itemRevenue: 1890 },
      { item_name: 'لاتيه',       qtySold: 38, itemRevenue:  836 },
      { item_name: 'إسبريسو',    qtySold: 31, itemRevenue:  465 },
      { item_name: 'عصير برتقال', qtySold: 20, itemRevenue:  360 },
      { item_name: 'كرواسون',    qtySold: 15, itemRevenue:  180 },
    ],
    recentSales: mockSales,
  }),

  // FIX: was missing — Dashboard fetchDashboard crashed silently
  getYesterdayStats: async () => ({
    sales:    4120.50,
    expenses:  295.00,
  }),

  // FIX: was missing — Dashboard timeline chart had no data
  getFinancialTimeline: async ({ startDate, endDate }) => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({
        period:       d.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric' }),
        total_sales:  Math.round(3000 + Math.random() * 3000),
        total_expenses: Math.round(200 + Math.random() * 500),
      });
    }
    return days;
  },

  getVATReport: async (range) => ({
    invoiceCount: 45, taxableAmount: 4347.8, vatOutput: 652.2, vatInput: 150, netVAT: 502.2
  }),

  // ── Expenditures ─────────────────────────────────────────────────
  getExpenditures: async (f) => [
    { id: 1, description: 'فاتورة كهرباء', amount: 370, category: 'مرافق', expense_date: '2026-04-01' },
    { id: 2, description: 'صيانة معدات',   amount: 180, category: 'صيانة', expense_date: '2026-04-05' },
  ],
  addExpenditure:    async (d)  => ({ id: Date.now(), success: true }),
  deleteExpenditure: async (id) => ({ success: true }),

  // ── Customers ────────────────────────────────────────────────────
  getCustomers: async (f) => [
    { id: 1, name: 'أحمد محمد',  phone: '0501234567', loyalty_points: 150, tax_id: '' },
    { id: 2, name: 'فاطمة علي',  phone: '0559876543', loyalty_points: 80,  tax_id: '' },
    { id: 3, name: 'خالد الحربي', phone: '0533112233', loyalty_points: 320, tax_id: '300111222333' },
  ],
  addCustomer:    async (d) => ({ id: Date.now(), success: true, ...d }),
  updateCustomer: async (d) => ({ success: true }),
  deleteCustomer: async (id) => ({ success: true }),

  // ── Staff ────────────────────────────────────────────────────────
  getStaff: async () => mockStaff,
  addStaff:    async (d)  => ({ id: Date.now(), success: true }),
  updateStaff: async (d)  => ({ success: true }),
  deleteStaff: async (id) => ({ success: true }),

  // FIX: was returning user object directly — useAuthStore.login expects
  // { success: true, token, user } shape — login was always failing in browser mode
  verifyStaffPin: async (pin) => {
    const staff = mockStaff.find(s => s.pin_hash === pin);
    if (staff) {
      return {
        success: true,
        token: `mock-token-${Date.now()}`,
        user: { id: staff.id, name: staff.name, role: staff.role },
      };
    }
    return { success: false };
  },

  // FIX: was missing — useAuthStore.logout called this and silently crashed
  logout: async (token) => {
    console.log('[mockApi] logout — token:', token);
    return { success: true };
  },

  // ── Shift ────────────────────────────────────────────────────────
  getOpenShift: async () => ({
    id: 1,
    starting_cash: 500,
    status: 'open',
    opened_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    opened_by: 1,
  }),
  openShift:  async (cash) => ({ id: Date.now(), starting_cash: cash, status: 'open', opened_at: new Date().toISOString() }),
  closeShift: async (data) => ({ success: true, ...data }),

  // ── Settings ─────────────────────────────────────────────────────
  getSettings:  async ()  => ({ ..._settings }),
  saveSettings: async (d) => { Object.assign(_settings, d); return { success: true }; },

  // ── Promotions ───────────────────────────────────────────────────
  // FIX: was missing — useCartStore.fetchPromotions crashed silently
  getPromotions: async () => [
    { id: 1, name: 'خصم 10% على الطلبات فوق 100 ريال', type: 'TOTAL', min_spend: 100, discount_type: 'pct', discount_value: 10, active: 1 },
    { id: 2, name: 'اشتري 2 قهوة احصل على الثالثة مجاناً', type: 'BOGO', buy_product_id: 2, buy_qty: 2, get_qty: 1, active: 1 },
  ],
  addPromotion:    async (d)  => ({ id: Date.now(), success: true }),
  updatePromotion: async (d)  => ({ success: true }),
  deletePromotion: async (id) => ({ success: true }),

  // ── Hardware ─────────────────────────────────────────────────────
  // FIX: was missing — SecurityGuard.checkLicense crashed immediately
  getHWID: async () => 'MOCK-HWID-DEV-0000-FFFF',

  // FIX: was missing — OfflineBanner crashed silently on every 10-second poll
  getSyncStatus: async () => ({ status: 'online', lastSync: new Date().toISOString() }),
  forceSync:     async ()  => ({ success: true }),

  // FIX: was missing — Settings page crashed when polling printers
  getPrinters: async () => [
    { name: 'طابعة حرارية - USB', id: 'thermal-usb' },
    { name: 'طابعة شبكية - IP',   id: 'net-printer' },
  ],

  printHTML: async (html) => {
    console.log('[mockApi] printHTML — preview window');
    if (window.api?.printHTML) {
      window.api.printHTML(html);
    } else {
      const win = window.open('', '_blank', 'width=400,height=600');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
    }
    return { success: true };
  },

  // ── Accounting ───────────────────────────────────────────────────
  getAccounts: async () => [
    { account_code: 1101, name_ar: 'الصندوق',   balance: 1500 },
    { account_code: 4101, name_ar: 'المبيعات',  balance: 5240.75 },
    { account_code: 5101, name_ar: 'تكلفة البضاعة', balance: 2060.45 },
  ],
  getTrialBalance:  async ()  => [],
  getGeneralLedger: async (f) => [],

  // ── Suppliers / Purchases ─────────────────────────────────────────
  getSuppliers: async () => [
    { id: 1, name: 'شركة النخبة للتوريد',  phone: '0123456789', email: 'info@elite.sa' },
  ],
  addSupplier:    async (d)  => ({ id: Date.now(), success: true }),
  updateSupplier: async (d)  => ({ success: true }),
  deleteSupplier: async (id) => ({ success: true }),

  getPurchases: async () => [
    { id: 1, supplier_name: 'شركة النخبة', total: 1200, date: '2026-04-10', status: 'received' },
  ],
  addPurchase:    async (d)  => ({ id: Date.now(), success: true }),
  updatePurchase: async (d)  => ({ success: true }),

  // ── Tables (restaurant) ───────────────────────────────────────────
  getTables: async () => [
    { id: 1, name: 'طاولة 1', capacity: 4, status: 'available' },
    { id: 2, name: 'طاولة 2', capacity: 6, status: 'occupied' },
    { id: 3, name: 'طاولة 3', capacity: 2, status: 'available' },
    { id: 4, name: 'طاولة 4', capacity: 4, status: 'reserved' },
  ],
  updateTableStatus: async (d) => ({ success: true }),

  // ── KDS ───────────────────────────────────────────────────────────
  getKDSOrders: async () => [
    { id: 1, label: 'طاولة 2', items: [{ Name: 'برجر دجاج', Qty: 2 }], kds_status: 'pending',  timestamp: new Date().toISOString() },
    { id: 2, label: 'سفري',   items: [{ Name: 'لاتيه', Qty: 1 }],      kds_status: 'preparing', timestamp: new Date().toISOString() },
  ],
  updateKDSStatus: async ({ id, status }) => ({ success: true }),

  // ── Stock History ─────────────────────────────────────────────
  getStockHistory: async (productId) => [
    { id: 1, product_id: productId, change_qty: -2, reason: 'sale',     note: 'INV-1001', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, product_id: productId, change_qty: 20, reason: 'purchase', note: 'شراء من المورد', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 3, product_id: productId, change_qty: -1, reason: 'waste',    note: 'تلف',       created_at: new Date(Date.now() - 172800000).toISOString() },
  ],

  // ── Audit Logs ────────────────────────────────────────────────────
  getAuditLogs: async (l) => [],

  // ── Misc ──────────────────────────────────────────────────────────
  onSessionExpired: (cb) => { /* no-op in browser */ },
  onSyncNotify:     (cb) => { /* no-op in browser */ },
};

export default mockApi;
