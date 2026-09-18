// mockApi.js — Comprehensive In-Browser Simulation for Smart Touch POS & Tailor
// ─────────────────────────────────────────────────────────────────

let _heldOrders = [];
let _invoiceCounter = 1001;
let _tailorOrderCounter = 2001;

let _settings = {
  business_name_ar: 'البصمة الذكية - خياطة ومقاسات ونقاط بيع',
  business_name_en: 'Smart Touch POS & Tailoring',
  branch_name: 'الفرع الرئيسي',
  vat_number: '300000000000003',
  address: 'طريق الملك فهد، الرياض، المملكة العربية السعودية',
  phone: '966533174895',
  email: 'ea.gaber10@gmail.com',
  vat_rate: '0.15',
  country: 'sa',
  currency: 'SAR',
  invoice_prefix: 'INV-',
  auto_print: 'false',
  business_type: 'tailor', // Default to tailor / multi-mode
  tailor_default_delivery_days: '7',
  loyalty_rate: '10',
  loyalty_redeem_rate: '0.1',
  receipt_width: '80',
  activation_key: 'ENTERPRISE-LIFETIME-PRO-2026',
  business_logo: '',
  network_mode: 'standalone',
  expense_lock_days: '30',
  date_format: 'gregorian',
};

const mockStaff = [
  { id: 1, name: 'محمد العمري',  role: 'Admin',   pin_hash: '1234', permissions_json: '["reports","accounts","stock","settings","customers"]', active: 1 },
  { id: 2, name: 'سارة الأحمدي', role: 'Cashier', pin_hash: '5678', permissions_json: '["stock","customers"]', active: 1 },
  { id: 3, name: 'أحمد الترزي (المعلم)', role: 'Tailor', pin_hash: '1111', permissions_json: '["stock"]', active: 1 },
  { id: 4, name: 'كريم القصّاص', role: 'Cutter',  pin_hash: '2222', permissions_json: '["stock"]', active: 1 },
];

const mockMenu = [
  // ── Tailor Fabrics ──
  { ID: 101, Name: 'قماش ياباني تترون سوبر فاخر', Price: 65.0, Category: 'أقمشة', Stock: 500, Cost: 30.0, MinStockLevel: 20, IsFabric: 1, IsActive: 1, Barcode: '6001' },
  { ID: 102, Name: 'قماش قطن كوري صيفي بارد',    Price: 45.0, Category: 'أقمشة', Stock: 400, Cost: 20.0, MinStockLevel: 20, IsFabric: 1, IsActive: 1, Barcode: '6002' },
  { ID: 103, Name: 'قماش سلك فاخر مقلم خفيف',    Price: 85.0, Category: 'أقمشة', Stock: 300, Cost: 40.0, MinStockLevel: 15, IsFabric: 1, IsActive: 1, Barcode: '6003' },
  { ID: 104, Name: 'قماش شتوي صوف إنجليزي',      Price: 120.0, Category: 'أقمشة', Stock: 150, Cost: 60.0, MinStockLevel: 10, IsFabric: 1, IsActive: 1, Barcode: '6004' },
  // ── Ready Garments / Services ──
  { ID: 201, Name: 'تفصيل ثوب سعودي سادة',       Price: 160.0, Category: 'أثواب', Stock: 999, Cost: 60.0, MinStockLevel: 0,  IsService: false, IsActive: 1, Barcode: '5001' },
  { ID: 202, Name: 'تفصيل ثوب كويتي قلاب',       Price: 175.0, Category: 'أثواب', Stock: 999, Cost: 65.0, MinStockLevel: 0,  IsService: false, IsActive: 1, Barcode: '5002' },
  { ID: 203, Name: 'تفصيل ثوب قطري / إماراتي',   Price: 180.0, Category: 'أثواب', Stock: 999, Cost: 70.0, MinStockLevel: 0,  IsService: false, IsActive: 1, Barcode: '5003' },
  { ID: 204, Name: 'تقصير وتعديل ثوب',           Price: 25.0,  Category: 'تعديلات', Stock: 999, Cost: 0.0, MinStockLevel: 0,  IsService: true,  IsActive: 1, Barcode: '7001' },
  { ID: 205, Name: 'تضييق جوانب وأكمام',          Price: 35.0,  Category: 'تعديلات', Stock: 999, Cost: 0.0, MinStockLevel: 0,  IsService: true,  IsActive: 1, Barcode: '7002' },
  // ── Retail / Cafe Items ──
  { ID: 1, Name: 'إسبريسو',    Price: 15.0, Category: 'قهوة',    Stock: 100, Cost: 5.0,  MinStockLevel: 5,  IsService: false, IsActive: 1, Barcode: '4001' },
  { ID: 2, Name: 'لاتيه',      Price: 22.0, Category: 'قهوة',    Stock: 50,  Cost: 7.0,  MinStockLevel: 10, IsService: false, IsActive: 1, Barcode: '4002' },
  { ID: 3, Name: 'كرواسون',    Price: 12.0, Category: 'مخبوزات', Stock: 4,   Cost: 4.0,  MinStockLevel: 5,  IsService: false, IsActive: 1, Barcode: '4003' },
  { ID: 4, Name: 'عصير برتقال', Price: 18.0, Category: 'مشروبات', Stock: 30,  Cost: 6.0,  MinStockLevel: 5,  IsService: false, IsActive: 1, Barcode: '4004' },
];

const mockCustomers = [
  { id: 1, name: 'عبدالله السعدون', phone: '0501234567', loyalty_points: 150, tax_id: '' },
  { id: 2, name: 'سلطان القحطاني', phone: '0559876543', loyalty_points: 80,  tax_id: '' },
  { id: 3, name: 'خالد الحربي',    phone: '0533112233', loyalty_points: 320, tax_id: '300111222333' },
];

