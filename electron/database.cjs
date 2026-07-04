const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

// ─────────────────────────────────────────────────────────────────────────────
// ZATCA PHASE 2 — CANONICAL GENESIS PIH
// Per ZATCA Phase 2 spec §5.3: the PIH for the very first invoice (ICV=1) is
// the SHA-256 of the empty string, hex-encoded then base64'd.
// This MUST be used as the default last_pih for any fresh device registration
// and as the fallback when last_pih is NULL or an uninitialized placeholder.
// ─────────────────────────────────────────────────────────────────────────────
const ZATCA_GENESIS_PIH = 'NWZlY2Q3YmU1YTIzYmU3YTYzYTk3YmQ4NzY0ODk2ODM3NGJhOWI5NjgxYTNpYmQyNzhjNTU4NTUxYWI5ZWYyZg==';

// ─────────────────────────────────────────────
// MONEY ROUNDING HELPER (4-B)
// ─────────────────────────────────────────────
const roundMoney = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const { generateUUID, generateUBL21XML } = require('./zatca_utils.cjs');
const zatca = require('./zatca_phase2_impl.cjs');
const accounting = require('./accounting.cjs');
const accountingP2 = require('./accounting_p2.cjs');

let db;

// ─────────────────────────────────────────────
// SECURITY HELPERS
// ─────────────────────────────────────────────
function hashPin(pin) {
    return crypto.createHash('sha256').update('pos-salt-2026-' + pin).digest('hex');
}

// ─────────────────────────────────────────────
// PHASE 1: SAFE SYNC DATABASE MIGRATION (CRDT)
// ─────────────────────────────────────────────
function migrateForSync(db) {
    const syncTables = [
        'products', 'customers', 'sales', 'sales_items', 
        'held_orders', 'expenditures', 'shifts', 'ledger_entries', 
        'staff', 'suppliers', 'purchase_orders', 'purchase_items'
    ];

    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_nodes (
            node_id TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS sync_watermarks (
            node_id TEXT PRIMARY KEY,
            last_sync_timestamp INTEGER,
            FOREIGN KEY (node_id) REFERENCES sync_nodes(node_id)
        );
    `);

    try {
        db.function('gen_uuid', () => crypto.randomUUID());
    } catch (e) {}

    for (const table of syncTables) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        
        if (!columns.includes('sync_id')) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN sync_id TEXT;`);
        }
        if (!columns.includes('updated_at')) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER;`);
        }
        if (!columns.includes('is_deleted')) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
        }

        db.exec(`
            UPDATE ${table} 
            SET sync_id = gen_uuid(), 
                updated_at = CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)
            WHERE sync_id IS NULL OR updated_at IS NULL;
        `);

        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_sync_id ON ${table}(sync_id);`);

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS ${table}_sync_insert
            AFTER INSERT ON ${table}
            FOR EACH ROW
            WHEN NEW.sync_id IS NULL OR NEW.updated_at IS NULL
            BEGIN
                UPDATE ${table}
                SET sync_id = COALESCE(NEW.sync_id, gen_uuid()),
                    updated_at = COALESCE(NEW.updated_at, CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
                WHERE id = NEW.id;
            END;
        `);

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS ${table}_sync_update
            AFTER UPDATE ON ${table}
            FOR EACH ROW
            WHEN NEW.updated_at = OLD.updated_at
            BEGIN
                UPDATE ${table}
                SET updated_at = CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)
                WHERE id = NEW.id;
            END;
        `);
    }
}

// ─────────────────────────────────────────────
// LABEL ENGINE MIGRATION
// Adds: label_templates, label_print_log, product label columns
// ─────────────────────────────────────────────
function migrateLabelEngine(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (e) { /* column/table exists */ } };

    // Label templates table (P7)
    safe(`
        CREATE TABLE IF NOT EXISTS label_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id TEXT,
            config_json TEXT
        );
    `);

    // Print log table (P9)
    safe(`
        CREATE TABLE IF NOT EXISTS label_print_log (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            timestamp INTEGER,
            copies INTEGER DEFAULT 1,
            label_key TEXT,
            status TEXT DEFAULT 'success',
            error TEXT
        );
    `);

    // Product schema extensions (P10)
    safe(`ALTER TABLE products ADD COLUMN label_template_id TEXT`);
    safe(`ALTER TABLE products ADD COLUMN expiry_date TEXT`);
    safe(`ALTER TABLE products ADD COLUMN batch_number TEXT`);
    safe(`ALTER TABLE products ADD COLUMN net_weight_g REAL`);
    safe(`ALTER TABLE products ADD COLUMN country_of_origin TEXT`);

    // Index for fast log queries
    safe(`CREATE INDEX IF NOT EXISTS idx_lpl_product_id ON label_print_log(product_id)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_lpl_timestamp  ON label_print_log(timestamp DESC)`);
    safe(`CREATE INDEX IF NOT EXISTS idx_lt_category    ON label_templates(category_id)`);

    console.log('[Label] Schema migration complete.');
}

// ─────────────────────────────────────────────
// JE ACCOUNT CODE BOOTSTRAP (FK guard for existing DBs)
// ─────────────────────────────────────────────
/**
 * Upsert every account_code that the auto-JE integration points write to.
 * Uses INSERT OR IGNORE so it never corrupts existing rows.
 * Safe to call on every startup — no-ops when codes already exist.
 */
function _ensureJEAccounts(dbInst) {
    // Add optional columns defensively — accounting.cjs already does this,
    // but guard here too in case call order ever changes.
    const safeAlter = (sql) => { try { dbInst.exec(sql); } catch (_) {} };
    safeAlter(`ALTER TABLE accounts ADD COLUMN name_en TEXT`);
    safeAlter(`ALTER TABLE accounts ADD COLUMN level INTEGER DEFAULT 3`);
    safeAlter(`ALTER TABLE accounts ADD COLUMN normal_balance TEXT DEFAULT 'debit'`);
    safeAlter(`ALTER TABLE accounts ADD COLUMN is_system INTEGER DEFAULT 0`);
    safeAlter(`ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1`);

    const stmt = dbInst.prepare(`
        INSERT OR IGNORE INTO accounts (account_code, name_ar, name_en, type, level, normal_balance, is_system, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `);
    const run = dbInst.transaction((rows) => { for (const r of rows) stmt.run(...r); });
    run([
        // ── New 4-digit codes used by auto-JE integration points ──
        [1111, '\u0627\u0644\u0635\u0646\u062f\u0648\u0642 (\u0646\u0642\u062f\u064a POS)', 'Cash / POS Till',        'Asset',     4, 'debit'],
        [1112, '\u0631\u0635\u064a\u062f \u0628\u0646\u0643\u064a',            'Bank Account',           'Asset',     4, 'debit'],
        [1200, '\u0630\u0645\u0645 \u0645\u062f\u064a\u0646\u0629 \u2014 \u0639\u0645\u0644\u0627\u0621', 'Accounts Receivable',    'Asset',     3, 'debit'],
        [1300, '\u0627\u0644\u0645\u062e\u0632\u0648\u0646',               'Inventory',              'Asset',     3, 'debit'],
        [2100, '\u0630\u0645\u0645 \u062f\u0627\u0626\u0646\u0629 \u2014 \u0645\u0648\u0631\u062f\u0648\u0646', 'Accounts Payable',       'Liability', 3, 'credit'],
        [2210, '\u0631\u0648\u0627\u062a\u0628 \u0645\u0633\u062a\u062d\u0642\u0629',          'Salaries Payable',       'Liability', 4, 'credit'],
        [2300, '\u0636\u0631\u064a\u0628\u0629 \u0642\u064a\u0645\u0629 \u0645\u0636\u0627\u0641\u0629 \u0645\u062e\u0631\u062c\u0627\u062a', 'VAT Collected (Output)', 'Liability', 3, 'credit'],
        [2400, '\u0636\u0631\u064a\u0628\u0629 \u0642\u064a\u0645\u0629 \u0645\u0636\u0627\u0641\u0629 \u0645\u062f\u062e\u0644\u0627\u062a', 'VAT Deductible (Input)', 'Asset',     3, 'debit'],
        [4100, '\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',      'Sales Revenue',          'Revenue',   3, 'credit'],
        [5100, '\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 (COGS)', 'Cost of Goods Sold',     'Expense',   3, 'debit'],
        // ── Legacy 4-digit codes used by recordTransaction() in saveSale ──
        // These were deleted by _seedCoA() on existing DBs; re-insert as aliases
        // so ledger_entries FK does not fire.
        [1101, '\u0635\u0646\u062f\u0648\u0642 (\u0646\u0642\u062f\u064a - \u0644\u064a\u062c\u0627\u0633\u064a)', 'Cash Till (legacy)',      'Asset',     4, 'debit'],
        [1102, '\u0628\u0646\u0643 / \u0628\u0637\u0627\u0642\u0629 (\u0644\u064a\u062c\u0627\u0633\u064a)',     'Card / Bank (legacy)',    'Asset',     4, 'debit'],
        [1103, '\u0630\u0645\u0645 \u0645\u062f\u064a\u0646\u0629 - \u0622\u062c\u0644 (\u0644\u064a\u062c\u0627\u0633\u064a)', 'Credit AR (legacy)',     'Asset',     3, 'debit'],
        [2201, '\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (\u0644\u064a\u062c\u0627\u0633\u064a)', 'VAT Payable (legacy)',   'Liability', 3, 'credit'],
        [4101, '\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0645\u0628\u064a\u0639\u0627\u062a (\u0644\u064a\u062c\u0627\u0633\u064a)', 'Sales Revenue (legacy)', 'Revenue',   3, 'credit'],
        [5101, '\u062a\u0643\u0644\u0641\u0629 \u0628\u0636\u0627\u0639\u0629 \u0645\u0628\u0627\u0639\u0629 (\u0644\u064a\u062c\u0627\u0633\u064a)', 'COGS (legacy)',           'Expense',   3, 'debit'],
        [5201, '\u0645\u0634\u062a\u0631\u064a\u0627\u062a (\u0644\u064a\u062c\u0627\u0633\u064a)',            'Purchases (legacy)',      'Expense',   3, 'debit'],
        [1201, '\u0645\u062e\u0632\u0648\u0646 (\u0644\u064a\u062c\u0627\u0633\u064a)',               'Inventory (legacy)',      'Asset',     3, 'debit'],
        [2202, '\u0636\u0631\u064a\u0628\u0629 \u0642\u064a\u0645\u0629 \u0645\u0636\u0627\u0641\u0629 \u0645\u062f\u062e\u0644\u0627\u062a (\u0644\u064a\u062c\u0627\u0633\u064a)', 'VAT Input (legacy)',      'Asset',     3, 'debit'],
    ]);
}

