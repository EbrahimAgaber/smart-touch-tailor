/**
 * ═══════════════════════════════════════════════════════════════════
 *  POS v2 — ACCOUNTING ENGINE  Phase 2 & 3 (P-008 → P-021)
 *  AR / AP · Fixed Assets · Bank Reconciliation · VAT Compliance
 *  Payroll · Accruals · Audit Log Upgrade · Inventory Costing
 *  Subsidiary Ledgers · Budget
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Cross-cutting rules inherited from accounting.cjs:
 *  • Monetary amounts → INTEGER halala (×100). Display ÷ 100.
 *  • Dates → ISO 8601 TEXT ('YYYY-MM-DD').
 *  • Every table: created_at TEXT DEFAULT (datetime('now')), created_by INTEGER.
 */

'use strict';

let _db;
const { postJournalEntry, fmtDate, toHalala, fromHalala } = require('./accounting.cjs');
const roundMoney = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

function initP2(dbInstance) {
    _db = dbInstance;
    _runMigrations();
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────
function _runMigrations() {
    const safe = (sql) => { try { _db.exec(sql); } catch (_) {} };

    // ── P-008 / P-009 / P-010: AR support ────────────────────────────────────
    // credit_limit on customers
    safe(`ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT NULL`);
    safe(`ALTER TABLE customers ADD COLUMN outstanding_balance REAL DEFAULT 0`);

    // credit_payments — partial payment tracking
    _db.exec(`
        CREATE TABLE IF NOT EXISTS credit_payments (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id     INTEGER NOT NULL,
            invoice_id      TEXT,
            payment_date    TEXT    NOT NULL DEFAULT (date('now')),
            amount_halala   INTEGER NOT NULL,
            payment_method  TEXT    NOT NULL DEFAULT 'cash',
            reference_no    TEXT,
            notes           TEXT,
            created_by      INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
    `);

    // ── P-011: Fixed Assets ────────────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS fixed_assets (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_code              TEXT    NOT NULL UNIQUE,
            name                    TEXT    NOT NULL,
            category                TEXT    DEFAULT 'Equipment',
            purchase_date           TEXT    NOT NULL,
            purchase_cost_halala    INTEGER NOT NULL,
            residual_value_halala   INTEGER NOT NULL DEFAULT 0,
            useful_life_months      INTEGER NOT NULL DEFAULT 60,
            depreciation_method     TEXT    NOT NULL DEFAULT 'straight_line',
            accum_dep_halala        INTEGER NOT NULL DEFAULT 0,
            status                  TEXT    NOT NULL DEFAULT 'active',
            location                TEXT,
            serial_number           TEXT,
            notes                   TEXT,
            created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by              INTEGER NOT NULL DEFAULT 1
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS depreciation_runs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            run_date        TEXT    NOT NULL,
            asset_id        INTEGER NOT NULL,
            amount_halala   INTEGER NOT NULL,
            journal_entry_id INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (asset_id) REFERENCES fixed_assets(id)
        );
    `);

    // ── P-012: Bank Reconciliation ────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_name       TEXT    NOT NULL,
            account_number  TEXT,
            account_type    TEXT    DEFAULT 'current',
            currency        TEXT    DEFAULT 'SAR',
            current_balance_halala INTEGER DEFAULT 0,
            is_active       INTEGER DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS bank_reconciliations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_account_id INTEGER NOT NULL,
            period_start    TEXT    NOT NULL,
            period_end      TEXT    NOT NULL,
            statement_closing_halala INTEGER NOT NULL,
            system_balance_halala    INTEGER NOT NULL,
            difference_halala        INTEGER NOT NULL DEFAULT 0,
            status          TEXT    NOT NULL DEFAULT 'draft',
            notes           TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS bank_rec_matches (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            reconciliation_id INTEGER NOT NULL,
            journal_entry_line_id INTEGER,
            bank_statement_line TEXT,
            match_type      TEXT    DEFAULT 'matched',
            FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id)
        );
    `);

    // ── P-013: Multi-rate VAT (tax_category already added to products in database.cjs) ─

    // ── P-014: Accrual Scheduler ──────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS prepaid_schedules (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            description     TEXT    NOT NULL,
            total_amount_halala INTEGER NOT NULL,
            start_date      TEXT    NOT NULL,
            end_date        TEXT    NOT NULL,
            monthly_amount_halala INTEGER NOT NULL,
            expense_account_code INTEGER NOT NULL DEFAULT 5300,
            last_posted_date TEXT,
            is_active       INTEGER DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS recurring_expenses (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_name    TEXT    NOT NULL,
            amount_halala   INTEGER NOT NULL,
            account_code    INTEGER NOT NULL DEFAULT 5700,
            day_of_month    INTEGER NOT NULL DEFAULT 1,
            start_date      TEXT    NOT NULL,
            end_date        TEXT,
            last_posted_date TEXT,
            is_active       INTEGER DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    // ── P-015: Payroll ────────────────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS employees (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL,
            id_number       TEXT,
            nationality     TEXT    DEFAULT 'Saudi',
            job_title       TEXT,
            department      TEXT,
            basic_salary_halala     INTEGER NOT NULL DEFAULT 0,
            housing_allowance_halala INTEGER DEFAULT 0,
            transport_allowance_halala INTEGER DEFAULT 0,
            other_allowances_halala INTEGER DEFAULT 0,
            gosi_registered INTEGER DEFAULT 1,
            employment_date TEXT,
            bank_iban       TEXT,
            is_active       INTEGER DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS payroll_runs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            run_month       TEXT    NOT NULL,
            status          TEXT    NOT NULL DEFAULT 'draft',
            total_gross_halala    INTEGER DEFAULT 0,
            total_gosi_employee_halala INTEGER DEFAULT 0,
            total_gosi_employer_halala INTEGER DEFAULT 0,
            total_net_halala      INTEGER DEFAULT 0,
            journal_entry_id INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS payroll_lines (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            payroll_run_id  INTEGER NOT NULL,
            employee_id     INTEGER NOT NULL,
            gross_halala    INTEGER NOT NULL DEFAULT 0,
            gosi_employee_halala INTEGER NOT NULL DEFAULT 0,
            gosi_employer_halala INTEGER NOT NULL DEFAULT 0,
            other_deductions_halala INTEGER DEFAULT 0,
            net_halala      INTEGER NOT NULL DEFAULT 0,
            commissions_halala INTEGER DEFAULT 0,
            bonuses_halala  INTEGER DEFAULT 0,
            FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
            FOREIGN KEY (employee_id)   REFERENCES employees(id)
        );
    `);

    // ── P-016: Upgraded Audit Log ─────────────────────────────────────────────
    safe(`ALTER TABLE audit_logs ADD COLUMN user_name TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN entity_type TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN entity_id TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN entity_reference TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN field_name TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN old_value TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN new_value TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN ip_address TEXT`);
    safe(`ALTER TABLE audit_logs ADD COLUMN session_id TEXT`);

    // Prevent DELETE on audit_log (DB trigger)
    _db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_audit_log_nodelete
        BEFORE DELETE ON audit_logs
        BEGIN
            SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE: Cannot delete audit log entries.');
        END;
    `);

    // ── P-018: Inventory Batches (FIFO / AVCO) ────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_batches (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id      INTEGER NOT NULL,
            received_date   TEXT    NOT NULL,
            purchase_order_id INTEGER,
            quantity_received REAL  NOT NULL,
            quantity_remaining REAL NOT NULL,
            unit_cost_halala INTEGER NOT NULL,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS stock_counts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            count_date      TEXT    NOT NULL,
            product_id      INTEGER NOT NULL,
            system_qty      REAL    NOT NULL,
            physical_qty    REAL    NOT NULL,
            difference      REAL    NOT NULL,
            reason          TEXT,
            journal_entry_id INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // ── P-021: Budget ─────────────────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS budget_entries (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            period          TEXT    NOT NULL,
            account_code    INTEGER NOT NULL,
            budgeted_halala INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(period, account_code)
        );
    `);

    // ── P-021: Cost Centres ───────────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS cost_centres (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL UNIQUE,
            is_active       INTEGER DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    console.log('[AccountingP2] Migrations complete.');
}

// ─────────────────────────────────────────────────────────────────────────────
// P-008: AR AGING REPORT
// ─────────────────────────────────────────────────────────────────────────────

function getARAgingReport(asOfDate) {
    const asOf = fmtDate(asOfDate || new Date());

    // Get all credit sales with unpaid balances
    const creditSales = _db.prepare(`
        SELECT s.id, s.invoice, s.timestamp, s.total_amount, s.customer_id,
               c.name as customer_name,
               COALESCE(
                   (SELECT SUM(cp.amount_halala) / 100.0
                    FROM credit_payments cp
                    WHERE cp.invoice_id = s.invoice AND DATE(cp.payment_date) <= ?),
                   0
               ) as paid_amount
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'credit'
          AND DATE(s.timestamp) <= ?
        ORDER BY s.customer_id, s.timestamp ASC
    `).all(asOf, asOf);

    const customerMap = {};

    for (const sale of creditSales) {
        const remaining = parseFloat(sale.total_amount) - parseFloat(sale.paid_amount || 0);
        if (remaining <= 0.01) continue;

        const invoiceDate = (sale.timestamp || '').split('T')[0];
        const daysOverdue = Math.floor((new Date(asOf) - new Date(invoiceDate)) / 86400000);

        if (!customerMap[sale.customer_id]) {
            customerMap[sale.customer_id] = {
                customer_id: sale.customer_id,
                customer_name: sale.customer_name,
                total: 0, current: 0,
                d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0,
                invoices: []
            };
        }

        const bucket = daysOverdue <= 0 ? 'current'
            : daysOverdue <= 30  ? 'd1_30'
            : daysOverdue <= 60  ? 'd31_60'
            : daysOverdue <= 90  ? 'd61_90'
            :                      'd90plus';

        customerMap[sale.customer_id][bucket] += remaining;
        customerMap[sale.customer_id].total   += remaining;
        customerMap[sale.customer_id].invoices.push({
            invoice: sale.invoice,
            date: invoiceDate,
            original: parseFloat(sale.total_amount),
            paid: parseFloat(sale.paid_amount || 0),
            remaining,
            days_overdue: daysOverdue,
            bucket
        });
    }

    const rows = Object.values(customerMap);
    const totals = rows.reduce((acc, r) => {
        acc.total   += r.total;
        acc.current += r.current;
        acc.d1_30   += r.d1_30;
        acc.d31_60  += r.d31_60;
        acc.d61_90  += r.d61_90;
        acc.d90plus += r.d90plus;
        return acc;
    }, { total: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });

    return { as_of: asOf, rows, totals };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-009: CUSTOMER STATEMENT
// ─────────────────────────────────────────────────────────────────────────────

function getCustomerStatement(customerId, startDate, endDate) {
    const sDate = fmtDate(startDate || new Date(new Date().getFullYear(), 0, 1));
    const eDate = fmtDate(endDate   || new Date());

    const customer = _db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
    if (!customer) return null;

    // Collect all transactions in period
    const lines = [];

    // Invoices (debits — charges)
    const invoices = _db.prepare(`
        SELECT s.invoice, DATE(s.timestamp) as date, s.total_amount, s.status
        FROM sales s
        WHERE s.customer_id = ? AND s.status IN ('credit', 'paid')
          AND DATE(s.timestamp) BETWEEN ? AND ?
        ORDER BY s.timestamp ASC
    `).all(customerId, sDate, eDate);

    for (const inv of invoices) {
        lines.push({
            date: inv.date,
            reference: inv.invoice,
            description: `فاتورة مبيعات`,
            debit: parseFloat(inv.total_amount),
            credit: 0,
        });
    }

    // Payments received (credits)
    const payments = _db.prepare(`
        SELECT cp.*, DATE(cp.payment_date) as pd
        FROM credit_payments cp
        WHERE cp.customer_id = ?
          AND DATE(cp.payment_date) BETWEEN ? AND ?
        ORDER BY cp.payment_date ASC
    `).all(customerId, sDate, eDate);

    for (const pmt of payments) {
        lines.push({
            date: pmt.pd,
            reference: pmt.reference_no || `PMT-${pmt.id}`,
            description: `دفعة مستلمة`,
            debit: 0,
            credit: fromHalala(pmt.amount_halala),
        });
    }

    // Credit notes / returns
    const returns = _db.prepare(`
        SELECT s.invoice, DATE(s.timestamp) as date, s.total_amount
        FROM sales s
        WHERE s.customer_id = ? AND s.status = 'return'
          AND DATE(s.timestamp) BETWEEN ? AND ?
        ORDER BY s.timestamp ASC
    `).all(customerId, sDate, eDate);

    for (const ret of returns) {
        lines.push({
            date: ret.date,
            reference: ret.invoice,
            description: `مرتجع / إشعار دائن`,
            debit: 0,
            credit: Math.abs(parseFloat(ret.total_amount)),
        });
    }

    // Sort by date
    lines.sort((a, b) => a.date.localeCompare(b.date));

    // Add running balance
    let balance = 0;
    for (const l of lines) {
        balance += l.debit - l.credit;
        l.balance = balance;
    }

    // Aging summary for closing balance
    const aging = getARAgingReport(eDate);
    const custAging = aging.rows.find(r => r.customer_id === customerId) || {};

    return {
        customer,
        period: { start: sDate, end: eDate },
        lines,
        closing_balance: balance,
        aging: custAging,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-010: PARTIAL PAYMENT RECORDING
// ─────────────────────────────────────────────────────────────────────────────

function recordCustomerPayment({ customer_id, invoice_id, amount, payment_method, reference_no, notes, created_by }) {
    if (!customer_id || !amount || amount <= 0) throw new Error('بيانات غير صحيحة');

    const amountH = toHalala(amount);

    // Check credit limit won't be violated (not needed here — this is a payment, not a charge)
    return _db.transaction(() => {
        const pmtId = _db.prepare(`
            INSERT INTO credit_payments
            (customer_id, invoice_id, amount_halala, payment_method, reference_no, notes, created_by, payment_date)
            VALUES (?,?,?,?,?,?,?, date('now'))
        `).run(customer_id, invoice_id || null, amountH, payment_method || 'cash',
               reference_no || null, notes || null, created_by || 1).lastInsertRowid;

        // Post JE: DR 1111 Cash (or 1112 Bank), CR 1200 AR
        const cashAcct = (payment_method === 'bank' || payment_method === 'transfer') ? 1112 : 1111;
        postJournalEntry({
            entry_date:     fmtDate(new Date()),
            reference_no:   reference_no || `PMT-${pmtId}`,
            description:    `تحصيل من عميل #${customer_id}${invoice_id ? ' — ' + invoice_id : ''}`,
            entry_type:     'Manual',
            reference_type: 'credit_payment',
            reference_id:   String(pmtId),
            lines: [
                { account_code: cashAcct, debit: amount, credit: 0 },
                { account_code: 1200,     debit: 0,      credit: amount },
            ],
            created_by: created_by || 1,
        });

        return { success: true, payment_id: pmtId };
    })();
}

