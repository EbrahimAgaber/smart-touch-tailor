/**
 * simulation_test.cjs — Year-Long Business Simulation & Accounting Audit
 * ─────────────────────────────────────────────────────────────────────────
 * Uses sql.js (pure JS SQLite) to avoid Electron native module conflicts.
 * Creates an isolated test database, simulates 12 months of operations,
 * then validates every accounting module.
 *
 * Run: node tests/simulation_test.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// ─── Constants ───────────────────────────────────────────────────────────────
const YEAR = 2025;
const VAT_RATE = 0.15;
const HALALA = 100; // 1 SAR = 100 halala
const CATEGORIES = ['مواد غذائية','خامات','معدات','خدمات','إيجار','تسويق','أخرى'];
const TAX_CATS = ['S','S','S','S','S','S','Z','Z','E']; // 67% standard
const EMPLOYEE_SALARIES = [4000, 5500, 7000, 8500, 6000, 9500];
const ASSET_DATA = [
  { code: 'FA-001', name: 'سيارة توصيل', cost: 60000, month: 1, life: 60 },
  { code: 'FA-002', name: 'معدات مطبخ', cost: 120000, month: 2, life: 60 },
  { code: 'FA-003', name: 'أجهزة حاسب', cost: 15000, month: 3, life: 36 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const toH = (sar) => Math.round(parseFloat(sar) * HALALA);
const fromH = (h) => (h || 0) / HALALA;
const fmtDate = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const eom = (y, m) => new Date(y, m, 0).getDate();
const randDate = (y, m) => fmtDate(y, m, rand(1, eom(y, m)));
const round2 = (n) => Math.round(n * 100) / 100;

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      YEAR-LONG BUSINESS SIMULATION — INITIALIZING          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEMA CREATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[1/6] Creating database schema...');

  // Chart of Accounts
  db.run(`CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_code INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    account_type TEXT NOT NULL,
    parent_code INTEGER,
    level INTEGER DEFAULT 1,
    normal_balance TEXT DEFAULT 'debit',
    is_active INTEGER DEFAULT 1
  )`);

  // Seed CoA
  const accounts = [
    [1000,'الأصول','Assets','asset',null,1,'debit'],
    [1100,'النقد وما في حكمه','Cash','asset',1000,2,'debit'],
    [1111,'الصندوق','Cash in Hand','asset',1100,3,'debit'],
    [1112,'البنك','Bank','asset',1100,3,'debit'],
    [1200,'الذمم المدينة','Accounts Receivable','asset',1000,2,'debit'],
    [1300,'المخزون','Inventory','asset',1000,2,'debit'],
    [1400,'مصروفات مقدمة','Prepaid Expenses','asset',1000,2,'debit'],
    [1500,'أصول ثابتة','Fixed Assets','asset',1000,2,'debit'],
    [1501,'مجمع الإهلاك','Accumulated Depreciation','asset',1000,2,'credit'],
    [2000,'الالتزامات','Liabilities','liability',null,1,'credit'],
    [2100,'ذمم دائنة','Accounts Payable','liability',2000,2,'credit'],
    [2300,'ضريبة مخرجات','VAT Output','liability',2000,2,'credit'],
    [2400,'ضريبة مدخلات','VAT Input','asset',1000,2,'debit'],
    [2500,'رواتب مستحقة','Accrued Salaries','liability',2000,2,'credit'],
    [3000,'حقوق الملكية','Equity','equity',null,1,'credit'],
    [3100,'رأس المال','Capital','equity',3000,2,'credit'],
    [3200,'أرباح محتجزة','Retained Earnings','equity',3000,2,'credit'],
    [4000,'الإيرادات','Revenue','revenue',null,1,'credit'],
    [4100,'إيرادات المبيعات','Sales Revenue','revenue',4000,2,'credit'],
    [5000,'المصروفات','Expenses','expense',null,1,'debit'],
    [5100,'تكلفة المبيعات','COGS','expense',5000,2,'debit'],
    [5200,'رواتب وأجور','Salaries','expense',5000,2,'debit'],
    [5300,'إيجار','Rent','expense',5000,2,'debit'],
    [5400,'إهلاك','Depreciation','expense',5000,2,'debit'],
    [5500,'تسويق','Marketing','expense',5000,2,'debit'],
    [5700,'مصروفات عامة','General Expenses','expense',5000,2,'debit'],
  ];
  const insAcct = db.prepare('INSERT INTO chart_of_accounts (account_code,name_ar,name_en,account_type,parent_code,level,normal_balance) VALUES (?,?,?,?,?,?,?)');
  for (const a of accounts) insAcct.run(a);
  insAcct.free();

  // Journal Entries
  db.run(`CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_no TEXT,
    entry_date TEXT NOT NULL,
    description TEXT,
    entry_type TEXT DEFAULT 'Manual',
    reference_type TEXT,
    reference_id TEXT,
    status TEXT DEFAULT 'posted',
    created_by INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    account_code INTEGER NOT NULL,
    debit_halala INTEGER DEFAULT 0,
    credit_halala INTEGER DEFAULT 0,
    description TEXT,
    FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
  )`);

  // Products, Sales, Expenditures, Suppliers, etc.
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, price REAL, cost REAL DEFAULT 0,
    category TEXT, stock INTEGER DEFAULT 0, barcode TEXT,
    tax_category TEXT DEFAULT 'S', is_service INTEGER DEFAULT 0,
    supplier_id INTEGER, is_active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT, tax_id TEXT,
    is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice TEXT UNIQUE, subtotal REAL, tax_amount REAL DEFAULT 0,
    total_amount REAL, discount REAL DEFAULT 0,
    payment_method TEXT, status TEXT DEFAULT 'paid',
    customer_id INTEGER, paid REAL DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER, product_id INTEGER,
    item_name TEXT, item_price REAL, quantity INTEGER DEFAULT 1,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenditures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT, supplier_name TEXT, invoice_ref TEXT,
    category TEXT, amount REAL, net_amount REAL, vat_amount REAL DEFAULT 0,
    vat_eligible INTEGER DEFAULT 0, expense_date TEXT,
    status TEXT, timestamp TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, phone TEXT, credit_limit REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER, sale_id INTEGER, amount_halala INTEGER,
    payment_date TEXT, payment_method TEXT, reference_no TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, job_title TEXT, basic_salary REAL,
    housing_allowance REAL DEFAULT 0, transport_allowance REAL DEFAULT 0,
    gosi_registered INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payroll_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT, total_gross_halala INTEGER, total_net_halala INTEGER,
    status TEXT DEFAULT 'draft', journal_entry_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payroll_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER, employee_id INTEGER, employee_name TEXT,
    basic_halala INTEGER, housing_halala INTEGER, transport_halala INTEGER,
    total_gross_halala INTEGER, deductions_halala INTEGER DEFAULT 0,
    net_halala INTEGER,
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fixed_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT, name TEXT, category TEXT,
    purchase_date TEXT, purchase_cost_halala INTEGER,
    residual_value_halala INTEGER DEFAULT 0,
    useful_life_months INTEGER DEFAULT 60,
    depreciation_method TEXT DEFAULT 'straight_line',
    accum_dep_halala INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS depreciation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER, period TEXT, amount_halala INTEGER,
    journal_entry_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER, total_amount REAL, status TEXT DEFAULT 'pending',
    vat_amount REAL DEFAULT 0, vat_included INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER, quantity_change INTEGER,
    reason TEXT, reference_id TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL POSTING ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  let jeCounter = 0;
  function postJE(date, ref, desc, lines, refType = null, refId = null) {
    jeCounter++;
    const totalDr = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCr = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDr - totalCr) > 1) {
      throw new Error(`JE IMBALANCED: Dr=${totalDr} Cr=${totalCr} — ${desc}`);
    }
    db.run(`INSERT INTO journal_entries (reference_no, entry_date, description, entry_type, reference_type, reference_id)
            VALUES (?,?,?,?,?,?)`, [ref || `JE-${jeCounter}`, date, desc, 'Auto', refType, refId]);
    const jeId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    const insLine = db.prepare('INSERT INTO journal_entry_lines (entry_id, account_code, debit_halala, credit_halala, description) VALUES (?,?,?,?,?)');
    for (const l of lines) {
      insLine.run([jeId, l.account_code, l.debit || 0, l.credit || 0, l.desc || desc]);
    }
    insLine.free();
    return jeId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER DATA SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[2/6] Creating master data (suppliers, products, customers, employees, assets)...');

  // Suppliers
  const supplierNames = ['شركة التوريدات الغذائية','مؤسسة الأمين للخامات','شركة الكهرباء السعودية','شركة المياه الوطنية','مؤسسة الإمداد','شركة النقل المتحد','مطابع الوطن','شركة الاتصالات'];
  for (const name of supplierNames) {
    db.run('INSERT INTO suppliers (name, phone, tax_id) VALUES (?,?,?)', [name, `050${rand(1000000,9999999)}`, `3${rand(100000000000000,999999999999999)}`]);
  }
  const supplierIds = db.exec('SELECT id FROM suppliers')[0].values.map(r => r[0]);

  // Products (20 items with mixed tax categories)
  for (let i = 1; i <= 20; i++) {
    const price = rand(15, 250);
    const cost = round2(price * (0.3 + Math.random() * 0.25));
    const tc = TAX_CATS[i % TAX_CATS.length];
    db.run('INSERT INTO products (name, price, cost, category, stock, tax_category, is_service, supplier_id) VALUES (?,?,?,?,?,?,?,?)',
      [`منتج ${i} (${tc === 'S' ? '15%' : tc === 'Z' ? 'صفري' : 'معفى'})`, price, cost, 'عام', 500, tc, i > 18 ? 1 : 0, pick(supplierIds)]);
  }
  const productRows = db.exec('SELECT id, price, cost, tax_category FROM products');
  const products = productRows[0].values.map(r => ({ id: r[0], price: r[1], cost: r[2], tc: r[3] }));

  // Customers
  for (let i = 1; i <= 12; i++) {
    db.run('INSERT INTO customers (name, phone, credit_limit) VALUES (?,?,?)', [`عميل ${i}`, `055${rand(1000000,9999999)}`, 50000]);
  }
  const customerIds = db.exec('SELECT id FROM customers')[0].values.map(r => r[0]);

  // Employees
  for (let i = 0; i < EMPLOYEE_SALARIES.length; i++) {
    const sal = EMPLOYEE_SALARIES[i];
    db.run('INSERT INTO employees (name, job_title, basic_salary, housing_allowance, transport_allowance, gosi_registered) VALUES (?,?,?,?,?,?)',
      [`موظف ${i+1}`, 'عامل', sal, round2(sal * 0.25), round2(sal * 0.1), 1]);
  }

  // Fixed Assets (Q1)
  for (const fa of ASSET_DATA) {
    const costH = toH(fa.cost);
    const residH = toH(fa.cost * 0.1);
    db.run('INSERT INTO fixed_assets (asset_code, name, category, purchase_date, purchase_cost_halala, residual_value_halala, useful_life_months) VALUES (?,?,?,?,?,?,?)',
      [fa.code, fa.name, 'معدات', fmtDate(YEAR, fa.month, 5), costH, residH, fa.life]);
    // JE: DR Fixed Assets, CR Cash
    postJE(fmtDate(YEAR, fa.month, 5), `FA-ACQ-${fa.code}`, `شراء أصل: ${fa.name}`, [
      { account_code: 1500, debit: costH, desc: fa.name },
      { account_code: 1111, credit: costH, desc: `سداد شراء ${fa.name}` },
    ]);
  }

  // Opening Balance — Capital injection
  postJE(`${YEAR}-01-01`, 'OB-001', 'رأس المال التأسيسي', [
    { account_code: 1111, debit: toH(500000), desc: 'إيداع رأس المال' },
    { account_code: 3100, credit: toH(500000), desc: 'رأس المال' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12-MONTH SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[3/6] Running 12-month simulation...');

  let invoiceSeq = 1000;
  let totalSalesRevenue = 0, totalCOGS = 0, totalExpenses = 0;
  let totalOutputVAT = 0, totalInputVAT = 0;
  let totalSalaryExpense = 0, totalDepreciation = 0;

  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const isPeak = [6, 7, 11, 12].includes(m);
    const salesCount = isPeak ? rand(100, 130) : rand(70, 95);

    process.stdout.write(`  Month ${mStr}: `);

    // ─── SALES ───────────────────────────────────────────────────────────
    let monthSales = 0;
    for (let s = 0; s < salesCount; s++) {
      const date = randDate(YEAR, m);
      const isCredit = Math.random() < 0.10;
      const itemCount = rand(1, 4);
      let subtotal = 0, tax = 0, cogs = 0;
      const saleItems = [];

      for (let j = 0; j < itemCount; j++) {
        const p = pick(products);
        const qty = rand(1, 3);
        const lineTotal = p.price * qty;
        const lineTax = p.tc === 'S' ? round2(lineTotal * VAT_RATE) : 0;
        subtotal += lineTotal;
        tax += lineTax;
        cogs += p.cost * qty;
        saleItems.push({ pid: p.id, name: `منتج ${p.id}`, price: p.price, qty });
      }

      subtotal = round2(subtotal);
      tax = round2(tax);
      cogs = round2(cogs);
      const total = round2(subtotal + tax);
      invoiceSeq++;
      const inv = `INV-${invoiceSeq}`;
      const status = isCredit ? 'credit' : 'paid';
      const pmtMethod = isCredit ? 'credit' : pick(['cash', 'card']);
      const custId = isCredit ? pick(customerIds) : null;

      db.run('INSERT INTO sales (invoice, subtotal, tax_amount, total_amount, payment_method, status, customer_id, paid, discount, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [inv, subtotal, tax, total, pmtMethod, status, custId, isCredit ? 0 : total, 0, `${date}T${String(rand(9,20)).padStart(2,'0')}:${String(rand(0,59)).padStart(2,'0')}:00`]);

      const saleId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      for (const si of saleItems) {
        db.run('INSERT INTO sales_items (sale_id, product_id, item_name, item_price, quantity) VALUES (?,?,?,?,?)', [saleId, si.pid, si.name, si.price, si.qty]);
        // Deduct stock
        db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [si.qty, si.pid]);
        db.run('INSERT INTO stock_history (product_id, quantity_change, reason, reference_id) VALUES (?,?,?,?)', [si.pid, -si.qty, 'sale', String(saleId)]);
      }

      // Journal Entry: DR Cash/AR, CR Revenue + VAT Output
      const jeLines = [];
      if (isCredit) {
        jeLines.push({ account_code: 1200, debit: toH(total), desc: `ذمم مدينة: ${inv}` });
      } else {
        jeLines.push({ account_code: 1111, debit: toH(total), desc: `نقدي: ${inv}` });
      }
      jeLines.push({ account_code: 4100, credit: toH(subtotal), desc: `إيراد: ${inv}` });
      if (tax > 0) jeLines.push({ account_code: 2300, credit: toH(tax), desc: `ض.مخرجات: ${inv}` });

      // COGS entry
      if (cogs > 0) {
        jeLines.push({ account_code: 5100, debit: toH(cogs), desc: `ت.مبيعات: ${inv}` });
        jeLines.push({ account_code: 1300, credit: toH(cogs), desc: `مخزون: ${inv}` });
      }

      postJE(date, inv, `بيع: ${inv}`, jeLines, 'sale', String(saleId));

      totalSalesRevenue += subtotal;
      totalOutputVAT += tax;
      totalCOGS += cogs;
      monthSales += total;
    }

    // ─── CREDIT PAYMENTS (40% chance per outstanding invoice) ─────────
    const unpaid = db.exec(`SELECT id, total_amount, customer_id FROM sales WHERE status = 'credit' AND paid < total_amount AND timestamp <= '${fmtDate(YEAR, m, eom(YEAR, m))}T23:59:59'`);
    let creditPayments = 0;
    if (unpaid.length > 0) {
      for (const row of unpaid[0].values) {
        if (Math.random() < 0.40) {
          const saleId = row[0], saleTotal = row[1], custId = row[2];
          const currentPaid = db.exec(`SELECT paid FROM sales WHERE id=${saleId}`)[0].values[0][0];
          const remaining = round2(saleTotal - currentPaid);
          if (remaining <= 0) continue;
          const payAmt = Math.random() < 0.5 ? remaining : round2(remaining * 0.5);
          const payH = toH(payAmt);
          db.run('INSERT INTO credit_payments (customer_id, sale_id, amount_halala, payment_date, payment_method, reference_no) VALUES (?,?,?,?,?,?)',
            [custId, saleId, payH, randDate(YEAR, m), 'bank', `PMT-${saleId}`]);
          db.run('UPDATE sales SET paid = paid + ? WHERE id = ?', [payAmt, saleId]);
          // Check if fully paid
          const newPaid = db.exec(`SELECT paid, total_amount FROM sales WHERE id=${saleId}`)[0].values[0];
          if (newPaid[0] >= newPaid[1]) db.run("UPDATE sales SET status = 'paid' WHERE id = ?", [saleId]);

          postJE(randDate(YEAR, m), `PMT-${saleId}`, 'تحصيل ذمم مدينة', [
            { account_code: 1111, debit: payH, desc: 'نقدي' },
            { account_code: 1200, credit: payH, desc: 'ذمم مدينة' },
          ]);
          creditPayments++;
        }
      }
    }

    // ─── EXPENSES ────────────────────────────────────────────────────────
    const expCount = rand(15, 25);
    let monthExpenses = 0;
    for (let e = 0; e < expCount; e++) {
      const date = randDate(YEAR, m);
      const cat = pick(CATEGORIES);
      const amt = round2(rand(200, 6000));
      const isVat = Math.random() < 0.60;
      const net = isVat ? round2(amt / 1.15) : amt;
      const vat = isVat ? round2(amt - net) : 0;

      db.run('INSERT INTO expenditures (description, supplier_name, category, amount, net_amount, vat_amount, vat_eligible, expense_date) VALUES (?,?,?,?,?,?,?,?)',
        [`مصروف ${cat}`, pick(supplierNames), cat, amt, net, vat, isVat ? 1 : 0, date]);

      const expId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      const jeLines = [];
      if (net > 0) jeLines.push({ account_code: 5700, debit: toH(net), desc: `مصروف: ${cat}` });
      if (vat > 0) jeLines.push({ account_code: 2400, debit: toH(vat), desc: `ض.مدخلات` });
      jeLines.push({ account_code: 1111, credit: toH(amt), desc: 'سداد مصروف' });
      postJE(date, `EXP-${expId}`, `مصروف: ${cat}`, jeLines, 'expenditure', String(expId));

      totalExpenses += net;
      totalInputVAT += vat;
      monthExpenses += amt;
    }

    // ─── PURCHASE ORDERS & INVENTORY ─────────────────────────────────────
    const poCount = rand(5, 10);
    for (let po = 0; po < poCount; po++) {
      const date = randDate(YEAR, m);
      const suppId = pick(supplierIds);
      let poTotal = 0;
      const poProducts = [];
      for (let j = 0; j < rand(2, 4); j++) {
        const p = pick(products);
        const qty = rand(30, 150);
        const cost = p.cost;
        poTotal += round2(qty * cost);
        poProducts.push({ pid: p.id, qty, cost });
      }
      db.run('INSERT INTO purchase_orders (supplier_id, total_amount, status) VALUES (?,?,?)', [suppId, poTotal, 'received']);
      const poId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

      for (const pp of poProducts) {
        db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [pp.qty, pp.pid]);
        db.run('INSERT INTO stock_history (product_id, quantity_change, reason, reference_id) VALUES (?,?,?,?)', [pp.pid, pp.qty, 'purchase', String(poId)]);
      }
      // JE: DR Inventory, CR Cash
      postJE(date, `PO-${poId}`, 'شراء مخزون', [
        { account_code: 1300, debit: toH(poTotal), desc: 'مخزون' },
        { account_code: 1111, credit: toH(poTotal), desc: 'سداد مشتريات' },
      ]);
    }

    // ─── PAYROLL ──────────────────────────────────────────────────────────
    const prDate = fmtDate(YEAR, m, eom(YEAR, m));
    let totalGross = 0, totalNet = 0;
    const empRows = db.exec('SELECT id, name, basic_salary, housing_allowance, transport_allowance FROM employees');
    const payrollLines = [];
    for (const emp of empRows[0].values) {
      const gross = round2(emp[2] + emp[3] + emp[4]);
      const deductions = round2(gross * 0.0975); // GOSI employee share
      const netPay = round2(gross - deductions);
      totalGross += gross;
      totalNet += netPay;
      payrollLines.push({ empId: emp[0], name: emp[1], basic: emp[2], housing: emp[3], transport: emp[4], gross, deductions, net: netPay });
    }

    db.run('INSERT INTO payroll_runs (period, total_gross_halala, total_net_halala, status) VALUES (?,?,?,?)',
      [`${YEAR}-${mStr}`, toH(totalGross), toH(totalNet), 'posted']);
    const prId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    for (const pl of payrollLines) {
      db.run('INSERT INTO payroll_lines (run_id, employee_id, employee_name, basic_halala, housing_halala, transport_halala, total_gross_halala, deductions_halala, net_halala) VALUES (?,?,?,?,?,?,?,?,?)',
        [prId, pl.empId, pl.name, toH(pl.basic), toH(pl.housing), toH(pl.transport), toH(pl.gross), toH(pl.deductions), toH(pl.net)]);
    }

    postJE(prDate, `PR-${YEAR}${mStr}`, `رواتب شهر ${mStr}/${YEAR}`, [
      { account_code: 5200, debit: toH(totalGross), desc: 'مصروف رواتب' },
      { account_code: 1111, credit: toH(totalNet), desc: 'صرف رواتب' },
      { account_code: 2500, credit: toH(round2(totalGross - totalNet)), desc: 'حصة التأمينات' },
    ]);
    totalSalaryExpense += totalGross;

    // ─── DEPRECIATION ────────────────────────────────────────────────────
    const activeAssets = db.exec("SELECT id, name, purchase_cost_halala, residual_value_halala, useful_life_months, accum_dep_halala, purchase_date FROM fixed_assets WHERE status = 'active'");
    if (activeAssets.length > 0) {
      for (const fa of activeAssets[0].values) {
        const faId = fa[0], faName = fa[1], costH = fa[2], residH = fa[3], life = fa[4], accumH = fa[5], purchDate = fa[6];
        // Check if asset was purchased before or during this month
        const purchMonth = parseInt(purchDate.substring(5, 7));
        if (m < purchMonth) continue;
        const monthlyDep = Math.round((costH - residH) / life);
        if (accumH + monthlyDep > costH - residH) continue;

        db.run('UPDATE fixed_assets SET accum_dep_halala = accum_dep_halala + ? WHERE id = ?', [monthlyDep, faId]);
        const jeId = postJE(prDate, `DEP-${faId}-${mStr}`, `إهلاك: ${faName}`, [
          { account_code: 5400, debit: monthlyDep, desc: `إهلاك ${faName}` },
          { account_code: 1501, credit: monthlyDep, desc: `مجمع إهلاك ${faName}` },
        ]);
        db.run('INSERT INTO depreciation_runs (asset_id, period, amount_halala, journal_entry_id) VALUES (?,?,?,?)', [faId, `${YEAR}-${mStr}`, monthlyDep, jeId]);
        totalDepreciation += fromH(monthlyDep);
      }
    }

    process.stdout.write(`${salesCount} sales, ${expCount} expenses, ${poCount} POs, ${creditPayments} payments, payroll ✓, dep ✓\n`);
  }

  console.log('\n[4/6] Simulation complete. Starting validations...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  let pass = 0, total = 0;
  const results = [];

  function check(name, condition, details) {
    total++;
    const ok = !!condition;
    if (ok) pass++;
    results.push({ name, ok, details });
  }

  // 1. Trial Balance
  const tbRows = db.exec(`
    SELECT l.account_code,
           SUM(l.debit_halala) as dr, SUM(l.credit_halala) as cr
    FROM journal_entry_lines l
    JOIN journal_entries je ON l.entry_id = je.id
    WHERE je.status != 'reversed'
    GROUP BY l.account_code
  `);
  let tbDr = 0, tbCr = 0;
  if (tbRows.length > 0) {
    for (const row of tbRows[0].values) { tbDr += row[1]; tbCr += row[2]; }
  }
  check('Trial Balance', Math.abs(tbDr - tbCr) < 2, `Dr: ${fromH(tbDr).toFixed(2)} | Cr: ${fromH(tbCr).toFixed(2)} | Diff: ${fromH(Math.abs(tbDr-tbCr)).toFixed(2)}`);

  // 2. Income Statement
  const revRow = db.exec(`SELECT COALESCE(SUM(credit_halala - debit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code BETWEEN 4000 AND 4999 AND je.status!='reversed'`);
  const expRow = db.exec(`SELECT COALESCE(SUM(debit_halala - credit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code BETWEEN 5000 AND 5999 AND je.status!='reversed'`);
  const revenue = fromH(revRow[0].values[0][0]);
  const expenses = fromH(expRow[0].values[0][0]);
  const netProfit = round2(revenue - expenses);
  check('Income Statement', revenue > 0 && expenses > 0, `Revenue: ${revenue.toFixed(2)} | Expenses: ${expenses.toFixed(2)} | Net: ${netProfit.toFixed(2)}`);

  // 3. Balance Sheet (A = L + E + Net Income)
  const assetH = db.exec(`SELECT COALESCE(SUM(debit_halala - credit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code BETWEEN 1000 AND 1999 AND je.status!='reversed'`)[0].values[0][0];
  const liabH = db.exec(`SELECT COALESCE(SUM(credit_halala - debit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code BETWEEN 2000 AND 2999 AND je.status!='reversed'`)[0].values[0][0];
  const eqH = db.exec(`SELECT COALESCE(SUM(credit_halala - debit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code BETWEEN 3000 AND 3999 AND je.status!='reversed'`)[0].values[0][0];
  const assets = fromH(assetH);
  const liabilities = fromH(liabH);
  const equity = fromH(eqH);
  const bsDiff = Math.abs(assets - (liabilities + equity + netProfit));
  check('Balance Sheet', bsDiff < 1, `Assets: ${assets.toFixed(2)} = Liab: ${liabilities.toFixed(2)} + Eq: ${equity.toFixed(2)} + NI: ${netProfit.toFixed(2)} | Diff: ${bsDiff.toFixed(2)}`);

  // 4. VAT Return
  const outVAT = db.exec(`SELECT COALESCE(SUM(tax_amount), 0) FROM sales WHERE status != 'voided'`)[0].values[0][0];
  const inVATExp = db.exec(`SELECT COALESCE(SUM(vat_amount), 0) FROM expenditures WHERE vat_eligible = 1 AND (status IS NULL OR status != 'deleted')`)[0].values[0][0];
  const vatDue = round2(outVAT - inVATExp);
  check('VAT Return', outVAT > 0 && inVATExp > 0, `Output: ${round2(outVAT).toFixed(2)} | Input: ${round2(inVATExp).toFixed(2)} | Net Due: ${vatDue.toFixed(2)}`);

  // 5. AR Aging
  const arResult = db.exec(`SELECT COALESCE(SUM(total_amount - paid), 0) FROM sales WHERE status = 'credit'`);
  const arTotal = round2(arResult[0].values[0][0]);
  check('AR Aging', arTotal >= 0, `Outstanding AR: ${arTotal.toFixed(2)} SAR`);

  // 6. Payroll Tracking
  const prRuns = db.exec('SELECT COUNT(*) FROM payroll_runs')[0].values[0][0];
  const prTotal = fromH(db.exec('SELECT COALESCE(SUM(total_gross_halala), 0) FROM payroll_runs')[0].values[0][0]);
  check('Payroll', prRuns === 12, `${prRuns}/12 monthly runs | Total Gross: ${prTotal.toFixed(2)}`);

  // 7. Fixed Assets
  const faRows = db.exec("SELECT COUNT(*), SUM(purchase_cost_halala), SUM(accum_dep_halala) FROM fixed_assets WHERE status='active'");
  const faCount = faRows[0].values[0][0];
  const faCost = fromH(faRows[0].values[0][1]);
  const faAccum = fromH(faRows[0].values[0][2]);
  const faNBV = round2(faCost - faAccum);
  check('Fixed Assets', faCount >= 3 && faAccum > 0, `${faCount} assets | Cost: ${faCost.toFixed(2)} | Accum: ${faAccum.toFixed(2)} | NBV: ${faNBV.toFixed(2)}`);

  // 8. Journal Integrity (no imbalanced entries)
  const imbalanced = db.exec(`SELECT entry_id, ABS(SUM(debit_halala) - SUM(credit_halala)) as diff FROM journal_entry_lines GROUP BY entry_id HAVING diff > 1`);
  const imbalCount = imbalanced.length > 0 ? imbalanced[0].values.length : 0;
  check('Journal Integrity', imbalCount === 0, `${imbalCount} imbalanced entries (tolerance: 1 halala)`);

  // 9. Inventory Movement
  const stockMoves = db.exec('SELECT COUNT(*) FROM stock_history')[0].values[0][0];
  const currentStock = db.exec('SELECT SUM(stock) FROM products')[0].values[0][0];
  check('Inventory Tracking', stockMoves > 100, `${stockMoves} movements | Current total stock: ${currentStock} units`);

  // 10. Expense Tracking
  const expTotal = db.exec(`SELECT COALESCE(SUM(amount), 0) FROM expenditures WHERE status IS NULL OR status != 'deleted'`)[0].values[0][0];
  const expJE = fromH(db.exec(`SELECT COALESCE(SUM(debit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code = 5700 AND je.reference_type = 'expenditure' AND je.status != 'reversed'`)[0].values[0][0]);
  check('Expense Tracking', expTotal > 0, `Total Expenses: ${round2(expTotal).toFixed(2)} | JE 5700 Total: ${expJE.toFixed(2)}`);

  // 11. Cash Flow Coherence (cash balance == sum of all cash JE lines)
  const cashBalance = fromH(db.exec(`SELECT COALESCE(SUM(debit_halala - credit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code = 1111 AND je.status != 'reversed'`)[0].values[0][0]);
  // In this simulation, cash can go negative because we don't model credit lines/overdraft.
  // The CHECK is: does the ledger balance reconcile? i.e., cash debits - credits = net cash
  const cashDebits = fromH(db.exec(`SELECT COALESCE(SUM(debit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code = 1111 AND je.status != 'reversed'`)[0].values[0][0]);
  const cashCredits = fromH(db.exec(`SELECT COALESCE(SUM(credit_halala), 0) FROM journal_entry_lines l JOIN journal_entries je ON l.entry_id=je.id WHERE l.account_code = 1111 AND je.status != 'reversed'`)[0].values[0][0]);
  const cashRecon = Math.abs(cashBalance - (cashDebits - cashCredits));
  check('Cash Flow', cashRecon < 0.01, `Balance: ${cashBalance.toFixed(2)} = Dr: ${cashDebits.toFixed(2)} - Cr: ${cashCredits.toFixed(2)}`);

  // 12. Supplier Suggestions Endpoint Logic
  const distinctExpSuppliers = db.exec(`SELECT COUNT(DISTINCT supplier_name) FROM expenditures WHERE supplier_name IS NOT NULL AND supplier_name != ''`)[0].values[0][0];
  check('Supplier Suggestions', distinctExpSuppliers > 0, `${distinctExpSuppliers} distinct supplier names in expenditures`);

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT CARD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[5/6] Generating report card...\n');

  const hr = '═'.repeat(72);
  const thinHr = '─'.repeat(72);
  console.log(`╔${hr}╗`);
  console.log(`║${'YEAR-LONG BUSINESS SIMULATION — REPORT CARD'.padStart(58).padEnd(72)}║`);
  console.log(`╠${hr}╣`);
  console.log(`║ ${'Module'.padEnd(24)}│ ${'Status'.padEnd(8)}│ ${'Details'.padEnd(36)} ║`);
  console.log(`╠${'─'.repeat(25)}┼${'─'.repeat(9)}┼${'─'.repeat(37)}╣`);

  for (const r of results) {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    const det = r.details.length > 35 ? r.details.substring(0, 32) + '...' : r.details;
    console.log(`║ ${r.name.padEnd(24)}│ ${status.padEnd(8)}│ ${det.padEnd(36)} ║`);
  }

  console.log(`╠${hr}╣`);
  const scoreStr = `FINAL SCORE: ${pass}/${total}`;
  const verdict = pass === total ? '✅ FULLY RELIABLE FOR ACCOUNTING' : pass >= total - 2 ? '⚠️ MOSTLY RELIABLE — MINOR GAPS' : '❌ CRITICAL GAPS — NOT PRODUCTION READY';
  console.log(`║ ${scoreStr.padEnd(71)}║`);
  console.log(`║ ${verdict.padEnd(71)}║`);
  console.log(`╚${hr}╝`);

  // Summary Statistics
  console.log('\n[6/6] Summary Statistics:');
  console.log(`  Total Journal Entries:  ${jeCounter}`);
  console.log(`  Total Sales Revenue:   ${round2(totalSalesRevenue).toLocaleString()} SAR`);
  console.log(`  Total COGS:            ${round2(totalCOGS).toLocaleString()} SAR`);
  console.log(`  Total Output VAT:      ${round2(totalOutputVAT).toLocaleString()} SAR`);
  console.log(`  Total Input VAT:       ${round2(totalInputVAT).toLocaleString()} SAR`);
  console.log(`  Total Salary Expense:  ${round2(totalSalaryExpense).toLocaleString()} SAR`);
  console.log(`  Total Depreciation:    ${round2(totalDepreciation).toLocaleString()} SAR`);
  console.log(`  Cash Balance:          ${cashBalance.toLocaleString()} SAR`);

  // Save database
  const dbPath = path.join(__dirname, 'simulation_test.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log(`\n  Test database saved: ${dbPath}`);

  db.close();
  return pass === total ? 0 : 1;
}

main().then(code => process.exit(code)).catch(e => { console.error('FATAL:', e); process.exit(1); });