const mockMeasurements = [
  {
    id: 1,
    customer_id: 1,
    name: 'المقاس الأساسي المريح',
    garment_type: 'thobe',
    updated_at: new Date().toISOString(),
    measurements: {
      length: '58', shoulder: '18', neck: '16.5', chest: '44',
      waist: '42', sleeve: '24', wrist: '9', hand_opening: '7',
      bottom_flare: '32', collar_height: '3.5', jabzor: '12'
    },
    config: { collar: 'classic', cuff: 'single' },
    notes: 'يفضل وسع خفيف عند الصدر'
  },
  {
    id: 2,
    customer_id: 2,
    name: 'ثوب رسمي مناسبات',
    garment_type: 'thobe',
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    measurements: {
      length: '57.5', shoulder: '17.5', neck: '16', chest: '42',
      waist: '40', sleeve: '23.5', wrist: '8.5', hand_opening: '6.5',
      bottom_flare: '30', collar_height: '4', jabzor: '12'
    },
    config: { collar: 'mandarin', cuff: 'french' },
    notes: 'قماش واقف كويتي'
  }
];

let mockTailorOrders = [
  {
    id: 1,
    order_id: 1,
    invoice_number: 'ORD-2001',
    customer_id: 1,
    customer_name: 'عبدالله السعدون',
    customer_phone: '0501234567',
    delivery_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    target_delivery_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    is_urgent: 0,
    status: 'cutting',
    total_amount: 320.0,
    paid_amount: 200.0,
    deposit_paid: 200.0,
    remaining_amount: 120.0,
    balance_due: 120.0,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    items: [
      {
        id: 1,
        order_id: 1,
        garment_type: 'thobe',
        fabric_name: 'قماش ياباني تترون سوبر فاخر',
        price: 160.0,
        qty: 2,
        stage: 'cutting',
        production_stage: 'cutting',
        tailor_name: 'أحمد الترزي (المعلم)',
        cutter_name: 'كريم القصّاص',
        measurements: { length: '58', shoulder: '18', neck: '16.5', chest: '44', sleeve: '24' }
      }
    ]
  },
  {
    id: 2,
    order_id: 2,
    invoice_number: 'ORD-2002',
    customer_id: 2,
    customer_name: 'سلطان القحطاني',
    customer_phone: '0559876543',
    delivery_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    target_delivery_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    is_urgent: 1,
    status: 'stitching',
    total_amount: 190.0,
    paid_amount: 190.0,
    deposit_paid: 190.0,
    remaining_amount: 0.0,
    balance_due: 0.0,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    items: [
      {
        id: 2,
        order_id: 2,
        garment_type: 'thobe',
        fabric_name: 'قماش سلك فاخر مقلم خفيف',
        price: 190.0,
        qty: 1,
        stage: 'stitching',
        production_stage: 'stitching',
        tailor_name: 'أحمد الترزي (المعلم)',
        cutter_name: 'كريم القصّاص',
        measurements: { length: '57.5', shoulder: '17.5', neck: '16', chest: '42', sleeve: '23.5' }
      }
    ]
  }
];

let mockAlterations = [
  {
    id: 1,
    ticket_number: 'ALT-101',
    customer_name: 'خالد الحربي',
    customer_phone: '0533112233',
    garment_type: 'thobe',
    alteration_type: 'تقصير وتقفيل كم',
    price: 35.0,
    status: 'in_progress',
    delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  }
];

let mockSales = [
  {
    id: 1,
    invoice: 'INV-1001',
    sale_date: new Date(Date.now() - 3600000).toISOString(),
    total: 320.0,
    subtotal: 278.26,
    tax: 41.74,
    paid: 320.0,
    balance: 0.0,
    status: 'paid',
    customer_id: 1,
    customer_name: 'عبدالله السعدون',
    customer_phone: '0501234567',
    payment: 'Cash',
    payment_method: 'Cash',
    clearance_status: 'reported',
    items: [
      { id: 101, Name: 'تفصيل ثوب سعودي سادة', Price: 160.0, Qty: 2, Total: 320.0, Category: 'أثواب' }
    ],
    items_json: JSON.stringify([
      { id: 101, Name: 'تفصيل ثوب سعودي سادة', Price: 160.0, Qty: 2, Total: 320.0, Category: 'أثواب' }
    ])
  },
  {
    id: 2,
    invoice: 'INV-1002',
    sale_date: new Date(Date.now() - 7200000).toISOString(),
    total: 190.0,
    subtotal: 165.22,
    tax: 24.78,
    paid: 190.0,
    balance: 0.0,
    status: 'paid',
    customer_id: 2,
    customer_name: 'سلطان القحطاني',
    customer_phone: '0559876543',
    payment: 'Card',
    payment_method: 'Card',
    clearance_status: 'cleared',
    items: [
      { id: 202, Name: 'تفصيل ثوب كويتي قلاب', Price: 190.0, Qty: 1, Total: 190.0, Category: 'أثواب' }
    ],
    items_json: JSON.stringify([
      { id: 202, Name: 'تفصيل ثوب كويتي قلاب', Price: 190.0, Qty: 1, Total: 190.0, Category: 'أثواب' }
    ])
  },
  {
    id: 3,
    invoice: 'INV-1003',
    sale_date: new Date(Date.now() - 10800000).toISOString(),
    total: 22.0,
    subtotal: 19.13,
    tax: 2.87,
    paid: 22.0,
    balance: 0.0,
    status: 'paid',
    customer_id: null,
    customer_name: 'عميل نقدي',
    customer_phone: '',
    payment: 'Card',
    payment_method: 'Card',
    clearance_status: 'reported',
    items: [
      { id: 2, Name: 'لاتيه', Price: 22.0, Qty: 1, Total: 22.0, Category: 'قهوة' }
    ],
    items_json: JSON.stringify([
      { id: 2, Name: 'لاتيه', Price: 22.0, Qty: 1, Total: 22.0, Category: 'قهوة' }
    ])
  }
];