function checkCreditLimit(customerId, newInvoiceAmount) {
    const customer = _db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId);
    if (!customer || !customer.credit_limit) return { exceeded: false };

    // Outstanding = sum of unpaid credit sales
    const outstanding = _db.prepare(`
        SELECT COALESCE(SUM(s.total_amount), 0) as total
        FROM sales s
        WHERE s.customer_id = ? AND s.status = 'credit'
    `).get(customerId).total;

    const totalPaid = _db.prepare(`
        SELECT COALESCE(SUM(amount_halala) / 100.0, 0) as total
        FROM credit_payments WHERE customer_id = ?
    `).get(customerId).total;

    const balance = parseFloat(outstanding) - parseFloat(totalPaid);
    const projected = balance + parseFloat(newInvoiceAmount || 0);

    return {
        exceeded: projected > customer.credit_limit,
        current_balance: balance,
        credit_limit: customer.credit_limit,
        projected_balance: projected,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-011: FIXED ASSETS
// ─────────────────────────────────────────────────────────────────────────────

function getFixedAssets() {
    return _db.prepare(`SELECT * FROM fixed_assets ORDER BY asset_code ASC`).all().map(a => ({
        ...a,
        purchase_cost:    fromHalala(a.purchase_cost_halala),
        residual_value:   fromHalala(a.residual_value_halala),
        accum_dep:        fromHalala(a.accum_dep_halala),
        net_book_value:   fromHalala(a.purchase_cost_halala - a.residual_value_halala - a.accum_dep_halala < 0 ? a.residual_value_halala : a.purchase_cost_halala - a.accum_dep_halala),
    }));
}

function addFixedAsset(data) {
    const costH    = toHalala(data.purchase_cost);
    const residH   = toHalala(data.residual_value || 0);
    const id = _db.prepare(`
        INSERT INTO fixed_assets
        (asset_code, name, category, purchase_date, purchase_cost_halala,
         residual_value_halala, useful_life_months, depreciation_method,
         location, serial_number, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
        data.asset_code, data.name, data.category || 'Equipment',
        fmtDate(data.purchase_date), costH, residH,
        parseInt(data.useful_life_months) || 60,
        data.depreciation_method || 'straight_line',
        data.location || null, data.serial_number || null,
        data.notes || null, data.created_by || 1
    ).lastInsertRowid;

    // Post acquisition JE: DR 1510 Fixed Assets, CR 1111 Cash (or AP)
    const creditAcct = data.payment_method === 'credit' ? 2100 : 1111;
    try {
        postJournalEntry({
            entry_date:   fmtDate(data.purchase_date),
            reference_no: data.asset_code,
            description:  `شراء أصل ثابت: ${data.name}`,
            entry_type:   'Manual',
            reference_type: 'fixed_asset',
            reference_id:   String(id),
            lines: [
                { account_code: 1510,        debit: data.purchase_cost, credit: 0 },
                { account_code: creditAcct,  debit: 0, credit: data.purchase_cost },
            ],
            created_by: data.created_by || 1,
        });
    } catch(_) {}

    return { success: true, id };
}

function updateFixedAsset(data) {
    _db.prepare(`
        UPDATE fixed_assets SET name=?, category=?, location=?, serial_number=?, notes=?
        WHERE id=?
    `).run(data.name, data.category, data.location, data.serial_number, data.notes, data.id);
    return { success: true };
}

function disposeFixedAsset(assetId, disposalDate, proceedsAmount, createdBy = 1) {
    const asset = _db.prepare(`SELECT * FROM fixed_assets WHERE id = ?`).get(assetId);
    if (!asset) throw new Error('الأصل غير موجود');
    if (asset.status !== 'active') throw new Error('هذا الأصل تم التخلص منه مسبقاً');

    const nbv      = fromHalala(asset.purchase_cost_halala - asset.accum_dep_halala);
    const proceeds = parseFloat(proceedsAmount || 0);
    const gainLoss = proceeds - nbv;

    return _db.transaction(() => {
        _db.prepare(`UPDATE fixed_assets SET status='disposed' WHERE id=?`).run(assetId);

        // Disposal JE
        const lines = [
            { account_code: 1520, debit: fromHalala(asset.accum_dep_halala), credit: 0 }, // Remove accum dep
            { account_code: 1510, debit: 0, credit: fromHalala(asset.purchase_cost_halala) }, // Remove cost
        ];
        if (proceeds > 0) {
            lines.push({ account_code: 1111, debit: proceeds, credit: 0 }); // Cash received
        }
        if (Math.abs(gainLoss) > 0.01) {
            if (gainLoss > 0) {
                lines.push({ account_code: 4200, debit: 0, credit: gainLoss }); // Gain
            } else {
                lines.push({ account_code: 5700, debit: Math.abs(gainLoss), credit: 0 }); // Loss
            }
        }

        postJournalEntry({
            entry_date:   fmtDate(disposalDate),
            reference_no: `DISP-${asset.asset_code}`,
            description:  `التخلص من أصل ثابت: ${asset.name}`,
            entry_type:   'Manual',
            lines,
            created_by:   createdBy,
        });

        return { success: true, gain_loss: gainLoss };
    })();
}

/**
 * Run depreciation for a given month.
 * month: 'YYYY-MM' string. Posts one JE per batch of assets for that month.
 */
function runDepreciation(month, createdBy = 1) {
    const [year, mon] = month.split('-').map(Number);
    const runDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(year, mon, 0).toISOString().split('T')[0];

    // Check if already run for this month
    const alreadyRun = _db.prepare(`
        SELECT COUNT(*) as c FROM depreciation_runs WHERE run_date BETWEEN ? AND ?
    `).get(runDate, lastDay).c;
    if (alreadyRun > 0) throw new Error(`الاستهلاك لشهر ${month} تم ترحيله مسبقاً`);

    const assets = _db.prepare(`
        SELECT * FROM fixed_assets WHERE status = 'active'
    `).all();

    if (assets.length === 0) return { success: true, count: 0, total: 0 };

    const depLines = [];
    let totalDep = 0;

    for (const asset of assets) {
        const costH    = asset.purchase_cost_halala;
        const residH   = asset.residual_value_halala;
        const nbvH     = costH - asset.accum_dep_halala;

        if (nbvH <= residH) {
            // Fully depreciated — mark it
            _db.prepare(`UPDATE fixed_assets SET status='fully_depreciated' WHERE id=?`).run(asset.id);
            continue;
        }

        let monthlyDepH;
        if (asset.depreciation_method === 'straight_line') {
            monthlyDepH = Math.round((costH - residH) / asset.useful_life_months);
        } else {
            // Declining balance: use 40% annual rate (adjustable)
            const annualRate = 0.40;
            monthlyDepH = Math.round((fromHalala(nbvH) * annualRate / 12) * 100);
        }

        // Don't depreciate below residual
        const maxDepH = nbvH - residH;
        monthlyDepH = Math.min(monthlyDepH, maxDepH);
        if (monthlyDepH <= 0) continue;

        totalDep += monthlyDepH;
        depLines.push({ account_code: 5400, debit: fromHalala(monthlyDepH), credit: 0, description: `استهلاك: ${asset.name}` });
        depLines.push({ account_code: 1520, debit: 0, credit: fromHalala(monthlyDepH), description: `استهلاك: ${asset.name}` });

        // Update asset
        _db.prepare(`
            UPDATE fixed_assets SET accum_dep_halala = accum_dep_halala + ?
            WHERE id = ?
        `).run(monthlyDepH, asset.id);

        _db.prepare(`
            INSERT INTO depreciation_runs (run_date, asset_id, amount_halala)
            VALUES (?, ?, ?)
        `).run(lastDay, asset.id, monthlyDepH);
    }

    if (depLines.length === 0) return { success: true, count: 0, total: 0 };

    // Merge duplicate account codes into single lines
    const merged = {};
    for (const l of depLines) {
        const key = `${l.account_code}`;
        if (!merged[key]) merged[key] = { account_code: l.account_code, debit: 0, credit: 0, description: l.description };
        merged[key].debit  += l.debit;
        merged[key].credit += l.credit;
    }

    const jeId = postJournalEntry({
        entry_date:   lastDay,
        reference_no: `DEP-${month}`,
        description:  `استهلاك الأصول الثابتة — ${month}`,
        entry_type:   'Depreciation',
        lines:        Object.values(merged),
        created_by:   createdBy,
    });

    return {
        success: true,
        journal_entry_id: jeId,
        count: assets.length,
        total_dep: fromHalala(totalDep),
    };
}

function getDepreciationSchedule(assetId) {
    const asset = _db.prepare(`SELECT * FROM fixed_assets WHERE id = ?`).get(assetId);
    if (!asset) return null;

    const schedule = [];
    let balance = fromHalala(asset.purchase_cost_halala);
    const residual = fromHalala(asset.residual_value_halala);
    const months = asset.useful_life_months;

    for (let i = 1; i <= months; i++) {
        let dep;
        if (asset.depreciation_method === 'straight_line') {
            dep = (fromHalala(asset.purchase_cost_halala) - residual) / months;
        } else {
            dep = balance * (0.40 / 12);
        }
        dep = Math.min(dep, balance - residual);
        if (dep <= 0) break;
        balance -= dep;
        schedule.push({ month: i, depreciation: dep, accumulated: fromHalala(asset.purchase_cost_halala) - balance, nbv: balance });
    }
    return { asset: { ...asset, purchase_cost: fromHalala(asset.purchase_cost_halala), residual_value: residual }, schedule };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-012: BANK RECONCILIATION
// ─────────────────────────────────────────────────────────────────────────────

function getBankAccounts() {
    return _db.prepare(`SELECT *, current_balance_halala / 100.0 as current_balance FROM bank_accounts WHERE is_active = 1 ORDER BY bank_name ASC`).all();
}

function saveBankAccount(data) {
    if (data.id) {
        _db.prepare(`UPDATE bank_accounts SET bank_name=?, account_number=?, account_type=? WHERE id=?`)
            .run(data.bank_name, data.account_number, data.account_type, data.id);
        return { success: true };
    }
    const id = _db.prepare(`
        INSERT INTO bank_accounts (bank_name, account_number, account_type)
        VALUES (?,?,?)
    `).run(data.bank_name, data.account_number || null, data.account_type || 'current').lastInsertRowid;
    return { success: true, id };
}

function getBankReconciliations(bankAccountId) {
    return _db.prepare(`
        SELECT *, statement_closing_halala / 100.0 as statement_closing,
               system_balance_halala / 100.0 as system_balance,
               difference_halala / 100.0 as difference
        FROM bank_reconciliations
        WHERE bank_account_id = ?
        ORDER BY period_end DESC
    `).all(bankAccountId);
}

function saveBankReconciliation(data) {
    const stmtH   = toHalala(data.statement_closing);
    const sysH    = toHalala(data.system_balance);
    const diffH   = stmtH - sysH;

    if (data.id) {
        _db.prepare(`
            UPDATE bank_reconciliations
            SET statement_closing_halala=?, system_balance_halala=?, difference_halala=?, status=?, notes=?
            WHERE id=?
        `).run(stmtH, sysH, diffH, data.status || 'draft', data.notes || null, data.id);
        return { success: true };
    }
    const id = _db.prepare(`
        INSERT INTO bank_reconciliations
        (bank_account_id, period_start, period_end, statement_closing_halala, system_balance_halala, difference_halala, status, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
        data.bank_account_id, data.period_start, data.period_end,
        stmtH, sysH, diffH, data.status || 'draft', data.notes || null, data.created_by || 1
    ).lastInsertRowid;
    return { success: true, id };
}

function getBankTransactions(startDate, endDate) {
    // System cash/bank entries from journal_entry_lines for accounts 1111 and 1112
    return _db.prepare(`
        SELECT l.*, je.entry_date, je.description, je.reference_no,
               a.name_ar as account_name,
               l.debit_halala / 100.0 as debit,
               l.credit_halala / 100.0 as credit
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE l.account_code IN (1111, 1112)
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
        ORDER BY je.entry_date ASC
    `).all(startDate, endDate);
}

// ─────────────────────────────────────────────────────────────────────────────
// P-012 ADDITIONS: Match bank lines + cheque management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a bank statement line with a journal entry line.
 * Creates a record in bank_rec_matches.
 */
function matchBankLines({ reconciliation_id, journal_entry_line_id, bank_statement_line }) {
    if (!reconciliation_id) throw new Error('معرف المطابقة مطلوب');
    const id = _db.prepare(`
        INSERT INTO bank_rec_matches
        (reconciliation_id, journal_entry_line_id, bank_statement_line, match_type)
        VALUES (?,?,?,'matched')
    `).run(reconciliation_id, journal_entry_line_id || null, bank_statement_line || null).lastInsertRowid;
    return { success: true, id };
}

/**
 * Remove a previously matched line pair.
 */
function unmatchBankLine(matchId) {
    _db.prepare('DELETE FROM bank_rec_matches WHERE id = ?').run(matchId);
    return { success: true };
}

/**
 * Get all match records for a reconciliation, with journal entry details.
 */
function getBankRecMatches(reconciliationId) {
    return _db.prepare(`
        SELECT m.*, l.debit_halala/100.0 as debit, l.credit_halala/100.0 as credit,
               je.entry_date, je.description, je.reference_no
        FROM bank_rec_matches m
        LEFT JOIN journal_entry_lines l ON m.journal_entry_line_id = l.id
        LEFT JOIN journal_entries je ON l.entry_id = je.id
        WHERE m.reconciliation_id = ?
        ORDER BY m.id ASC
    `).all(reconciliationId);
}

/**
 * Cheque management: ensure cheques table exists and expose CRUD.
 * Cheque statuses: issued | presented | cleared | bounced
 */
function _ensureChequeTable() {
    _db.exec(`
        CREATE TABLE IF NOT EXISTS cheques (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cheque_number   TEXT    NOT NULL,
            bank_account_id INTEGER,
            direction       TEXT    NOT NULL DEFAULT 'issued',
            amount_halala   INTEGER NOT NULL,
            payee           TEXT,
            issue_date      TEXT    NOT NULL,
            due_date        TEXT,
            status          TEXT    NOT NULL DEFAULT 'issued',
            journal_entry_id INTEGER,
            notes           TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
        );
    `);
}

function getCheques(bankAccountId, status) {
    _ensureChequeTable();
    let sql = `SELECT *, amount_halala/100.0 as amount FROM cheques WHERE 1=1`;
    const params = [];
    if (bankAccountId) { sql += ' AND bank_account_id = ?'; params.push(bankAccountId); }
    if (status)        { sql += ' AND status = ?';          params.push(status); }
    sql += ' ORDER BY issue_date DESC, id DESC';
    return _db.prepare(sql).all(...params);
}

function saveCheque(data) {
    _ensureChequeTable();
    const amountH = toHalala(data.amount);
    if (data.id) {
        _db.prepare(`
            UPDATE cheques SET cheque_number=?, payee=?, issue_date=?, due_date=?, status=?, notes=?
            WHERE id=?
        `).run(data.cheque_number, data.payee||null, fmtDate(data.issue_date),
               data.due_date ? fmtDate(data.due_date) : null,
               data.status||'issued', data.notes||null, data.id);
        return { success: true };
    }
    const id = _db.prepare(`
        INSERT INTO cheques
        (cheque_number, bank_account_id, direction, amount_halala, payee, issue_date, due_date, status, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(data.cheque_number, data.bank_account_id||null, data.direction||'issued',
           amountH, data.payee||null, fmtDate(data.issue_date),
           data.due_date ? fmtDate(data.due_date) : null,
           data.status||'issued', data.notes||null, data.created_by||1).lastInsertRowid;
    return { success: true, id };
}

function updateChequeStatus(chequeId, status) {
    _ensureChequeTable();
    const allowed = ['issued','presented','cleared','bounced'];
    if (!allowed.includes(status)) throw new Error(`حالة الشيك غير صالحة: ${status}`);
    _db.prepare('UPDATE cheques SET status=? WHERE id=?').run(status, chequeId);

    // If cleared, verify JE was already posted; if bounced, post reversal
    if (status === 'bounced') {
        const cheque = _db.prepare('SELECT * FROM cheques WHERE id=?').get(chequeId);
        if (cheque) {
            try {
                postJournalEntry({
                    entry_date:   fmtDate(new Date()),
                    reference_no: `BOUNCE-${cheque.cheque_number}`,
                    description:  `شيك مردود: ${cheque.cheque_number} — ${cheque.payee || ''}`,
                    entry_type:   'Manual',
                    lines: [
                        { account_code: 1200, debit: fromHalala(cheque.amount_halala), credit: 0 },
                        { account_code: 1112, debit: 0, credit: fromHalala(cheque.amount_halala) },
                    ],
                    created_by: 1,
                });
            } catch(_) {}
        }
    }
    return { success: true };
}

/**
 * Get unmatched bank transactions for a reconciliation period.
 * Returns system JE lines for 1111/1112 that haven't been matched yet.
 */
function getUnmatchedBankTransactions(bankAccountId, startDate, endDate, reconciliationId) {
    const allLines = getBankTransactions(startDate, endDate);
    if (!reconciliationId) return allLines;
    const matched = _db.prepare(`
        SELECT journal_entry_line_id FROM bank_rec_matches
        WHERE reconciliation_id = ? AND journal_entry_line_id IS NOT NULL
    `).all(reconciliationId).map(r => r.journal_entry_line_id);
    return allLines.filter(l => !matched.includes(l.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// P-013: MULTI-RATE VAT RETURN
// ─────────────────────────────────────────────────────────────────────────────

function getVATReturnBoxes(startDate, endDate) {
    if (startDate && typeof startDate === 'object' && !(startDate instanceof Date)) {
        endDate = startDate.endDate;
        startDate = startDate.startDate;
    }
    const sDate = fmtDate(startDate);
    const eDate = fmtDate(endDate);

    const vatRate = 0.15;

    // Sales calculation (matching getVATReport)
    const salesRow = _db.prepare(`
        SELECT
            COUNT(*) as invoiceCount,
            COALESCE(SUM(total_amount / (1 + ?)), 0) as taxableAmount,
            COALESCE(SUM(total_amount - (total_amount / (1 + ?))), 0) as vatOutput
        FROM sales
        WHERE DATE(timestamp) BETWEEN ? AND ?
          AND (status IS NULL OR status NOT IN ('void','voided','return'))
    `).get(vatRate, vatRate, sDate, eDate);

    // Exempt / Zero-rated items if tagged in product catalog
    const box2_3 = _db.prepare(`
        SELECT p.tax_category,
               COALESCE(SUM(si.quantity * si.item_price), 0) as total
        FROM sales_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE DATE(s.timestamp) BETWEEN ? AND ?
          AND (s.status IS NULL OR s.status NOT IN ('void','voided','return'))
          AND p.tax_category != 'S'
        GROUP BY p.tax_category
    `).all(sDate, eDate);

    const zeroRated = box2_3.find(r => r.tax_category === 'Z')?.total || 0;
    const exempt    = box2_3.find(r => r.tax_category === 'E')?.total || 0;

    // Input VAT from received purchase orders
    const poRow = _db.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN vat_amount > 0 THEN vat_amount WHEN vat_included = 1 THEN total_amount - (total_amount / (1 + ?)) ELSE total_amount * ? END), 0) as vatInput,
            COALESCE(SUM(CASE WHEN vat_amount > 0 THEN total_amount - vat_amount WHEN vat_included = 1 THEN total_amount / (1 + ?) ELSE total_amount END), 0) as netInput
        FROM purchase_orders
        WHERE status = 'received'
          AND DATE(COALESCE(received_at, created_at)) BETWEEN ? AND ?
    `).get(vatRate, vatRate, vatRate, sDate, eDate);

    // Input VAT from expenditures (matching getVATReport)
    const expRow = _db.prepare(`
        SELECT
            COALESCE(SUM(vat_amount), 0) as vatInput,
            COALESCE(SUM(CASE WHEN net_amount > 0 THEN net_amount WHEN vat_amount > 0 THEN vat_amount / ? ELSE amount / (1 + ?) END), 0) as netInput
        FROM expenditures
        WHERE DATE(COALESCE(expense_date, timestamp)) BETWEEN ? AND ?
          AND (status IS NULL OR status != 'deleted')
    `).get(vatRate, vatRate, sDate, eDate);

    // Additional standalone journal entries for VAT input (Account 2400)
    const jeVATInput = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala) / 100.0, 0) as vat
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 2400
          AND (je.reference_type IS NULL OR je.reference_type NOT IN ('expenditure', 'purchase_order'))
          AND DATE(je.entry_date) BETWEEN ? AND ?
          AND (je.status IS NULL OR je.status != 'reversed')
    `).get(sDate, eDate);

    const stdAmount  = roundMoney(salesRow?.taxableAmount || 0);
    const stdVAT     = roundMoney(salesRow?.vatOutput || 0);
    const totalSales = roundMoney(stdAmount + zeroRated + exempt);

    const poVAT  = parseFloat(poRow?.vatInput || 0);
    const poNet  = parseFloat(poRow?.netInput || 0);
    const expVAT = parseFloat(expRow?.vatInput || 0);
    const expNet = parseFloat(expRow?.netInput || 0);
    const otherVAT = Math.max(0, parseFloat(jeVATInput?.vat || 0));
    const otherNet = otherVAT > 0 ? (otherVAT / vatRate) : 0;

    const inputVATTotal = roundMoney(poVAT + expVAT + otherVAT);
    const inputAmount   = roundMoney(poNet + expNet + otherNet);

    const vatDue = roundMoney(stdVAT - inputVATTotal);

    return {
        period: { start: sDate, end: eDate },
        box1_standard_amount: stdAmount,
        box1_standard_vat:    stdVAT,
        box2_zero_rated:      zeroRated,
        box3_exempt:          exempt,
        box4_total_sales:     totalSales,
        box5_input_amount:    inputAmount,
        box5_input_vat:       inputVATTotal,
        box9_vat_due:         vatDue,
        is_refund:            vatDue < 0,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-014: ACCRUAL SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

function getPrepaidSchedules() {
    return _db.prepare(`SELECT *, total_amount_halala/100.0 as total_amount, monthly_amount_halala/100.0 as monthly_amount FROM prepaid_schedules WHERE is_active=1 ORDER BY start_date ASC`).all();
}

function addPrepaidSchedule(data) {
    const totalH   = toHalala(data.total_amount);
    const monthlyH = toHalala(data.monthly_amount);

    // Initial entry: DR Prepaid (1400), CR Cash (1111)
    postJournalEntry({
        entry_date:   fmtDate(data.start_date),
        reference_no: `PRE-${Date.now()}`,
        description:  `مصروف مقدم: ${data.description}`,
        entry_type:   'Manual',
        lines: [
            { account_code: 1400, debit: data.total_amount, credit: 0 },
            { account_code: 1111, debit: 0, credit: data.total_amount },
        ],
        created_by: data.created_by || 1,
    });

    const id = _db.prepare(`
        INSERT INTO prepaid_schedules
        (description, total_amount_halala, start_date, end_date, monthly_amount_halala, expense_account_code, created_by)
        VALUES (?,?,?,?,?,?,?)
    `).run(data.description, totalH, fmtDate(data.start_date), fmtDate(data.end_date),
           monthlyH, data.expense_account_code || 5300, data.created_by || 1).lastInsertRowid;

    return { success: true, id };
}

function runPrepaidAmortisation(month, createdBy = 1) {
    // month: 'YYYY-MM'
    const schedules = _db.prepare(`
        SELECT * FROM prepaid_schedules
        WHERE is_active = 1
          AND start_date <= ? AND end_date >= ?
          AND (last_posted_date IS NULL OR last_posted_date < ?)
    `).all(`${month}-28`, `${month}-01`, `${month}-01`);

    let posted = 0;
    for (const s of schedules) {
        const monthlyAmt = fromHalala(s.monthly_amount_halala);
        try {
            postJournalEntry({
                entry_date:   `${month}-01`,
                reference_no: `AMR-${s.id}-${month}`,
                description:  `إطفاء مصروف مقدم: ${s.description} — ${month}`,
                entry_type:   'Adjusting',
                lines: [
                    { account_code: s.expense_account_code, debit: monthlyAmt, credit: 0 },
                    { account_code: 1400, debit: 0, credit: monthlyAmt },
                ],
                created_by: createdBy,
            });
            _db.prepare(`UPDATE prepaid_schedules SET last_posted_date=? WHERE id=?`).run(`${month}-01`, s.id);
            posted++;
        } catch(_) {}
    }
    return { success: true, posted };
}

function getRecurringExpenses() {
    return _db.prepare(`SELECT *, amount_halala/100.0 as amount FROM recurring_expenses WHERE is_active=1 ORDER BY day_of_month ASC`).all();
}

function addRecurringExpense(data) {
    const id = _db.prepare(`
        INSERT INTO recurring_expenses (expense_name, amount_halala, account_code, day_of_month, start_date, end_date, created_by)
        VALUES (?,?,?,?,?,?,?)
    `).run(data.expense_name, toHalala(data.amount), data.account_code || 5700,
           data.day_of_month || 1, fmtDate(data.start_date), data.end_date ? fmtDate(data.end_date) : null,
           data.created_by || 1).lastInsertRowid;
    return { success: true, id };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-015: PAYROLL MODULE
// ─────────────────────────────────────────────────────────────────────────────

function getEmployees() {
    return _db.prepare(`SELECT * FROM employees WHERE is_active=1 ORDER BY name ASC`).all().map(e => ({
        ...e,
        basic_salary:        fromHalala(e.basic_salary_halala),
        housing_allowance:   fromHalala(e.housing_allowance_halala),
        transport_allowance: fromHalala(e.transport_allowance_halala),
        other_allowances:    fromHalala(e.other_allowances_halala),
    }));
}

function saveEmployee(data) {
    const bH = toHalala(data.basic_salary);
    const hH = toHalala(data.housing_allowance  || 0);
    const tH = toHalala(data.transport_allowance || 0);
    const oH = toHalala(data.other_allowances    || 0);

    if (data.id) {
        _db.prepare(`
            UPDATE employees SET name=?, id_number=?, nationality=?, job_title=?, department=?,
            basic_salary_halala=?, housing_allowance_halala=?, transport_allowance_halala=?,
            other_allowances_halala=?, gosi_registered=?, employment_date=?, bank_iban=?
            WHERE id=?
        `).run(data.name, data.id_number, data.nationality || 'Saudi', data.job_title, data.department,
               bH, hH, tH, oH, data.gosi_registered ? 1 : 0, data.employment_date || null,
               data.bank_iban || null, data.id);
        return { success: true };
    }
    const id = _db.prepare(`
        INSERT INTO employees
        (name, id_number, nationality, job_title, department,
         basic_salary_halala, housing_allowance_halala, transport_allowance_halala,
         other_allowances_halala, gosi_registered, employment_date, bank_iban, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(data.name, data.id_number, data.nationality || 'Saudi', data.job_title, data.department,
           bH, hH, tH, oH, data.gosi_registered ? 1 : 0, data.employment_date || null,
           data.bank_iban || null, data.created_by || 1).lastInsertRowid;
    return { success: true, id };
}

function deleteEmployee(id) {
    _db.prepare(`UPDATE employees SET is_active=0 WHERE id=?`).run(id);
    return { success: true };
}

function createPayrollRun(month, overrides = [], createdBy = 1) {
    // month: 'YYYY-MM'
    const existingRun = _db.prepare(`SELECT id FROM payroll_runs WHERE run_month = ? AND status != 'cancelled'`).get(month);
    if (existingRun) throw new Error(`كشف راتب ${month} موجود بالفعل`);

    const employees = getEmployees();
    if (employees.length === 0) throw new Error('لا يوجد موظفون نشطون');

    return _db.transaction(() => {
        const runId = _db.prepare(`
            INSERT INTO payroll_runs (run_month, status, created_by)
            VALUES (?, 'draft', ?)
        `).run(month, createdBy).lastInsertRowid;

        let totalGrossH = 0, totalGosiEmpH = 0, totalGosiEmpRH = 0, totalNetH = 0;
        const lineStmt = _db.prepare(`
            INSERT INTO payroll_lines
            (payroll_run_id, employee_id, gross_halala, gosi_employee_halala, gosi_employer_halala,
             other_deductions_halala, net_halala, commissions_halala, bonuses_halala)
            VALUES (?,?,?,?,?,?,?,?,?)
        `);

        for (const emp of employees) {
            const override = overrides.find(o => o.employee_id === emp.id) || {};
            const commissions = toHalala(override.commissions || 0);
            const bonuses     = toHalala(override.bonuses     || 0);
            const deductions  = toHalala(override.other_deductions || 0);

            const grossH = emp.basic_salary_halala + emp.housing_allowance_halala +
                           emp.transport_allowance_halala + emp.other_allowances_halala +
                           commissions + bonuses;

            // GOSI rates (2024 Saudi)
            let gosiEmpH = 0, gosiErH = 0;
            if (emp.gosi_registered) {
                if (emp.nationality === 'Saudi') {
                    gosiEmpH = Math.round(emp.basic_salary_halala * 0.09);    // 9% employee
                    gosiErH  = Math.round(emp.basic_salary_halala * 0.1175);  // 11.75% employer
                } else {
                    gosiEmpH = 0;
                    gosiErH  = Math.round(emp.basic_salary_halala * 0.02);    // 2% work hazard only
                }
            }

            const netH = grossH - gosiEmpH - deductions;

            lineStmt.run(runId, emp.id, grossH, gosiEmpH, gosiErH, deductions, netH, commissions, bonuses);

            totalGrossH   += grossH;
            totalGosiEmpH += gosiEmpH;
            totalGosiEmpRH += gosiErH;
            totalNetH     += netH;
        }

        _db.prepare(`
            UPDATE payroll_runs SET
                total_gross_halala=?, total_gosi_employee_halala=?, total_gosi_employer_halala=?,
                total_net_halala=?
            WHERE id=?
        `).run(totalGrossH, totalGosiEmpH, totalGosiEmpRH, totalNetH, runId);

        return {
            success: true,
            run_id: runId,
            total_gross:   fromHalala(totalGrossH),
            total_gosi_employee: fromHalala(totalGosiEmpH),
            total_gosi_employer: fromHalala(totalGosiEmpRH),
            total_net:     fromHalala(totalNetH),
        };
    })();
}

function postPayrollRun(runId, createdBy = 1) {
    const run = _db.prepare(`SELECT * FROM payroll_runs WHERE id = ?`).get(runId);
    if (!run) throw new Error('كشف الراتب غير موجود');
    if (run.status === 'posted') throw new Error('تم ترحيل كشف الراتب بالفعل');

    const [year, mon] = run.run_month.split('-');
    const runDate = `${year}-${mon}-28`;

    return _db.transaction(() => {
        const grossSAR   = fromHalala(run.total_gross_halala);
        const gosiEmpSAR = fromHalala(run.total_gosi_employee_halala);
        const gosiErSAR  = fromHalala(run.total_gosi_employer_halala);
        const netSAR     = fromHalala(run.total_net_halala);

        const jeId = postJournalEntry({
            entry_date:   runDate,
            reference_no: `PAY-${run.run_month}`,
            description:  `كشف رواتب — ${run.run_month}`,
            entry_type:   'Payroll',
            lines: [
                { account_code: 5200, debit: grossSAR,               credit: 0 },          // Salaries Expense
                { account_code: 5210, debit: gosiErSAR,              credit: 0 },          // GOSI Employer Expense
                { account_code: 2210, debit: 0,                      credit: netSAR },     // Salaries Payable
                { account_code: 2220, debit: 0, credit: gosiEmpSAR + gosiErSAR },         // GOSI Payable
            ],
            created_by: createdBy,
        });

        _db.prepare(`UPDATE payroll_runs SET status='posted', journal_entry_id=? WHERE id=?`).run(jeId, runId);
        return { success: true, journal_entry_id: jeId };
    })();
}

function getPayrollRuns(month) {
    let sql = `SELECT * FROM payroll_runs`;
    const params = [];
    if (month) { sql += ` WHERE run_month = ?`; params.push(month); }
    sql += ` ORDER BY id DESC`;
    const runs = _db.prepare(sql).all(...params);

    return runs.map(r => ({
        ...r,
        total_gross:         fromHalala(r.total_gross_halala),
        total_gosi_employee: fromHalala(r.total_gosi_employee_halala),
        total_gosi_employer: fromHalala(r.total_gosi_employer_halala),
        total_net:           fromHalala(r.total_net_halala),
        lines: _db.prepare(`
            SELECT pl.*, e.name as employee_name, e.nationality, e.job_title,
                   pl.gross_halala/100.0 as gross,
                   pl.gosi_employee_halala/100.0 as gosi_employee,
                   pl.gosi_employer_halala/100.0 as gosi_employer,
                   pl.other_deductions_halala/100.0 as other_deductions,
                   pl.net_halala/100.0 as net,
                   pl.commissions_halala/100.0 as commissions,
                   pl.bonuses_halala/100.0 as bonuses
            FROM payroll_lines pl
            JOIN employees e ON pl.employee_id = e.id
            WHERE pl.payroll_run_id = ?
            ORDER BY e.name ASC
        `).all(r.id),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// P-016: ENHANCED AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

function addEnhancedAuditLog({
    user_id, user_name, action, entity_type, entity_id,
    entity_reference, field_name, old_value, new_value, details
}) {
    try {
        _db.prepare(`
            INSERT INTO audit_logs
            (user_id, user_name, action, entity_type, entity_id, entity_reference,
             field_name, old_value, new_value, details)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        `).run(
            user_id || 1,
            user_name || null,
            action,
            entity_type || null,
            entity_id ? String(entity_id) : null,
            entity_reference || null,
            field_name || null,
            old_value != null ? String(old_value) : null,
            new_value != null ? String(new_value) : null,
            details || null,
        );
    } catch(_) {}
}

function getEnhancedAuditLogs(filters = {}) {
    let sql = `
        SELECT al.*, s.name as user_name_from_staff
        FROM audit_logs al
        LEFT JOIN staff s ON al.user_id = s.id
        WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ' AND DATE(al.timestamp) >= ?'; params.push(filters.startDate); }
    if (filters.endDate)   { sql += ' AND DATE(al.timestamp) <= ?'; params.push(filters.endDate); }
    if (filters.user_id)   { sql += ' AND al.user_id = ?';          params.push(filters.user_id); }
    if (filters.entity_type) { sql += ' AND al.entity_type = ?';    params.push(filters.entity_type); }
    if (filters.action)    { sql += ' AND al.action = ?';           params.push(filters.action); }
    sql += ' ORDER BY al.timestamp DESC LIMIT ?';
    params.push(parseInt(filters.limit) || 200);
    return _db.prepare(sql).all(...params);
}

// ─────────────────────────────────────────────────────────────────────────────
// P-018: INVENTORY COSTING (FIFO / AVCO)
// ─────────────────────────────────────────────────────────────────────────────

function addInventoryBatch(productId, purchaseOrderId, qty, unitCostSAR, receivedDate) {
    _db.prepare(`
        INSERT INTO inventory_batches
        (product_id, purchase_order_id, received_date, quantity_received, quantity_remaining, unit_cost_halala)
        VALUES (?,?,?,?,?,?)
    `).run(productId, purchaseOrderId || null, fmtDate(receivedDate || new Date()),
           qty, qty, toHalala(unitCostSAR));
    return { success: true };
}

function getInventoryBatches(productId) {
    return _db.prepare(`
        SELECT *, unit_cost_halala/100.0 as unit_cost
        FROM inventory_batches
        WHERE product_id = ? AND quantity_remaining > 0
        ORDER BY id ASC
    `).all(productId);
}

/**
 * Calculate COGS for a sale item using FIFO or AVCO.
 * costing_method: 'FIFO' | 'AVCO'
 * Returns the total COGS (SAR decimal) and consumes batch quantities for FIFO.
 */
function computeSaleCOGS(productId, qty, costingMethod = 'AVCO') {
    if (costingMethod === 'FIFO') {
        const batches = _db.prepare(`
            SELECT * FROM inventory_batches
            WHERE product_id = ? AND quantity_remaining > 0
            ORDER BY id ASC
        `).all(productId);

        let remaining = qty, totalCost = 0;
        for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(batch.quantity_remaining, remaining);
            totalCost += consume * fromHalala(batch.unit_cost_halala);
            _db.prepare(`UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id=?`)
               .run(consume, batch.id);
            remaining -= consume;
        }
        return totalCost;
    } else {
        // AVCO
        const avgRow = _db.prepare(`
            SELECT COALESCE(
                SUM(quantity_remaining * unit_cost_halala) / NULLIF(SUM(quantity_remaining), 0),
                0
            ) as avg_cost_h
            FROM inventory_batches WHERE product_id = ? AND quantity_remaining > 0
        `).get(productId);
        return fromHalala(Math.round((avgRow.avg_cost_h || 0) * qty));
    }
}

function getStockCountHistory(productId) {
    return _db.prepare(`
        SELECT sc.*, p.name as product_name
        FROM stock_counts sc
        JOIN products p ON sc.product_id = p.id
        WHERE sc.product_id = ?
        ORDER BY sc.count_date DESC LIMIT 50
    `).all(productId);
}

function postStockCount(data, createdBy = 1) {
    const { product_id, count_date, physical_qty, reason } = data;
    const product = _db.prepare(`SELECT * FROM products WHERE id = ?`).get(product_id);
    if (!product) throw new Error('المنتج غير موجود');

    const systemQty = product.stock;
    const diff = parseFloat(physical_qty) - systemQty;

    return _db.transaction(() => {
        // Post adjustment JE if there's a variance
        let jeId = null;
        if (Math.abs(diff) > 0.001) {
            const adjustCost = Math.abs(diff * (product.cost || 0));
            const lines = diff > 0
                ? [
                    { account_code: 1300, debit: adjustCost, credit: 0 },
                    { account_code: 5900, debit: 0, credit: adjustCost },
                  ]
                : [
                    { account_code: 5900, debit: adjustCost, credit: 0 },
                    { account_code: 1300, debit: 0, credit: adjustCost },
                  ];

            if (adjustCost > 0) {
                jeId = postJournalEntry({
                    entry_date:   fmtDate(count_date),
                    reference_no: `SC-${product_id}-${fmtDate(count_date)}`,
                    description:  `تسوية مخزون: ${product.name} (فرق: ${diff > 0 ? '+' : ''}${diff})`,
                    entry_type:   'Adjusting',
                    lines,
                    created_by:   createdBy,
                });
            }

            // Update actual stock
            _db.prepare(`UPDATE products SET stock = ? WHERE id = ?`).run(physical_qty, product_id);
        }

        const id = _db.prepare(`
            INSERT INTO stock_counts (count_date, product_id, system_qty, physical_qty, difference, reason, journal_entry_id, created_by)
            VALUES (?,?,?,?,?,?,?,?)
        `).run(fmtDate(count_date), product_id, systemQty, physical_qty, diff, reason || null, jeId, createdBy).lastInsertRowid;

        return { success: true, id, difference: diff, journal_entry_id: jeId };
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// P-020: SUBSIDIARY LEDGERS
// ─────────────────────────────────────────────────────────────────────────────

function getCustomerSubsidiaryLedger(customerId, startDate, endDate) {
    return getCustomerStatement(customerId, startDate, endDate);
}

function getSupplierSubsidiaryLedger(supplierId, startDate, endDate) {
    const sDate = fmtDate(startDate || new Date(new Date().getFullYear(), 0, 1));
    const eDate = fmtDate(endDate   || new Date());

    const supplier = _db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(supplierId);
    if (!supplier) return null;

    const lines = [];

    // Purchase orders received (debits to AP = credits in supplier ledger)
    const purchases = _db.prepare(`
        SELECT po.id, po.created_at, po.total_amount, po.status, po.received_at
        FROM purchase_orders po
        WHERE po.supplier_id = ?
          AND po.status = 'received'
          AND DATE(COALESCE(po.received_at, po.created_at)) BETWEEN ? AND ?
        ORDER BY po.created_at ASC
    `).all(supplierId, sDate, eDate);

    for (const po of purchases) {
        lines.push({
            date: (po.received_at || po.created_at || '').split('T')[0],
            reference: `PO-${po.id}`,
            description: 'فاتورة توريد',
            debit: 0,
            credit: parseFloat(po.total_amount),
        });
    }

    // Journal entry payments to supplier (account 2100 debit entries)
    const jePayments = _db.prepare(`
        SELECT je.entry_date, je.reference_no, je.description,
               l.debit_halala/100.0 as debit, l.credit_halala/100.0 as credit
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 2100
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
          AND je.description LIKE '%' || ? || '%'
        ORDER BY je.entry_date ASC
    `).all(sDate, eDate, String(supplierId));

    for (const p of jePayments) {
        if (p.debit > 0) {
            lines.push({ date: p.entry_date, reference: p.reference_no, description: p.description || 'دفعة لمورد', debit: p.debit, credit: 0 });
        }
    }

    lines.sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    for (const l of lines) { balance += l.credit - l.debit; l.balance = balance; }

    return { supplier, period: { start: sDate, end: eDate }, lines, closing_balance: balance };
}

function getSubsidiaryControlCheck() {
    // AR: sum of customer balances vs account 1200
    const arSumRow = _db.prepare(`
        SELECT COALESCE(SUM(s.total_amount), 0) as total_credit
        FROM sales s WHERE s.status = 'credit'
    `).get();
    const arPaidRow = _db.prepare(`
        SELECT COALESCE(SUM(amount_halala)/100.0, 0) as total_paid FROM credit_payments
    `).get();
    const arSubsidiary = parseFloat(arSumRow.total_credit) - parseFloat(arPaidRow.total_paid);

    const arGL = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala) / 100.0, 0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 1200 AND je.status != 'reversed'
    `).get().net;

    // AP: from purchase_orders received
    const apPORow = _db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status='received'
    `).get();
    const apGL = _db.prepare(`
        SELECT COALESCE(SUM(l.credit_halala - l.debit_halala) / 100.0, 0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 2100 AND je.status != 'reversed'
    `).get().net;

    return {
        ar: {
            subsidiary_balance: arSubsidiary,
            gl_balance: parseFloat(arGL || 0),
            reconciled: Math.abs(arSubsidiary - parseFloat(arGL || 0)) < 1,
        },
        ap: {
            subsidiary_balance: parseFloat(apPORow.total),
            gl_balance: parseFloat(apGL || 0),
            reconciled: Math.abs(parseFloat(apPORow.total) - parseFloat(apGL || 0)) < 1,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-021: BUDGET
// ─────────────────────────────────────────────────────────────────────────────

function getBudgetVsActual(period) {
    // period: 'YYYY-MM' or 'YYYY' for full year
    const isYear = /^\d{4}$/.test(period);
    const sDate = isYear ? `${period}-01-01` : `${period}-01`;
    const eDate = isYear ? `${period}-12-31` : `${period}-${new Date(period + '-01').toISOString().split('T')[0].split('-')[1] === '02' ? 28 : 30}`;

    const budgets = _db.prepare(`SELECT * FROM budget_entries WHERE period = ?`).all(period);
    const actuals = _db.prepare(`
        SELECT l.account_code, a.type as acc_type,
               SUM(CASE WHEN a.type = 'Revenue' THEN (l.credit_halala - l.debit_halala) ELSE (l.debit_halala - l.credit_halala) END) / 100.0 as net_actual
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE DATE(je.entry_date) BETWEEN ? AND ? AND je.status != 'reversed'
          AND a.type IN ('Revenue', 'Expense')
        GROUP BY l.account_code, a.type
    `).all(sDate, eDate);

    const accounts = _db.prepare(`SELECT * FROM accounts WHERE type IN ('Revenue','Expense') AND level=3`).all();

    return accounts.map(a => {
        const budget = budgets.find(b => b.account_code === a.account_code);
        const actual = actuals.find(x => x.account_code === a.account_code);
        const budgetedH = budget ? budget.budgeted_halala : 0;
        const actualAmt = parseFloat(actual?.net_actual || 0);
        const budgetAmt = budgetedH / 100;
        const variance  = a.type === 'Revenue' ? (actualAmt - budgetAmt) : (budgetAmt - actualAmt);
        return {
            account_code: a.account_code,
            name_ar: a.name_ar,
            type: a.type,
            budgeted: budgetAmt,
            actual: actualAmt,
            variance,
            variance_pct: budgetAmt !== 0 ? ((variance / Math.abs(budgetAmt)) * 100) : null,
        };
    }).filter(r => r.budgeted !== 0 || r.actual !== 0);
}

function saveBudgetEntry(period, account_code, budgeted_amount) {
    _db.prepare(`
        INSERT INTO budget_entries (period, account_code, budgeted_halala)
        VALUES (?,?,?)
        ON CONFLICT(period, account_code) DO UPDATE SET budgeted_halala=excluded.budgeted_halala
    `).run(period, account_code, toHalala(budgeted_amount));
    return { success: true };
}

function getCostCentres() {
    return _db.prepare(`SELECT * FROM cost_centres WHERE is_active=1 ORDER BY name ASC`).all();
}

function saveCostCentre(data) {
    if (data.id) {
        _db.prepare(`UPDATE cost_centres SET name=? WHERE id=?`).run(data.name, data.id);
        return { success: true };
    }
    const id = _db.prepare(`INSERT INTO cost_centres (name) VALUES (?)`).run(data.name).lastInsertRowid;
    return { success: true, id };
}

/**
 * P-003 GL DRILL-DOWN
 */
function getAccountDrillDown(accountCode, startDate, endDate, limit) {
    limit = parseInt(limit) || 200;
    const sDate = fmtDate(startDate || new Date(new Date().getFullYear(), 0, 1));
    const eDate = fmtDate(endDate   || new Date());

    const account = _db.prepare(`SELECT * FROM accounts WHERE account_code = ?`).get(accountCode);
    if (!account) return null;

    const lines = _db.prepare(`
        SELECT l.id, l.account_code, l.description as line_description,
               l.debit_halala  / 100.0 as debit,
               l.credit_halala / 100.0 as credit,
               l.cost_centre_id,
               je.entry_date, je.reference_no, je.description as entry_description,
               je.entry_type, je.id as entry_id,
               cc.name as cost_centre_name
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        LEFT JOIN cost_centres cc ON l.cost_centre_id = cc.id
        WHERE l.account_code = ?
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
        ORDER BY je.entry_date DESC, je.id DESC
        LIMIT ?
    `).all(accountCode, sDate, eDate, limit);

    let runningBal = 0;
    const linesWithBal = [...lines].reverse().map(l => {
        runningBal += (l.debit - l.credit);
        return { ...l, running_balance: runningBal };
    }).reverse();

    const totals = lines.reduce((acc, l) => {
        acc.total_debit  += l.debit;
        acc.total_credit += l.credit;
        return acc;
    }, { total_debit: 0, total_credit: 0 });

    return { account, period: { start: sDate, end: eDate }, lines: linesWithBal, totals };
}

/**
 * P-021 COST CENTRE REPORT
 */
function getCostCentreReport(startDate, endDate) {
    const sDate = fmtDate(startDate || new Date(new Date().getFullYear(), 0, 1));
    const eDate = fmtDate(endDate   || new Date());
    const centres = _db.prepare(`SELECT * FROM cost_centres WHERE is_active=1 ORDER BY name`).all();
    return centres.map(cc => {
        const lines = _db.prepare(`
            SELECT l.account_code, a.name_ar as account_name, a.type,
                   SUM(l.debit_halala)  / 100.0 as total_debit,
                   SUM(l.credit_halala) / 100.0 as total_credit
            FROM journal_entry_lines l
            JOIN journal_entries je ON l.entry_id = je.id
            JOIN accounts a ON l.account_code = a.account_code
            WHERE l.cost_centre_id = ?
              AND je.entry_date BETWEEN ? AND ?
              AND je.status != 'reversed'
            GROUP BY l.account_code
            ORDER BY a.type, l.account_code
        `).all(cc.id, sDate, eDate);
        const totalExpense = lines.filter(l => l.type === 'Expense').reduce((s, l) => s + l.total_debit - l.total_credit, 0);
        const totalRevenue = lines.filter(l => l.type === 'Revenue').reduce((s, l) => s + l.total_credit - l.total_debit, 0);
        return { ...cc, lines, totalExpense, totalRevenue, netContribution: totalRevenue - totalExpense };
    });
}

/**
 * P-014 DEFERRED REVENUE SCHEDULER
 */
function _ensureDeferredRevenueTable() {
    _db.exec(`
        CREATE TABLE IF NOT EXISTS deferred_revenue_schedules (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            description             TEXT    NOT NULL,
            total_amount_halala     INTEGER NOT NULL,
            start_date              TEXT    NOT NULL,
            end_date                TEXT    NOT NULL,
            monthly_amount_halala   INTEGER NOT NULL,
            liability_account_code  INTEGER NOT NULL DEFAULT 2500,
            revenue_account_code    INTEGER NOT NULL DEFAULT 4100,
            last_posted_date        TEXT,
            is_active               INTEGER DEFAULT 1,
            created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by              INTEGER NOT NULL DEFAULT 1
        );
    `);
    try {
        const exists = _db.prepare(`SELECT 1 FROM accounts WHERE account_code=2500`).get();
        if (!exists) {
            _db.prepare(`INSERT INTO accounts (account_code, name_ar, type, level, normal_balance, is_system, is_active) VALUES (2500,'إيراد مؤجل','Liability',3,'credit',0,1)`).run();
        }
    } catch(_) {}
}

function getDeferredRevenueSchedules() {
    _ensureDeferredRevenueTable();
    return _db.prepare(`
        SELECT *, total_amount_halala/100.0 as total_amount, monthly_amount_halala/100.0 as monthly_amount
        FROM deferred_revenue_schedules WHERE is_active=1 ORDER BY start_date ASC
    `).all();
}

function addDeferredRevenueSchedule(data) {
    _ensureDeferredRevenueTable();
    const totalH   = toHalala(data.total_amount);
    const monthlyH = toHalala(data.monthly_amount);
    postJournalEntry({
        entry_date:   fmtDate(data.start_date),
        reference_no: `DEF-${Date.now()}`,
        description:  `إيراد مؤجل: ${data.description}`,
        entry_type:   'Manual',
        lines: [
            { account_code: 1111, debit: data.total_amount, credit: 0 },
            { account_code: data.liability_account_code || 2500, debit: 0, credit: data.total_amount },
        ],
        created_by: data.created_by || 1,
    });
    const id = _db.prepare(`
        INSERT INTO deferred_revenue_schedules
        (description, total_amount_halala, start_date, end_date, monthly_amount_halala,
         liability_account_code, revenue_account_code, created_by)
        VALUES (?,?,?,?,?,?,?,?)
    `).run(
        data.description, totalH, fmtDate(data.start_date), fmtDate(data.end_date),
        monthlyH, data.liability_account_code || 2500, data.revenue_account_code || 4100,
        data.created_by || 1
    ).lastInsertRowid;
    return { success: true, id };
}

function runDeferredRevenueRecognition(month, createdBy) {
    createdBy = createdBy || 1;
    _ensureDeferredRevenueTable();
    const schedules = _db.prepare(`
        SELECT * FROM deferred_revenue_schedules
        WHERE is_active = 1
          AND start_date <= ? AND end_date >= ?
          AND (last_posted_date IS NULL OR last_posted_date < ?)
    `).all(`${month}-28`, `${month}-01`, `${month}-01`);
    let posted = 0;
    for (const s of schedules) {
        const monthlyAmt = fromHalala(s.monthly_amount_halala);
        try {
            postJournalEntry({
                entry_date:   `${month}-01`,
                reference_no: `DREV-${s.id}-${month}`,
                description:  `اعتراف بإيراد مؤجل: ${s.description} — ${month}`,
                entry_type:   'Adjusting',
                lines: [
                    { account_code: s.liability_account_code, debit: monthlyAmt, credit: 0 },
                    { account_code: s.revenue_account_code,   debit: 0, credit: monthlyAmt },
                ],
                created_by: createdBy,
            });
            _db.prepare(`UPDATE deferred_revenue_schedules SET last_posted_date=? WHERE id=?`).run(`${month}-01`, s.id);
            posted++;
        } catch(_) {}
    }
    return { success: true, posted };
}

/**
 * P-021: Derive break-even inputs from the last 3 months of ledger data.
 * Returns { fixedCosts, variableCostPct, avgPrice } as sensible defaults for the slider UI.
 */
function getBreakEvenInputs() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sDate = threeMonthsAgo.toISOString().split('T')[0];
    const eDate = new Date().toISOString().split('T')[0];

    // Fixed costs: sum of rent (5300), utilities (5600), salaries (5200), depreciation (5400)
    const fixedRow = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala) / 100.0, 0) as total
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code IN (5200, 5300, 5400, 5600)
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
    `).get(sDate, eDate);

    // Revenue
    const revRow = _db.prepare(`
        SELECT COALESCE(SUM(l.credit_halala - l.debit_halala) / 100.0, 0) as total
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 4100
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
    `).get(sDate, eDate);

    // COGS
    const cogsRow = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala) / 100.0, 0) as total
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        WHERE l.account_code = 5100
          AND je.entry_date BETWEEN ? AND ?
          AND je.status != 'reversed'
    `).get(sDate, eDate);

    const revenue  = parseFloat(revRow.total  || 0);
    const cogs     = parseFloat(cogsRow.total || 0);
    const fixed    = parseFloat(fixedRow.total || 0);
    const variableCostPct = revenue > 0 ? Math.round((cogs / revenue) * 100) : 40;

    // Average sale price from last 3 months
    const avgRow = _db.prepare(`
        SELECT AVG(total_amount) as avg_price FROM sales
        WHERE DATE(timestamp) BETWEEN ? AND ?
          AND status NOT IN ('void','voided','return')
    `).get(sDate, eDate);
    const avgPrice = Math.round(parseFloat(avgRow?.avg_price || 0)) || 100;

    return {
        fixedCosts:        Math.max(0, Math.round(fixed)),
        variableCostPct:   Math.min(90, Math.max(0, variableCostPct)),
        avgPrice:          Math.max(1, avgPrice),
        period:            { start: sDate, end: eDate },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
// IP-6: PAYROLL DISBURSEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Disburse a posted payroll run.
 * Posts: DR 2210 (Salaries Payable) / CR 1112 (Bank)
 * runId        — ID of a payroll_runs row with status = 'posted'
 * paymentMethod— 'bank' (default) | 'cash'
 * createdBy    — staff id
 */
function disbursePayroll(runId, paymentMethod = 'bank', createdBy = 1) {
    const run = _db.prepare(`SELECT * FROM payroll_runs WHERE id = ?`).get(runId);
    if (!run) throw new Error('كشف الراتب غير موجود');
    if (run.status !== 'posted') throw new Error('يجب ترحيل كشف الراتب أولاً قبل الصرف');
    if (run.status === 'disbursed') throw new Error('تم صرف هذا الكشف مسبقاً');

    const netSAR    = fromHalala(run.total_net_halala);
    const creditAcct = (paymentMethod === 'cash') ? 1111 : 1112;
    const disbursedDate = fmtDate(new Date());

    return _db.transaction(() => {
        const jeId = postJournalEntry({
            entry_date:     disbursedDate,
            reference_no:   `DISB-${run.run_month}`,
            description:    `صرف رواتب — ${run.run_month}`,
            entry_type:     'Auto',
            reference_type: 'payroll_run',
            reference_id:   String(runId),
            lines: [
                { account_code: 2210,       debit: netSAR, credit: 0 },
                { account_code: creditAcct, debit: 0,      credit: netSAR },
            ],
            created_by: createdBy,
        });
        _db.prepare(`UPDATE payroll_runs SET status = 'disbursed' WHERE id = ?`).run(runId);
        return { success: true, journal_entry_id: jeId };
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// IP-7: VAT SETTLEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Settle VAT for a period.
 * Reads getVATReturnBoxes() for net VAT due, then posts:
 *   DR 2300 (VAT Output — full output collected)
 *   CR 2400 (VAT Input  — net off recoverable input)
 *   CR 1112 (Bank       — net payment to ZATCA)
 * If vatDue < 0 (refund): DR 1112, CR 2400, CR/DR 2300 accordingly.
 */
function postVATSettlement(startDate, endDate, paymentDate, createdBy = 1) {
    const boxes = getVATReturnBoxes(startDate, endDate);
    const outputVAT = parseFloat(boxes.box1_standard_vat)   || 0;
    const inputVAT  = parseFloat(boxes.box5_input_vat)       || 0;
    const vatDue    = parseFloat(boxes.box9_vat_due)         || 0;  // outputVAT - inputVAT

    if (Math.abs(vatDue) < 0.01 && Math.abs(outputVAT) < 0.01) {
        throw new Error('لا توجد ضريبة مستحقة لهذه الفترة');
    }

    const pDate = fmtDate(paymentDate || new Date());
    const refNo = `VAT-SET-${startDate.substring(0, 7)}`;

    const lines = [];

    if (vatDue >= 0) {
        // Normal: pay ZATCA
        // DR 2300 (clear output VAT liability)
        lines.push({ account_code: 2300, debit: outputVAT, credit: 0,         description: 'تسوية ضريبة مخرجات' });
        // CR 2400 (clear input VAT asset)
        if (inputVAT > 0) {
            lines.push({ account_code: 2400, debit: 0, credit: inputVAT, description: 'تسوية ضريبة مدخلات' });
        }
        // CR 1112 Bank (payment to ZATCA)
        lines.push({ account_code: 1112, debit: 0, credit: vatDue, description: 'دفع ضريبة لهيئة الزكاة' });
    } else {
        // Refund scenario: ZATCA owes us
        // DR 2300 (clear output)
        lines.push({ account_code: 2300, debit: outputVAT, credit: 0,          description: 'تسوية ضريبة مخرجات' });
        // DR 1112 (refund receivable from ZATCA)
        lines.push({ account_code: 1112, debit: Math.abs(vatDue), credit: 0,   description: 'استرداد ضريبة من هيئة الزكاة' });
        // CR 2400 (clear input asset)
        lines.push({ account_code: 2400, debit: 0, credit: inputVAT,           description: 'تسوية ضريبة مدخلات' });
    }

    const jeId = postJournalEntry({
        entry_date:     pDate,
        reference_no:   refNo,
        description:    `تسوية ضريبة القيمة المضافة — ${startDate.substring(0,7)}`,
        entry_type:     'Auto',
        reference_type: 'vat_settlement',
        reference_id:   `${startDate}:${endDate}`,
        lines,
        created_by:     createdBy,
    });

    return {
        success:          true,
        journal_entry_id: jeId,
        output_vat:       outputVAT,
        input_vat:        inputVAT,
        vat_due:          vatDue,
        is_refund:        vatDue < 0,
    };
}

module.exports = {
    initP2,
    // AR
    getARAgingReport,
    getCustomerStatement,
    recordCustomerPayment,
    checkCreditLimit,
    // Fixed Assets
    getFixedAssets,
    addFixedAsset,
    updateFixedAsset,
    disposeFixedAsset,
    runDepreciation,
    getDepreciationSchedule,
    // Bank Reconciliation
    getBankAccounts,
    saveBankAccount,
    getBankReconciliations,
    saveBankReconciliation,
    getBankTransactions,
    matchBankLines,
    unmatchBankLine,
    getBankRecMatches,
    getUnmatchedBankTransactions,
    getCheques,
    saveCheque,
    updateChequeStatus,
    // VAT
    getVATReturnBoxes,
    // Accruals
    getPrepaidSchedules,
    addPrepaidSchedule,
    runPrepaidAmortisation,
    getRecurringExpenses,
    addRecurringExpense,
    // Payroll
    getEmployees,
    saveEmployee,
    deleteEmployee,
    createPayrollRun,
    postPayrollRun,
    getPayrollRuns,
    // Audit
    addEnhancedAuditLog,
    getEnhancedAuditLogs,
    // Inventory Costing
    addInventoryBatch,
    getInventoryBatches,
    computeSaleCOGS,
    getStockCountHistory,
    postStockCount,
    // Subsidiary Ledgers
    getCustomerSubsidiaryLedger,
    getSupplierSubsidiaryLedger,
    getSubsidiaryControlCheck,
    // Budget
    getBudgetVsActual,
    saveBudgetEntry,
    getCostCentres,
    saveCostCentre,
    getBreakEvenInputs,
    getCostCentreReport,
    // GL Drill-Down (P-003)
    getAccountDrillDown,
    // Deferred Revenue (P-014)
    getDeferredRevenueSchedules,
    addDeferredRevenueSchedule,
    runDeferredRevenueRecognition,
    // IP-6: Payroll Disbursement
    disbursePayroll,
    // IP-7: VAT Settlement
    postVATSettlement,
};