// ─────────────────────────────────────────────
function initDatabase(userDataPath) {
    if (db) return;
    try {
        if (!userDataPath) {
            userDataPath = process.env.USER_DATA_PATH || process.cwd();
        }
        const dbPath = path.join(userDataPath, 'pos_data.db');
        console.log(`Connecting to database at: ${dbPath}`);
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = FULL');
        db.pragma('foreign_keys = ON');
    } catch (err) {
        console.error('CRITICAL: Database initialization failed:', err);
        throw err;
    }

    // CORE TABLES
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            price REAL NOT NULL,
            category TEXT DEFAULT 'عام',
            image TEXT,
            stock INTEGER NOT NULL DEFAULT 0,
            cost REAL DEFAULT 0,
            barcode TEXT,
            supplier_id INTEGER,
            is_service INTEGER DEFAULT 0,
            unit TEXT DEFAULT 'وحدة'
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS modifiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            name TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice TEXT UNIQUE NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL NOT NULL,
            subtotal REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            payment_method TEXT,
            paid REAL,
            change_amount REAL,
            payment_details_json TEXT,
            status TEXT DEFAULT 'paid',
            order_type TEXT DEFAULT 'counter',
            note TEXT,
            uuid TEXT,
            hash TEXT,
            hash_chain TEXT,
            zatca_status TEXT DEFAULT 'pending',
            customer_id INTEGER,
            staff_id INTEGER,
            discount_type TEXT DEFAULT 'normal',
            is_agreed_total INTEGER DEFAULT 0
        );
    `);

    try { db.exec("ALTER TABLE sales ADD COLUMN discount_type TEXT DEFAULT 'normal';"); } catch(e){}
    try { db.exec("ALTER TABLE sales ADD COLUMN is_agreed_total INTEGER DEFAULT 0;"); } catch(e){}

    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_id INTEGER,
            item_name TEXT NOT NULL,
            item_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            item_note TEXT,
            modifiers_json TEXT,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        );
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS zatca_device (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            private_key_pem TEXT NOT NULL,
            csr_pem TEXT,
            compliance_csid TEXT,
            production_csid TEXT,
            production_cert_pem TEXT,
            current_icv INTEGER DEFAULT 0,
            last_pih TEXT DEFAULT 'NWZlY2Q3YmU1YTIzYmU3YTYzYTk3YmQ4NzY0ODk2ODM3NGJhOWI5NjgxYTNpYmQyNzhjNTU4NTUxYWI5ZWYyZg==',
            -- ^ ZATCA Phase 2 canonical genesis PIH (SHA-256 of empty string, hex→base64)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS zatca_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            icv INTEGER NOT NULL,
            uuid TEXT NOT NULL,
            signed_xml TEXT NOT NULL,
            xml_hash TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            zatca_response_json TEXT,
            attempts INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS expenditures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            net_amount REAL DEFAULT 0,
            vat_amount REAL DEFAULT 0,
            vat_eligible INTEGER DEFAULT 0,
            category TEXT DEFAULT 'أخرى',
            supplier_name TEXT,
            invoice_ref TEXT,
            expense_date DATE,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            starting_cash REAL DEFAULT 0,
            actual_cash REAL DEFAULT 0,
            expected_cash REAL DEFAULT 0,
            cash_sales REAL DEFAULT 0,
            card_sales REAL DEFAULT 0,
            status TEXT DEFAULT 'open',
            staff_id INTEGER
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            account_code INTEGER PRIMARY KEY,
            name_ar TEXT NOT NULL,
            type TEXT CHECK(type IN ('Asset','Liability','Equity','Revenue','Expense')),
            parent_id INTEGER,
            balance REAL DEFAULT 0,
            FOREIGN KEY (parent_id) REFERENCES accounts(account_code)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS ledger_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_code INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            debit REAL DEFAULT 0,
            credit REAL DEFAULT 0,
            reference TEXT,
            FOREIGN KEY (account_code) REFERENCES accounts(account_code)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            tax_id TEXT,
            loyalty_points INTEGER DEFAULT 0,
            tier TEXT DEFAULT 'bronze',
            total_spent REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pin TEXT NOT NULL UNIQUE,
            role TEXT DEFAULT 'Cashier',
            permissions_json TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            tax_id TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS held_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT,
            items_json TEXT NOT NULL,
            customer_id INTEGER,
            table_id INTEGER,
            order_type TEXT DEFAULT 'counter',
            kds_status TEXT DEFAULT 'pending',
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            zone TEXT DEFAULT 'Main',
            capacity INTEGER DEFAULT 4,
            status TEXT DEFAULT 'available',
            x_pos REAL DEFAULT 0,
            y_pos REAL DEFAULT 0,
            current_order_id INTEGER,
            FOREIGN KEY (current_order_id) REFERENCES held_orders(id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS stock_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            change_amount REAL NOT NULL,
            reason TEXT NOT NULL,
            reference_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            note TEXT,
            received_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER,
            product_id INTEGER,
            quantity REAL NOT NULL,
            unit_cost REAL NOT NULL,
            is_bulk INTEGER DEFAULT 0,
            FOREIGN KEY (purchase_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Schema Migrations
    try { db.exec("ALTER TABLE purchase_items ADD COLUMN unit_name TEXT;"); } catch(e) {}
    try { db.exec("ALTER TABLE purchase_items ADD COLUMN pieces_per_unit REAL DEFAULT 1;"); } catch(e) {}

    db.exec(`
      CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        buy_product_id INTEGER,
        buy_qty REAL,
        get_product_id INTEGER,
        get_qty REAL,
        discount_value REAL,
        discount_type TEXT,
        min_spend REAL,
        active INTEGER DEFAULT 1,
        start_date TEXT,
        end_date TEXT
      );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS supplier_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            note TEXT,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS customer_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            note TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );
    `);

    try { db.exec("ALTER TABLE promotions ADD COLUMN discount_type TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE promotions ADD COLUMN start_date TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE promotions ADD COLUMN end_date TEXT;"); } catch(e){}

    // ── ZATCA device schema migrations — guarded with PRAGMA to avoid
    // duplicate-column warnings when the column already exists in the
    // CREATE TABLE DDL above (fixes: "Migration warn: duplicate column name").
    const safeZatca = (sql) => { try { db.exec(sql); } catch(e) { console.warn('Migration warn:', e.message); } };
    const _zatcaCols = db.prepare('PRAGMA table_info(zatca_device)').all().map(c => c.name);
    if (!_zatcaCols.includes('current_icv'))       db.exec('ALTER TABLE zatca_device ADD COLUMN current_icv INTEGER DEFAULT 0;');
    if (!_zatcaCols.includes('last_pih'))           db.exec(`ALTER TABLE zatca_device ADD COLUMN last_pih TEXT DEFAULT '${ZATCA_GENESIS_PIH}';`);
    if (!_zatcaCols.includes('device_id'))          safeZatca('ALTER TABLE zatca_device ADD COLUMN device_id TEXT;');
    if (!_zatcaCols.includes('private_key_pem'))    safeZatca('ALTER TABLE zatca_device ADD COLUMN private_key_pem TEXT;');
    if (!_zatcaCols.includes('csr_pem'))            safeZatca('ALTER TABLE zatca_device ADD COLUMN csr_pem TEXT;');
    if (!_zatcaCols.includes('production_cert_pem')) safeZatca('ALTER TABLE zatca_device ADD COLUMN production_cert_pem TEXT;');

    try { db.exec("ALTER TABLE zatca_device ADD COLUMN production_cert_pem TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE zatca_device ADD COLUMN cert_expires_at TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE zatca_device ADD COLUMN uuid TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE zatca_device ADD COLUMN compliance_secret TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE zatca_device ADD COLUMN production_secret TEXT;"); } catch(e){}
    try { db.exec("ALTER TABLE zatca_device ADD COLUMN status TEXT;"); } catch(e){}

    db.prepare(`
        CREATE TABLE IF NOT EXISTS business_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();

    db.prepare(
        "INSERT OR IGNORE INTO business_settings (key, value) VALUES ('zatca_env', 'production')"
    ).run();

    // SEED CHART OF ACCOUNTS
    const acctCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
    if (acctCount === 0) {
        const ins = db.prepare('INSERT INTO accounts (account_code, name_ar, type, parent_id) VALUES (?,?,?,?)');
        const tx = db.transaction((rows) => { for (const r of rows) ins.run(...r); });
        tx([
            [1,    'الأصول',                  'Asset',     null],
            [1101, 'الصندوق (نقدي)',            'Asset',     1],
            [1102, 'البنك (شبكة)',               'Asset',     1],
            [1103, 'ذمم مدينة — عملاء آجل',    'Asset',     1],
            [1201, 'المخزون',                  'Asset',     1],
            [2,    'الخصوم',                  'Liability', null],
            [2101, 'الموردون',                 'Liability', 2],
            [2201, 'ضريبة مخرجات مستحقة',      'Liability', 2],
            [2202, 'ضريبة مدخلات (مستردة)',    'Asset',     1],
            [3,    'حقوق الملكية',             'Equity',    null],
            [4,    'الإيرادات',                'Revenue',   null],
            [4101, 'مبيعات المنتجات',          'Revenue',   4],
            [5,    'المصروفات',                'Expense',   null],
            [5101, 'تكلفة البضاعة المباعة',     'Expense',   5],
            [5201, 'مصروفات تشغيل',            'Expense',   5],
        ]);
    }

    try { 
        const exists2202 = db.prepare('SELECT 1 FROM accounts WHERE account_code=2202').get();
        if (!exists2202) {
            db.prepare('INSERT INTO accounts (account_code, name_ar, type, parent_id) VALUES (2202, ?, ?, 1)').run('ضريبة مدخلات (مستردة)', 'Asset');
        }
        const exists1103 = db.prepare('SELECT 1 FROM accounts WHERE account_code=1103').get();
        if (!exists1103) {
            db.prepare('INSERT INTO accounts (account_code, name_ar, type, parent_id) VALUES (1103, ?, ?, 1)').run('ذمم مدينة — عملاء آجل', 'Asset');
        }
    } catch(e){}

    // SAFE MIGRATIONS
    const safe = (sql) => { try { db.exec(sql); } catch (e) { /* column exists */ } };
    safe(`ALTER TABLE products ADD COLUMN cost REAL DEFAULT 0`);
    safe(`ALTER TABLE products ADD COLUMN barcode TEXT`);
    safe(`ALTER TABLE products ADD COLUMN supplier_id INTEGER`);
    safe(`ALTER TABLE products ADD COLUMN is_service INTEGER DEFAULT 0`);
    safe(`ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'وحدة'`);
    safe(`ALTER TABLE sales ADD COLUMN payment_details_json TEXT`);
    safe(`ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'paid'`);
    safe(`ALTER TABLE sales ADD COLUMN order_type TEXT DEFAULT 'counter'`);
    safe(`ALTER TABLE sales ADD COLUMN note TEXT`);
    safe(`ALTER TABLE sales ADD COLUMN uuid TEXT`);
    safe(`ALTER TABLE sales ADD COLUMN hash TEXT`);
    safe(`ALTER TABLE sales ADD COLUMN hash_chain TEXT`);
    safe(`ALTER TABLE sales ADD COLUMN zatca_status TEXT DEFAULT 'pending'`);
    safe(`ALTER TABLE sales ADD COLUMN icv INTEGER`);
    try { db.prepare("UPDATE sales SET zatca_status = 'legacy' WHERE icv IS NULL AND status != 'legacy' AND zatca_status != 'legacy'").run(); } catch(e){}
    safe(`ALTER TABLE sales ADD COLUMN customer_id INTEGER`);
    safe(`ALTER TABLE sales ADD COLUMN staff_id INTEGER`);
    safe(`ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0`);
    safe(`ALTER TABLE sales ADD COLUMN tax_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE sales ADD COLUMN change_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE sales ADD COLUMN loyalty_points_redeemed INTEGER DEFAULT 0`);
    safe(`ALTER TABLE sales_items ADD COLUMN item_note TEXT`);
    safe(`ALTER TABLE expenditures ADD COLUMN supplier_name TEXT`);
    safe(`ALTER TABLE expenditures ADD COLUMN invoice_ref TEXT`);
    safe(`ALTER TABLE expenditures ADD COLUMN net_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE expenditures ADD COLUMN vat_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE expenditures ADD COLUMN vat_eligible INTEGER DEFAULT 0`);
    safe(`ALTER TABLE expenditures ADD COLUMN expense_date DATE`);
    safe(`ALTER TABLE ledger_entries ADD COLUMN reference TEXT`);
    safe(`ALTER TABLE shifts ADD COLUMN cash_sales REAL DEFAULT 0`);
    safe(`ALTER TABLE shifts ADD COLUMN card_sales REAL DEFAULT 0`);
    safe(`ALTER TABLE customers ADD COLUMN tier TEXT DEFAULT 'bronze'`);
    safe(`ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0`);
    safe(`ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0`);
    safe(`ALTER TABLE held_orders ADD COLUMN table_id INTEGER`);
    safe(`ALTER TABLE held_orders ADD COLUMN kds_status TEXT DEFAULT 'pending'`);
    safe(`ALTER TABLE products ADD COLUMN min_stock_level REAL DEFAULT 0`);
    safe(`ALTER TABLE products ADD COLUMN bulk_unit_name TEXT`);
    safe(`ALTER TABLE products ADD COLUMN bulk_unit_size REAL DEFAULT 1`);
    safe(`ALTER TABLE products ADD COLUMN metadata_json TEXT`);
    safe(`ALTER TABLE products ADD COLUMN tax_category TEXT DEFAULT 'S'`);
    safe(`ALTER TABLE zatca_queue ADD COLUMN invoice_subtype TEXT DEFAULT '0200000'`);
    safe(`ALTER TABLE zatca_queue ADD COLUMN stamped_xml TEXT`);
    safe(`ALTER TABLE zatca_queue ADD COLUMN has_warnings INTEGER DEFAULT 0`);
    safe(`ALTER TABLE zatca_queue ADD COLUMN warning_messages TEXT`);
    safe(`ALTER TABLE zatca_device ADD COLUMN cert_expires_at DATETIME`);
    safe(`ALTER TABLE purchase_orders ADD COLUMN vat_included INTEGER DEFAULT 1`);
    safe(`ALTER TABLE purchase_orders ADD COLUMN vat_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE expenditures ADD COLUMN status TEXT DEFAULT 'active'`);
    safe(`ALTER TABLE customers ADD COLUMN last_whatsapp_sent DATETIME`);
    safe(`ALTER TABLE purchase_orders ADD COLUMN paid_amount REAL DEFAULT 0`);
    safe(`ALTER TABLE purchase_orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`);
    safe(`INSERT OR IGNORE INTO business_settings (key, value) VALUES ('costing_method', 'avco')`);

    const naColumns = ['na_short', 'na_building', 'na_street', 'na_secondary', 'na_district', 'na_postal', 'na_city', 'na_country', 'id_type', 'id_value'];
    naColumns.forEach(c => {
        safe(`ALTER TABLE customers ADD COLUMN ${c} TEXT`);
        safe(`ALTER TABLE suppliers ADD COLUMN ${c} TEXT`);
    });

    // Also migrate the sync tables list in migrateForSync if needed, 
    // but those tables won't sync until added to syncTables array. 
    // We'll leave them local for now to avoid schema drift sync issues unless explicitly requested.

    // ── Label Engine Schema Migration ──────────────────────────────────────
    migrateLabelEngine(db);

    // Seed default staff if none (use hashed PINs)
    const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
    if (staffCount === 0) {
        db.prepare('INSERT INTO staff (name, pin, role) VALUES (?,?,?)').run('المدير العام', hashPin('1234'), 'Admin');
        db.prepare('INSERT INTO staff (name, pin, role) VALUES (?,?,?)').run('كاشير 1', hashPin('0000'), 'Cashier');
    }

    const allStaff = db.prepare('SELECT id, pin FROM staff').all();
    for (const s of allStaff) {
        if (s.pin && s.pin.length !== 64) {
            db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin(s.pin), s.id);
        }
    }

    try {
        console.log('[Auth] Checking for emergency PIN resets...');
        const adminUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'admin'").get();
        if (adminUser) {
            db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('1234'), adminUser.id);
            console.log(`[Auth] Emergency: Admin '${adminUser.name}' (ID: ${adminUser.id}) PIN reset to '1234'`);
        } else {
            console.warn('[Auth] Emergency: No Admin user found to reset.');
        }

        const cashierUser = db.prepare("SELECT id, name, role FROM staff WHERE LOWER(TRIM(role)) = 'cashier'").get();
        if (cashierUser) {
            db.prepare('UPDATE staff SET pin = ? WHERE id = ?').run(hashPin('0000'), cashierUser.id);
            console.log(`[Auth] Emergency: Cashier '${cashierUser.name}' (ID: ${cashierUser.id}) PIN reset to '0000'`);
        }
    } catch (err) {
        console.error('[Auth] Emergency Reset Fatal Error:', err);
    }

    console.log('Running Sync Engine Migrations...');
    migrateForSync(db);

    console.log('Database connected and ready.');

    accounting.initAccounting(db);
    console.log('[Accounting] Phase 1 engine initialized.');
    accountingP2.initP2(db);
    console.log('[AccountingP2] Phase 2 engine initialized.');

    // ── Ensure all account codes used by auto-JEs exist (FK guard) ──────────
    // On existing databases the CoA migration guard may have skipped seeding.
    // These INSERT OR IGNORE calls are idempotent and never overwrite existing rows.
    _ensureJEAccounts(db);
    console.log('[AccountingMigration] JE account codes verified.');
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function getSettings() {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function saveSettings(settings) {
    const stmt = db.prepare(`INSERT INTO business_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    const tx = db.transaction((data) => { for (const k in data) stmt.run(k, String(data[k])); });
    tx(settings);
    return { success: true };
}

function getVatRate() {
    const s = getSettings();
    return parseFloat(s.vat_rate || '0.15');
}

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────
function mapProductKeys(p) {
    return {
        ID: p.id, Name: p.name, Price: p.price,
        Category: p.category || 'عام', Image: p.image || '',
        Stock: p.stock, Cost: p.cost || 0,
        Barcode: p.barcode || '', SupplierID: p.supplier_id || null,
        IsService: !!p.is_service, Unit: p.unit || 'وحدة',
        Modifiers: p.modifiers_json ? JSON.parse(p.modifiers_json) : [],
        MinStockLevel: p.min_stock_level || 0,
        BulkUnitName: p.bulk_unit_name || '',
        BulkUnitSize: p.bulk_unit_size || 1,
        Metadata: p.metadata_json ? JSON.parse(p.metadata_json) : {},
        // Label engine fields (P10)
        label_template_id:  p.label_template_id  || null,
        expiry_date:        p.expiry_date        || null,
        batch_number:       p.batch_number       || null,
        net_weight_g:       p.net_weight_g       || null,
        country_of_origin:  p.country_of_origin  || null,
    };
}

function getMenu() {
    const products = db.prepare('SELECT * FROM products ORDER BY category ASC, name ASC').all();
    return products.map(p => {
        const modifiers = db.prepare('SELECT * FROM modifiers WHERE product_id = ?').all(p.id);
        return mapProductKeys({ ...p, modifiers_json: JSON.stringify(modifiers) });
    });
}

function addItem(item) {
    const metadataStr = item.Metadata ? JSON.stringify(item.Metadata) : null;
    const stmt = db.prepare(`INSERT INTO products (name, price, category, image, stock, cost, barcode, supplier_id, is_service, unit, min_stock_level, bulk_unit_name, bulk_unit_size, metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const result = stmt.run(
        item.Name, item.Price, item.Category || 'عام', item.Image || '',
        item.IsService ? 999999 : (item.Stock || 0),
        item.Cost || 0, item.Barcode || '',
        item.SupplierID || null,
        item.IsService ? 1 : 0,
        item.Unit || 'وحدة',
        item.MinStockLevel || 0,
        item.BulkUnitName || '',
        item.BulkUnitSize || 1,
        metadataStr
    );
    addAuditLog('ADD_PRODUCT', `Name: ${item.Name}, Price: ${item.Price}`);
    return { ID: result.lastInsertRowid, ...item };
}

function editItem(item) {
    const metadataStr = item.Metadata ? JSON.stringify(item.Metadata) : null;
    db.prepare(`UPDATE products SET name=?, price=?, category=?, image=?, cost=?, barcode=?, supplier_id=?, is_service=?, unit=?, min_stock_level=?, bulk_unit_name=?, bulk_unit_size=?, metadata_json=? WHERE id=?`)
        .run(item.Name, item.Price, item.Category || 'عام', item.Image || '',
             item.Cost || 0, item.Barcode || '', item.SupplierID || null,
             item.IsService ? 1 : 0, item.Unit || 'وحدة', 
             item.MinStockLevel || 0, item.BulkUnitName || '', item.BulkUnitSize || 1,
             metadataStr,
             item.ID);
    addAuditLog('EDIT_PRODUCT', `ID: ${item.ID}, Name: ${item.Name}`);
    return item;
}

function deleteItem(id) {
    db.prepare('DELETE FROM products WHERE id=?').run(id);
    addAuditLog('DELETE_PRODUCT', `ID: ${id}`);
    return { success: true };
}

function updateStock(id, newStock) {
    db.prepare('UPDATE products SET stock=? WHERE id=?').run(newStock, id);
    return { success: true };
}

function updateProductCost(id, newCost) {
    db.prepare('UPDATE products SET cost=? WHERE id=?').run(newCost, id);
    return { success: true };
}

function importProductsFromCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات');
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('اسم'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('سعر'));
    const catIdx = headers.findIndex(h => h.includes('category') || h.includes('فئة'));
    const barcodeIdx = headers.findIndex(h => h.includes('barcode') || h.includes('باركود'));
    const finalNameIdx = nameIdx !== -1 ? nameIdx : 0;
    const finalPriceIdx = priceIdx !== -1 ? priceIdx : 1;
    const stmt = db.prepare(`INSERT OR REPLACE INTO products (name, price, category, image, stock, barcode) VALUES (?,?,?,?,?,?)`);
    let count = 0;
    const tx = db.transaction((rows) => {
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols.length >= 2) {
                const name = cols[finalNameIdx]?.replace(/^"|"$/g, '').trim();
                const price = parseFloat((cols[finalPriceIdx] || '0').replace(/[^\d.-]/g, ''));
                const cat = catIdx !== -1 ? (cols[catIdx]?.replace(/^"|"$/g, '').trim() || 'عام') : 'عام';
                const barcode = barcodeIdx !== -1 ? (cols[barcodeIdx]?.replace(/^"|"$/g, '').trim() || '') : '';
                if (name && !isNaN(price)) { stmt.run(name, price, cat, '', 100, barcode); count++; }
            }
        }
    });
    tx(lines);
    return { success: true, count };
}