let mockExpenditures = [
  { id: 1, description: 'فاتورة كهرباء المحل', amount: 370, category: 'مرافق', expense_date: '2026-04-01' },
  { id: 2, description: 'إبر وخيوط ومستلزمات خياطة', amount: 180, category: 'مستلزمات', expense_date: '2026-04-05' },
];

const rawMockApi = {
  // ── Version & Environment ─────────────────────────────────────────
  getVersion: async () => '1.8.5',
  getHWID: async () => 'MOCK-HWID-DEV-0000-FFFF',

  // ── License Management ───────────────────────────────────────────
  checkLicense: async () => ({
    valid: true,
    billing: 'lifetime',
    tier: 'X',
    tierName: 'enterprise',
    daysLeft: Infinity,
    isOwner: true,
    isTrial: false,
    isLifetime: true,
    trialExpired: false,
    keyType: 'tier',
    activeAddons: ['restaurant', 'finance', 'sync', 'zatca_p2'],
  }),
  validateLicense: async (key) => ({
    valid: true,
    plan: 'lifetime',
    tier: 'X',
    tierName: 'enterprise',
    expiry: 0,
  }),
  getLicenseGraceStatus: async () => ({
    active: false,
    hoursLeft: 48,
  }),
  onLicenseGrace: (cb) => () => {},
  onLicenseExpired: (cb) => () => {},

  // ── Settings ─────────────────────────────────────────────────────
  getSettings:  async ()  => ({ ..._settings }),
  saveSettings: async (d) => { Object.assign(_settings, d); return { success: true }; },

  // ── Staff & Authentication ───────────────────────────────────────
  getStaff: async () => mockStaff,
  addStaff:    async (d)  => {
    const s = { id: Date.now(), ...d, active: 1, permissions_json: JSON.stringify(d.permissions || []) };
    mockStaff.push(s);
    return { id: s.id, success: true };
  },
  updateStaff: async (d)  => {
    const idx = mockStaff.findIndex(s => s.id === d.id);
    if (idx !== -1) Object.assign(mockStaff[idx], d);
    return { success: true };
  },
  deleteStaff: async (id) => {
    const idx = mockStaff.findIndex(s => s.id === id);
    if (idx !== -1) mockStaff.splice(idx, 1);
    return { success: true };
  },

  verifyStaffPin: async (pin, staffId) => {
    const staff = staffId 
      ? mockStaff.find(s => s.id === staffId && s.pin_hash === String(pin))
      : mockStaff.find(s => s.pin_hash === String(pin));
    if (staff) {
      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        permissions_json: staff.permissions_json || '[]',
        active: staff.active,
        success: true,
        user: { id: staff.id, name: staff.name, role: staff.role, permissions_json: staff.permissions_json || '[]' }
      };
    }
    return null;
  },

  logout: async (token) => ({ success: true }),

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

  // ── Menu / Catalog ───────────────────────────────────────────────
  getMenu:        async ()  => mockMenu,
  addMenuItem:    async (d) => {
    const item = { ID: Date.now(), ...d, IsActive: 1 };
    mockMenu.push(item);
    return item;
  },
  editMenuItem:   async (d) => {
    const idx = mockMenu.findIndex(m => m.ID === d.ID);
    if (idx !== -1) Object.assign(mockMenu[idx], d);
    return d;
  },
  deleteMenuItem: async (id) => {
    const idx = mockMenu.findIndex(m => m.ID === id);
    if (idx !== -1) mockMenu.splice(idx, 1);
    return { success: true, ID: id };
  },
  updateStock:    async (d) => ({ success: true }),
  updateProductCost: async (d) => ({ success: true }),

  // ── Sales ────────────────────────────────────────────────────────
  saveSale: async (data) => {
    const invoice = data.invoice || `INV-${_invoiceCounter++}`;
    const total = parseFloat(data.total) || 0;
    const subtotal = data.subtotal !== undefined ? parseFloat(data.subtotal) : parseFloat((total / 1.15).toFixed(2));
    const tax = data.tax !== undefined ? parseFloat(data.tax) : parseFloat((total - subtotal).toFixed(2));
    const paid = data.paid !== undefined ? parseFloat(data.paid) : total;
    const balance = Math.max(0, parseFloat((total - paid).toFixed(2)));
    const saleItems = data.items || [];

    const saleRecord = {
      id: Date.now(),
      invoice,
      sale_date: data.sale_date || new Date().toISOString(),
      total,
      subtotal,
      tax,
      paid,
      balance,
      status: data.status || (balance > 0 ? 'partial' : 'paid'),
      customer_id: data.customer_id || (data.customer ? data.customer.id : null),
      customer_name: data.customer_name || (data.customer ? data.customer.name : 'عميل نقدي'),
      customer_phone: data.customer_phone || (data.customer ? data.customer.phone : ''),
      payment: data.payment || data.payment_method || 'Cash',
      payment_method: data.payment_method || data.payment || 'Cash',
      clearance_status: 'reported',
      items: saleItems,
      items_json: JSON.stringify(saleItems),
      tailor_order_id: data.tailor_order_id || null,
      alteration_ticket_id: data.alteration_ticket_id || null,
    };
    mockSales.unshift(saleRecord);
    return { success: true, invoice, id: saleRecord.id };
  },
  getSalesHistory: async (f = {}) => {
    let list = [...mockSales];
    if (f.startDate) {
      list = list.filter(s => s.sale_date >= f.startDate);
    }
    if (f.endDate) {
      list = list.filter(s => s.sale_date.split('T')[0] <= f.endDate);
    }
    if (f.status && f.status !== 'all') {
      list = list.filter(s => s.status === f.status);
    }
    if (f.search) {
      const q = String(f.search).toLowerCase();
      list = list.filter(s =>
        (s.invoice && s.invoice.toLowerCase().includes(q)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.customer_phone && s.customer_phone.includes(q))
      );
    }
    if (f.limit) {
      list = list.slice(0, f.limit);
    }
    return list;
  },
  getSaleByInvoice: async (invoice) => mockSales.find(s => s.invoice === invoice) || null,
  voidSale: async ({ id, reason }) => {
    const s = mockSales.find(x => x.id === id);
    if (s) s.status = 'void';
    return { success: true };
  },

  // ── Held Orders ──────────────────────────────────────────────────
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

  // ── Tailor Subsystem ─────────────────────────────────────────────
  tailor: {
    getOrders: async (filter) => {
      let orders = [...mockTailorOrders];
      if (filter?.exclude_status) {
        orders = orders.filter(o => o.status !== filter.exclude_status);
      }
      return orders;
    },
    getGarments: async (orderId) => {
      const ord = mockTailorOrders.find(o => o.id === orderId || o.order_id === orderId || String(o.id) === String(orderId));
      if (!ord) return [];
      return (ord.items || []).map(item => ({
        ...item,
        production_stage: item.production_stage || item.stage || 'cutting',
        stage: item.stage || item.production_stage || 'cutting'
      }));
    },
    createOrder: async (data) => {
      const orderId = _tailorOrderCounter++;
      const invoiceNumber = `ORD-${orderId}`;
      let cName = data.customer_name;
      let cPhone = data.customer_phone;
      if (data.customer_id && (!cName || !cPhone)) {
        const cust = mockCustomers.find(c => c.id === data.customer_id);
        if (cust) {
          cName = cName || cust.name;
          cPhone = cPhone || cust.phone;
        }
      }
      const rawItems = data.garments || data.items || [];
      const paidAmt = parseFloat(data.deposit_paid ?? data.paid_amount ?? 0);
      const totalAmt = parseFloat(data.total_amount || 0);
      const deliveryDate = data.delivery_date || data.target_delivery_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const newOrder = {
        id: orderId,
        order_id: orderId,
        invoice_number: invoiceNumber,
        sale_invoice_id: data.sale_invoice_id || null,
        customer_id: data.customer_id || null,
        customer_name: cName || 'عميل نقدي',
        customer_phone: cPhone || '',
        delivery_date: deliveryDate,
        target_delivery_date: deliveryDate,
        is_urgent: data.is_urgent ? 1 : 0,
        status: data.status === 'draft' ? 'draft' : (data.status === 'pending' ? 'pending' : (data.status || 'cutting')),
        total_amount: totalAmt,
        paid_amount: paidAmt,
        deposit_paid: paidAmt,
        remaining_amount: Math.max(0, totalAmt - paidAmt),
        balance_due: Math.max(0, totalAmt - paidAmt),
        created_at: new Date().toISOString(),
        items: rawItems.map((it, idx) => ({
          id: Date.now() + idx,
          order_id: orderId,
          garment_type: it.garment_type || 'thobe',
          fabric_name: it.fabric_name || 'قماش مختار',
          price: parseFloat(it.price || 150),
          qty: 1,
          stage: 'cutting',
          production_stage: 'cutting',
          tailor_name: it.tailor_name || 'أحمد الترزي (المعلم)',
          cutter_name: it.cutter_name || 'كريم القصّاص',
          measurements: it.measurements || {}
        }))
      };
      mockTailorOrders.unshift(newOrder);
      return { success: true, id: orderId, order_id: orderId, invoice_number: invoiceNumber };
    },
    updateOrderStatus: async ({ order_id, sale_invoice_id, status, paid_amount }) => {
      const ord = mockTailorOrders.find(o => o.id === order_id || o.order_id === order_id);
      if (ord) {
        if (status) ord.status = status;
        if (sale_invoice_id) ord.sale_invoice_id = sale_invoice_id;
        if (paid_amount !== undefined) {
          ord.paid_amount = parseFloat(paid_amount);
          ord.deposit_paid = ord.paid_amount;
          ord.remaining_amount = Math.max(0, (ord.total_amount || 0) - ord.paid_amount);
          ord.balance_due = ord.remaining_amount;
        }
      }
      return { success: true };
    },
    updateStage: async ({ garment_id, stage }) => {
      for (const ord of mockTailorOrders) {
        const item = (ord.items || []).find(i => i.id === garment_id || String(i.id) === String(garment_id));
        if (item) {
          item.stage = stage;
          item.production_stage = stage;
          // Synchronize parent order status
          const stages = ord.items.map(i => i.production_stage || i.stage);
          if (stages.every(s => s === 'delivered')) ord.status = 'delivered';
          else if (stages.every(s => s === 'ready')) ord.status = 'ready';
          else if (stages.some(s => s === 'stitching' || s === 'sewing')) ord.status = 'stitching';
          else if (stages.some(s => s === 'finishing' || s === 'qc' || s === 'ironing')) ord.status = 'stitching';
          return { success: true };
        }
      }
      return { success: true };
    },
    completeOrder: async ({ order_id, payment_method = 'Cash', balance_paid }) => {
      const ord = mockTailorOrders.find(o => o.id === order_id || o.order_id === order_id || String(o.id) === String(order_id));
      if (ord) {
        ord.status = 'delivered';
        (ord.items || []).forEach(i => {
          i.stage = 'delivered';
          i.production_stage = 'delivered';
        });
        const balPaid = parseFloat(balance_paid) || 0;
        if (balPaid > 0) {
          ord.paid_amount = (ord.paid_amount || 0) + balPaid;
          ord.deposit_paid = ord.paid_amount;
          ord.remaining_amount = Math.max(0, (ord.total_amount || 0) - ord.paid_amount);
          ord.balance_due = ord.remaining_amount;

          // Record settlement in mockSales so reports and cash drawer match
          const invNum = `INV-${_invoiceCounter++}`;
          mockSales.unshift({
            id: Date.now(),
            invoice: invNum,
            sale_date: new Date().toISOString(),
            total: balPaid,
            subtotal: parseFloat((balPaid / 1.15).toFixed(2)),
            tax: parseFloat((balPaid - balPaid / 1.15).toFixed(2)),
            paid: balPaid,
            balance: 0,
            status: 'paid',
            customer_id: ord.customer_id || null,
            customer_name: ord.customer_name || 'عميل تفصيل',
            customer_phone: ord.customer_phone || '',
            payment: payment_method === 'card' ? 'Card' : (payment_method === 'bank' ? 'Bank' : 'Cash'),
            payment_method: payment_method === 'card' ? 'Card' : (payment_method === 'bank' ? 'Bank' : 'Cash'),
            clearance_status: 'reported',
            items: [{
              id: `settle_${ord.id}`,
              Name: `سداد متبقي استلام طلب تفصيل #${ord.id}`,
              Price: balPaid,
              Qty: 1,
              Total: balPaid,
              Category: 'تفصيل'
            }],
            items_json: JSON.stringify([{
              id: `settle_${ord.id}`,
              Name: `سداد متبقي استلام طلب تفصيل #${ord.id}`,
              Price: balPaid,
              Qty: 1,
              Total: balPaid,
              Category: 'تفصيل'
            }]),
            tailor_order_id: ord.id
          });
        }
      }
      return { success: true };
    },
    addPayment: async ({ order_id, amount, payment_method = 'Cash' }) => {
      const ord = mockTailorOrders.find(o => o.id === order_id || o.order_id === order_id);
      if (ord) {
        const amt = parseFloat(amount) || 0;
        ord.paid_amount = (ord.paid_amount || 0) + amt;
        ord.deposit_paid = ord.paid_amount;
        ord.remaining_amount = Math.max(0, (ord.total_amount || 0) - ord.paid_amount);
        ord.balance_due = ord.remaining_amount;

        if (amt > 0) {
          const invNum = `INV-${_invoiceCounter++}`;
          mockSales.unshift({
            id: Date.now(),
            invoice: invNum,
            sale_date: new Date().toISOString(),
            total: amt,
            subtotal: parseFloat((amt / 1.15).toFixed(2)),
            tax: parseFloat((amt - amt / 1.15).toFixed(2)),
            paid: amt,
            balance: 0,
            status: 'paid',
            customer_id: ord.customer_id || null,
            customer_name: ord.customer_name || 'عميل تفصيل',
            customer_phone: ord.customer_phone || '',
            payment: payment_method,
            payment_method: payment_method,
            clearance_status: 'reported',
            items: [{
              id: `pay_${ord.id}`,
              Name: `دفعة طلب تفصيل #${ord.id}`,
              Price: amt,
              Qty: 1,
              Total: amt,
              Category: 'تفصيل'
            }],
            items_json: JSON.stringify([{
              id: `pay_${ord.id}`,
              Name: `دفعة طلب تفصيل #${ord.id}`,
              Price: amt,
              Qty: 1,
              Total: amt,
              Category: 'تفصيل'
            }]),
            tailor_order_id: ord.id
          });
        }
      }
      return { success: true };
    },
    getMeasurements: async (filter) => {
      const cid = typeof filter === 'object' ? filter?.customer_id : filter;
      if (cid) {
        return mockMeasurements.filter(m => m.customer_id === cid);
      }
      return mockMeasurements;
    },
    getProfiles: async (customerId) => {
      const cid = typeof customerId === 'object' ? customerId?.customer_id : customerId;
      if (cid) {
        return mockMeasurements.filter(m => m.customer_id === cid);
      }
      return mockMeasurements;
    },
    saveProfile: async (data) => {
      const newProf = {
        id: Date.now(),
        customer_id: data.customer_id,
        name: data.profile_name || data.name || data.garment_type || 'مقاس جديد',
        garment_type: data.garment_type || 'thobe',
        measurements: data.measurements || {},
        config: data.config || {},
        notes: data.notes || '',
        updated_at: new Date().toISOString()
      };
      mockMeasurements.unshift(newProf);
      return { success: true, id: newProf.id };
    },
    getAlterations: async () => mockAlterations,
    createAlteration: async (payload) => {
      const alt = {
        id: Date.now(),
        ticket_number: `ALT-${Math.floor(100 + Math.random() * 900)}`,
        ...payload,
        status: payload.status || 'pending',
        created_at: new Date().toISOString()
      };
      mockAlterations.unshift(alt);
      return { success: true, id: alt.id };
    },
    updateAlterationStatus: async ({ ticket_id, status }) => {
      const a = mockAlterations.find(x => x.id === ticket_id || String(x.id) === String(ticket_id));
      if (a) a.status = status;
      return { success: true };
    },
    getAttachments: async (customerId) => [],
    saveAttachment: async (data) => ({ success: true, id: Date.now() }),
    getDashboardStats: async () => ({
      inProgress: mockTailorOrders.filter(o => o.status !== 'delivered').length,
      activeOrders: mockTailorOrders.filter(o => o.status !== 'delivered').length,
      pendingAlterations: mockAlterations.filter(a => a.status !== 'delivered').length,
      totalMeasurements: mockMeasurements.length,
      total_orders: mockTailorOrders.length,
      cutting_count: mockTailorOrders.filter(o => o.status === 'cutting').length,
      sewing_count: mockTailorOrders.filter(o => o.status === 'sewing' || o.status === 'stitching').length,
      ready_count: mockTailorOrders.filter(o => o.status === 'ready').length,
      delivered_count: mockTailorOrders.filter(o => o.status === 'delivered').length,
      urgent_count: mockTailorOrders.filter(o => o.is_urgent === 1).length,
    })
  },

  // ── Financial Reports & Dashboards ───────────────────────────────
  getFinancialReport: async (range = {}) => {
    let sales = mockSales.filter(s => s.status !== 'void');
    if (range.startDate) sales = sales.filter(s => s.sale_date >= range.startDate);
    if (range.endDate) sales = sales.filter(s => s.sale_date.split('T')[0] <= range.endDate);

    const totalSales = sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const vatOutput = sales.reduce((sum, s) => sum + (parseFloat(s.tax) || (parseFloat(s.total) * 0.15 / 1.15)), 0);
    const taxableAmount = Math.max(0, totalSales - vatOutput);

    let expenses = mockExpenditures;
    if (range.startDate) expenses = expenses.filter(e => !e.expense_date || e.expense_date >= range.startDate);
    if (range.endDate) expenses = expenses.filter(e => !e.expense_date || e.expense_date <= range.endDate);
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const grossProfit = totalSales - totalExpenses;
    const netProfit = grossProfit;
    const grossMarginPct = totalSales > 0 ? parseFloat(((grossProfit / totalSales) * 100).toFixed(1)) : 0;
    const netMarginPct = totalSales > 0 ? parseFloat(((netProfit / totalSales) * 100).toFixed(1)) : 0;

    const itemMap = {};
    sales.forEach(s => {
      (s.items || []).forEach(it => {
        const name = it.Name || it.name || it.item_name || 'منتج';
        const qty = parseFloat(it.Qty || it.qty || 1);
        const rev = parseFloat(it.Total || it.total || (it.Price * qty) || 0);
        if (!itemMap[name]) itemMap[name] = { item_name: name, qtySold: 0, itemRevenue: 0 };
        itemMap[name].qtySold += qty;
        itemMap[name].itemRevenue += rev;
      });
    });

    const topProducts = Object.values(itemMap).sort((a, b) => b.itemRevenue - a.itemRevenue);
    if (topProducts.length === 0) {
      topProducts.push(
        { item_name: 'تفصيل ثوب رجالي فاخر', qtySold: 6, itemRevenue: 960 },
        { item_name: 'قماش ياباني تترون سوبر فاخر', qtySold: 4, itemRevenue: 260 }
      );
    }

    return {
      totalSales: parseFloat(totalSales.toFixed(2)),
      vatOutput: parseFloat(vatOutput.toFixed(2)),
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      expenses: parseFloat(totalExpenses.toFixed(2)),
      grossMarginPct,
      netMarginPct,
      topProducts: topProducts.slice(0, 5),
      recentSales: sales.slice(0, 8),
    };
  },
  getYesterdayStats: async () => {
    const yestDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yestSales = mockSales.filter(s => s.status !== 'void' && s.sale_date.startsWith(yestDate));
    const total = yestSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    return { sales: total > 0 ? total : 2150.0, expenses: 180.0 };
  },
  getFinancialTimeline: async () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dStr = d.toISOString().split('T')[0];
      const daySales = mockSales.filter(s => s.status !== 'void' && s.sale_date.startsWith(dStr));
      const dayTotal = daySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      days.push({
        period: d.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric' }),
        total_sales: dayTotal > 0 ? dayTotal : Math.round(1200 + (6 - i) * 350),
        total_expenses: 120 + i * 25,
      });
    }
    return days;
  },
  getVATReport: async () => {
    const validSales = mockSales.filter(s => s.status !== 'void');
    const totalSales = validSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const vatOutput = validSales.reduce((sum, s) => sum + (parseFloat(s.tax) || (parseFloat(s.total) * 0.15 / 1.15)), 0);
    const taxableAmount = Math.max(0, totalSales - vatOutput);
    return {
      invoiceCount: validSales.length,
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      vatOutput: parseFloat(vatOutput.toFixed(2)),
      vatInput: 150.0,
      netVAT: parseFloat((vatOutput - 150.0).toFixed(2))
    };
  },

  // ── Customers ────────────────────────────────────────────────────
  getCustomers: async (query) => {
    if (query?.id) return mockCustomers.filter(c => c.id === query.id);
    if (query?.search) {
      const s = String(query.search).toLowerCase();
      return mockCustomers.filter(c => (c.name && c.name.includes(s)) || (c.phone && c.phone.includes(s)));
    }
    return mockCustomers;
  },
  addCustomer: async (d) => {
    const cust = { id: Date.now(), loyalty_points: 0, tax_id: '', ...d };
    mockCustomers.push(cust);
    return { id: cust.id, success: true, ...cust };
  },
  updateCustomer: async (d) => {
    const idx = mockCustomers.findIndex(c => c.id === d.id);
    if (idx !== -1) Object.assign(mockCustomers[idx], d);
    return { success: true };
  },
  deleteCustomer: async (id) => {
    const idx = mockCustomers.findIndex(c => c.id === id);
    if (idx !== -1) mockCustomers.splice(idx, 1);
    return { success: true };
  },

  // ── Expenditures ─────────────────────────────────────────────────
  getExpenditures: async () => mockExpenditures,
  addExpenditure:    async (d)  => {
    const exp = { id: Date.now(), ...d, expense_date: d.expense_date || new Date().toISOString().split('T')[0] };
    mockExpenditures.unshift(exp);
    return { id: exp.id, success: true, ...exp };
  },
  deleteExpenditure: async (id) => {
    const idx = mockExpenditures.findIndex(e => e.id === id);
    if (idx !== -1) mockExpenditures.splice(idx, 1);
    return { success: true };
  },

  // ── Promotions ───────────────────────────────────────────────────
  getPromotions: async () => [
    { id: 1, name: 'خصم 10% على تفصيل أكثر من ثوبين', type: 'TOTAL', min_spend: 300, discount_type: 'pct', discount_value: 10, active: 1 },
    { id: 2, name: 'تفصيل ثوبين والثالث خصم 50%', type: 'BOGO', buy_product_id: 201, buy_qty: 2, get_qty: 1, active: 1 },
  ],
  addPromotion:    async (d)  => ({ id: Date.now(), success: true }),
  updatePromotion: async (d)  => ({ success: true }),
  deletePromotion: async (id) => ({ success: true }),

  // ── Hardware & Printing ──────────────────────────────────────────
  getSyncStatus: async () => ({ status: 'online', lastSync: new Date().toISOString() }),
  forceSync:     async ()  => ({ success: true }),
  getPrinters: async () => [
    { name: 'طابعة الإيصالات والفواتير - حرارية', id: 'thermal-usb' },
    { name: 'طابعة الباركود وبطاقات المقاسات', id: 'barcode-label' },
  ],
  printHTML: async (html) => {
    console.log('[mockApi] printHTML triggered');
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn('[mockApi] iframe print error:', e);
        }
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) {}
        }, 2000);
      }, 400);
      return { success: true };
    } catch (e) {
      console.warn('[mockApi] printHTML failed:', e);
      return { success: false, error: e.message };
    }
  },
  printHTMLSilent: async (data) => {
    const html = typeof data === 'object' && data?.html ? data.html : data;
    return window.api.printHTML(html);
  },
  printLabel: async (d) => ({ success: true }),

  // ── Accounting Subsystem (acct) ──────────────────────────────────
  acct: {
    getAccountsHierarchical: async () => [
      { id: 1, code: '1000', name: 'الأصول', type: 'asset', children: [
        { id: 11, code: '1100', name: 'النقد وما في حكمه', children: [
          { id: 111, code: '1101', name: 'الصندوق الرئيسي', balance: 4500 },
          { id: 112, code: '1102', name: 'حساب بنك الراجحي', balance: 35200 }
        ]}
      ]},
      { id: 2, code: '4000', name: 'الإيرادات', type: 'revenue', children: [
        { id: 21, code: '4101', name: 'إيرادات تفصيل الملابس', balance: 42300 },
        { id: 22, code: '4102', name: 'إيرادات مبيعات الأقمشة', balance: 18500 }
      ]},
    ],
    getBalanceSheet: async () => ({
      assets: 39700,
      liabilities: 8200,
      equity: 31500,
      as_of: new Date().toISOString()
    }),
    getCashFlow: async () => ({
      operating: 12400,
      investing: -3000,
      financing: 0,
      net: 9400
    }),
    getIncomeStatement: async () => ({
      revenue: 60800,
      cogs: 22500,
      grossProfit: 38300,
      expenses: 9400,
      netIncome: 28900
    }),
    getJournalEntries: async () => [
      { id: 1, jv_ref: 'JV-2026-001', date: '2026-04-01', description: 'رصيد افتتاح الصندوق', amount: 5000, status: 'posted' },
      { id: 2, jv_ref: 'JV-2026-002', date: '2026-04-05', description: 'إيراد مبيعات أسبوعية', amount: 8400, status: 'posted' }
    ],
    getPeriods: async () => [
      { id: 1, name: 'أبريل 2026', start_date: '2026-04-01', end_date: '2026-04-30', is_locked: 0 }
    ],
    hasOpeningBalances: async () => true,
    nextJvRef: async () => `JV-${new Date().getFullYear()}-003`,
    postJournalEntry: async (e) => ({ success: true, id: Date.now() }),
    savePeriod: async (p) => ({ success: true }),
    lockPeriod: async (id) => ({ success: true }),
    unlockPeriod: async (id) => ({ success: true }),
  },

  // ── Accounting P2 Subsystem (p2) ─────────────────────────────────
  p2: {
    getBreakEvenData: async () => ({
      fixedCosts: 8000,
      avgVariableCostRatio: 0.35,
      breakEvenRevenue: 12307,
      currentRevenue: 24500,
      marginOfSafety: 12193
    }),
    getInventoryCosting: async () => [
      { id: 101, name: 'قماش ياباني تترون سوبر فاخر', method: 'FIFO', qty: 500, unitCost: 30, totalValue: 15000 },
      { id: 102, name: 'قماش قطن كوري صيفي بارد',    method: 'FIFO', qty: 400, unitCost: 20, totalValue: 8000 },
    ],
    getDeferredRevenue: async () => [],
    getGLDrilldown: async () => [],
    getCostCentres: async () => [
      { id: 1, name: 'قسم التفصيل الرجالي', code: 'CC-01' },
      { id: 2, name: 'قسم التعديلات والترميم', code: 'CC-02' }
    ]
  },

  // ── Compliance (ZATCA Phase 1 & 2) ──────────────────────────────
  compliance: {
    exportVAT311: async () => ({ success: true }),
  },

  // ── Smart Assistant ──────────────────────────────────────────────
  assistant: {
    query: async (q) => ({ answer: 'نظام البصمة الذكية يعمل بكفاءة تامة وجاهز لتسجيل الطلبات والمبيعات.' }),
  },

  // ── Suppliers & Purchases ────────────────────────────────────────
  getSuppliers: async () => [
    { id: 1, name: 'شركة النخبة للأقمشة والمنسوجات', phone: '0123456789', email: 'info@elite-textiles.sa' },
    { id: 2, name: 'مؤسسة الغزل الذهبي للخيوط', phone: '0544332211', email: 'goldenyarn@sa.com' }
  ],
  addSupplier:    async (d)  => ({ id: Date.now(), success: true }),
  updateSupplier: async (d)  => ({ success: true }),
  deleteSupplier: async (id) => ({ success: true }),
  getPurchases: async () => [
    { id: 1, supplier_name: 'شركة النخبة للأقمشة', total: 4200, date: '2026-04-10', status: 'received' },
  ],
  addPurchase:    async (d)  => ({ id: Date.now(), success: true }),
  updatePurchase: async (d)  => ({ success: true }),

  // ── Tables (Restaurant Mode) ─────────────────────────────────────
  getTables: async () => [
    { id: 1, name: 'طاولة 1', capacity: 4, status: 'available' },
    { id: 2, name: 'طاولة 2', capacity: 6, status: 'occupied' },
    { id: 3, name: 'طاولة 3', capacity: 2, status: 'available' },
    { id: 4, name: 'طاولة 4', capacity: 4, status: 'reserved' },
  ],
  updateTableStatus: async () => ({ success: true }),

  // ── KDS ──────────────────────────────────────────────────────────
  getKDSOrders: async () => [
    { id: 1, label: 'طاولة 2', items: [{ Name: 'برجر دجاج', Qty: 2 }], kds_status: 'pending',  timestamp: new Date().toISOString() },
  ],
  updateKDSStatus: async () => ({ success: true }),

  // ── Stock History ────────────────────────────────────────────────
  getStockHistory: async (productId) => [
    { id: 1, product_id: productId, change_qty: -2, reason: 'sale',     note: 'INV-1001', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, product_id: productId, change_qty: 20, reason: 'purchase', note: 'شراء أقمشة من المورد', created_at: new Date(Date.now() - 86400000).toISOString() },
  ],

  // ── Audit Logs ───────────────────────────────────────────────────
  getAuditLogs: async () => [
    { id: 1, user_name: 'محمد العمري', action: 'تسجيل دخول للنظام', timestamp: new Date().toISOString() },
    { id: 2, user_name: 'محمد العمري', action: 'إنشاء طلب تفصيل ORD-2001', timestamp: new Date(Date.now() - 3600000).toISOString() }
  ],

  // ── WhatsApp Automation ──────────────────────────────────────────
  whatsapp: {
    getStatus: async () => ({ 
      connected: false, 
      qr: '2@DemoWhatsAppSessionKeyMockForPreviewApp_ScanWithWhatsAppOnMobileToPair',
      isMock: true 
    }),
    logout: async () => ({ success: true }),
    send: async ({ phone, text }) => {
      console.log('[mockApi whatsapp:send]', { phone, text });
      return { success: true };
    },
    sendHTML: async ({ phone, text, html }) => {
      console.log('[mockApi whatsapp:sendHTML]', { phone, text, hasHtml: !!html });
      return { success: true };
    },
    onStatus: (cb) => {
      // simulate connection status
      const timer = setTimeout(() => {
        cb({ connected: false, qr: '2@DemoWhatsAppSessionKeyMockForPreviewApp_ScanWithWhatsAppOnMobileToPair' });
      }, 500);
      return () => clearTimeout(timer);
    },
    onQr: (cb) => {
      const timer = setTimeout(() => {
        cb('2@DemoWhatsAppSessionKeyMockForPreviewApp_ScanWithWhatsAppOnMobileToPair');
      }, 500);
      return () => clearTimeout(timer);
    },
  },

  // ── Helpers ──────────────────────────────────────────────────────
  openExternal: (url) => {
    if (typeof window !== 'undefined') window.open(url, '_blank');
  },
  onSessionExpired: (cb) => () => {},
  onSyncNotify:     (cb) => () => {},
};

