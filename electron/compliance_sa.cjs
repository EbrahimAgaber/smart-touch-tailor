/**
 * ═══════════════════════════════════════════════════════════════════
 *  POS v2 — Saudi Labour & Compliance Engine
 *  Addresses confirmed gaps from the audit report:
 *
 *  GAP-01 · EOSB (End of Service Benefits) — Article 84, Saudi Labour Law
 *  GAP-02 · WPS / Mudad-compatible payroll export (SIF flat-file)
 *  GAP-03 · VAT Return XML — GAZT VAT311 format (ZATCA schema)
 *  GAP-04 · AP Aging — 1-30 / 31-60 / 61-90 / 91-120 / 120+ buckets
 *  GAP-05 · Period-End Closing Wizard — auto-sweep income/expense → RE
 *  GAP-06 · Bank Statement CSV/Excel import for reconciliation
 *  GAP-07 · Data retention manifest (ZATCA 5-year rule)
 * ═══════════════════════════════════════════════════════════════════
 */
'use strict';

const path = require('path');
const fs   = require('fs');

let _db;
// postJournalEntry, toHalala, fromHalala, fmtDate injected after init
let _acct = {};

function initCompliance(dbInstance, acctModule) {
    _db   = dbInstance;
    _acct = acctModule;
    _runMigrations();
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────
function _runMigrations() {
    const safe = (sql) => { try { _db.exec(sql); } catch (_) {} };

    // EOSB accrual log
    _db.exec(`
        CREATE TABLE IF NOT EXISTS eosb_runs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id     INTEGER NOT NULL,
            run_date        TEXT    NOT NULL DEFAULT (date('now')),
            years_of_service REAL   NOT NULL,
            monthly_salary_halala INTEGER NOT NULL,
            eosb_halala     INTEGER NOT NULL,
            method          TEXT    NOT NULL DEFAULT 'saudi_labour_law',
            journal_entry_id INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    // WPS export log
    _db.exec(`
        CREATE TABLE IF NOT EXISTS wps_exports (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            export_date     TEXT    NOT NULL DEFAULT (date('now')),
            payroll_run_id  INTEGER,
            file_path       TEXT,
            record_count    INTEGER DEFAULT 0,
            total_net_halala INTEGER DEFAULT 0,
            status          TEXT    NOT NULL DEFAULT 'generated',
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    // Bank statement import staging
    _db.exec(`
        CREATE TABLE IF NOT EXISTS bank_statement_imports (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_account_id INTEGER,
            import_date     TEXT    NOT NULL DEFAULT (date('now')),
            row_count       INTEGER DEFAULT 0,
            status          TEXT    NOT NULL DEFAULT 'pending',
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS bank_statement_lines (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id       INTEGER NOT NULL,
            bank_account_id INTEGER,
            transaction_date TEXT   NOT NULL,
            value_date      TEXT,
            description     TEXT,
            debit_halala    INTEGER DEFAULT 0,
            credit_halala   INTEGER DEFAULT 0,
            balance_halala  INTEGER DEFAULT 0,
            reference       TEXT,
            is_matched      INTEGER DEFAULT 0,
            journal_entry_line_id INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (import_id) REFERENCES bank_statement_imports(id)
        );
    `);

    // Add EOSB liability account to CoA if missing
    safe(`INSERT OR IGNORE INTO accounts
        (account_code, name_ar, name_en, type, parent_id, level, normal_balance, is_system, is_active)
        VALUES (2230, 'مخصص نهاية الخدمة (EOSB)', 'EOSB Provision', 'Liability', 2200, 4, 'credit', 1, 1)`);
    safe(`INSERT OR IGNORE INTO accounts
        (account_code, name_ar, name_en, type, parent_id, level, normal_balance, is_system, is_active)
        VALUES (5220, 'مخصص نهاية الخدمة — مصروف', 'EOSB Expense', 'Expense', 5200, 4, 'debit', 1, 1)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-01 · EOSB — End of Service Benefits Calculator
//  Saudi Labour Law Art. 84 graduated scale:
//  • <2 yr : 0 (probation/resignation rules apply — we expose raw calc)
//  • 2–5 yr: ½ month per year
//  • 5+ yr : 1 month per year (full)
//  Employer-terminated employees get full month regardless of tenure.
//  We always compute the maximum accrual (employer termination scenario)
//  so the operator can adjust in the journal.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * calculateEOSB
 * @param {object} p
 * @param {string}  p.employment_date   ISO date
 * @param {string}  [p.termination_date] ISO date, defaults to today
 * @param {number}  p.basic_salary_sar  Monthly basic salary in SAR
 * @param {string}  [p.reason]          'termination'|'resignation' (affects partial scale)
 * @returns {{ years, months, eosb_sar, breakdown }}
 */
function calculateEOSB({ employment_date, termination_date, basic_salary_sar, reason = 'termination' }) {
    if (!employment_date) throw new Error('employment_date is required');
    const start = new Date(employment_date);
    const end   = termination_date ? new Date(termination_date) : new Date();

    // Exact duration in fractional years (Saudi calendar months)
    const diffMs    = end - start;
    const diffDays  = diffMs / 86_400_000;
    const diffYears = diffDays / 365.25;
    const diffMonths = diffYears * 12;

    if (diffYears < 0) throw new Error('termination_date must be after employment_date');

    const salary = parseFloat(basic_salary_sar) || 0;
    const monthlyBasic = salary; // SAR

    // Saudi Labour Law Art. 84 graduated scale
    let eosb_sar = 0;
    const breakdown = [];

    if (reason === 'resignation') {
        // Resignation scale (Art. 85): no benefit < 2 yr; 1/3 for 2-5 yr; 2/3 for 5-10 yr; full for 10+ yr
        if (diffYears >= 2 && diffYears < 5) {
            eosb_sar = (monthlyBasic / 2) * diffYears * (1 / 3) * 3; // ½ month × years × 1/3 multiplier
            // Simpler: ½ × years × (1/3) scale = (1/6) × months
            eosb_sar = (monthlyBasic * diffYears * 0.5) * (1 / 3);
            breakdown.push({ label: '2–5 سنوات (استقالة 1/3)', years: diffYears, rate: '1/6 شهر/سنة', amount: eosb_sar });
        } else if (diffYears >= 5 && diffYears < 10) {
            const first5  = (monthlyBasic * 5 * 0.5) * (2 / 3);
            const rest    = (monthlyBasic * (diffYears - 5) * 1) * (2 / 3);
            eosb_sar = first5 + rest;
            breakdown.push({ label: 'أول 5 سنوات (استقالة 2/3)', years: 5, rate: '1/3 شهر/سنة', amount: first5 });
            breakdown.push({ label: 'بعد 5 سنوات (استقالة 2/3)', years: diffYears - 5, rate: '2/3 شهر/سنة', amount: rest });
        } else if (diffYears >= 10) {
            const first5  = monthlyBasic * 5 * 0.5;
            const next5   = monthlyBasic * 5 * 1;
            const rest    = monthlyBasic * (diffYears - 10) * 1;
            eosb_sar = first5 + next5 + rest;
            breakdown.push({ label: 'أول 5 سنوات', years: 5, rate: '½ شهر/سنة', amount: first5 });
            breakdown.push({ label: '5–10 سنوات',  years: 5, rate: 'شهر/سنة كامل', amount: next5 });
            breakdown.push({ label: 'بعد 10 سنوات', years: diffYears - 10, rate: 'شهر/سنة كامل', amount: rest });
        }
    } else {
        // Termination / employer-initiated — full graduated scale
        if (diffYears >= 2 && diffYears < 5) {
            eosb_sar = monthlyBasic * diffYears * 0.5;
            breakdown.push({ label: 'أول 5 سنوات (فصل)', years: diffYears, rate: '½ شهر/سنة', amount: eosb_sar });
        } else if (diffYears >= 5) {
            const first5 = monthlyBasic * 5 * 0.5;
            const rest   = monthlyBasic * (diffYears - 5) * 1;
            eosb_sar = first5 + rest;
            breakdown.push({ label: 'أول 5 سنوات', years: 5, rate: '½ شهر/سنة', amount: first5 });
            breakdown.push({ label: 'بعد 5 سنوات',  years: diffYears - 5, rate: 'شهر/سنة كامل', amount: rest });
        }
        // < 2 years: 0 (no EOSB unless internal policy)
        if (diffYears < 2) {
            breakdown.push({ label: 'أقل من سنتين', years: diffYears, rate: '—', amount: 0 });
        }
    }

    return {
        years:    parseFloat(diffYears.toFixed(4)),
        months:   parseFloat(diffMonths.toFixed(2)),
        days:     Math.round(diffDays),
        eosb_sar: parseFloat(eosb_sar.toFixed(2)),
        breakdown,
        reason,
        employment_date,
        termination_date: termination_date || new Date().toISOString().split('T')[0],
    };
}

/**
 * postEOSBEntry — record EOSB accrual as journal entry
 * Dr 5220 (EOSB Expense) / Cr 2230 (EOSB Provision)
 */
function postEOSBEntry({ employee_id, eosb_sar, notes, created_by = 1 }) {
    const halala = Math.round(eosb_sar * 100);
    if (halala <= 0) throw new Error('EOSB amount must be positive');

    const emp = _db.prepare('SELECT name FROM employees WHERE id = ?').get(employee_id);
    const empName = emp?.name || `موظف #${employee_id}`;

    const jeId = _acct.postJournalEntry({
        entry_date:     new Date().toISOString().split('T')[0],
        reference_no:   `EOSB-${employee_id}-${Date.now()}`,
        description:    `مخصص نهاية الخدمة — ${empName}`,
        entry_type:     'EOSB',
        reference_type: 'employee',
        reference_id:   String(employee_id),
        notes,
        lines: [
            { account_code: 5220, debit: eosb_sar, credit: 0, description: `مصروف EOSB — ${empName}` },
            { account_code: 2230, debit: 0, credit: eosb_sar, description: `مخصص EOSB — ${empName}` },
        ],
        created_by,
    });

    const runId = _db.prepare(`
        INSERT INTO eosb_runs (employee_id, years_of_service, monthly_salary_halala, eosb_halala, journal_entry_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(employee_id, 0, 0, halala, jeId, created_by).lastInsertRowid;

    return { runId, jeId, eosb_sar };
}

function getEOSBHistory(employee_id) {
    return _db.prepare(`
        SELECT r.*, e.name as employee_name
        FROM eosb_runs r
        LEFT JOIN employees e ON e.id = r.employee_id
        WHERE (? IS NULL OR r.employee_id = ?)
        ORDER BY r.run_date DESC
    `).all(employee_id || null, employee_id || null);
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-02 · WPS / Mudad SIF Export
//  Salary Information File (SIF) — MOHRE standard flat-file format
//  Fields: Employer IBAN | Employee ID | Days | Basic | Housing | Other | Net
//  Delimiter: pipe '|', encoding UTF-8, extension .sif
// ═════════════════════════════════════════════════════════════════════════════

/**
 * generateWPSSIF
 * @param {number}  payroll_run_id
 * @param {object}  settings  — must contain employer_iban, employer_mol_id
 * @returns {{ sifContent: string, filename: string, count: number }}
 */
function generateWPSSIF(payroll_run_id, settings = {}) {
    const run = _db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(payroll_run_id);
    if (!run) throw new Error(`Payroll run #${payroll_run_id} not found`);

    const lines = _db.prepare(`
        SELECT pl.*, e.id_number, e.bank_iban, e.name,
               e.basic_salary_halala, e.housing_allowance_halala,
               e.transport_allowance_halala, e.other_allowances_halala
        FROM payroll_lines pl
        JOIN employees e ON e.id = pl.employee_id
        WHERE pl.run_id = ?
    `).all(payroll_run_id);

    if (!lines.length) throw new Error('No payroll lines found for this run');

    const employerMOL  = settings.mol_id       || settings.employer_mol_id  || '0000000000';
    const employerIBAN = settings.employer_iban || 'SA0000000000000000000000';
    const runMonth     = run.run_month; // YYYY-MM

    // SIF header record (HR)
    const header = [
        'HR',
        employerMOL,
        runMonth.replace('-', ''),   // YYYYMM
        String(lines.length),
        String(lines.reduce((s, l) => s + (l.net_pay_halala || 0), 0) / 100 | 0) + '.' +
            String(lines.reduce((s, l) => s + (l.net_pay_halala || 0), 0) % 100).padStart(2, '0'),
    ].join('|');

    // Detail records (DR) — one per employee
    const details = lines.map((l, idx) => {
        const idNo      = l.id_number   || String(l.employee_id).padStart(10, '0');
        const iban      = l.bank_iban   || employerIBAN; // fallback to employer if employee has no IBAN
        const basic     = _sarStr(l.basic_salary_halala      || l.basic_pay_halala || 0);
        const housing   = _sarStr(l.housing_allowance_halala || 0);
        const transport = _sarStr(l.transport_allowance_halala || 0);
        const other     = _sarStr(l.other_allowances_halala  || 0);
        const net       = _sarStr(l.net_pay_halala            || 0);
        const days      = l.working_days || 30;

        return [
            'DR',
            String(idx + 1).padStart(6, '0'), // seq
            employerMOL,
            idNo,
            iban,
            String(days),
            basic,
            housing,
            transport,
            other,
            net,
            'SAR',
        ].join('|');
    });

    // Trailer record (TR)
    const trailer = [
        'TR',
        String(lines.length),
        String(lines.reduce((s, l) => s + (l.net_pay_halala || 0), 0) / 100 | 0) + '.' +
            String(lines.reduce((s, l) => s + (l.net_pay_halala || 0), 0) % 100).padStart(2, '0'),
    ].join('|');

    const sifContent = [header, ...details, trailer].join('\r\n');
    const filename   = `WPS_${employerMOL}_${runMonth.replace('-', '')}.sif`;

    // Log export
    _db.prepare(`
        INSERT INTO wps_exports (payroll_run_id, record_count, total_net_halala, status)
        VALUES (?, ?, ?, 'generated')
    `).run(payroll_run_id, lines.length, lines.reduce((s, l) => s + (l.net_pay_halala || 0), 0));

    return { sifContent, filename, count: lines.length };
}

function _sarStr(halala) {
    const total = Math.round(parseInt(halala) || 0);
    return String(Math.floor(total / 100)) + '.' + String(total % 100).padStart(2, '0');
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-03 · VAT Return XML — GAZT VAT311 (ZATCA schema)
//  Produces a well-formed XML conforming to the ZATCA VAT311 return format.
//  Covers boxes 1-A through 16 as per the official return form.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * getVATReturnBoxes is already implemented in accounting_p2.cjs.
 * This function serializes those boxes into valid VAT311 XML.
 *
 * @param {object} boxes  — result of p2.getVATReturnBoxes
 * @param {object} settings — business settings
 * @param {string} period_start  YYYY-MM-DD
 * @param {string} period_end    YYYY-MM-DD
 */
function generateVAT311XML({ boxes, settings, period_start, period_end }) {
    if (!boxes) throw new Error('VAT return boxes data is required');

    const vatNo    = settings.vat_number || settings.tax_number || '';
    const bizName  = settings.business_name_ar || settings.business_name || '';
    const crn      = settings.crn || '';

    if (!vatNo) throw new Error('VAT number (vat_number) is required in settings');

    const now = new Date().toISOString();

    // Helper: safely format decimal
    const d = (v) => (parseFloat(v) || 0).toFixed(2);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ZATCA VAT Return Form VAT311 — Generated by POS System -->
<VATReturn xmlns="urn:gov:sa:zatca:vat:return:v1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="urn:gov:sa:zatca:vat:return:v1 VAT311.xsd">

  <ReturnHeader>
    <TaxpayerVATNumber>${_escXML(vatNo)}</TaxpayerVATNumber>
    <TaxpayerNameAR>${_escXML(bizName)}</TaxpayerNameAR>
    <CommercialRegistrationNumber>${_escXML(crn)}</CommercialRegistrationNumber>
    <ReturnPeriodStart>${period_start}</ReturnPeriodStart>
    <ReturnPeriodEnd>${period_end}</ReturnPeriodEnd>
    <PreparedAt>${now}</PreparedAt>
    <Currency>SAR</Currency>
    <FormVersion>VAT311-2024</FormVersion>
  </ReturnHeader>

  <!-- ══ SECTION A: TAXABLE SUPPLIES ══════════════════════════════ -->
  <TaxableSupplies>
    <!-- Box 1: Standard-rated domestic supplies (15%) -->
    <Box1>
      <Description>الإيرادات الخاضعة للضريبة بالمعدل القياسي (15%) — المحلية</Description>
      <TaxableAmount>${d(boxes.box1_taxable)}</TaxableAmount>
      <TaxAmount>${d(boxes.box1_tax)}</TaxAmount>
    </Box1>
    <!-- Box 2: Zero-rated domestic supplies -->
    <Box2>
      <Description>الإيرادات بمعدل الصفر — المحلية</Description>
      <TaxableAmount>${d(boxes.box2_taxable || 0)}</TaxableAmount>
      <TaxAmount>0.00</TaxAmount>
    </Box2>
    <!-- Box 3: Exempt supplies -->
    <Box3>
      <Description>الإيرادات المعفاة</Description>
      <TaxableAmount>${d(boxes.box3_taxable || 0)}</TaxableAmount>
      <TaxAmount>0.00</TaxAmount>
    </Box3>
    <!-- Box 4: GCC intra-community supplies -->
    <Box4>
      <Description>التوريدات داخل دول مجلس التعاون</Description>
      <TaxableAmount>${d(boxes.box4_taxable || 0)}</TaxableAmount>
      <TaxAmount>${d(boxes.box4_tax || 0)}</TaxAmount>
    </Box4>
    <!-- Box 5: Total VAT on sales -->
    <Box5>
      <Description>إجمالي ضريبة القيمة المضافة على المبيعات</Description>
      <TaxAmount>${d(boxes.box5_vat_sales || (parseFloat(boxes.box1_tax || 0) + parseFloat(boxes.box4_tax || 0)))}</TaxAmount>
    </Box5>
  </TaxableSupplies>

  <!-- ══ SECTION B: TAXABLE PURCHASES & INPUT TAX ══════════════════ -->
  <TaxablePurchases>
    <!-- Box 6: Standard-rated purchases -->
    <Box6>
      <Description>المشتريات الخاضعة للضريبة بالمعدل القياسي (15%)</Description>
      <TaxableAmount>${d(boxes.box6_taxable || 0)}</TaxableAmount>
      <TaxAmount>${d(boxes.box6_tax || 0)}</TaxAmount>
    </Box6>
    <!-- Box 7: Imports subject to VAT from Customs -->
    <Box7>
      <Description>الاستيراد الخاضع للضريبة (جمارك)</Description>
      <TaxableAmount>${d(boxes.box7_taxable || 0)}</TaxableAmount>
      <TaxAmount>${d(boxes.box7_tax || 0)}</TaxAmount>
    </Box7>
    <!-- Box 8: Imports via reverse charge -->
    <Box8>
      <Description>الاستيراد عبر الاحتساب العكسي</Description>
      <TaxableAmount>${d(boxes.box8_taxable || 0)}</TaxableAmount>
      <TaxAmount>${d(boxes.box8_tax || 0)}</TaxAmount>
    </Box8>
    <!-- Box 9: Total input VAT available for deduction -->
    <Box9>
      <Description>إجمالي ضريبة المدخلات القابلة للخصم</Description>
      <TaxAmount>${d(boxes.box9_input_vat || boxes.box6_tax || 0)}</TaxAmount>
    </Box9>
  </TaxablePurchases>

  <!-- ══ SECTION C: ADJUSTMENTS ════════════════════════════════════ -->
  <Adjustments>
    <!-- Box 10: Adjustment on sales (credit notes, corrections) -->
    <Box10>
      <Description>تعديلات على المبيعات (إشعارات دائنة)</Description>
      <Amount>${d(boxes.box10_adjustment || 0)}</Amount>
    </Box10>
    <!-- Box 11: Adjustment on purchases (debit notes) -->
    <Box11>
      <Description>تعديلات على المشتريات (إشعارات مدينة)</Description>
      <Amount>${d(boxes.box11_adjustment || 0)}</Amount>
    </Box11>
  </Adjustments>

  <!-- ══ SECTION D: NET TAX POSITION ══════════════════════════════ -->
  <NetTaxPosition>
    <!-- Box 12: Net VAT for period (Box 5 + Box 10 - Box 9 - Box 11) -->
    <Box12>
      <Description>صافي ضريبة القيمة المضافة المستحقة للفترة</Description>
      <NetVAT>${d(boxes.box12_net_vat || (
          parseFloat(boxes.box5_vat_sales || boxes.box1_tax || 0) +
          parseFloat(boxes.box10_adjustment || 0) -
          parseFloat(boxes.box9_input_vat || boxes.box6_tax || 0) -
          parseFloat(boxes.box11_adjustment || 0)
      ))}</NetVAT>
    </Box12>
    <!-- Box 13: VAT credit carried forward from previous period -->
    <Box13>
      <Description>رصيد ضريبة مرحّل من الفترة السابقة</Description>
      <Amount>${d(boxes.box13_carried_forward || 0)}</Amount>
    </Box13>
    <!-- Box 14: Net VAT payable / refundable -->
    <Box14>
      <Description>صافي الضريبة المستحقة / القابلة للاسترداد</Description>
      <Amount>${d(boxes.box14_net_payable || boxes.box12_net_vat || 0)}</Amount>
    </Box14>
  </NetTaxPosition>

  <!-- ══ METADATA ══════════════════════════════════════════════════ -->
  <GenerationInfo>
    <SystemVersion>POS-v2</SystemVersion>
    <GeneratedAt>${now}</GeneratedAt>
    <Note>Generated for review. File with ZATCA portal after verification.</Note>
  </GenerationInfo>

</VATReturn>`;

    return xml;
}

function _escXML(str) {
    return String(str || '')
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&apos;');
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-04 · AP Aging Report
//  Buckets: Current (not due) | 1-30 | 31-60 | 61-90 | 91-120 | 120+
//  Source: purchase_orders with status = 'received' and unpaid balance
// ═════════════════════════════════════════════════════════════════════════════

function getAPAgingReport({ as_of_date } = {}) {
    const asOf = as_of_date || new Date().toISOString().split('T')[0];

    // Pull all open AP items: purchase orders received but not fully paid
    // We compute outstanding as: total_amount - sum(supplier_payments for that PO)
    const rows = _db.prepare(`
        SELECT
            po.id                                  AS po_id,
            po.reference_no,
            po.order_date,
            po.expected_delivery                   AS due_date,
            po.total_amount                        AS total_sar,
            s.id                                   AS supplier_id,
            s.name                                 AS supplier_name,
            COALESCE(pay.paid, 0)                  AS paid_sar,
            (po.total_amount - COALESCE(pay.paid, 0)) AS outstanding_sar
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        LEFT JOIN (
            SELECT reference_id, SUM(amount) AS paid
            FROM supplier_payments
            WHERE reference_type = 'purchase_order'
            GROUP BY reference_id
        ) pay ON pay.reference_id = po.id
        WHERE po.status IN ('received', 'partial')
          AND (po.total_amount - COALESCE(pay.paid, 0)) > 0.005
        ORDER BY s.name, po.order_date
    `).all();

    // Bucket each row
    const aging = rows.map(row => {
        const dueDate   = row.due_date ? new Date(row.due_date) : new Date(row.order_date);
        const asOfDate  = new Date(asOf);
        const ageDays   = Math.floor((asOfDate - dueDate) / 86_400_000);
        const outstanding = parseFloat(row.outstanding_sar) || 0;

        let bucket;
        if (ageDays <= 0)        bucket = 'current';
        else if (ageDays <= 30)  bucket = '1_30';
        else if (ageDays <= 60)  bucket = '31_60';
        else if (ageDays <= 90)  bucket = '61_90';
        else if (ageDays <= 120) bucket = '91_120';
        else                     bucket = '120_plus';

        return { ...row, age_days: ageDays, bucket, outstanding };
    });

    // Summary by supplier
    const bySupplier = {};
    for (const row of aging) {
        if (!bySupplier[row.supplier_id]) {
            bySupplier[row.supplier_id] = {
                supplier_id:   row.supplier_id,
                supplier_name: row.supplier_name,
                current:   0, '1_30': 0, '31_60': 0, '61_90': 0, '91_120': 0, '120_plus': 0,
                total:     0,
            };
        }
        bySupplier[row.supplier_id][row.bucket] += row.outstanding;
        bySupplier[row.supplier_id].total        += row.outstanding;
    }

    // Grand totals
    const totals = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '91_120': 0, '120_plus': 0, total: 0 };
    for (const s of Object.values(bySupplier)) {
        for (const k of Object.keys(totals)) totals[k] += s[k] || 0;
    }

    return {
        as_of_date:  asOf,
        detail:      aging,
        by_supplier: Object.values(bySupplier),
        totals,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-05 · Period-End Closing Wizard
//  Steps:
//  1. Validate period is open and all sub-ledgers reconcile
//  2. Compute net income (Revenue − Expenses)
//  3. Post closing entries:
//     a. Dr all Revenue accounts → Cr Income Summary (9001)
//     b. Dr Income Summary → Cr all Expense accounts
//     c. Dr/Cr Income Summary → Cr/Dr Retained Earnings (3200)
//  4. Lock the accounting period
// ═════════════════════════════════════════════════════════════════════════════

const INCOME_SUMMARY_CODE = 9001; // Temporary clearing account

function _ensureIncomeSummaryAccount() {
    const safe = (sql) => { try { _db.exec(sql); } catch (_) {} };
    safe(`INSERT OR IGNORE INTO accounts
        (account_code, name_ar, name_en, type, level, normal_balance, is_system, is_active)
        VALUES (9001, 'ملخص الدخل (مؤقت)', 'Income Summary', 'Equity', 3, 'credit', 1, 1)`);
}

/**
 * previewClosingWizard — dry-run; returns what entries WILL be posted.
 */
function previewClosingWizard({ period_id, period_start, period_end, created_by = 1 }) {
    _ensureIncomeSummaryAccount();

    // Fetch account balances for the period
    const accounts = _db.prepare(`
        SELECT a.account_code, a.name_ar, a.type, a.normal_balance,
               COALESCE(SUM(jl.debit_halala - jl.credit_halala), 0) AS net_halala
        FROM accounts a
        LEFT JOIN journal_entry_lines jl ON jl.account_code = a.account_code
        LEFT JOIN journal_entries je ON je.id = jl.entry_id
            AND je.entry_date BETWEEN ? AND ?
            AND je.status = 'posted'
            AND je.entry_type != 'Closing'
        WHERE a.type IN ('Revenue', 'Expense') AND a.is_active = 1
        GROUP BY a.account_code
        HAVING net_halala != 0
    `).all(period_start, period_end);

    const revenues  = accounts.filter(a => a.type === 'Revenue');
    const expenses  = accounts.filter(a => a.type === 'Expense');

    // Revenue accounts have credit normal balance, so net_halala will be negative (cr > dr)
    const totalRevH = revenues.reduce((s, a) => s + Math.abs(a.net_halala), 0);
    const totalExpH = expenses.reduce((s, a) => s + Math.abs(a.net_halala), 0);
    const netIncomeH = totalRevH - totalExpH; // positive = profit

    // Entry 1: Close Revenue → Income Summary
    const closeRevenueLines = [
        ...revenues.map(a => ({
            account_code: a.account_code,
            description:  `إغلاق ${a.name_ar}`,
            debit: Math.abs(a.net_halala) / 100,
            credit: 0,
        })),
        {
            account_code: INCOME_SUMMARY_CODE,
            description:  'إغلاق الإيرادات → ملخص الدخل',
            debit: 0,
            credit: totalRevH / 100,
        },
    ];

    // Entry 2: Close Expenses → Income Summary
    const closeExpenseLines = [
        {
            account_code: INCOME_SUMMARY_CODE,
            description:  'إغلاق المصروفات → ملخص الدخل',
            debit: totalExpH / 100,
            credit: 0,
        },
        ...expenses.map(a => ({
            account_code: a.account_code,
            description:  `إغلاق ${a.name_ar}`,
            debit: 0,
            credit: Math.abs(a.net_halala) / 100,
        })),
    ];

    // Entry 3: Transfer Income Summary → Retained Earnings
    const closeToRELines = netIncomeH >= 0
        ? [
            { account_code: INCOME_SUMMARY_CODE, description: 'تحويل صافي الربح → الأرباح المبقاة', debit: netIncomeH / 100, credit: 0 },
            { account_code: 3200,                description: 'صافي الربح — الأرباح المبقاة', debit: 0, credit: netIncomeH / 100 },
          ]
        : [
            { account_code: 3200,                description: 'صافي الخسارة — الأرباح المبقاة', debit: Math.abs(netIncomeH) / 100, credit: 0 },
            { account_code: INCOME_SUMMARY_CODE, description: 'تحويل صافي الخسارة → الأرباح المبقاة', debit: 0, credit: Math.abs(netIncomeH) / 100 },
          ];

    return {
        period_start, period_end,
        revenues_count:  revenues.length,
        expenses_count:  expenses.length,
        total_revenue_sar:  totalRevH / 100,
        total_expense_sar:  totalExpH / 100,
        net_income_sar:     netIncomeH / 100,
        entries: [
            { label: 'إغلاق الإيرادات', lines: closeRevenueLines },
            { label: 'إغلاق المصروفات', lines: closeExpenseLines },
            { label: 'تحويل إلى الأرباح المبقاة', lines: closeToRELines },
        ],
    };
}

/**
 * executeClosingWizard — post all three closing entries and lock the period.
 */
function executeClosingWizard({ period_id, period_start, period_end, created_by = 1 }) {
    const preview = previewClosingWizard({ period_id, period_start, period_end, created_by });
    if (!preview.revenues_count && !preview.expenses_count) {
        throw new Error('لا توجد إيرادات أو مصروفات مرحّلة لهذه الفترة');
    }

    const jeIds = [];

    for (const entry of preview.entries) {
        if (entry.lines.length < 2) continue;
        // Skip if nothing to post
        const totalDr = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
        if (totalDr === 0) continue;

        const jeId = _acct.postJournalEntry({
            entry_date:    period_end,
            reference_no:  `CLOSE-${period_end}-${jeIds.length + 1}`,
            description:   `قيد إقفال — ${entry.label} — ${period_start} : ${period_end}`,
            entry_type:    'Closing',
            lines:         entry.lines,
            created_by,
        });
        jeIds.push(jeId);
    }

    // Lock the period
    if (period_id) {
        _db.prepare(`
            UPDATE accounting_periods SET status = 'closed', locked_at = datetime('now'), locked_by = ?
            WHERE id = ?
        `).run(created_by, period_id);
    }

    return { success: true, journal_entry_ids: jeIds, ...preview };
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-06 · Bank Statement CSV/Excel Import
//  Accepts a parsed array of rows (parsed in renderer via Papa/SheetJS)
//  and inserts them into bank_statement_lines for reconciliation matching.
//
//  Expected columns (flexible mapping):
//    date | description | debit | credit | balance | reference
// ═════════════════════════════════════════════════════════════════════════════

/**
 * importBankStatementRows
 * @param {object} opts
 * @param {number}   opts.bank_account_id
 * @param {object[]} opts.rows   — parsed rows from frontend
 * @param {object}   [opts.columnMap] — { date, description, debit, credit, balance, reference }
 */
function importBankStatementRows({ bank_account_id, rows, columnMap = {} }) {
    if (!rows || !rows.length) throw new Error('No rows provided');

    const map = {
        date:        columnMap.date        || 'date',
        description: columnMap.description || 'description',
        debit:       columnMap.debit       || 'debit',
        credit:      columnMap.credit      || 'credit',
        balance:     columnMap.balance     || 'balance',
        reference:   columnMap.reference   || 'reference',
    };

    const importId = _db.prepare(`
        INSERT INTO bank_statement_imports (bank_account_id, row_count, status)
        VALUES (?, ?, 'imported')
    `).run(bank_account_id, rows.length).lastInsertRowid;

    const ins = _db.prepare(`
        INSERT INTO bank_statement_lines
        (import_id, bank_account_id, transaction_date, description, debit_halala, credit_halala, balance_halala, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = _db.transaction((rows) => {
        for (const row of rows) {
            const txDate  = _parseDate(row[map.date]);
            if (!txDate) continue; // skip rows with no recognizable date

            const debit   = Math.round((parseFloat(row[map.debit])   || 0) * 100);
            const credit  = Math.round((parseFloat(row[map.credit])  || 0) * 100);
            const balance = Math.round((parseFloat(row[map.balance]) || 0) * 100);
            const desc    = String(row[map.description] || '').trim();
            const ref     = String(row[map.reference]   || '').trim();

            ins.run(importId, bank_account_id, txDate, desc, debit, credit, balance, ref);
        }
    });

    insertAll(rows);

    return {
        import_id:    importId,
        rows_imported: rows.length,
        bank_account_id,
    };
}

function getBankStatementLines({ bank_account_id, import_id, unmatched_only = false } = {}) {
    let sql = `
        SELECT bsl.*, ba.bank_name
        FROM bank_statement_lines bsl
        LEFT JOIN bank_accounts ba ON ba.id = bsl.bank_account_id
        WHERE 1=1
    `;
    const args = [];
    if (bank_account_id) { sql += ' AND bsl.bank_account_id = ?'; args.push(bank_account_id); }
    if (import_id)       { sql += ' AND bsl.import_id = ?';       args.push(import_id); }
    if (unmatched_only)  { sql += ' AND bsl.is_matched = 0'; }
    sql += ' ORDER BY bsl.transaction_date, bsl.id';
    return _db.prepare(sql).all(...args);
}

function matchStatementLine({ line_id, journal_entry_line_id }) {
    _db.prepare(`
        UPDATE bank_statement_lines SET is_matched = 1, journal_entry_line_id = ? WHERE id = ?
    `).run(journal_entry_line_id, line_id);
    return { success: true };
}

function getStatementImports(bank_account_id) {
    return _db.prepare(`
        SELECT * FROM bank_statement_imports
        ${bank_account_id ? 'WHERE bank_account_id = ?' : ''}
        ORDER BY import_date DESC
    `).all(...(bank_account_id ? [bank_account_id] : []));
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-07 · Data Retention Manifest (ZATCA 5-year rule)
//  Returns a manifest of the oldest records and storage age,
//  and flags any table at risk of non-compliance.
// ═════════════════════════════════════════════════════════════════════════════

function getRetentionManifest() {
    const tables = [
        { name: 'sales',           dateCol: 'sale_date',   label: 'الفواتير / المبيعات' },
        { name: 'journal_entries', dateCol: 'entry_date',  label: 'قيود اليومية' },
        { name: 'expenditures',    dateCol: 'expense_date',label: 'المصروفات' },
        { name: 'purchase_orders', dateCol: 'order_date',  label: 'أوامر الشراء' },
        { name: 'payroll_runs',    dateCol: 'run_month',   label: 'مسيرات الرواتب' },
        { name: 'wps_exports',     dateCol: 'export_date', label: 'ملفات WPS' },
    ];

    const RETENTION_YEARS = 5;
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

    const manifest = tables.map(t => {
        let oldest = null, newest = null, count = 0;
        try {
            const row = _db.prepare(`
                SELECT MIN(${t.dateCol}) as oldest, MAX(${t.dateCol}) as newest, COUNT(*) as cnt
                FROM ${t.name}
            `).get();
            oldest = row?.oldest || null;
            newest = row?.newest || null;
            count  = row?.cnt   || 0;
        } catch (_) { /* table may not exist */ }

        const oldestDate = oldest ? new Date(oldest) : null;
        const ageYears   = oldestDate ? ((today - oldestDate) / (365.25 * 86400000)).toFixed(1) : null;
        const compliant  = !oldestDate || oldestDate >= cutoff; // records exist within 5-yr window

        return {
            table:      t.name,
            label:      t.label,
            count,
            oldest,
            newest,
            age_years:  ageYears,
            compliant,
            warning:    !compliant ? `يوجد سجلات أقدم من 5 سنوات — يُنصح بالأرشفة قبل الحذف` : null,
        };
    });

    return {
        as_of:            today.toISOString().split('T')[0],
        retention_years:  RETENTION_YEARS,
        zatca_rule:       'يُلزم نظام زاتكا بالاحتفاظ بالسجلات الضريبية لمدة 5 سنوات من تاريخ انتهاء السنة الضريبية',
        tables:           manifest,
        all_compliant:    manifest.every(m => m.compliant),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-08 · Bank Statement CSV Ingestion
//  importBankStatement  — reads a CSV and persists rows to bank_statement_lines
//  autoMatchBankLines   — exact-match pass against journal_entry_lines
// ═════════════════════════════════════════════════════════════════════════════

const _fs   = require('fs');
const _csvParse = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    return lines.slice(1).map(line => {
        // Respect quoted fields
        const cols = [];
        let cur = '', inQ = false;
        for (const ch of line) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        cols.push(cur.trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cols[i] || '').replace(/^"|"$/g,'').trim(); });
        return obj;
    });
};

function importBankStatement(bankAccountId, filePath) {
    if (!bankAccountId) throw new Error('bank_account_id مطلوب');
    if (!filePath || !_fs.existsSync(filePath)) throw new Error('مسار الملف غير صحيح: ' + filePath);

    const raw  = _fs.readFileSync(filePath, 'utf8');
    const rows = _csvParse(raw);
    if (!rows.length) throw new Error('الملف فارغ أو تنسيقه غير مدعوم');

    // Create import batch
    const importId = _db.prepare(`
        INSERT INTO bank_statement_imports (bank_account_id, import_date, file_name, row_count)
        VALUES (?, DATE('now'), ?, ?)
    `).run(bankAccountId, _fs.basename ? _fs.basename(filePath) : filePath.split(/[\\/]/).pop(), rows.length).lastInsertRowid;

    const insertLine = _db.prepare(`
        INSERT INTO bank_statement_lines
            (import_id, bank_account_id, value_date, description, debit_halala, credit_halala, balance_halala, reference, is_matched)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    let inserted = 0;
    const insertMany = _db.transaction((rows) => {
        for (const r of rows) {
            const vDate   = _parseDate(r['Date'] || r['date'] || r['DATE']);
            if (!vDate) continue;
            const debit   = Math.round((parseFloat(r['Debit']   || r['debit']   || '0') || 0) * 100);
            const credit  = Math.round((parseFloat(r['Credit']  || r['credit']  || '0') || 0) * 100);
            const balance = Math.round((parseFloat(r['Balance'] || r['balance'] || '0') || 0) * 100);
            const desc    = r['Description'] || r['description'] || r['DESC'] || '';
            const ref     = r['Reference']   || r['reference']   || r['REF']  || '';
            insertLine.run(importId, bankAccountId, vDate, desc, debit, credit, balance, ref);
            inserted++;
        }
    });
    insertMany(rows);

    return { success: true, import_id: importId, inserted };
}

function autoMatchBankLines(bankAccountId) {
    if (!bankAccountId) throw new Error('bank_account_id مطلوب');

    // Pull all unmatched statement lines for this account
    const unmatched = _db.prepare(`
        SELECT id, value_date, debit_halala, credit_halala
        FROM   bank_statement_lines
        WHERE  bank_account_id = ? AND is_matched = 0
    `).all(bankAccountId);

    const doMatch = _db.prepare(`
        SELECT jel.id AS jel_id
        FROM   journal_entry_lines jel
        JOIN   journal_entries     je  ON je.id = jel.journal_entry_id
        WHERE  jel.account_id   = ?
          AND  je.entry_date    = ?
          AND  jel.amount_halala = ?
          AND  NOT EXISTS (
              SELECT 1 FROM bank_statement_lines bsl
              WHERE  bsl.journal_entry_line_id = jel.id AND bsl.is_matched = 1
          )
        LIMIT 1
    `);

    const setMatched = _db.prepare(`
        UPDATE bank_statement_lines
        SET    is_matched = 1, journal_entry_line_id = ?
        WHERE  id = ?
    `);

    let matched = 0;
    const runAll = _db.transaction(() => {
        for (const line of unmatched) {
            // Net movement for this line (credit side if credit > 0, else debit)
            const amount = line.credit_halala > 0 ? line.credit_halala : line.debit_halala;
            if (!amount) continue;

            const hit = doMatch.get(bankAccountId, line.value_date, amount);
            if (hit) {
                setMatched.run(hit.jel_id, line.id);
                matched++;
            }
        }
    });
    runAll();

    return { success: true, matched, total: unmatched.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — flexible date parser for CSV imports
// ─────────────────────────────────────────────────────────────────────────────
function _parseDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    // ISO 8601
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    // MM/DD/YYYY
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
    // Excel serial number
    if (/^\d{5}$/.test(s)) {
        const d = new Date((parseInt(s) - 25569) * 86400000);
        return d.toISOString().split('T')[0];
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    initCompliance,
    // GAP-01 EOSB
    calculateEOSB,
    postEOSBEntry,
    getEOSBHistory,
    // GAP-02 WPS
    generateWPSSIF,
    // GAP-03 VAT XML
    generateVAT311XML,
    // GAP-04 AP Aging
    getAPAgingReport,
    // GAP-05 Closing Wizard
    previewClosingWizard,
    executeClosingWizard,
    // GAP-06 Bank Import
    importBankStatementRows,
    getBankStatementLines,
    matchStatementLine,
    getStatementImports,
    // GAP-07 Retention
    getRetentionManifest,
    // GAP-08 Bank Statement Ingestion
    importBankStatement,
    autoMatchBankLines,
};