// ─────────────────────────────────────────────
// LABEL TEMPLATES (P7)
// ─────────────────────────────────────────────
function getLabelTemplates(filters = {}) {
    let sql = 'SELECT * FROM label_templates WHERE 1=1';
    const params = [];
    if (filters.category_id) {
        sql += ' AND (category_id = ? OR category_id IS NULL OR category_id = "")';
        params.push(filters.category_id);
    }
    sql += ' ORDER BY name ASC';
    return db.prepare(sql).all(...params);
}

function saveLabelTemplate(tpl) {
    const id = tpl.id || crypto.randomUUID();
    db.prepare(`
        INSERT INTO label_templates (id, name, category_id, config_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name       = excluded.name,
            category_id = excluded.category_id,
            config_json = excluded.config_json
    `).run(id, tpl.name, tpl.category_id || null, tpl.config_json || '{}');
    return { id, ...tpl };
}

function deleteLabelTemplate(id) {
    db.prepare('DELETE FROM label_templates WHERE id = ?').run(id);
    return { success: true };
}

// ─────────────────────────────────────────────
// LABEL PRINT LOG (P9)
// ─────────────────────────────────────────────
function logLabelPrint(data) {
    const id = crypto.randomUUID();
    db.prepare(`
        INSERT INTO label_print_log (id, product_id, timestamp, copies, label_key, status, error)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        String(data.product_id || ''),
        Date.now(),
        parseInt(data.copies) || 1,
        data.label_key || '',
        data.status || 'success',
        data.error || null
    );
    return { id };
}

function getLabelPrintLog(filters = {}) {
    let sql = 'SELECT * FROM label_print_log WHERE 1=1';
    const params = [];
    if (filters.product_id) { sql += ' AND product_id = ?'; params.push(String(filters.product_id)); }
    if (filters.status)     { sql += ' AND status = ?';     params.push(filters.status); }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Math.min(parseInt(filters.limit) || 20, 100));
    return db.prepare(sql).all(...params);
}

// ─────────────────────────────────────────────
// HELD ORDERS
// ─────────────────────────────────────────────
function getHeldOrders() {
    return db.prepare('SELECT * FROM held_orders ORDER BY created_at DESC').all().map(o => ({
        ...o, items: JSON.parse(o.items_json || '[]')
    }));
}

function holdOrder(data) {
    const stmt = db.prepare(`INSERT INTO held_orders (label, items_json, customer_id, order_type, note) VALUES (?,?,?,?,?)`);
    const info = stmt.run(
        data.label || `طلب ${new Date().toLocaleTimeString('ar-SA')}`,
        JSON.stringify(data.items || []),
        data.customer_id || null,
        data.order_type || 'counter',
        data.note || ''
    );
    return { id: info.lastInsertRowid };
}

function deleteHeldOrder(id) {
    db.prepare('DELETE FROM held_orders WHERE id=?').run(id);
    return { success: true };
}

function updateHeldOrderStatus(id, status) {
    db.prepare('UPDATE held_orders SET kds_status=? WHERE id=?').run(status, id);
    return { success: true };
}

// ─────────────────────────────────────────────
// RESTAURANT TABLES
// ─────────────────────────────────────────────
function getTables() {
    return db.prepare(`
        SELECT t.*, h.items_json, h.label as order_label 
        FROM restaurant_tables t
        LEFT JOIN held_orders h ON t.current_order_id = h.id
        ORDER BY t.zone ASC, t.name ASC
    `).all();
}

function addTable(data) {
    const stmt = db.prepare(`INSERT INTO restaurant_tables (name, zone, capacity, x_pos, y_pos) VALUES (?,?,?,?,?)`);
    const info = stmt.run(data.name, data.zone || 'Main', data.capacity || 4, data.x_pos || 0, data.y_pos || 0);
    return { id: info.lastInsertRowid, ...data };
}

function updateTable(data) {
    db.prepare(`UPDATE restaurant_tables SET name=?, zone=?, capacity=?, status=?, current_order_id=?, x_pos=?, y_pos=? WHERE id=?`)
        .run(data.name, data.zone, data.capacity, data.status, data.current_order_id || null, data.x_pos || 0, data.y_pos || 0, data.id);
    return { success: true };
}

function updateTablePosition(id, x, y) {
    db.prepare(`UPDATE restaurant_tables SET x_pos=?, y_pos=? WHERE id=?`).run(x, y, id);
    return { success: true };
}

function deleteTable(id) {
    db.prepare('DELETE FROM restaurant_tables WHERE id=?').run(id);
    return { success: true };
}

// ─────────────────────────────────────────────
// STOCK HISTORY & PURCHASES
// ─────────────────────────────────────────────
function getStockHistory(productId = null) {
    let sql = 'SELECT h.*, p.name as product_name FROM stock_history h JOIN products p ON h.product_id = p.id';
    const params = [];
    if (productId) {
        sql += ' WHERE h.product_id = ?';
        params.push(productId);
    }
    sql += ' ORDER BY h.timestamp DESC LIMIT 500';
    return db.prepare(sql).all(...params);
}

function addStockAdjustment(data) {
    const { productId, amount, reason, note } = data;
    db.transaction(() => {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(amount, productId);
        db.prepare('INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)')
            .run(productId, amount, 'adjustment', note || 'Manual Adjustment');
    })();
    return { success: true };
}

function getPurchaseOrders() {
    return db.prepare(`
        SELECT p.*, COALESCE(s.name, 'مورد محذوف') as supplier_name 
        FROM purchase_orders p 
        LEFT JOIN suppliers s ON p.supplier_id = s.id 
        ORDER BY p.created_at DESC
    `).all();
}

function createPurchaseOrder(data) {
    const { supplier_id, total_amount, items, note, vat_included, paid_amount = 0, payment_status = 'unpaid' } = data;
    return db.transaction(() => {
        const vatFlag = (vat_included === false || vat_included === 0) ? 0 : 1;
        const info = db.prepare('INSERT INTO purchase_orders (supplier_id, total_amount, note, vat_included, paid_amount, payment_status) VALUES (?,?,?,?,?,?)')
            .run(supplier_id, roundMoney(total_amount), note || '', vatFlag, roundMoney(paid_amount), payment_status);
        const purchase_id = info.lastInsertRowid;
        
        if (paid_amount > 0) {
            db.prepare('INSERT INTO supplier_payments (supplier_id, amount, note, payment_date) VALUES (?,?,?,?)')
              .run(supplier_id, roundMoney(paid_amount), `دفعة مقدمة لطلب الشراء #${purchase_id}`, new Date().toISOString());
        }

        const item_stmt = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, is_bulk, unit_name, pieces_per_unit) VALUES (?,?,?,?,?,?,?)');
        for (const it of items) {
            item_stmt.run(purchase_id, it.product_id, it.quantity, roundMoney(it.unit_cost), it.is_bulk ? 1 : 0, it.unit_name || '', it.pieces_per_unit || 1);
        }
        return { success: true, id: purchase_id };
    })();
}

function updatePurchaseOrder(id, data) {
    const purchase = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id);
    if (!purchase || purchase.status !== 'pending') {
        throw new Error('لا يمكن تعديل طلب الشراء إلا إذا كان قيد الانتظار');
    }
    
    const { supplier_id, total_amount, items, note, vat_included, paid_amount = 0, payment_status = 'unpaid' } = data;
    return db.transaction(() => {
        const vatFlag = (vat_included === false || vat_included === 0) ? 0 : 1;
        db.prepare('UPDATE purchase_orders SET supplier_id=?, total_amount=?, note=?, vat_included=?, paid_amount=?, payment_status=? WHERE id=?')
          .run(supplier_id, roundMoney(total_amount), note || '', vatFlag, roundMoney(paid_amount), payment_status, id);
        
        db.prepare('DELETE FROM purchase_items WHERE purchase_id=?').run(id);
        
        const item_stmt = db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, is_bulk, unit_name, pieces_per_unit) VALUES (?,?,?,?,?,?,?)');
        for (const it of items) {
            item_stmt.run(id, it.product_id, it.quantity, roundMoney(it.unit_cost), it.is_bulk ? 1 : 0, it.unit_name || '', it.pieces_per_unit || 1);
        }
        return { success: true };
    })();
}

function deletePurchaseOrder(id) {
    const purchase = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id);
    if (!purchase || purchase.status !== 'pending') {
        throw new Error('لا يمكن حذف طلب الشراء إلا إذا كان قيد الانتظار');
    }
    return db.transaction(() => {
        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
        db.prepare('DELETE FROM supplier_payments WHERE note LIKE ?').run(`%لطلب الشراء #${id}%`);
        db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
        return { success: true };
    })();
}

function receivePurchaseOrder(id) {
    const purchase = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!purchase || purchase.status === 'received') throw new Error('تم استلام هذا الطلب مسبقاً أو غير موجود');
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);

    const settings = getSettings();
    const costMethod = settings.cost_method || 'weighted_average';

    return db.transaction(() => {
        const history_stmt = db.prepare('INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)');

        for (const it of items) {
            const product = db.prepare('SELECT stock, cost, bulk_unit_size FROM products WHERE id = ?').get(it.product_id);
            const actualQty = it.is_bulk ? (it.quantity * (product?.bulk_unit_size || 1)) : it.quantity;

            let newCost;
            if (costMethod === 'weighted_average') {
                const existingStock = product?.stock || 0;
                const existingCost  = product?.cost  || 0;
                const totalUnits    = existingStock + actualQty;
                newCost = totalUnits > 0
                    ? roundMoney(((existingStock * existingCost) + (actualQty * it.unit_cost)) / totalUnits)
                    : roundMoney(it.unit_cost);
            } else {
                newCost = roundMoney(it.unit_cost);
            }

            db.prepare('UPDATE products SET stock = stock + ?, cost = ? WHERE id = ?').run(actualQty, newCost, it.product_id);
            history_stmt.run(it.product_id, actualQty, 'purchase', `PO-${id}`);
        }

        db.prepare("UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

        const vatIncluded = purchase.vat_included !== 0;
        const total       = roundMoney(purchase.total_amount);
        const vatRate     = getVatRate();
        const receivedDate = new Date().toISOString().split('T')[0];

        let netValue, vatAmt;
        if (vatIncluded) {
            netValue = roundMoney(total / (1 + vatRate));
            vatAmt   = roundMoney(total - netValue);
        } else {
            netValue = total;
            vatAmt   = 0;
        }

        // ── IP-3: Inventory + AP Journal Entry (atomic, inside this db.transaction) ──
        const jeLines = [
            { account_code: 1300, debit: netValue, credit: 0,     description: `مخزون: مشتريات #${id}` },
            { account_code: 2100, debit: 0,        credit: total, description: `ذمم دائنة: مورد PO-${id}` },
        ];
        if (vatAmt > 0) {
            jeLines.push({ account_code: 2400, debit: vatAmt, credit: 0, description: `ضريبة مدخلات: PO-${id}` });
            // Adjust AP credit to net (total already includes VAT as credit)
            // Re-balance: DR Inventory(net) + DR VAT-Input(vat) = CR AP(total)
        }
        accounting.postJournalEntry({
            entry_date:     receivedDate,
            reference_no:   `PO-${id}`,
            description:    `استلام مشتريات #${id}`,
            entry_type:     'Auto',
            reference_type: 'purchase_order',
            reference_id:   String(id),
            lines:          jeLines,
            created_by:     1,
        });

        // ── IP-3b: Record inventory batches for FIFO/AVCO costing ─────────────
        for (const it of items) {
            try {
                accountingP2.addInventoryBatch(
                    it.product_id, id,
                    it.is_bulk ? (it.quantity * (db.prepare('SELECT bulk_unit_size FROM products WHERE id=?').get(it.product_id)?.bulk_unit_size || 1)) : it.quantity,
                    it.unit_cost,
                    receivedDate
                );
            } catch(_) {}
        }

        db.prepare('UPDATE purchase_orders SET vat_amount=? WHERE id=?').run(vatAmt, id);

        return { success: true };
    })();
}