// ── Recursive Safe Proxy ───────────────────────────────────────────
// Guarantees that any unexpected or unmocked window.api method call returns
// a safe resolved promise rather than crashing the interface with TypeError.
function createSafeProxy(target) {
  return new Proxy(target, {
    get(obj, prop) {
      if (typeof prop === 'symbol') return obj[prop];
      if (prop in obj) {
        const val = obj[prop];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return createSafeProxy(val);
        }
        return val;
      }
      // If it looks like an event subscription (e.g. onSomething)
      if (prop.startsWith('on')) {
        return () => () => {};
      }
      // Otherwise default to an async no-op returning an empty collection or success,
      // wrapped in a callable Proxy so sub-property accesses like obj.whatsapp.getStatus don't throw.
      const fallbackFn = async (...args) => {
        console.warn(`[mockApi Proxy fallback] Called unmocked method: "${String(prop)}"`, args);
        if (String(prop).startsWith('get') || String(prop).startsWith('fetch') || String(prop).startsWith('list')) {
          return [];
        }
        return { success: true };
      };

      return new Proxy(fallbackFn, {
        get(fnTarget, subProp) {
          if (typeof subProp === 'symbol') return fnTarget[subProp];
          if (subProp.startsWith('on')) return () => () => {};
          return async (...args) => {
            console.warn(`[mockApi Proxy fallback] Called unmocked sub-method: "${String(prop)}.${String(subProp)}"`, args);
            return { success: true };
          };
        }
      });
    }
  });
}

const mockApi = createSafeProxy(rawMockApi);

export default mockApi;