function returnPurchaseOrder(id) {
    const purchase = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!purchase || purchase.status !== 'received') throw new Error('لا يمكن إرجاع هذا الطلب لأن حالته ليست مستلم');
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);

    return db.transaction(() => {
        const history_stmt = db.prepare('INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)');

        for (const it of items) {
            const product = db.prepare('SELECT stock, bulk_unit_size FROM products WHERE id = ?').get(it.product_id);
            const actualQty = it.is_bulk ? (it.quantity * (product?.bulk_unit_size || 1)) : (it.quantity * (it.pieces_per_unit || 1));

            db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(actualQty, it.product_id);
            history_stmt.run(it.product_id, -actualQty, 'purchase_return', `RTN-PO-${id}`);
        }

        db.prepare("UPDATE purchase_orders SET status = 'returned' WHERE id = ?").run(id);

        const vatIncluded = purchase.vat_included !== 0;
        const total       = roundMoney(purchase.total_amount);
        const vatRate     = getVatRate();
        const returnDate  = new Date().toISOString().split('T')[0];

        let netValue, vatAmt;
        if (vatIncluded) {
            netValue = roundMoney(total / (1 + vatRate));
            vatAmt   = roundMoney(total - netValue);
        } else {
            netValue = total;
            vatAmt   = 0;
        }

        // Reversing Journal Entry
        const jeLines = [
            { account_code: 2100, debit: total, credit: 0,        description: `عكس ذمم دائنة (مرتجع مشتريات): مورد PO-${id}` },
            { account_code: 1300, debit: 0,     credit: netValue, description: `عكس مخزون (مرتجع مشتريات): #${id}` },
        ];
        if (vatAmt > 0) {
            jeLines.push({ account_code: 2400, debit: 0, credit: vatAmt, description: `عكس ضريبة مدخلات (مرتجع مشتريات): PO-${id}` });
        }
        accounting.postJournalEntry({
            entry_date:     returnDate,
            reference_no:   `RTN-PO-${id}`,
            description:    `إرجاع مشتريات #${id}`,
            entry_type:     'Auto',
            reference_type: 'purchase_return',
            reference_id:   String(id),
            lines:          jeLines,
            created_by:     1,
        });

        return { success: true };
    })();
}

/**
 * Partial Purchase Return
 * returnItems: [{ product_id, return_qty }]
 *   return_qty is expressed in the user-facing unit (e.g. 3 dozen), so we
 *   multiply by pieces_per_unit to get base-stock units.
 */
function partialReturnPurchaseOrder(id, returnItems) {
    const purchase = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!purchase || (purchase.status !== 'received' && purchase.status !== 'partial_return'))
        throw new Error('لا يمكن إرجاع هذا الطلب — حالته ليست مستلم');

    const allItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);

    return db.transaction(() => {
        const history_stmt = db.prepare(
            'INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)'
        );

        let returnValue = 0; // net monetary value being returned (before VAT split)

        for (const r of returnItems) {
            if (!r.return_qty || r.return_qty <= 0) continue;

            const orig = allItems.find(i => i.product_id === r.product_id);
            if (!orig) throw new Error(`المنتج ${r.product_id} غير موجود في هذا الطلب`);

            // Validate: cannot return more than originally ordered
            const maxReturnQty = orig.quantity / (orig.pieces_per_unit || 1);
            if (r.return_qty > maxReturnQty + 0.0001)
                throw new Error(`الكمية المرتجعة تتجاوز الكمية الأصلية للمنتج`);

            const pieces = orig.pieces_per_unit || 1;
            const baseQty = r.return_qty * pieces; // actual stock units to remove

            db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(baseQty, orig.product_id);
            history_stmt.run(orig.product_id, -baseQty, 'purchase_return', `PRTN-PO-${id}`);

            // Monetary value: return_qty_units * cost_per_unit
            returnValue += r.return_qty * (orig.unit_cost * pieces);
        }

        returnValue = roundMoney(returnValue);

        // Check if everything was returned → mark as fully returned
        const isFullReturn = returnItems.every(r => {
            const orig = allItems.find(i => i.product_id === r.product_id);
            if (!orig) return false;
            const maxQty = orig.quantity / (orig.pieces_per_unit || 1);
            return Math.abs(r.return_qty - maxQty) < 0.0001;
        }) && returnItems.length === allItems.length;

        const newStatus = isFullReturn ? 'returned' : 'partial_return';
        db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(newStatus, id);

        const vatIncluded = purchase.vat_included !== 0;
        const vatRate     = getVatRate();
        const returnDate  = new Date().toISOString().split('T')[0];

        let netReturn, vatReturn;
        if (vatIncluded) {
            netReturn = roundMoney(returnValue / (1 + vatRate));
            vatReturn = roundMoney(returnValue - netReturn);
        } else {
            netReturn = returnValue;
            vatReturn = 0;
        }

        // Reversing Journal Entry (proportional)
        const jeLines = [
            { account_code: 2100, debit: returnValue, credit: 0,         description: `عكس ذمم دائنة (مرتجع جزئي): PO-${id}` },
            { account_code: 1300, debit: 0,           credit: netReturn,  description: `عكس مخزون (مرتجع جزئي): #${id}` },
        ];
        if (vatReturn > 0) {
            jeLines.push({ account_code: 2400, debit: 0, credit: vatReturn, description: `عكس ضريبة (مرتجع جزئي): PO-${id}` });
        }
        accounting.postJournalEntry({
            entry_date:     returnDate,
            reference_no:   `PRTN-PO-${id}`,
            description:    `إرجاع جزئي مشتريات #${id}`,
            entry_type:     'Auto',
            reference_type: 'purchase_return',
            reference_id:   String(id),
            lines:          jeLines,
            created_by:     1,
        });

        return { success: true, status: newStatus, returnValue };
    })();
}

// ─────────────────────────────────────────────
// SALES
// ─────────────────────────────────────────────
function saveSale(saleData) {
    const {
        total, subtotal, tax, discount = 0, payment, paid, change,
        items, invoice, customer_id = null, paymentDetails = [],
        order_type = 'counter', note = '', staff_id = null, status = null,
        loyalty_points_redeemed = 0,
        discount_type = 'normal',
        is_agreed_total = 0,
        billingRef = null,
        originalInvoice = null,
    } = saleData;

    const isCreditNote = status === 'credit' || (Array.isArray(items) && items.some(it => parseFloat(it.Qty || it.quantity || 1) < 0));
    if (isCreditNote && !billingRef) {
        throw new Error('\u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u0646\u0634\u0627\u0621 \u0645\u0631\u062a\u062c\u0639 — \u0645\u0631\u062c\u0639\u064a\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 \u0645\u0641\u0642\u0648\u062f\u0629 (billingRef). \u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u0646\u0634\u0627\u0621 \u0645\u0631\u062a\u062c\u0639 \u0628\u062f\u0648\u0646 \u0645\u0631\u062c\u0639\u064a\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064a\u0629.');
    }

    const openShift = getOpenShift();
    if (!openShift) throw new Error('NO_OPEN_SHIFT');

    const vatRate = getVatRate();
    const saleStatus = status || ((payment === '\u0622\u062c\u0644' || payment === 'Credit') ? 'credit' : 'paid');
    const entryDesc = `\u0641\u0627\u062a\u0648\u0631\u0629 \u0645\u0628\u064a\u0639\u0627\u062a: ${invoice}`;

    const redeemedPts = Math.max(0, Math.floor(parseInt(loyalty_points_redeemed) || 0));

    const runTx = db.transaction(() => {

        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (!device) {
            const keys = zatca.generateDeviceKeyPair();
            db.prepare(`INSERT INTO zatca_device (device_id, private_key_pem) VALUES (?, ?)`).run('POS-01', keys.privateKeyPem);
            device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        }
        
        db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
        const newIcv = db.prepare('SELECT current_icv FROM zatca_device WHERE id = ?').get(device.id).current_icv;
        // Use canonical ZATCA genesis PIH if last_pih is NULL or still holds an uninitialized placeholder
        const prevHash = (device.last_pih && device.last_pih !== 'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=')
            ? device.last_pih
            : ZATCA_GENESIS_PIH;
        const invoiceUUID = generateUUID();

        const saleTimestamp = (saleData.date && typeof saleData.date === 'string')
            ? saleData.date
            : new Date().toISOString();

        const finalTotal    = roundMoney(total);
        const finalSubtotal = subtotal != null ? roundMoney(subtotal) : roundMoney(finalTotal / (1 + vatRate));
        const finalTax      = tax != null ? roundMoney(tax) : roundMoney(finalTotal - finalSubtotal);

        let buyer = null;
        if (customer_id) {
            const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(customer_id);
            if (cust && cust.tax_id) {
                buyer = { vatNo: cust.tax_id, name: cust.name, street: cust.na_street, building: cust.na_building, district: cust.na_district, city: cust.na_city, postal: cust.na_postal, country: cust.na_country };
            }
        }

        const settings = getSettings();
        // [FIX-5] B2B buyer address hard gate for saveSale
        if (buyer) {
            const _bm3 = [];
            if (!buyer.street   || !String(buyer.street).trim())   _bm3.push('street');
            if (!buyer.building || !String(buyer.building).trim()) _bm3.push('building');
            if (!buyer.district || !String(buyer.district).trim()) _bm3.push('district');
            if (!buyer.city     || !String(buyer.city).trim())     _bm3.push('city');
            if (!buyer.postal   || !String(buyer.postal).trim())   _bm3.push('postal');
            if (_bm3.length > 0) {
                throw new Error(
                    `ZATCA_MISSING_BUYER_ADDRESS: عنوان المشتري ناقص (${_bm3.join(', ')}). ` +
                    `يُرجى تحديث بيانات العميل بالعنوان الوطني الكامل قبل إصدار فاتورة B2B.`
                );
            }
        }

        // [FIX-3] BR-KSA-17: for credit note invoices pass reason for cbc:InstructionNote
        const xml = generateUBL21XML({
            invoice: { id: invoice }, icv: newIcv, timestamp: saleTimestamp, total: finalTotal, 
            items: items || [], uuid: invoiceUUID, prevHash, 
            seller: settings.business_name_ar || 'مؤسسة تجارية', 
            vatNo: settings.vat_number || settings.tax_number,
            vatRate, discount: Number(discount),
            typeCode: billingRef ? '381' : '388',
            billingRef: billingRef || null,
            reason: billingRef ? (saleData.reason || 'تعديل على الفاتورة الأصلية') : null,
            buyer,
            paymentMethod: payment,
            crn: settings.crn,
            address: {
                street: settings.address_street,
                building: settings.address_building,
                district: settings.address_district,
                city: settings.address_city,
                postal: settings.address_postal,
                crn: settings.crn
            }
        });
        
        const { signedXml, invoiceHash } = zatca.signAndPackageInvoice({
            xml, device, settings, timestamp: saleTimestamp,
            total: finalTotal, tax: finalTax, db
        });

        // ── [FIX-PIH-CHAIN] Write the new invoice hash as last_pih BEFORE any
        // other INSERT so the chain is persisted even if the zatca_queue INSERT
        // later fails and the transaction rolls back cleanly.
        // This is the critical missing step that caused every invoice to reuse
        // the same stale prevHash, triggering ICV sequence conflicts in ZATCA.
        db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);

        const saleResult = db.prepare(`
            INSERT INTO sales (invoice, timestamp, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note,
                customer_id, staff_id, uuid, hash, hash_chain, loyalty_points_redeemed,
                discount_type, is_agreed_total, icv, zatca_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
            String(invoice), String(saleTimestamp), Number(finalTotal), Number(finalSubtotal), Number(finalTax), Number(discount), 
            String(payment || 'Cash'), Number(paid || 0), Number(change || 0), JSON.stringify(paymentDetails || []), 
            String(saleStatus), String(order_type), String(note || ''), 
            customer_id ? Number(customer_id) : null, staff_id ? Number(staff_id) : null,
            String(invoiceUUID), String(invoiceHash), String(prevHash), Number(redeemedPts),
            String(discount_type || 'normal'), is_agreed_total ? 1 : 0, newIcv, 'pending'
        );
        const saleId = saleResult.lastInsertRowid;
        
        const invoiceSubtype = buyer ? '0100000' : '0200000';
        db.prepare(`
            INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash, invoice_subtype)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, invoice, newIcv, invoiceUUID, signedXml, invoiceHash, invoiceSubtype);

        if (customer_id) {
            const earnedPts = Math.floor(finalTotal / 10);
            db.prepare(`
                UPDATE customers
                SET loyalty_points = MAX(0, loyalty_points - ?),
                    total_spent     = total_spent + ?
                WHERE id = ?
            `).run(redeemedPts, finalTotal, customer_id);

            db.prepare(`
                UPDATE customers
                SET loyalty_points = loyalty_points + ?
                WHERE id = ?
            `).run(earnedPts, customer_id);

            const cust = db.prepare('SELECT total_spent FROM customers WHERE id=?').get(customer_id);
            let tier = 'bronze';
            if (cust.total_spent >= 5000) tier = 'gold';
            else if (cust.total_spent >= 1000) tier = 'silver';
            db.prepare('UPDATE customers SET tier=? WHERE id=?').run(tier, customer_id);
        }

        let paymentAcct;
        if (payment === 'آجل' || payment === 'Credit') {
            paymentAcct = 1103;
        } else if (payment && (payment.toLowerCase().includes('card') || payment.toLowerCase().includes('stc'))) {
            paymentAcct = 1102;
        } else {
            paymentAcct = 1101;
        }

        recordTransaction([
            { code: paymentAcct, debit: finalTotal,    credit: 0 },
            { code: 4101,        debit: 0,             credit: finalSubtotal },
            { code: 2201,        debit: 0,             credit: finalTax }
        ], entryDesc, invoice);

        let totalCOGS = 0;
        const history_stmt = db.prepare(`INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)`);

        // [FIX-BR-KSA-F-06-C19] Item name length validation (3–1000 chars)
        for (const item of items) {
            if (!item.Name || String(item.Name).trim().length < 3) {
                throw new Error('BR-KSA-F-06-C19: Item name must be between 3 and 1000 characters.');
            }
        }

        for (const item of items) {
            if (!item.ID || item.IsService) {
                db.prepare(`INSERT INTO sales_items (sale_id, product_id, item_name, item_price, quantity, item_note, modifiers_json) VALUES (?,?,?,?,?,?,?)`)
                    .run(Number(saleId), null, String(item.Name), Number(item.Price), Number(item.Qty), String(item.Note || ''), JSON.stringify(item.Mods || []));
                continue;
            }
            const row = db.prepare('SELECT stock, name, cost, is_service FROM products WHERE id=?').get(item.ID);
            if (row) {
                if (!row.is_service && item.Qty > 0 && row.stock < item.Qty) {
                    const errData = JSON.stringify({ productId: item.ID, productName: row.name, available: row.stock, requested: item.Qty });
                    throw new Error(`INSUFFICIENT_STOCK:${errData}`);
                }
                if (!row.is_service) {
                    db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(item.Qty, item.ID);
                    history_stmt.run(item.ID, -item.Qty, item.Qty < 0 ? 'credit_note_return' : 'sale', invoice);
                }
                totalCOGS += roundMoney((parseFloat(row.cost) || 0) * item.Qty);
            }
            db.prepare(`INSERT INTO sales_items (sale_id, product_id, item_name, item_price, quantity, item_note, modifiers_json) VALUES (?,?,?,?,?,?,?)`)
                .run(
                    Number(saleId), 
                    item.ID ? (String(item.ID).startsWith('group_') ? null : Number(item.ID)) : null, 
                    String(item.Name), Number(item.Price), Number(item.Qty), 
                    String(item.Note || ''), JSON.stringify(item.Mods || [])
                );
        }

        const costingMethod = (getSettings().costing_method || 'avco').toUpperCase();
        let totalCOGS_p2 = 0;
        for (const item of items) {
            if (!item.ID || item.IsService) continue;
            try {
                const cogs = accountingP2.computeSaleCOGS(item.ID, item.Qty, costingMethod);
                totalCOGS_p2 += cogs;
            } catch(_) {}
        }
        const finalCOGS = totalCOGS_p2 > 0 ? totalCOGS_p2 : totalCOGS;

        // ── IP-1: Revenue / VAT Journal Entry (atomic — inside db.transaction) ──
        const saleDate = new Date().toISOString().split('T')[0];
        let drAcct = 1111;
        if (payment === 'آجل' || payment === 'Credit') drAcct = 1200;
        else if (payment && (payment.toLowerCase().includes('card') || payment.toLowerCase().includes('stc'))) drAcct = 1112;

        if (finalTotal > 0) {
            const revLines = [
                { account_code: drAcct, debit: finalTotal,    credit: 0,             description: `مبيعات: ${invoice}` },
                { account_code: 4100,   debit: 0,             credit: finalSubtotal, description: `إيراد مبيعات: ${invoice}` },
                { account_code: 2300,   debit: 0,             credit: finalTax,      description: `ضريبة مخرجات: ${invoice}` },
            ];
            accounting.postJournalEntry({
                entry_date:     saleDate,
                reference_no:   `SAL-${invoice}`,
                description:    `مبيعات: ${invoice}`,
                entry_type:     'Auto',
                reference_type: 'sale',
                reference_id:   String(saleId),
                lines:          revLines,
                created_by:     staff_id || 1,
            });
        }

        // Reverse-charge VAT per line item (RC products)
        for (const item of items) {
            if (!item.ID) continue;
            const prod = db.prepare('SELECT tax_category FROM products WHERE id=?').get(item.ID);
            if (!prod || prod.tax_category !== 'RC') continue;
            const lineSubtotal = roundMoney(item.Price * item.Qty);
            const lineVAT      = roundMoney(lineSubtotal * vatRate);
            if (lineVAT <= 0) continue;
            accounting.postJournalEntry({
                entry_date:     saleDate,
                reference_no:   `RC-${invoice}-${item.ID}`,
                description:    `ضريبة عكسية: ${item.Name} — ${invoice}`,
                entry_type:     'Auto',
                reference_type: 'sale',
                reference_id:   String(saleId),
                lines: [
                    { account_code: 2400, debit: lineVAT, credit: 0,       description: 'ضريبة مدخلات (انعكاسية)' },
                    { account_code: 2300, debit: 0,       credit: lineVAT, description: 'ضريبة مخرجات (انعكاسية)' },
                ],
                created_by: staff_id || 1,
            });
        }

        // ── IP-2: COGS Journal Entry (atomic — inside db.transaction) ──────────
        if (finalCOGS > 0) {
            accounting.postJournalEntry({
                entry_date:     saleDate,
                reference_no:   `COGS-${invoice}`,
                description:    `تكلفة بضاعة مباعة: ${invoice}`,
                entry_type:     'Auto',
                reference_type: 'sale',
                reference_id:   String(saleId),
                lines: [
                    { account_code: 5100, debit: finalCOGS, credit: 0 },
                    { account_code: 1300, debit: 0,         credit: finalCOGS },
                ],
                created_by: staff_id || 1,
            });
        }

        addAuditLog('SALE', `Invoice: ${invoice}, Total: ${finalTotal}, Payment: ${payment}, PointsRedeemed: ${redeemedPts}, COGS: ${finalCOGS.toFixed(2)}, CostingMethod: ${costingMethod}`);
        return { saleId, invoice, status: saleStatus };
    });

    return runTx();
}

function voidSale(invoiceId, reason = 'لم يُحدد') {
    const sale = db.prepare('SELECT * FROM sales WHERE invoice=?').get(invoiceId);
    if (!sale) return { success: false, error: 'الفاتورة غير موجودة' };
    if (sale.status === 'void' || sale.status === 'voided') return { success: false, error: 'الفاتورة ملغاة بالفعل' };

    const vatRate = getVatRate();
    const total = sale.total_amount;
    const subtotalVal = sale.subtotal || (total / (1 + vatRate));
    const taxVal = sale.tax_amount || (total - subtotalVal);

    const pointsToRestore = Math.max(0, Math.floor(parseInt(sale.loyalty_points_redeemed) || 0));

    db.transaction(() => {
        db.prepare('UPDATE sales SET status=? WHERE invoice=?').run('void', invoiceId);
        
        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (device) {
            db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
            const newIcv = db.prepare('SELECT current_icv FROM zatca_device WHERE id = ?').get(device.id).current_icv;
            // Use canonical ZATCA genesis PIH if last_pih is NULL or still holds an uninitialized placeholder
            const prevHash = (device.last_pih && device.last_pih !== 'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=')
                ? device.last_pih
                : ZATCA_GENESIS_PIH;
            const uuid = generateUUID();
            const timestamp = new Date().toISOString();
            const settings = getSettings();
            
            const items = db.prepare('SELECT item_name as Name, quantity as Qty, item_price as Price FROM sales_items WHERE sale_id=?').all(sale.id);
            
            let buyer = null;
            if (sale.customer_id) {
                const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(sale.customer_id);
                if (cust && cust.tax_id) {
                    buyer = { vatNo: cust.tax_id, name: cust.name, street: cust.na_street, building: cust.na_building, district: cust.na_district, city: cust.na_city, postal: cust.na_postal, country: cust.na_country };
                }
            }

            // [FIX-5] B2B buyer address hard gate for voidSale
            if (buyer) {
                const _bm = [];
                if (!buyer.street   || !String(buyer.street).trim())   _bm.push('street');
                if (!buyer.building || !String(buyer.building).trim()) _bm.push('building');
                if (!buyer.district || !String(buyer.district).trim()) _bm.push('district');
                if (!buyer.city     || !String(buyer.city).trim())     _bm.push('city');
                if (!buyer.postal   || !String(buyer.postal).trim())   _bm.push('postal');
                if (_bm.length > 0) {
                    throw new Error(
                        `ZATCA_MISSING_BUYER_ADDRESS: عنوان المشتري ناقص (${_bm.join(', ')}). ` +
                        `يُرجى تحديث بيانات العميل بالعنوان الوطني الكامل قبل إصدار فاتورة B2B.`
                    );
                }
            }

            // [FIX-3] BR-KSA-17: pass reason for cbc:InstructionNote
            const xml = generateUBL21XML({
                invoice: { id: 'CN-' + invoiceId }, icv: newIcv, timestamp, total, 
                items: items, uuid, prevHash, 
                seller: settings.business_name_ar || 'مؤسسة تجارية', 
                vatNo: settings.vat_number || settings.tax_number,
                vatRate, discount: 0, typeCode: '381',
                billingRef: invoiceId,
                reason: reason || 'إلغاء الفاتورة الأصلية',
                buyer,
                paymentMethod: sale.payment_method,
                crn: settings.crn,
                address: {
                    street: settings.address_street,
                    building: settings.address_building,
                    district: settings.address_district,
                    city: settings.address_city,
                    postal: settings.address_postal,
                    crn: settings.crn
                }
            });
            
            const { signedXml, invoiceHash } = zatca.signAndPackageInvoice({
                xml, device, settings, timestamp,
                total, tax: taxVal, db
            });

            // ── [FIX-PIH-CHAIN] Persist the new hash as last_pih for the next invoice.
            db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);

            const voidOrigSubtype = db.prepare(
                'SELECT invoice_subtype FROM zatca_queue WHERE invoice_number = ? ORDER BY id DESC LIMIT 1'
            ).get(invoiceId)?.invoice_subtype || '0200000';

            db.prepare(`
                INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash, invoice_subtype)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(sale.id, 'CN-' + invoiceId, newIcv, uuid, signedXml, invoiceHash, voidOrigSubtype);
        }

        const items = db.prepare('SELECT * FROM sales_items WHERE sale_id=?').all(sale.id);
        for (const it of items) {
            if (it.product_id) {
                db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(it.quantity, it.product_id);
            }
        }

        if (sale.customer_id) {
            const earnedPtsToRemove = Math.floor(total / 10);
            db.prepare(`
                UPDATE customers
                SET loyalty_points = MAX(0, loyalty_points - ?),
                    total_spent     = MAX(0, total_spent - ?)
                WHERE id = ?
            `).run(earnedPtsToRemove, total, sale.customer_id);

            if (pointsToRestore > 0) {
                db.prepare(`
                    UPDATE customers
                    SET loyalty_points = loyalty_points + ?
                    WHERE id = ?
                `).run(pointsToRestore, sale.customer_id);
            }
        }

        const paymentMethod = sale.payment_method || '';
        let reversePayAcct;
        if (paymentMethod === 'آجل' || paymentMethod === 'Credit') {
            reversePayAcct = 1103;
        } else if (paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('stc')) {
            reversePayAcct = 1102;
        } else {
            reversePayAcct = 1101;
        }

        const desc = `إلغاء فاتورة: ${invoiceId} — ${reason}`;
        recordTransaction([
            { code: reversePayAcct, debit: 0,           credit: total },
            { code: 4101,           debit: subtotalVal, credit: 0 },
            { code: 2201,           debit: taxVal,      credit: 0 }
        ], desc, invoiceId);

        // ── IP-5: Revenue-reversal JE (inside this db.transaction, atomic) ──────
        const voidDate = new Date().toISOString().split('T')[0];
        let crAcct = 1111; // cash default
        if (paymentMethod === 'آجل' || paymentMethod === 'Credit') crAcct = 1200;
        else if (paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('stc')) crAcct = 1112;

        // Reverse revenue + VAT
        if (total > 0) {
            accounting.postJournalEntry({
                entry_date:     voidDate,
                reference_no:   `VOID-${invoiceId}`,
                description:    `إلغاء فاتورة: ${invoiceId} — ${reason}`,
                entry_type:     'Auto',
                reference_type: 'void',
                reference_id:   String(sale.id),
                lines: [
                    { account_code: 4100, debit: subtotalVal, credit: 0,     description: `عكس إيراد: ${invoiceId}` },
                    { account_code: 2300, debit: taxVal,      credit: 0,     description: `عكس ضريبة: ${invoiceId}` },
                    { account_code: crAcct, debit: 0, credit: total,         description: `عكس دفع: ${invoiceId}` },
                ],
                created_by: 1,
            });
        }

        // Reverse COGS if products had cost
        const saleItems = db.prepare('SELECT * FROM sales_items WHERE sale_id=?').all(sale.id);
        let totalCOGSReverse = 0;
        for (const it of saleItems) {
            if (it.product_id) {
                const prod = db.prepare('SELECT cost FROM products WHERE id=?').get(it.product_id);
                totalCOGSReverse += roundMoney((parseFloat(prod?.cost) || 0) * it.quantity);
            }
        }
        if (totalCOGSReverse > 0) {
            accounting.postJournalEntry({
                entry_date:     voidDate,
                reference_no:   `VOID-COGS-${invoiceId}`,
                description:    `عكس تكلفة إلغاء: ${invoiceId}`,
                entry_type:     'Auto',
                reference_type: 'void',
                reference_id:   String(sale.id),
                lines: [
                    { account_code: 1300, debit: totalCOGSReverse, credit: 0 },
                    { account_code: 5100, debit: 0, credit: totalCOGSReverse },
                ],
                created_by: 1,
            });
        }

        addAuditLog('VOID_SALE', `Invoice: ${invoiceId}, Reason: ${reason}, PointsRestored: ${pointsToRestore}`);
    })();

    return { success: true };
}

function getSalesHistory(filters = {}) {
    let sql = `
        SELECT s.id, s.invoice, s.timestamp as sale_date,
               s.total_amount as total, s.subtotal, s.tax_amount as tax,
               s.discount, s.payment_method as payment, s.status,
               s.order_type, s.note, s.uuid, s.zatca_status,
               s.customer_id,
               c.name as customer_name,
               c.phone as customer_phone,
               c.tax_id as customer_tax_id,
               c.address as customer_address,
               c.na_building as customer_na_building,
               c.na_street as customer_na_street,
               c.na_district as customer_na_district,
               c.na_postal as customer_na_postal,
               c.na_city as customer_na_city
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
    `;
    const params = [];
    if (filters.startDate && filters.endDate) {
        sql += ` AND DATE(s.timestamp) BETWEEN ? AND ?`;
        params.push(filters.startDate, filters.endDate);
    }
    if (filters.search) { sql += ` AND s.invoice LIKE ?`; params.push(`%${filters.search}%`); }
    if (filters.status) { 
        if (filters.status === 'void') {
            sql += ` AND s.status IN ('void', 'voided')`;
        } else {
            sql += ` AND s.status = ?`; params.push(filters.status); 
        }
    }
    sql += ` ORDER BY s.timestamp DESC`;
    if (filters.limit) { sql += ` LIMIT ?`; params.push(filters.limit); }

    return db.prepare(sql).all(...params).map(sale => {
        const items = db.prepare(`SELECT product_id as ID, item_name as Name, quantity as Qty, item_price as Price, item_note as Note FROM sales_items WHERE sale_id=?`).all(sale.id);
        return { ...sale, items_json: JSON.stringify(items) };
    });
}

function updateSaleStatus(invoiceId, status) {
    db.prepare('UPDATE sales SET status=? WHERE invoice=?').run(status, invoiceId);
    return { success: true };
}

function getSaleByInvoice(invoiceId) {
    const sale = db.prepare('SELECT * FROM sales WHERE invoice=?').get(invoiceId);
    if (!sale) return null;
    const items = db.prepare(`SELECT item_name as Name, quantity as Qty, item_price as Price FROM sales_items WHERE sale_id=?`).all(sale.id);
    return { ...sale, items };
}

// ─────────────────────────────────────────────
// EXPENDITURES
// ─────────────────────────────────────────────
function addExpenditure(data) {
    const desc = (data.description?.trim()) ? data.description.trim()
        : `${data.supplier_name || 'مصروف'}${data.invoice_ref ? ' - ' + data.invoice_ref : ''}`;
    
    return db.transaction(() => {
        const stmt = db.prepare(`INSERT INTO expenditures (description, supplier_name, invoice_ref, category, net_amount, vat_amount, amount, vat_eligible, expense_date) VALUES (?,?,?,?,?,?,?,?,?)`);
        const result = stmt.run(desc, data.supplier_name || null, data.invoice_ref || null, data.category || 'أخرى',
            data.net_amount || 0, data.vat_amount || 0, parseFloat(data.amount), data.vat_eligible ? 1 : 0, data.date || null);

        const ref = data.invoice_ref || `EXP-${result.lastInsertRowid}`;
        const total = parseFloat(data.amount);
        const vat = parseFloat(data.vat_amount || 0);
        const net = total - vat;
        
        recordTransaction([
            { code: 5201, debit: net > 0 ? net : 0, credit: 0 },
            { code: 2202, debit: vat > 0 ? vat : 0, credit: 0 },
            { code: 1101, debit: 0,                  credit: total }
        ], desc, ref);

        addAuditLog('ADD_EXPENDITURE', `Amount: ${data.amount}, Supplier: ${data.supplier_name}`);
        return { id: result.lastInsertRowid };
    })();
}

function getExpenditures(filters = {}) {
    let baseSql = `FROM expenditures WHERE (status IS NULL OR status != 'deleted')`;
    const params = [];
    if (filters.startDate && filters.endDate) {
        baseSql += ` AND DATE(COALESCE(expense_date, timestamp)) BETWEEN ? AND ?`;
        params.push(filters.startDate, filters.endDate);
    }
    if (filters.category && filters.category !== 'الكل') {
        baseSql += ` AND category = ?`; params.push(filters.category);
    }
    if (filters.supplier) { baseSql += ` AND supplier_name LIKE ?`; params.push(`%${filters.supplier}%`); }
    
    let sql = `SELECT * ${baseSql} ORDER BY COALESCE(expense_date, timestamp) DESC, id DESC`;
    const limit  = parseInt(filters.limit)  || 50;
    const offset = parseInt(filters.offset) || 0;
    sql += ` LIMIT ? OFFSET ?`;
    
    const rows = db.prepare(sql).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as total ${baseSql}`).get(...params)?.total || 0;
    return { rows, total, limit, offset };
}

function deleteExpenditure(id) {
    const exp = db.prepare('SELECT * FROM expenditures WHERE id=?').get(id);
    if (!exp) return { success: false, error: 'المصروف غير موجود' };
    addAuditLog('DELETE_EXPENDITURE', `ID: ${id}, Amount: ${exp.amount}, Supplier: ${exp.supplier_name}`);
    return db.transaction(() => {
        const total = roundMoney(exp.amount || 0);
        const vat   = roundMoney(exp.vat_amount || 0);
        const net   = roundMoney(total - vat);
        if (total > 0) {
            recordTransaction([
                { code: 1101, debit: total,          credit: 0 },
                { code: 5201, debit: 0,              credit: net > 0 ? net : 0 },
                { code: 2202, debit: 0,              credit: vat > 0 ? vat : 0 }
            ], `حذف مصروف: ${exp.description || exp.supplier_name}`, `EXP-DEL-${id}`);
        }
        db.prepare(`UPDATE expenditures SET status='deleted' WHERE id=?`).run(id);
        return { success: true };
    })();
}

function editExpenditure(data) {
    const exp = db.prepare('SELECT * FROM expenditures WHERE id=?').get(data.id);
    if (!exp) return { success: false, error: 'المصروف غير موجود' };
    const settings = getSettings();
    const maxDays = parseInt(settings.expense_edit_max_days || '30');
    const expDate = new Date(exp.expense_date || exp.timestamp);
    const diffDays = Math.floor((Date.now() - expDate.getTime()) / 86400000);
    if (diffDays > maxDays) {
        return { success: false, error: `لا يمكن تعديل مصروف مؤرخ منذ أكثر من ${maxDays} يوماً` };
    }
    return db.transaction(() => {
        const oldTotal = roundMoney(exp.amount || 0);
        const oldVat   = roundMoney(exp.vat_amount || 0);
        const oldNet   = roundMoney(oldTotal - oldVat);
        if (oldTotal > 0) {
            recordTransaction([
                { code: 1101, debit: oldTotal,           credit: 0 },
                { code: 5201, debit: 0,                  credit: oldNet > 0 ? oldNet : 0 },
                { code: 2202, debit: 0,                  credit: oldVat > 0 ? oldVat : 0 }
            ], `تعديل مصروف (عكس): ${exp.description}`, `EXP-EDIT-${exp.id}`);
        }
        const newTotal = roundMoney(parseFloat(data.amount) || 0);
        const newVat   = roundMoney(parseFloat(data.vat_amount) || 0);
        const newNet   = roundMoney(newTotal - newVat);
        const desc = (data.description?.trim()) || `${data.supplier_name || 'مصروف'}${data.invoice_ref ? ' - ' + data.invoice_ref : ''}`;
        if (newTotal > 0) {
            recordTransaction([
                { code: 5201, debit: newNet > 0 ? newNet : 0, credit: 0 },
                { code: 2202, debit: newVat > 0 ? newVat : 0, credit: 0 },
                { code: 1101, debit: 0,                        credit: newTotal }
            ], `تعديل مصروف: ${desc}`, `EXP-EDIT-${exp.id}`);
        }
        db.prepare(`UPDATE expenditures SET description=?, supplier_name=?, invoice_ref=?, category=?, net_amount=?, vat_amount=?, amount=?, vat_eligible=?, expense_date=? WHERE id=?`)
            .run(desc, data.supplier_name || null, data.invoice_ref || null, data.category || 'أخرى',
                newNet, newVat, newTotal, data.vat_eligible ? 1 : 0, data.date || exp.expense_date, data.id);
        addAuditLog('EDIT_EXPENDITURE', `ID: ${data.id}, NewAmount: ${newTotal}`);
        return { success: true };
    })();
}

// ─────────────────────────────────────────────
// FINANCIAL REPORTS
// ─────────────────────────────────────────────
function getFinancialReport({ startDate, endDate } = {}) {
    const today = new Date().toISOString().split('T')[0];
    const sDate = startDate || today;
    const eDate = endDate || today;

    const salesSummary = db.prepare(`
        SELECT COUNT(*) as totalOrders, IFNULL(SUM(total_amount),0) as grossRevenue,
               IFNULL(SUM(discount),0) as totalDiscounts,
               IFNULL(SUM(subtotal),0) as netRevenue,
               IFNULL(SUM(tax_amount),0) as vatOutput
        FROM sales WHERE DATE(timestamp) BETWEEN ? AND ? AND status NOT IN ('void','voided')
    `).get(sDate, eDate);

    const topProducts = db.prepare(`
        SELECT item_name, SUM(quantity) as qtySold, SUM(quantity*item_price) as itemRevenue
        FROM sales_items si JOIN sales s ON si.sale_id=s.id
        WHERE DATE(s.timestamp) BETWEEN ? AND ? AND s.status NOT IN ('void','voided')
        GROUP BY item_name ORDER BY qtySold DESC LIMIT 10
    `).all(sDate, eDate);

    const recentSales = db.prepare(`
        SELECT s.invoice as invoice_id, s.total_amount as grand_total, s.status,
               s.timestamp, COALESCE(c.name,'عميل عام') as customer_name
        FROM sales s LEFT JOIN customers c ON s.customer_id=c.id
        WHERE DATE(s.timestamp) BETWEEN ? AND ?
        ORDER BY s.timestamp DESC LIMIT 50
    `).all(sDate, eDate);

    const revenueRow = db.prepare(`
        SELECT IFNULL(SUM(credit) - SUM(debit), 0) as net
        FROM ledger_entries WHERE account_code=4101 AND DATE(date) BETWEEN ? AND ?
    `).get(sDate, eDate);
    
    const cogsRow = db.prepare(`
        SELECT IFNULL(SUM(debit) - SUM(credit), 0) as net
        FROM ledger_entries WHERE account_code=5101 AND DATE(date) BETWEEN ? AND ?
    `).get(sDate, eDate);
    
    const vatOutputRow = db.prepare(`
        SELECT IFNULL(SUM(credit) - SUM(debit), 0) as net
        FROM ledger_entries WHERE account_code=2201 AND DATE(date) BETWEEN ? AND ?
    `).get(sDate, eDate);
    
    const expensesRow = db.prepare(`
        SELECT IFNULL(SUM(debit) - SUM(credit), 0) as net
        FROM ledger_entries WHERE account_code=5201 AND DATE(date) BETWEEN ? AND ?
    `).get(sDate, eDate);

    const revenue = Math.abs(revenueRow?.net || 0);
    const cogs    = Math.abs(cogsRow?.net    || 0);
    const vatOut  = Math.abs(vatOutputRow?.net || 0);
    const expenses = Math.abs(expensesRow?.net || 0);

    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - expenses;
    const totalSales  = revenue + vatOut;

    const grossMarginPct = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : 0;
    const netMarginPct   = revenue > 0 ? parseFloat(((netProfit   / revenue) * 100).toFixed(1)) : 0;

    return {
        period: { start: sDate, end: eDate },
        totalSales, revenue, cogs,
        grossProfit, grossMarginPct,
        expenses,
        netProfit, netMarginPct,
        vatOutput: vatOut,
        topProducts, recentSales
    };
}

function getFinancialTimeline({ startDate, endDate } = {}) {
    const today = new Date().toISOString().split('T')[0];
    const sDate = startDate || today;
    const eDate = endDate || today;

    const sales = db.prepare(`
        SELECT DATE(timestamp) as period, SUM(total_amount) as total_sales,
               COUNT(*) as order_count
        FROM sales WHERE DATE(timestamp) BETWEEN ? AND ? AND status NOT IN ('void','voided')
        GROUP BY DATE(timestamp) ORDER BY period
    `).all(sDate, eDate);

    const expenses = db.prepare(`
        SELECT DATE(COALESCE(expense_date,timestamp)) as period, SUM(amount) as expenses
        FROM expenditures WHERE DATE(COALESCE(expense_date,timestamp)) BETWEEN ? AND ?
        GROUP BY period
    `).all(sDate, eDate);

    return sales.map(s => ({
        ...s,
        expenses: expenses.find(e => e.period === s.period)?.expenses || 0
    }));
}

function getVATReport({ startDate, endDate } = {}) {
    const today = new Date().toISOString().split('T')[0];
    const sDate = startDate || today;
    const eDate = endDate || today;
    const vatRate = getVatRate();

    const row = db.prepare(`
        SELECT COUNT(*) as invoiceCount,
               SUM(total_amount/(1+?)) as taxableAmount,
               SUM(total_amount - total_amount/(1+?)) as vatOutput
        FROM sales WHERE DATE(timestamp) BETWEEN ? AND ? AND status NOT IN ('void','voided')
    `).get(vatRate, vatRate, sDate, eDate);

    const vatInputRow = db.prepare(`
        SELECT IFNULL(SUM(debit),0) as vatInput FROM ledger_entries
        WHERE account_code=2202 AND DATE(date) BETWEEN ? AND ?
    `).get(sDate, eDate);

    const vatInput = vatInputRow?.vatInput || 0;

    return {
        period: { start: sDate, end: eDate },
        invoiceCount: row?.invoiceCount || 0,
        taxableAmount: row?.taxableAmount || 0,
        total_sales_ex_vat: row?.taxableAmount || 0,
        vatOutput: row?.vatOutput || 0,
        output_vat: row?.vatOutput || 0,
        vatInput,
        input_vat: vatInput,
        netVAT: (row?.vatOutput || 0) - vatInput
    };
}

function getYesterdayStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const d = yesterday.toISOString().split('T')[0];
    const sales    = db.prepare(`SELECT IFNULL(SUM(total_amount),0) as total FROM sales WHERE DATE(timestamp)=? AND status NOT IN ('void','voided')`).get(d);
    const expenses = db.prepare(`SELECT IFNULL(SUM(amount),0) as total FROM expenditures WHERE DATE(COALESCE(expense_date,timestamp))=?`).get(d);
    return { sales: sales?.total || 0, expenses: expenses?.total || 0 };
}

// ─────────────────────────────────────────────
// CUSTOMERS (CRM)
// ─────────────────────────────────────────────
function getCustomers(filters = {}) {
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (filters.search) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    sql += ' ORDER BY name ASC';
    return db.prepare(sql).all(...params);
}

function addCustomer(data) {
    const stmt = db.prepare('INSERT INTO customers (name, phone, email, address, tax_id, na_short, na_building, na_street, na_secondary, na_district, na_postal, na_city, na_country, id_type, id_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const info = stmt.run(data.name, data.phone || null, data.email || null, data.address || null, data.tax_id || null, data.na_short || null, data.na_building || null, data.na_street || null, data.na_secondary || null, data.na_district || null, data.na_postal || null, data.na_city || null, data.na_country || null, data.id_type || null, data.id_value || null);
    addAuditLog('ADD_CUSTOMER', `Name: ${data.name}`);
    return { id: info.lastInsertRowid, ...data };
}

function updateCustomer(data) {
    db.prepare('UPDATE customers SET name=?, phone=?, email=?, address=?, tax_id=?, na_short=?, na_building=?, na_street=?, na_secondary=?, na_district=?, na_postal=?, na_city=?, na_country=?, id_type=?, id_value=? WHERE id=?')
        .run(data.name, data.phone, data.email, data.address, data.tax_id, data.na_short || null, data.na_building || null, data.na_street || null, data.na_secondary || null, data.na_district || null, data.na_postal || null, data.na_city || null, data.na_country || null, data.id_type || null, data.id_value || null, data.id);
    addAuditLog('UPDATE_CUSTOMER', `ID: ${data.id}`);
    return { success: true };
}

function getCustomerHistory(customerId) {
    return db.prepare(`
        SELECT s.invoice, s.timestamp as sale_date, s.total_amount as total,
               s.payment_method as payment, s.status
        FROM sales s WHERE s.customer_id=? ORDER BY s.timestamp DESC LIMIT 50
    `).all(customerId).map(sale => {
        const items = db.prepare(`
            SELECT item_name as Name, quantity as Qty, item_price as Price 
            FROM sales_items WHERE sale_id=(SELECT id FROM sales WHERE invoice=?)
        `).all(sale.invoice);
        return { ...sale, items };
    });
}

function redeemLoyaltyPoints(customerId, points) {
    const c = db.prepare('SELECT loyalty_points FROM customers WHERE id=?').get(customerId);
    if (!c || c.loyalty_points < points) return { success: false, error: 'نقاط غير كافية' };
    db.prepare('UPDATE customers SET loyalty_points=loyalty_points-? WHERE id=?').run(points, customerId);
    return { success: true, discount: points * 0.1 };
}

function recordWhatsAppShare(customerId, invoiceId) {
    try {
        if (customerId) {
            db.prepare('UPDATE customers SET last_whatsapp_sent = CURRENT_TIMESTAMP WHERE id = ?').run(customerId);
        }
        addAuditLog('WHATSAPP_SHARE', `Invoice: ${invoiceId}, CustomerID: ${customerId || 'N/A'}`);
        return { success: true };
    } catch (err) {
        console.error('Error recording WhatsApp share:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────────
function getStaff() {
    return db.prepare('SELECT id, name, role, permissions_json, created_at FROM staff').all();
}

function addStaff(data) {
    if (!data.pin || String(data.pin).length < 4) throw new Error('يجب أن يكون الرقم السري 4 أرقام على الأقل');
    const hashedPin = hashPin(String(data.pin));
    const stmt = db.prepare('INSERT INTO staff (name, pin, role, permissions_json) VALUES (?,?,?,?)');
    const info = stmt.run(data.name, hashedPin, data.role || 'Cashier', JSON.stringify(data.permissions || []));
    addAuditLog('ADD_STAFF', `Name: ${data.name}, Role: ${data.role}`);
    return { id: info.lastInsertRowid };
}

function updateStaff(data) {
    const existing = db.prepare('SELECT id FROM staff WHERE id=?').get(data.id);
    if (!existing) throw new Error('STAFF_NOT_FOUND');
    let sql = 'UPDATE staff SET name=?, role=?, permissions_json=?';
    const params = [data.name, data.role || 'Cashier', JSON.stringify(data.permissions || [])];
    if (data.pin && String(data.pin).length >= 4) {
        sql += ', pin=?';
        params.push(hashPin(String(data.pin)));
    }
    sql += ' WHERE id=?';
    params.push(data.id);
    db.prepare(sql).run(...params);
    addAuditLog('UPDATE_STAFF', `ID: ${data.id}, Name: ${data.name}`);
    return { success: true };
}

function deleteStaff(id) {
    db.prepare('DELETE FROM staff WHERE id=?').run(id);
    addAuditLog('DELETE_STAFF', `ID: ${id}`);
    return { success: true };
}

function updateStaffPermissions(id, permissions) {
    db.prepare('UPDATE staff SET permissions_json=? WHERE id=?').run(JSON.stringify(permissions), id);
    return { success: true };
}

function verifyStaffPin(pin, staffId = null) {
    const hashed = hashPin(String(pin));
    console.log(`[Auth] Verifying PIN for staffId: ${staffId || 'ANY'}`);
    console.log(`[Auth] Input PIN Hash (first 8): ${hashed.substring(0, 8)}...`);

    let staff = null;
    if (staffId) {
        staff = db.prepare('SELECT * FROM staff WHERE id=?').get(staffId) || null;
        if (staff) {
            console.log(`[Auth] Found staff: ${staff.name}. DB PIN Hash (first 8): ${staff.pin ? staff.pin.substring(0, 8) : 'NULL'}...`);
            if (staff.pin === hashed) {
                // Success
            } else {
                console.warn(`[Auth] PIN mismatch for ${staff.name}`);
                staff = null;
            }
        } else {
            console.warn(`[Auth] No staff found with ID: ${staffId}`);
        }
    } else {
        staff = db.prepare('SELECT * FROM staff WHERE pin=?').get(hashed) || null;
    }
    
    if (staff) {
        console.log(`[Auth] Success: ${staff.name} (${staff.role}) logged in.`);
    } else {
        console.warn(`[Auth] Auth Failed.`);
    }
    return staff;
}

// ─────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────
function getSuppliers() {
    return db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
}

function addSupplier(data) {
    const stmt = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, tax_id, address, na_short, na_building, na_street, na_secondary, na_district, na_postal, na_city, na_country, id_type, id_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const info = stmt.run(data.name, data.contact_person || null, data.phone || null, data.email || null, data.tax_id || null, data.address || null, data.na_short || null, data.na_building || null, data.na_street || null, data.na_secondary || null, data.na_district || null, data.na_postal || null, data.na_city || null, data.na_country || null, data.id_type || null, data.id_value || null);
    return { id: info.lastInsertRowid, ...data };
}

function updateSupplier(data) {
    db.prepare('UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, tax_id=?, address=?, na_short=?, na_building=?, na_street=?, na_secondary=?, na_district=?, na_postal=?, na_city=?, na_country=?, id_type=?, id_value=? WHERE id=?')
        .run(data.name, data.contact_person, data.phone, data.email, data.tax_id, data.address, data.na_short || null, data.na_building || null, data.na_street || null, data.na_secondary || null, data.na_district || null, data.na_postal || null, data.na_city || null, data.na_country || null, data.id_type || null, data.id_value || null, data.id);
    return { success: true };
}

function deleteSupplier(id) {
    db.prepare('DELETE FROM suppliers WHERE id=?').run(id);
    return { success: true };
}

// ─────────────────────────────────────────────
// ACCOUNTING
// ─────────────────────────────────────────────
function getAccounts() {
    return db.prepare('SELECT * FROM accounts ORDER BY account_code ASC').all();
}

function addAccount(acc) {
    return db.prepare('INSERT INTO accounts (account_code, name_ar, type, parent_id) VALUES (?,?,?,?)').run(acc.code, acc.name, acc.type, acc.parentId);
}

function getGeneralLedger(filters = {}) {
    let sql = `SELECT l.*, a.name_ar FROM ledger_entries l LEFT JOIN accounts a ON l.account_code=a.account_code WHERE 1=1`;
    const params = [];
    if (filters.account_code) { sql += ' AND l.account_code=?'; params.push(filters.account_code); }
    if (filters.startDate) { sql += ' AND DATE(l.date)>=?'; params.push(filters.startDate); }
    if (filters.endDate) { sql += ' AND DATE(l.date)<=?'; params.push(filters.endDate); }
    sql += ' ORDER BY l.date DESC LIMIT 500';
    return db.prepare(sql).all(...params);
}

function getTrialBalance() {
    return db.prepare(`SELECT account_code, name_ar, type, balance FROM accounts WHERE balance!=0 OR parent_id IS NULL ORDER BY account_code ASC`).all();
}

function recordTransaction(entries, description, reference = null) {
    if (!entries || entries.length === 0) return;
    
    const dr = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const cr = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    
    if (Math.abs(dr - cr) > 0.02) {
        throw new Error(`خلل في التوازن المحاسبي: المدين (${dr.toFixed(2)}) ≠ الدائن (${cr.toFixed(2)}) | ${description}`);
    }

    const insert = db.prepare(`INSERT INTO ledger_entries (account_code, description, debit, credit, reference) VALUES (?,?,?,?,?)`);
    const update = db.prepare(`UPDATE accounts SET balance = balance + (? - ?) WHERE account_code = ?`);

    db.transaction(() => {
        for (const e of entries) {
            insert.run(e.code, description, e.debit || 0, e.credit || 0, reference);
            update.run(e.debit || 0, e.credit || 0, e.code);
        }
    })();
}

// ─────────────────────────────────────────────
// SHIFTS
// ─────────────────────────────────────────────
function getOpenShift() {
    return db.prepare(`SELECT * FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1`).get() || null;
}

function openShift(startingCash, staffId = null) {
    const existing = getOpenShift();
    if (existing) return existing;
    const info = db.prepare(`INSERT INTO shifts (starting_cash, status, staff_id) VALUES (?,?,?)`).run(startingCash || 0, 'open', staffId);
    addAuditLog('OPEN_SHIFT', `Cash: ${startingCash}`);
    return { id: info.lastInsertRowid, starting_cash: startingCash, status: 'open' };
}

function closeShift({ id, cash }) {
    const shift = db.prepare('SELECT * FROM shifts WHERE id=?').get(id);
    if (!shift || shift.status === 'closed') return null;

    const cashSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount),0) as total FROM sales 
        WHERE timestamp>=? AND (payment_method LIKE '%Cash%' OR payment_method = 'نقد') 
        AND status NOT IN ('void','voided')
    `).get(shift.opened_at)?.total || 0;
    
    const cardSales = db.prepare(`
        SELECT COALESCE(SUM(total_amount),0) as total FROM sales 
        WHERE timestamp>=? AND payment_method NOT LIKE '%Cash%' AND payment_method != 'نقد'
        AND status NOT IN ('void','voided')
    `).get(shift.opened_at)?.total || 0;
    
    const expectedCash = (shift.starting_cash || 0) + cashSales;

    db.prepare(`UPDATE shifts SET closed_at=CURRENT_TIMESTAMP, actual_cash=?, expected_cash=?, cash_sales=?, card_sales=?, status='closed' WHERE id=?`)
        .run(cash || 0, expectedCash, cashSales, cardSales, id);

    addAuditLog('CLOSE_SHIFT', `ID: ${id}, Cash: ${cash}, Expected: ${expectedCash}`);
    return {
        id, opened_at: shift.opened_at, closed_at: new Date().toISOString(),
        starting_cash: shift.starting_cash, cash_sales: cashSales,
        card_sales: cardSales, expected_cash: expectedCash,
        actual_cash: cash || 0, variance: (cash || 0) - expectedCash
    };
}

// ─────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────
function addAuditLog(action, details) {
    try { db.prepare('INSERT INTO audit_logs (action, details) VALUES (?,?)').run(action, details); } catch (e) {}
}

function getAuditLogs(limit = 100) {
    return db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
}

// ─────────────────────────────────────────────
// LOW STOCK ALERTS
// ─────────────────────────────────────────────
function getLowStockAlerts() {
    return db.prepare(`
        SELECT id, name, stock, min_stock_level, unit
        FROM products
        WHERE is_service=0 AND min_stock_level > 0 AND stock <= min_stock_level
        ORDER BY (stock - min_stock_level) ASC
        LIMIT 20
    `).all();
}

// ─────────────────────────────────────────────
// PURCHASE ORDER ITEMS
// ─────────────────────────────────────────────
function getPurchaseItems(purchaseId) {
    return db.prepare(`
        SELECT pi.*, p.name as product_name, p.unit, p.bulk_unit_name, p.bulk_unit_size
        FROM purchase_items pi
        LEFT JOIN products p ON pi.product_id = p.id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id
    `).all(purchaseId);
}

// ─────────────────────────────────────────────
// PARTIAL RETURNS
// ─────────────────────────────────────────────
function createReturn(invoiceId, returnItems) {
    const original = db.prepare('SELECT * FROM sales WHERE invoice=?').get(invoiceId);
    if (!original) return { success: false, error: 'الفاتورة غير موجودة' };
    if (original.status === 'void' || original.status === 'voided') {
        return { success: false, error: 'لا يمكن إرجاع فاتورة ملغاة' };
    }
    return db.transaction(() => {
        const vatRate   = getVatRate();
        const returnInv = `RTN-${invoiceId}-${Date.now()}`;
        let returnTotal = 0;
        for (const ri of returnItems) {
            returnTotal += roundMoney(ri.price * ri.qty);
        }
        const returnSub = roundMoney(returnTotal / (1 + vatRate));
        const returnTax = roundMoney(returnTotal - returnSub);

        let device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        if (!device) {
            const keys = zatca.generateDeviceKeyPair();
            db.prepare(`INSERT INTO zatca_device (device_id, private_key_pem) VALUES (?, ?)`).run('POS-01', keys.privateKeyPem);
            device = db.prepare('SELECT * FROM zatca_device LIMIT 1').get();
        }
        db.prepare('UPDATE zatca_device SET current_icv = current_icv + 1 WHERE id = ?').run(device.id);
        const newIcv = db.prepare('SELECT current_icv FROM zatca_device WHERE id = ?').get(device.id).current_icv;
        // Use canonical ZATCA genesis PIH if last_pih is NULL or still holds an uninitialized placeholder
        const prevHash = (device.last_pih && device.last_pih !== 'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=')
            ? device.last_pih
            : ZATCA_GENESIS_PIH;
        const uuid = generateUUID();
        const timestamp = new Date().toISOString();
        const settings = getSettings();
        
        let buyer = null;
        if (original.customer_id) {
            const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(original.customer_id);
            if (cust && cust.tax_id) {
                buyer = { vatNo: cust.tax_id, name: cust.name, street: cust.na_street, building: cust.na_building, district: cust.na_district, city: cust.na_city, postal: cust.na_postal, country: cust.na_country };
            }
        }

        // [FIX-5] B2B buyer address hard gate for createReturn
        if (buyer) {
            const _bm2 = [];
            if (!buyer.street   || !String(buyer.street).trim())   _bm2.push('street');
            if (!buyer.building || !String(buyer.building).trim()) _bm2.push('building');
            if (!buyer.district || !String(buyer.district).trim()) _bm2.push('district');
            if (!buyer.city     || !String(buyer.city).trim())     _bm2.push('city');
            if (!buyer.postal   || !String(buyer.postal).trim())   _bm2.push('postal');
            if (_bm2.length > 0) {
                throw new Error(
                    `ZATCA_MISSING_BUYER_ADDRESS: عنوان المشتري ناقص (${_bm2.join(', ')}). ` +
                    `يُرجى تحديث بيانات العميل بالعنوان الوطني الكامل قبل إصدار فاتورة B2B.`
                );
            }
        }

        // [FIX-3] BR-KSA-17: pass reason for cbc:InstructionNote
        const returnReason = `مرتجع جزئي للفاتورة ${invoiceId}`;
        const xml = generateUBL21XML({
            invoice: { id: returnInv }, icv: newIcv, timestamp, total: returnTotal, 
            items: returnItems.map(ri => ({ Name: ri.name, Price: ri.price, Qty: ri.qty })), 
            uuid, prevHash, 
            seller: settings.business_name_ar || 'مؤسسة تجارية', 
            vatNo: settings.vat_number || settings.tax_number,
            vatRate, discount: 0, typeCode: '381',
            billingRef: invoiceId,
            reason: returnReason,
            buyer,
            paymentMethod: original.payment_method
        });
        
        const { signedXml, invoiceHash } = zatca.signAndPackageInvoice({
            xml, device, settings, timestamp,
            total: returnTotal, tax: returnTax, db
        });

        // ── [FIX-PIH-CHAIN] Persist the new hash as last_pih for the next invoice.
        db.prepare('UPDATE zatca_device SET last_pih = ? WHERE id = ?').run(invoiceHash, device.id);

        const saleRes = db.prepare(`
            INSERT INTO sales (invoice, total_amount, subtotal, tax_amount, discount, payment_method,
                paid, change_amount, payment_details_json, status, order_type, note, customer_id, staff_id, uuid, hash, hash_chain, icv, zatca_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(returnInv, -returnTotal, -returnSub, -returnTax, 0,
            original.payment_method, -returnTotal, 0, '[]',
            'return', 'return', `مرتجع: ${invoiceId}`,
            original.customer_id, original.staff_id,
            uuid, invoiceHash, prevHash, newIcv, 'pending');
        const saleId = saleRes.lastInsertRowid;

        const origSubtype = db.prepare(
            'SELECT invoice_subtype FROM zatca_queue WHERE invoice_number = ? ORDER BY id DESC LIMIT 1'
        ).get(invoiceId)?.invoice_subtype || '0200000';

        db.prepare(`
            INSERT INTO zatca_queue (sale_id, invoice_number, icv, uuid, signed_xml, xml_hash, invoice_subtype)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, returnInv, newIcv, uuid, signedXml, invoiceHash, origSubtype);

        let totalCOGS = 0;
        for (const ri of returnItems) {
            db.prepare(`INSERT INTO sales_items (sale_id, product_id, item_name, item_price, quantity) VALUES (?,?,?,?,?)`)
                .run(saleId, ri.product_id || null, ri.name, ri.price, -ri.qty);
            if (ri.product_id) {
                db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(ri.qty, ri.product_id);
                db.prepare(`INSERT INTO stock_history (product_id, change_amount, reason, reference_id) VALUES (?,?,?,?)`)
                    .run(ri.product_id, ri.qty, 'return', returnInv);
                const prod = db.prepare('SELECT cost FROM products WHERE id=?').get(ri.product_id);
                totalCOGS += roundMoney((prod?.cost || 0) * ri.qty);
            }
        }
        const payAcct = (original.payment_method === 'آجل' || original.payment_method === 'Credit') ? 1103
            : (original.payment_method?.toLowerCase().includes('card') ? 1102 : 1101);
        recordTransaction([
            { code: payAcct, debit: 0,           credit: returnTotal },
            { code: 4101,    debit: returnSub,   credit: 0 },
            { code: 2201,    debit: returnTax,   credit: 0 }
        ], `مرتجع: ${invoiceId}`, returnInv);
        if (totalCOGS > 0) {
            recordTransaction([
                { code: 5101, debit: 0,          credit: totalCOGS },
                { code: 1201, debit: totalCOGS,  credit: 0 }
            ], `تكلفة مرتجع: ${invoiceId}`, returnInv);
        }
        if (original.customer_id) {
            const pts = Math.floor(returnTotal / 10);
            db.prepare('UPDATE customers SET loyalty_points=MAX(0, loyalty_points-?), total_spent=MAX(0, total_spent-?) WHERE id=?')
                .run(pts, returnTotal, original.customer_id);
        }
        addAuditLog('RETURN', `Invoice: ${invoiceId}, ReturnInv: ${returnInv}, Total: ${returnTotal}`);
        return { success: true, returnInvoice: returnInv, total: returnTotal };
    })();
}

// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────
function exportSalesCSV(filters = {}) {
    const sales = getSalesHistory(filters);
    const rows = [['رقم الفاتورة', 'التاريخ', 'الإجمالي', 'الضريبة', 'طريقة الدفع', 'الحالة', 'العميل'].join(',')];
    for (const s of sales) {
        rows.push([s.invoice, s.sale_date?.split('T')[0], s.total, s.tax, s.payment, s.status, s.customer_name || ''].join(','));
    }
    return rows.join('\n');
}

// ─────────────────────────────────────────────
// PROMOTIONS
// ─────────────────────────────────────────────
function getPromotions() {
    return db.prepare("SELECT * FROM promotions ORDER BY id DESC").all();
}

function savePromotion(p) {
    if (p.id) {
        return db.prepare(`
            UPDATE promotions SET 
                name=?, type=?, buy_product_id=?, buy_qty=?, get_product_id=?, get_qty=?, 
                discount_value=?, discount_type=?, min_spend=?, active=?, start_date=?, end_date=?
            WHERE id=?
        `).run(p.name, p.type, p.buy_product_id, p.buy_qty, p.get_product_id, p.get_qty, 
               p.discount_value, p.discount_type, p.min_spend, p.active, p.start_date, p.end_date, p.id);
    } else {
        return db.prepare(`
            INSERT INTO promotions (name, type, buy_product_id, buy_qty, get_product_id, get_qty, 
                                    discount_value, discount_type, min_spend, active, start_date, end_date)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(p.name, p.type, p.buy_product_id, p.buy_qty, p.get_product_id, p.get_qty, 
               p.discount_value, p.discount_type, p.min_spend, p.active, p.start_date, p.end_date);
    }
}

function deletePromotion(id) {
    return db.prepare("DELETE FROM promotions WHERE id=?").run(id);
}

function togglePromotion(id, active) {
    return db.prepare("UPDATE promotions SET active=? WHERE id=?").run(active ? 1 : 0, id);
}

// ─────────────────────────────────────────────
// ZATCA API Integration
// ─────────────────────────────────────────────
function getZatcaDevice() {
    return db.prepare('SELECT * FROM zatca_device LIMIT 1').get() || null;
}
function updateZatcaDevice(data) {
    if (!data.id) return;
    const exists = db.prepare('SELECT id FROM zatca_device WHERE id = ?').get(data.id);
    if (!exists) {
        try {
            db.prepare('INSERT INTO zatca_device (id, device_id, private_key_pem, private_key, csr, certificate) VALUES (?, ?, ?, ?, ?, ?)')
              .run(data.id, data.device_id || 'POS-01', data.private_key_pem || '', data.private_key_pem || '', '', '');
        } catch (e) {
            try {
                db.prepare('INSERT INTO zatca_device (id, device_id, private_key_pem, private_key, csr) VALUES (?, ?, ?, ?, ?)')
                  .run(data.id, data.device_id || 'POS-01', data.private_key_pem || '', data.private_key_pem || '', '');
            } catch (e2) {
                db.prepare('INSERT INTO zatca_device (id, device_id, private_key_pem) VALUES (?, ?, ?)')
                  .run(data.id, data.device_id || 'POS-01', data.private_key_pem || '');
            }
        }
    }
    const fields = Object.keys(data).filter(k => k !== 'id');
    if (fields.length > 0) {
        const setClause = fields.map(k => `${k}=?`).join(', ');
        const values = fields.map(k => data[k]);
        values.push(data.id);
        db.prepare(`UPDATE zatca_device SET ${setClause} WHERE id=?`).run(...values);
    }
}

// ─────────────────────────────────────────────
// SUPPLIER & CUSTOMER CREDIT (Basic)
// ─────────────────────────────────────────────

function getSupplierStatement(supplierId) {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) return null;

    const invoices = db.prepare(`
        SELECT id, total_amount, paid_amount, payment_status, created_at, 'invoice' as type, note 
        FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at ASC
    `).all(supplierId);

    const payments = db.prepare(`
        SELECT id, amount, payment_date as created_at, 'payment' as type, note
        FROM supplier_payments WHERE supplier_id = ? ORDER BY payment_date ASC
    `).all(supplierId);

    const timeline = [...invoices, ...payments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let balance = 0;
    timeline.forEach(t => {
        if (t.type === 'invoice') balance += parseFloat(t.total_amount);
        if (t.type === 'payment') balance -= parseFloat(t.amount);
        t.running_balance = balance;
    });

    return { supplier, timeline, balance };
}

function recordSupplierPayment(data) {
    const { supplier_id, amount, note, payment_method = 'cash', purchase_order_id = null, created_by = 1 } = data;
    return db.transaction(() => {
        const result = db.prepare('INSERT INTO supplier_payments (supplier_id, amount, note, payment_date) VALUES (?,?,?, date(\'now\'))').run(supplier_id, amount, note || '');
        const pmtId = result.lastInsertRowid;

        // ── IP-4: AP Payment Journal Entry (atomic) ────────────────────
        const creditAcct = (payment_method === 'bank' || payment_method === 'transfer' || payment_method === 'cheque') ? 1112 : 1111;
        const supplierName = db.prepare('SELECT name FROM suppliers WHERE id=?').get(supplier_id)?.name || `مورد #${supplier_id}`;
        accounting.postJournalEntry({
            entry_date:     new Date().toISOString().split('T')[0],
            reference_no:   `SUPP-PMT-${pmtId}`,
            description:    `دفعة لمورد: ${supplierName}${purchase_order_id ? ` — PO-${purchase_order_id}` : ''}`,
            entry_type:     'Auto',
            reference_type: 'supplier_payment',
            reference_id:   String(pmtId),
            lines: [
                { account_code: 2100,       debit: amount, credit: 0 },
                { account_code: creditAcct, debit: 0,      credit: amount },
            ],
            created_by: created_by,
        });

        return { success: true, id: pmtId };
    })();
}

function getCustomerStatementBasic(customerId) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return null;

    // Only credit/آجل sales generate receivable debt
    const creditSales = db.prepare(`
        SELECT id, invoice, total_amount, timestamp, note
        FROM sales
        WHERE customer_id = ? AND (payment_method = 'آجل' OR payment_method = 'Credit' OR status = 'credit')
          AND status NOT IN ('void','voided','legacy')
        ORDER BY timestamp ASC
    `).all(customerId);

    // Returns (مرتجع) reduce the balance
    const returns = db.prepare(`
        SELECT id, invoice, total_amount, timestamp, note
        FROM sales
        WHERE customer_id = ? AND status = 'return'
        ORDER BY timestamp ASC
    `).all(customerId);

    // Manual payment records
    const payments = db.prepare(`
        SELECT id, amount, payment_date as timestamp, note
        FROM customer_payments WHERE customer_id = ? ORDER BY payment_date ASC
    `).all(customerId);

    // Build unified timeline
    const rawTimeline = [
        ...creditSales.map(r => ({ ...r, type: 'invoice' })),
        ...returns.map(r => ({ ...r, type: 'return' })),
        ...payments.map(r => ({ ...r, type: 'payment' })),
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let balance = 0;
    const entries = rawTimeline.map(t => {
        let debit = 0, credit = 0;
        if (t.type === 'invoice') {
            debit = parseFloat(t.total_amount) || 0;
            balance += debit;
        } else if (t.type === 'return') {
            credit = Math.abs(parseFloat(t.total_amount) || 0);
            balance -= credit;
        } else if (t.type === 'payment') {
            credit = parseFloat(t.amount) || 0;
            balance -= credit;
        }
        return {
            id: t.id,
            type: t.type,
            date: t.timestamp,
            invoice_number: t.invoice || null,
            note: t.note || null,
            debit,
            credit,
            running_balance: balance,
        };
    });

    return { entries, balance };
}

function recordCustomerPaymentBasic(data) {
    const { customer_id, amount, note } = data;
    const result = db.prepare('INSERT INTO customer_payments (customer_id, amount, note) VALUES (?,?,?)').run(customer_id, amount, note);
    return { success: true, id: result.lastInsertRowid };
}

async function getReceiptQR(signedXml) {
    const match = signedXml.match(/<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">([\s\S]+?)<\/cbc:EmbeddedDocumentBinaryObject>/);
    if (!match) return null;
    const tlv = match[1].trim();
    return await QRCode.toDataURL(tlv, { errorCorrectionLevel: 'M', width: 200 });
}

module.exports = {

    initDatabase, getSettings, saveSettings, getVatRate, getDbInstance: () => db, getReceiptQR,
    // Products
    getZatcaDevice, updateZatcaDevice,
    getMenu, addItem, editItem, deleteItem, updateStock, updateProductCost,
    importProductsFromCSV,
    // Label Engine (P7, P9, P10)
    getLabelTemplates, saveLabelTemplate, deleteLabelTemplate,
    logLabelPrint, getLabelPrintLog,
    // Held Orders
    getHeldOrders, holdOrder, deleteHeldOrder,
    // Sales
    saveSale, voidSale, getSalesHistory, getSaleByInvoice, updateSaleStatus, exportSalesCSV,
    createReturn,
    // Expenditures
    addExpenditure, getExpenditures, deleteExpenditure, editExpenditure,
    // Reports
    getFinancialReport, getFinancialTimeline, getVATReport, getYesterdayStats,
    getLowStockAlerts,
    // Customers
    getCustomers, addCustomer, updateCustomer, getCustomerHistory, redeemLoyaltyPoints,
    // Staff
    getStaff, addStaff, updateStaff, deleteStaff, updateStaffPermissions, verifyStaffPin,
    // Suppliers
    getSuppliers, addSupplier, updateSupplier, deleteSupplier,
    getSupplierStatement, recordSupplierPayment,
    // Customers (Basic Credit Tracking)
    getCustomerStatementBasic, recordCustomerPaymentBasic,
    // Tables
    getTables, addTable, updateTable, deleteTable, updateHeldOrderStatus,
    // Accounting
    getAccounts, addAccount, getGeneralLedger, getTrialBalance, recordTransaction,
    // Accounting Engine (Phase 1)
    postJournalEntry:      accounting.postJournalEntry,
    getJournalEntries:     accounting.getJournalEntries,
    getJournalEntry:       accounting.getJournalEntry,
    reverseJournalEntry:   accounting.reverseJournalEntry,
    getBalanceSheet:       accounting.getBalanceSheet,
    getCashFlowStatement:  accounting.getCashFlowStatement,
    getIncomeStatement:    accounting.getIncomeStatement,
    postOpeningBalances:   accounting.postOpeningBalances,
    hasOpeningBalances:    accounting.hasOpeningBalances,
    getAccountsHierarchical: accounting.getAccountsHierarchical,
    addAccountNew:         accounting.addAccountNew,
    getPeriods:            accounting.getPeriods,
    savePeriod:            accounting.savePeriod,
    lockPeriod:            accounting.lockPeriod,
    unlockPeriod:          accounting.unlockPeriod,
    nextJvRef:             accounting.nextJvRef,
    // Shifts
    getOpenShift, openShift, closeShift,
    // Audit
    addAuditLog, getAuditLogs,
    // Purchases & Stock
    getStockHistory, addStockAdjustment, getPurchaseOrders, createPurchaseOrder,
    receivePurchaseOrder, getPurchaseItems, updatePurchaseOrder, deletePurchaseOrder,
    returnPurchaseOrder, partialReturnPurchaseOrder,
    // Promotions
    getPromotions, savePromotion, deletePromotion, togglePromotion,
    recordWhatsAppShare,
    // Accounting Engine (Phase 2 & 3)
    p2: accountingP2,
    getARAgingReport:          accountingP2.getARAgingReport,
    getCustomerStatement:      accountingP2.getCustomerStatement,
    recordCustomerPayment:     accountingP2.recordCustomerPayment,
    checkCreditLimit:          accountingP2.checkCreditLimit,
    getFixedAssets:            accountingP2.getFixedAssets,
    addFixedAsset:             accountingP2.addFixedAsset,
    updateFixedAsset:          accountingP2.updateFixedAsset,
    disposeFixedAsset:         accountingP2.disposeFixedAsset,
    runDepreciation:           accountingP2.runDepreciation,
    getDepreciationSchedule:   accountingP2.getDepreciationSchedule,
    getBankAccounts:           accountingP2.getBankAccounts,
    saveBankAccount:           accountingP2.saveBankAccount,
    getBankReconciliations:    accountingP2.getBankReconciliations,
    saveBankReconciliation:    accountingP2.saveBankReconciliation,
    getBankTransactions:       accountingP2.getBankTransactions,
    matchBankLines:            accountingP2.matchBankLines,
    unmatchBankLine:           accountingP2.unmatchBankLine,
    getBankRecMatches:         accountingP2.getBankRecMatches,
    getUnmatchedBankTransactions: accountingP2.getUnmatchedBankTransactions,
    getCheques:                accountingP2.getCheques,
    saveCheque:                accountingP2.saveCheque,
    updateChequeStatus:        accountingP2.updateChequeStatus,
    getVATReturnBoxes:         accountingP2.getVATReturnBoxes,
    getPrepaidSchedules:       accountingP2.getPrepaidSchedules,
    addPrepaidSchedule:        accountingP2.addPrepaidSchedule,
    runPrepaidAmortisation:    accountingP2.runPrepaidAmortisation,
    getRecurringExpenses:      accountingP2.getRecurringExpenses,
    addRecurringExpense:       accountingP2.addRecurringExpense,
    getEmployees:              accountingP2.getEmployees,
    saveEmployee:              accountingP2.saveEmployee,
    deleteEmployee:            accountingP2.deleteEmployee,
    createPayrollRun:          accountingP2.createPayrollRun,
    postPayrollRun:            accountingP2.postPayrollRun,
    getPayrollRuns:            accountingP2.getPayrollRuns,
    disbursePayroll:           accountingP2.disbursePayroll,
    postVATSettlement:         accountingP2.postVATSettlement,
    addEnhancedAuditLog:       accountingP2.addEnhancedAuditLog,
    getEnhancedAuditLogs:      accountingP2.getEnhancedAuditLogs,
    addInventoryBatch:         accountingP2.addInventoryBatch,
    getInventoryBatches:       accountingP2.getInventoryBatches,
    postStockCount:            accountingP2.postStockCount,
    getStockCountHistory:      accountingP2.getStockCountHistory,
    getCustomerSubsidiaryLedger:  accountingP2.getCustomerSubsidiaryLedger,
    getSupplierSubsidiaryLedger:  accountingP2.getSupplierSubsidiaryLedger,
    getSubsidiaryControlCheck:    accountingP2.getSubsidiaryControlCheck,
    getBudgetVsActual:         accountingP2.getBudgetVsActual,
    saveBudgetEntry:           accountingP2.saveBudgetEntry,
    getCostCentres:            accountingP2.getCostCentres,
    saveCostCentre:            accountingP2.saveCostCentre,
    getBreakEvenInputs:        accountingP2.getBreakEvenInputs,
};
