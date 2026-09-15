/**
 * ═══════════════════════════════════════════════════════════════════
 *  POS v2 — ACCOUNTING ENGINE  (Phase 1 — Critical Core)
 *  Implements P-001 through P-007 from the implementation plan
 * ═══════════════════════════════════════════════════════════════════
 *
 *  CROSS-CUTTING RULES (applied everywhere in this file):
 *  • All monetary amounts stored as INTEGER halala (× 100).
 *    Display layer: divide by 100, format with SAR locale.
 *    Exception: legacy ledger_entries still stores REAL — we read
 *    and write it unchanged; new journal_entries uses INTEGER halala.
 *  • Dates stored as ISO 8601 TEXT ('YYYY-MM-DD').
 *  • Every insert/update carries created_at / created_by.
 *  • DB-level check: SUM(debits) = SUM(credits) enforced via trigger.
 */

'use strict';

let _db; // injected by init()

/** Call once from database.cjs after db connection is ready */
function initAccounting(dbInstance) {
    _db = dbInstance;
    _runMigrations();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert decimal SAR → integer halala (round half-up) */
const toHalala   = (sar) => Math.round((parseFloat(sar) || 0) * 100);
/** Convert integer halala → decimal SAR (2dp) */
const fromHalala = (h)   => ((parseInt(h) || 0) / 100);

function fmtDate(d) {
    if (!d) return new Date().toISOString().split('T')[0];
    if (typeof d === 'string') return d.split('T')[0];
    if (d instanceof Date) return d.toISOString().split('T')[0];
    if (typeof d === 'object' && d.startDate) return d.startDate.split('T')[0];
    try {
        return new Date(d).toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
}

function nextJvRef() {
    const row = _db.prepare(`
        SELECT reference_no FROM journal_entries
        WHERE reference_no LIKE 'JV-%'
        ORDER BY id DESC LIMIT 1
    `).get();
    if (!row) return 'JV-' + new Date().getFullYear() + '-0001';
    const parts = row.reference_no.split('-');
    const num   = parseInt(parts[parts.length - 1] || '0') + 1;
    const year  = new Date().getFullYear();
    return `JV-${year}-${String(num).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS — run once, safe to re-run
// ─────────────────────────────────────────────────────────────────────────────
function _runMigrations() {
    const safe = (sql) => { try { _db.exec(sql); } catch (_) {} };

    // ── P-001 / P-002: Upgrade accounts table to hierarchical CoA ─────────────
    safe(`ALTER TABLE accounts ADD COLUMN level INTEGER DEFAULT 1`);
    safe(`ALTER TABLE accounts ADD COLUMN normal_balance TEXT DEFAULT 'debit'`);
    safe(`ALTER TABLE accounts ADD COLUMN is_system INTEGER DEFAULT 0`);
    safe(`ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1`);
    safe(`ALTER TABLE accounts ADD COLUMN name_en TEXT`);
    safe(`ALTER TABLE accounts ADD COLUMN created_at TEXT DEFAULT (date('now'))`);
    safe(`ALTER TABLE accounts ADD COLUMN created_by INTEGER DEFAULT 1`);

    // ── P-001: journal_entries + journal_entry_lines (proper double-entry) ────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS journal_entries (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_date      TEXT    NOT NULL,
            reference_no    TEXT    NOT NULL,
            description     TEXT    NOT NULL,
            entry_type      TEXT    NOT NULL DEFAULT 'Manual',
            reference_type  TEXT,
            reference_id    TEXT,
            status          TEXT    NOT NULL DEFAULT 'posted',
            notes           TEXT,
            attachment_path TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            created_by      INTEGER NOT NULL DEFAULT 1
        );
    `);

    _db.exec(`
        CREATE TABLE IF NOT EXISTS journal_entry_lines (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id        INTEGER NOT NULL,
            account_code    INTEGER NOT NULL,
            description     TEXT,
            debit_halala    INTEGER NOT NULL DEFAULT 0,
            credit_halala   INTEGER NOT NULL DEFAULT 0,
            cost_centre_id  INTEGER,
            FOREIGN KEY (entry_id)     REFERENCES journal_entries(id) ON DELETE CASCADE,
            FOREIGN KEY (account_code) REFERENCES accounts(account_code)
        );
    `);

    // DB-level balance check trigger
    _db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_je_balance_check
        AFTER INSERT ON journal_entries
        FOR EACH ROW
        BEGIN
            SELECT CASE
                WHEN ABS(
                    (SELECT COALESCE(SUM(debit_halala),0)  FROM journal_entry_lines WHERE entry_id = NEW.id) -
                    (SELECT COALESCE(SUM(credit_halala),0) FROM journal_entry_lines WHERE entry_id = NEW.id)
                ) > 1
                THEN RAISE(ABORT, 'JE_IMBALANCED: sum(debits) ≠ sum(credits)')
            END;
        END;
    `);

    // ── P-007: Opening balances wizard table ──────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balance_entries (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_entry_id INTEGER NOT NULL,
            opening_date    TEXT    NOT NULL,
            locked          INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    // ── Period lock table (P-017) ─────────────────────────────────────────────
    _db.exec(`
        CREATE TABLE IF NOT EXISTS accounting_periods (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            period_name TEXT    NOT NULL,
            start_date  TEXT    NOT NULL,
            end_date    TEXT    NOT NULL,
            status      TEXT    NOT NULL DEFAULT 'open',
            locked_by   INTEGER,
            locked_at   TEXT,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    `);

    // ── Now seed the hierarchical Saudi-GAAP Chart of Accounts ───────────────
    _seedCoA();
}

// ─────────────────────────────────────────────────────────────────────────────
// P-002: SEED HIERARCHICAL SAUDI-GAAP CoA
// ─────────────────────────────────────────────────────────────────────────────
function _seedCoA() {
    // Only seed if accounts table has the old flat structure (< 20 accounts)
    const count = _db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
    // Check if already migrated (has the new structure, level column populated)
    const hasMigrated = _db.prepare(`
        SELECT COUNT(*) as c FROM accounts WHERE level IS NOT NULL AND level > 0 AND account_code >= 1000
    `).get().c;

    if (hasMigrated > 0) return; // Already seeded the hierarchical CoA

    // Wipe old flat accounts that don't conform to the new structure
    // But first preserve any custom accounts the user may have added
    const customAccounts = _db.prepare(`
        SELECT * FROM accounts WHERE is_system = 0 AND account_code >= 9000
    `).all();

    // Delete old flat seeded accounts (codes 1-9 and 1101-5201)
    _db.exec(`DELETE FROM accounts WHERE account_code < 1000`);

    const ins = _db.prepare(`
        INSERT OR IGNORE INTO accounts
        (account_code, name_ar, name_en, type, parent_id, level, normal_balance, is_system, is_active)
        VALUES (?,?,?,?,?,?,?,1,1)
    `);

    const seedTx = _db.transaction((rows) => {
        for (const r of rows) ins.run(...r);
    });

    /**
     * [code, name_ar, name_en, type, parent_code, level, normal_balance]
     * Level 1 = Group, 2 = Sub-group, 3 = Account, 4 = Sub-account
     */
    seedTx([
        // ── ASSETS ────────────────────────────────────────────────────────────
        [1000, 'الأصول',                       'Assets',                      'Asset',     null, 1, 'debit'],
        [1100, 'الأصول المتداولة',              'Current Assets',              'Asset',     1000, 2, 'debit'],
        [1110, 'النقد وما في حكمه',             'Cash & Cash Equivalents',     'Asset',     1100, 3, 'debit'],
        [1111, 'الصندوق (نقدي POS)',            'Cash / POS Till',             'Asset',     1110, 4, 'debit'],
        [1112, 'رصيد بنكي',                    'Bank Account',                'Asset',     1110, 4, 'debit'],
        [1200, 'ذمم مدينة — عملاء',            'Accounts Receivable',         'Asset',     1100, 3, 'debit'],
        [1210, 'مخصص الديون المشكوك بتحصيلها', 'Allowance for Doubtful Debts','Asset',     1200, 4, 'credit'],
        [1300, 'المخزون',                       'Inventory',                   'Asset',     1100, 3, 'debit'],
        [1400, 'مصروفات مدفوعة مقدماً',         'Prepaid Expenses',            'Asset',     1100, 3, 'debit'],
        [1500, 'الأصول غير المتداولة',           'Non-Current Assets',          'Asset',     1000, 2, 'debit'],
        [1510, 'الأصول الثابتة — التكلفة',      'Fixed Assets (Cost)',         'Asset',     1500, 3, 'debit'],
        [1520, 'مجمع الاستهلاك',               'Accumulated Depreciation',    'Asset',     1500, 3, 'credit'],

        // ── LIABILITIES ───────────────────────────────────────────────────────
        [2000, 'الخصوم',                        'Liabilities',                 'Liability', null, 1, 'credit'],
        [2100, 'ذمم دائنة — موردون',            'Accounts Payable',            'Liability', 2000, 3, 'credit'],
        [2200, 'مستحقات متراكمة',               'Accrued Liabilities',         'Liability', 2000, 3, 'credit'],
        [2210, 'رواتب مستحقة',                  'Salaries Payable',            'Liability', 2200, 4, 'credit'],
        [2220, 'اشتراكات التأمينات (GOSI)',     'GOSI Payable',                'Liability', 2200, 4, 'credit'],
        [2300, 'ضريبة القيمة المضافة المخرجات',  'VAT Collected (Output)',      'Liability', 2000, 3, 'credit'],
        [2400, 'ضريبة القيمة المضافة المدخلات',  'VAT Deductible (Input)',      'Asset',     1100, 3, 'debit'],
        [2500, 'إيراد مؤجل',                    'Deferred Revenue',            'Liability', 2000, 3, 'credit'],

        // ── EQUITY ────────────────────────────────────────────────────────────
        [3000, 'حقوق الملكية',                  'Equity',                      'Equity',    null, 1, 'credit'],
        [3100, 'رأس المال',                     'Owner Capital',               'Equity',    3000, 3, 'credit'],
        [3200, 'الأرباح المبقاة',               'Retained Earnings',           'Equity',    3000, 3, 'credit'],

        // ── REVENUE ───────────────────────────────────────────────────────────
        [4000, 'الإيرادات',                     'Revenue',                     'Revenue',   null, 1, 'credit'],
        [4100, 'إيرادات المبيعات',              'Sales Revenue',               'Revenue',   4000, 3, 'credit'],
        [4200, 'إيرادات أخرى',                  'Other Income',                'Revenue',   4000, 3, 'credit'],

        // ── EXPENSES ──────────────────────────────────────────────────────────
        [5000, 'المصروفات',                     'Expenses',                    'Expense',   null, 1, 'debit'],
        [5100, 'تكلفة البضاعة المباعة (COGS)',  'Cost of Goods Sold',          'Expense',   5000, 3, 'debit'],
        [5200, 'رواتب وأجور',                   'Salaries & Wages',            'Expense',   5000, 3, 'debit'],
        [5210, 'اشتراكات التأمينات (صاحب العمل)','GOSI — Employer Share',      'Expense',   5200, 4, 'debit'],
        [5300, 'إيجار',                          'Rent',                        'Expense',   5000, 3, 'debit'],
        [5400, 'استهلاك الأصول الثابتة',         'Depreciation',                'Expense',   5000, 3, 'debit'],
        [5500, 'تسويق وإعلان',                  'Marketing & Advertising',     'Expense',   5000, 3, 'debit'],
        [5600, 'مرافق (كهرباء، ماء، إنترنت)',   'Utilities',                   'Expense',   5000, 3, 'debit'],
        [5700, 'مصروفات متنوعة',                 'Miscellaneous Expenses',      'Expense',   5000, 3, 'debit'],
        [5800, 'مصروف ديون معدومة',             'Bad Debt Expense',            'Expense',   5000, 3, 'debit'],
        [5900, 'تسويات المخزون',                 'Inventory Adjustments',       'Expense',   5000, 3, 'debit'],
    ]);

    // Map old legacy account codes to new codes for ledger_entries
    // (old 1101→1111, 1102→1112, 1103→1200, 1201→1300, 2201→2300, 2202→2400, 4101→4100, 5101→5100, 5201→5700)
    const legacyMap = {
        1101: 1111, 1102: 1112, 1103: 1200, 1201: 1300,
        2201: 2300, 2202: 2400, 4101: 4100, 5101: 5100, 5201: 5700
    };
    _db.transaction(() => {
        for (const [old, newCode] of Object.entries(legacyMap)) {
            _db.prepare(`UPDATE ledger_entries SET account_code = ? WHERE account_code = ?`).run(newCode, parseInt(old));
            _db.prepare(`UPDATE accounts SET balance = 0 WHERE account_code = ?`).run(parseInt(old));
        }
        // Remove old single-digit codes (1,2,3,4,5) and old 4-digit legacy
        _db.exec(`DELETE FROM accounts WHERE (account_code < 1000 OR account_code IN (1101,1102,1103,1201,2201,2202,4101,5101,5201)) AND is_system = 0`);
        // Mark all seeded as system
        _db.exec(`UPDATE accounts SET is_system = 1 WHERE account_code >= 1000`);
    })();
    // ── Safe Migration of historical ledger_entries into journal_entries ──
    _db.transaction(() => {
        const legacyGroups = _db.prepare(`
            SELECT 
                COALESCE(reference, description, 'LEGACY-' || date) as group_key,
                date,
                description,
                reference
            FROM ledger_entries
            GROUP BY COALESCE(reference, description, 'LEGACY-' || date), date, description, reference
        `).all();

        const checkRef = _db.prepare(`SELECT id FROM journal_entries WHERE reference_no IN (?, ?, ?, ?)`);
        const checkDesc = _db.prepare(`SELECT id FROM journal_entries WHERE description = ? AND entry_date = ?`);
        const getLines = _db.prepare(`
            SELECT * FROM ledger_entries
            WHERE COALESCE(reference, description, 'LEGACY-' || date) = ?
              AND date = ?
              AND description = ?
              AND IFNULL(reference, '') = IFNULL(?, '')
        `);
        const insJE = _db.prepare(`
            INSERT INTO journal_entries (entry_date, reference_no, description, entry_type, reference_type, reference_id, status)
            VALUES (?, ?, ?, 'Auto', 'migration', ?, 'posted')
        `);
        const insLine = _db.prepare(`
            INSERT INTO journal_entry_lines (entry_id, account_code, description, debit_halala, credit_halala)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const grp of legacyGroups) {
            let possibleRefs = [
                grp.reference,
                grp.reference ? 'SAL-' + grp.reference : null,
                grp.reference ? 'EXP-' + grp.reference : null,
                grp.reference ? 'MIG-' + grp.reference : null
            ];
            
            let existing;
            if (grp.reference) {
                existing = checkRef.get(...possibleRefs);
            } else {
                existing = checkDesc.get(grp.description, fmtDate(grp.date));
            }

            if (existing) continue; // Skip already migrated or double-posted

            const lines = getLines.all(grp.group_key, grp.date, grp.description, grp.reference);
            if (lines.length === 0) continue;

            const entryDate = fmtDate(grp.date);
            const refNo = grp.reference ? `MIG-${grp.reference}` : nextJvRef();

            const jeResult = insJE.run(entryDate, refNo, grp.description || 'ترحيل قديم', grp.reference || null);
            const jeId = jeResult.lastInsertRowid;

            for (const line of lines) {
                const acctCode = legacyMap[line.account_code] || line.account_code;
                insLine.run(jeId, acctCode, line.description, toHalala(line.debit), toHalala(line.credit));
            }
        }
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// P-001: DOUBLE-ENTRY JOURNAL ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post a balanced journal entry.
 * lines: Array of { account_code, debit (SAR decimal), credit (SAR decimal), description? }
 * Returns the new journal_entry id.
 */
function postJournalEntry({
    entry_date,
    reference_no,
    description,
    entry_type = 'Manual',
    reference_type = null,
    reference_id   = null,
    lines = [],
    notes = null,
    attachment_path = null,
    created_by = 1
}) {
    if (!lines || lines.length < 2) throw new Error('يجب أن يحتوي القيد على سطرين على الأقل');

    const date = fmtDate(entry_date);

    // Check period lock
    _checkPeriodLock(date, created_by);

    // Convert to halala and validate balance
    const linesH = lines.map(l => ({
        account_code:  l.account_code,
        description:   l.description || description,
        debit_halala:  toHalala(l.debit  || 0),
        credit_halala: toHalala(l.credit || 0),
    }));

    const totalDr = linesH.reduce((s, l) => s + l.debit_halala,  0);
    const totalCr = linesH.reduce((s, l) => s + l.credit_halala, 0);
    if (Math.abs(totalDr - totalCr) > 1) {
        throw new Error(
            `القيد غير متوازن: مجموع المدين (${fromHalala(totalDr)} ر.س) ≠ مجموع الدائن (${fromHalala(totalCr)} ر.س)`
        );
    }

    const ref = reference_no || nextJvRef();

    return _db.transaction(() => {
        const entryId = _db.prepare(`
            INSERT INTO journal_entries
            (entry_date, reference_no, description, entry_type, reference_type, reference_id,
             status, notes, attachment_path, created_by)
            VALUES (?,?,?,?,?,?, 'posted',?,?,?)
        `).run(date, ref, description, entry_type, reference_type, reference_id,
               notes, attachment_path, created_by).lastInsertRowid;

        const lineStmt = _db.prepare(`
            INSERT INTO journal_entry_lines
            (entry_id, account_code, description, debit_halala, credit_halala)
            VALUES (?,?,?,?,?)
        `);

        for (const l of linesH) {
            // Verify account_code exists in accounts table to prevent FOREIGN KEY constraint failure
            const accExists = _db.prepare(`SELECT 1 FROM accounts WHERE account_code = ?`).get(l.account_code);
            if (!accExists) {
                const codeNum = parseInt(l.account_code);
                const isAsset     = codeNum >= 1000 && codeNum < 2000;
                const isLiability = codeNum >= 2000 && codeNum < 3000;
                const isEquity    = codeNum >= 3000 && codeNum < 4000;
                const isRevenue   = codeNum >= 4000 && codeNum < 5000;
                const type = isAsset ? 'Asset' : isLiability ? 'Liability' : isEquity ? 'Equity' : isRevenue ? 'Revenue' : 'Expense';
                const normalBal = (isAsset || !isLiability && !isEquity && !isRevenue) ? 'debit' : 'credit';
                _db.prepare(`
                    INSERT OR IGNORE INTO accounts (account_code, name_ar, name_en, type, parent_id, level, normal_balance, is_system, is_active)
                    VALUES (?, ?, ?, ?, NULL, 3, ?, 1, 1)
                `).run(l.account_code, `حساب ${l.account_code}`, `Account ${l.account_code}`, type, normalBal);
            }
            lineStmt.run(entryId, l.account_code, l.description, l.debit_halala, l.credit_halala);
            // Keep legacy accounts.balance in sync (in SAR, not halala, for backward compat)
            _db.prepare(`
                UPDATE accounts
                SET balance = balance + (? - ?)
                WHERE account_code = ?
            `).run(fromHalala(l.debit_halala), fromHalala(l.credit_halala), l.account_code);
        }

        return entryId;
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD LOCK CHECK
// ─────────────────────────────────────────────────────────────────────────────
function _checkPeriodLock(dateStr, userId = 1) {
    const period = _db.prepare(`
        SELECT * FROM accounting_periods
        WHERE start_date <= ? AND end_date >= ? AND status != 'open'
        LIMIT 1
    `).get(dateStr, dateStr);

    if (!period) return; // No locked period covers this date

    if (period.status === 'hard_locked') {
        throw new Error(`الفترة المحاسبية "${period.period_name}" مقفلة نهائياً ولا يمكن الترحيل إليها.`);
    }

    if (period.status === 'soft_locked') {
        // Only Admin (role 'Admin') or Accountant can post to soft-locked periods
        const user = _db.prepare(`SELECT role FROM staff WHERE id = ?`).get(userId);
        if (!user || !['Admin', 'Accountant'].includes(user.role)) {
            throw new Error(`الفترة المحاسبية "${period.period_name}" مقفلة مؤقتاً. يُسمح فقط للمحاسب والمدير بالترحيل.`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// P-003: MANUAL JOURNAL ENTRY — CRUD
// ─────────────────────────────────────────────────────────────────────────────

function getJournalEntries(filters = {}) {
    let sql = `
        SELECT je.*, s.name as created_by_name
        FROM journal_entries je
        LEFT JOIN staff s ON je.created_by = s.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) { sql += ' AND je.entry_date >= ?'; params.push(filters.startDate); }
    if (filters.endDate)   { sql += ' AND je.entry_date <= ?'; params.push(filters.endDate); }
    if (filters.entry_type && filters.entry_type !== 'all') {
        sql += ' AND je.entry_type = ?'; params.push(filters.entry_type);
    }
    if (filters.reference_no) {
        sql += ' AND je.reference_no LIKE ?'; params.push(`%${filters.reference_no}%`);
    }
    if (filters.account_code) {
        sql += ' AND EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.entry_id = je.id AND l.account_code = ?)';
        params.push(filters.account_code);
    }

    sql += ' ORDER BY je.entry_date DESC, je.id DESC';
    if (filters.limit)  { sql += ' LIMIT ?';  params.push(parseInt(filters.limit)); }
    if (filters.offset) { sql += ' OFFSET ?'; params.push(parseInt(filters.offset)); }

    const entries = _db.prepare(sql).all(...params);
    return entries.map(e => ({
        ...e,
        lines: _db.prepare(`
            SELECT l.*, a.name_ar, a.type, a.normal_balance
            FROM journal_entry_lines l
            JOIN accounts a ON l.account_code = a.account_code
            WHERE l.entry_id = ?
            ORDER BY l.id
        `).all(e.id).map(l => ({
            ...l,
            debit:  fromHalala(l.debit_halala),
            credit: fromHalala(l.credit_halala),
        }))
    }));
}

function getJournalEntry(id) {
    const entry = _db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(id);
    if (!entry) return null;
    entry.lines = _db.prepare(`
        SELECT l.*, a.name_ar, a.type
        FROM journal_entry_lines l
        JOIN accounts a ON l.account_code = a.account_code
        WHERE l.entry_id = ?
        ORDER BY l.id
    `).all(id).map(l => ({
        ...l,
        debit:  fromHalala(l.debit_halala),
        credit: fromHalala(l.credit_halala),
    }));
    return entry;
}

function reverseJournalEntry(entryId, reason, reversalDate, createdBy = 1) {
    const original = getJournalEntry(entryId);
    if (!original) throw new Error('القيد غير موجود');
    if (original.status === 'reversed') throw new Error('هذا القيد معكوس بالفعل');

    const date = fmtDate(reversalDate) || fmtDate(new Date());

    return _db.transaction(() => {
        // Mark original as reversed
        _db.prepare(`UPDATE journal_entries SET status = 'reversed' WHERE id = ?`).run(entryId);

        // Create mirror entry (swap debit ↔ credit)
        const reversalLines = original.lines.map(l => ({
            account_code: l.account_code,
            debit:        l.credit,   // swapped
            credit:       l.debit,    // swapped
            description:  `عكس: ${l.description || original.description}`,
        }));

        return postJournalEntry({
            entry_date:     date,
            reference_no:   `REV-${original.reference_no}`,
            description:    `عكس القيد ${original.reference_no} — ${reason || ''}`,
            entry_type:     'Reversal',
            reference_type: 'journal_entry',
            reference_id:   String(entryId),
            lines:          reversalLines,
            created_by:     createdBy,
        });
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// P-007: OPENING BALANCES WIZARD
// ─────────────────────────────────────────────────────────────────────────────

function hasOpeningBalances() {
    return !!_db.prepare(`SELECT id FROM opening_balance_entries LIMIT 1`).get();
}

function postOpeningBalances(openingDate, balances, createdBy = 1) {
    // balances: Array of { account_code, debit, credit }
    if (hasOpeningBalances()) {
        throw new Error('تم ترحيل الأرصدة الافتتاحية مسبقاً ولا يمكن إعادة ترحيلها. يمكنك عكس القيد بدلاً من ذلك.');
    }

    const date = fmtDate(openingDate);
    const lines = balances
        .filter(b => (parseFloat(b.debit) || 0) > 0 || (parseFloat(b.credit) || 0) > 0)
        .map(b => ({
            account_code: b.account_code,
            debit:        parseFloat(b.debit)  || 0,
            credit:       parseFloat(b.credit) || 0,
            description:  'رصيد افتتاحي',
        }));

    if (lines.length === 0) throw new Error('لم يتم إدخال أي أرصدة افتتاحية');

    const totalDr = lines.reduce((s, l) => s + l.debit, 0);
    const totalCr = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDr - totalCr) > 0.01) {
        throw new Error(
            `الأرصدة الافتتاحية غير متوازنة: المدين (${totalDr.toFixed(2)}) ≠ الدائن (${totalCr.toFixed(2)})`
        );
    }

    return _db.transaction(() => {
        const jeId = postJournalEntry({
            entry_date:     date,
            reference_no:   `OB-${date}`,
            description:    'أرصدة افتتاحية',
            entry_type:     'Opening',
            lines,
            created_by:     createdBy,
        });

        _db.prepare(`
            INSERT INTO opening_balance_entries (journal_entry_id, opening_date)
            VALUES (?, ?)
        `).run(jeId, date);

        return { success: true, journal_entry_id: jeId };
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// P-004: BALANCE SHEET
// ─────────────────────────────────────────────────────────────────────────────

function getBalanceSheet(asOfDate, compareDateOpt) {
    const asOf    = fmtDate(asOfDate || new Date());
    const compare = compareDateOpt ? fmtDate(compareDateOpt) : null;

    function _balances(upToDate) {
        // Sum all journal_entry_lines up to and including upToDate
        // PLUS legacy ledger_entries for backward compatibility
        const rows = _db.prepare(`
            SELECT l.account_code,
                   SUM(l.debit_halala)  as total_dr_h,
                   SUM(l.credit_halala) as total_cr_h
            FROM journal_entry_lines l
            JOIN journal_entries je ON l.entry_id = je.id
            WHERE je.entry_date <= ? AND je.status != 'reversed'
            GROUP BY l.account_code
        `).all(upToDate);

        // Include legacy ledger_entries (stored in SAR, not halala)
        const legacy = _db.prepare(`
            SELECT account_code,
                   SUM(debit)  as total_dr,
                   SUM(credit) as total_cr
            FROM ledger_entries
            WHERE DATE(date) <= ?
            GROUP BY account_code
        `).all(upToDate);

        const map = {};
        for (const r of rows) {
            map[r.account_code] = map[r.account_code] || { dr: 0, cr: 0 };
            map[r.account_code].dr += r.total_dr_h / 100;
            map[r.account_code].cr += r.total_cr_h / 100;
        }
        for (const r of legacy) {
            map[r.account_code] = map[r.account_code] || { dr: 0, cr: 0 };
            map[r.account_code].dr += parseFloat(r.total_dr || 0);
            map[r.account_code].cr += parseFloat(r.total_cr || 0);
        }
        return map;
    }

    function _netBalance(map, code, accountType, normalBalance) {
        const b = map[code] || { dr: 0, cr: 0 };
        // Net = debit - credit for debit-normal accounts, credit - debit for credit-normal
        return normalBalance === 'debit' ? (b.dr - b.cr) : (b.cr - b.dr);
    }

    const accounts = _db.prepare(`
        SELECT * FROM accounts WHERE is_active = 1 ORDER BY account_code ASC
    `).all();

    const currentBals  = _balances(asOf);
    const compareBals  = compare ? _balances(compare) : null;

    function buildSection(typeFilter) {
        return accounts
            .filter(a => a.type === typeFilter && a.level === 3)
            .map(a => {
                const bal  = _netBalance(currentBals, a.account_code, a.type, a.normal_balance || 'debit');
                const cBal = compareBals
                    ? _netBalance(compareBals, a.account_code, a.type, a.normal_balance || 'debit')
                    : null;
                return { ...a, balance: bal, compareBalance: cBal };
            });
    }

    const assets        = buildSection('Asset');
    const liabilities   = buildSection('Liability');
    const equity        = buildSection('Equity');

    // Current period net income = Revenue - Expenses (for the period before asOf,
    // starting from the last closed period or the oldest entry)
    const revAgg = _db.prepare(`
        SELECT COALESCE(SUM(l.credit_halala - l.debit_halala),0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Revenue' AND je.entry_date <= ? AND je.status != 'reversed'
    `).get(asOf);
    const expAgg = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala),0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Expense' AND je.entry_date <= ? AND je.status != 'reversed'
    `).get(asOf);

    // Also include legacy ledger_entries
    const legRevAgg = _db.prepare(`
        SELECT COALESCE(SUM(credit - debit),0) as net
        FROM ledger_entries l JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Revenue' AND DATE(l.date) <= ?
    `).get(asOf);
    const legExpAgg = _db.prepare(`
        SELECT COALESCE(SUM(debit - credit),0) as net
        FROM ledger_entries l JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Expense' AND DATE(l.date) <= ?
    `).get(asOf);

    const currentNetIncome =
        (revAgg.net / 100 + (legRevAgg.net || 0)) -
        (expAgg.net / 100 + (legExpAgg.net || 0));

    const totalAssets      = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity      = equity.reduce((s, a) => s + a.balance, 0) + currentNetIncome;
    const balanced         = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05;

    return {
        as_of: asOf,
        compare_date: compare,
        assets,
        liabilities,
        equity,
        current_net_income: currentNetIncome,
        total_assets:       totalAssets,
        total_liabilities:  totalLiabilities,
        total_equity:       totalEquity,
        total_liab_equity:  totalLiabilities + totalEquity,
        balanced,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-005: CASH FLOW STATEMENT (INDIRECT METHOD)
// ─────────────────────────────────────────────────────────────────────────────

function getCashFlowStatement(startDate, endDate) {
    const sDate = fmtDate(startDate);
    const eDate = fmtDate(endDate);
    const prevDate = sDate; // The day before sDate for opening balance

    function _accountBalAt(code, upTo) {
        const jeRow = _db.prepare(`
            SELECT COALESCE(SUM(l.debit_halala - l.credit_halala),0) as net
            FROM journal_entry_lines l
            JOIN journal_entries je ON l.entry_id = je.id
            WHERE l.account_code = ? AND je.entry_date <= ? AND je.status != 'reversed'
        `).get(code, upTo);
        const legRow = _db.prepare(`
            SELECT COALESCE(SUM(debit - credit),0) as net
            FROM ledger_entries WHERE account_code = ? AND DATE(date) <= ?
        `).get(code, upTo);
        return (jeRow.net / 100) + parseFloat(legRow.net || 0);
    }

    function _periodFlow(code, start, end, direction = 'debit') {
        const jeRow = _db.prepare(`
            SELECT COALESCE(SUM(l.debit_halala - l.credit_halala),0) as net
            FROM journal_entry_lines l
            JOIN journal_entries je ON l.entry_id = je.id
            WHERE l.account_code = ? AND je.entry_date BETWEEN ? AND ? AND je.status != 'reversed'
        `).get(code, start, end);
        const legRow = _db.prepare(`
            SELECT COALESCE(SUM(debit - credit),0) as net
            FROM ledger_entries WHERE account_code = ? AND DATE(date) BETWEEN ? AND ?
        `).get(code, start, end);
        const net = (jeRow.net / 100) + parseFloat(legRow.net || 0);
        return direction === 'debit' ? net : -net;
    }

    // Net Income for the period (from P&L)
    const revPeriod = _db.prepare(`
        SELECT COALESCE(SUM(l.credit_halala - l.debit_halala),0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Revenue' AND je.entry_date BETWEEN ? AND ? AND je.status != 'reversed'
    `).get(sDate, eDate);
    const expPeriod = _db.prepare(`
        SELECT COALESCE(SUM(l.debit_halala - l.credit_halala),0) as net
        FROM journal_entry_lines l
        JOIN journal_entries je ON l.entry_id = je.id
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type = 'Expense' AND je.entry_date BETWEEN ? AND ? AND je.status != 'reversed'
    `).get(sDate, eDate);
    const legRev = _db.prepare(`
        SELECT COALESCE(SUM(credit - debit),0) as net FROM ledger_entries l
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type='Revenue' AND DATE(l.date) BETWEEN ? AND ?
    `).get(sDate, eDate);
    const legExp = _db.prepare(`
        SELECT COALESCE(SUM(debit - credit),0) as net FROM ledger_entries l
        JOIN accounts a ON l.account_code = a.account_code
        WHERE a.type='Expense' AND DATE(l.date) BETWEEN ? AND ?
    `).get(sDate, eDate);

    const netIncome      = (revPeriod.net / 100 + parseFloat(legRev.net || 0)) -
                           (expPeriod.net / 100 + parseFloat(legExp.net || 0));
    const depreciation   = _periodFlow(5400, sDate, eDate, 'debit');

    // Changes in Working Capital
    const prevDate2      = new Date(sDate);
    prevDate2.setDate(prevDate2.getDate() - 1);
    const prevStr        = prevDate2.toISOString().split('T')[0];

    const arOpen  = _accountBalAt(1200, prevStr);
    const arClose = _accountBalAt(1200, eDate);
    const invOpen = _accountBalAt(1300, prevStr);
    const invClose= _accountBalAt(1300, eDate);
    const apOpen  = _accountBalAt(2100, prevStr);
    const apClose = _accountBalAt(2100, eDate);
    const vatOpen = _accountBalAt(2300, prevStr) - _accountBalAt(2400, prevStr);
    const vatClose= _accountBalAt(2300, eDate)   - _accountBalAt(2400, eDate);
    const defRevOpen  = _accountBalAt(2500, prevStr);
    const defRevClose = _accountBalAt(2500, eDate);

    const deltaAR      = -(arClose  - arOpen);   // increase in AR = cash use
    const deltaInv     = -(invClose - invOpen);   // increase in Inv = cash use
    const deltaAP      =  (apClose  - apOpen);    // increase in AP = cash source
    const deltaVAT     =  (vatClose - vatOpen);
    const deltaDefRev  =  (defRevClose - defRevOpen);

    const operatingActivities = netIncome + depreciation + deltaAR + deltaInv + deltaAP + deltaVAT + deltaDefRev;

    // Investing: Fixed Asset additions (Dr 1510 in period)
    const faAdditions  = _periodFlow(1510, sDate, eDate, 'debit');
    const investingActivities = -faAdditions;

    // Financing: Capital injections/withdrawals (net of 3100 period flow)
    const capitalFlow  = _periodFlow(3100, sDate, eDate, 'credit');
    const financingActivities = capitalFlow;

    const netChangeCash = operatingActivities + investingActivities + financingActivities;

    const cashCodes = [1111, 1112];
    const openingCash = cashCodes.reduce((s, c) => s + _accountBalAt(c, prevStr), 0);
    const closingCash = cashCodes.reduce((s, c) => s + _accountBalAt(c, eDate),   0);

    return {
        period: { start: sDate, end: eDate },
        net_income: netIncome,
        operating: {
            net_income:       netIncome,
            add_depreciation: depreciation,
            changes: {
                accounts_receivable:  deltaAR,
                inventory:            deltaInv,
                accounts_payable:     deltaAP,
                vat_net:              deltaVAT,
                deferred_revenue:     deltaDefRev,
            },
            total: operatingActivities,
        },
        investing: {
            fixed_asset_additions: -faAdditions,
            total: investingActivities,
        },
        financing: {
            capital_changes: capitalFlow,
            total: financingActivities,
        },
        net_change_cash:   netChangeCash,
        opening_cash:      openingCash,
        closing_cash:      closingCash,
        closing_check:     openingCash + netChangeCash,
        reconciled:        Math.abs((openingCash + netChangeCash) - closingCash) < 0.05,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// P-006: ENHANCED INCOME STATEMENT
// ─────────────────────────────────────────────────────────────────────────────

function getIncomeStatement(startDate, endDate, compareStartDate, compareEndDate) {
    const sDate = fmtDate(startDate);
    const eDate = fmtDate(endDate);
    const cStart = compareStartDate ? fmtDate(compareStartDate) : null;
    const cEnd   = compareEndDate   ? fmtDate(compareEndDate)   : null;

    function _accountPeriodNet(code, s, e) {
        const jeRow = _db.prepare(`
            SELECT COALESCE(SUM(l.debit_halala),0) as dr, COALESCE(SUM(l.credit_halala),0) as cr
            FROM journal_entry_lines l
            JOIN journal_entries je ON l.entry_id = je.id
            WHERE l.account_code = ? AND je.entry_date BETWEEN ? AND ? AND je.status != 'reversed'
        `).get(code, s, e);
        const legRow = _db.prepare(`
            SELECT COALESCE(SUM(debit),0) as dr, COALESCE(SUM(credit),0) as cr
            FROM ledger_entries WHERE account_code = ? AND DATE(date) BETWEEN ? AND ?
        `).get(code, s, e);
        return {
            dr: (jeRow.dr / 100) + parseFloat(legRow.dr || 0),
            cr: (jeRow.cr / 100) + parseFloat(legRow.cr || 0),
        };
    }

    function _buildIS(s, e) {
        const expAccounts = [5100, 5200, 5210, 5300, 5400, 5500, 5600, 5700, 5800, 5900];
        const revAccounts = [4100, 4200];

        let revenue = 0, otherIncome = 0, cogs = 0, grossProfit = 0;
        const expenseLines = [];

        for (const code of revAccounts) {
            const b = _accountPeriodNet(code, s, e);
            const net = b.cr - b.dr; // Revenue is credit-normal
            if (code === 4100) revenue     = net;
            if (code === 4200) otherIncome = net;
        }

        for (const code of expAccounts) {
            const b   = _accountPeriodNet(code, s, e);
            const net = b.dr - b.cr; // Expense is debit-normal
            const acc = _db.prepare('SELECT name_ar FROM accounts WHERE account_code = ?').get(code);
            if (code === 5100) { cogs = net; continue; }
            expenseLines.push({ account_code: code, name_ar: acc?.name_ar || String(code), amount: net });
        }

        grossProfit = revenue - cogs;
        const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);
        const operatingProfit = grossProfit - totalExpenses;
        const netProfit = operatingProfit + otherIncome;
        const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;
        const netMarginPct   = revenue > 0 ? ((netProfit   / revenue) * 100) : 0;

        return {
            revenue, other_income: otherIncome, cogs, gross_profit: grossProfit,
            expenses: expenseLines, total_expenses: totalExpenses,
            operating_profit: operatingProfit, net_profit: netProfit,
            gross_margin_pct: parseFloat(grossMarginPct.toFixed(1)),
            net_margin_pct:   parseFloat(netMarginPct.toFixed(1)),
        };
    }

    const current = _buildIS(sDate, eDate);
    const prior   = (cStart && cEnd) ? _buildIS(cStart, cEnd) : null;

    return {
        period: { start: sDate, end: eDate },
        compare_period: prior ? { start: cStart, end: cEnd } : null,
        current,
        prior,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS — READ
// ─────────────────────────────────────────────────────────────────────────────

function getAccountsHierarchical() {
    return _db.prepare(`
        SELECT * FROM accounts WHERE is_active = 1 ORDER BY account_code ASC
    `).all();
}

function addAccountNew(data) {
    const { code, name_ar, name_en, type, parent_code, level, normal_balance } = data;
    // Prevent deletion / overwrite of system accounts
    const existing = _db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code);
    if (existing) throw new Error(`الكود ${code} مستخدم بالفعل`);

    _db.prepare(`
        INSERT INTO accounts (account_code, name_ar, name_en, type, parent_id, level, normal_balance, is_system, is_active)
        VALUES (?,?,?,?,?,?,?, 0, 1)
    `).run(code, name_ar, name_en || null, type, parent_code || null,
           parseInt(level) || 3,
           normal_balance || (type === 'Asset' || type === 'Expense' ? 'debit' : 'credit'));

    return { success: true, account_code: code };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD MANAGEMENT (P-017)
// ─────────────────────────────────────────────────────────────────────────────

function getPeriods() {
    const periods = _db.prepare('SELECT * FROM accounting_periods ORDER BY start_date DESC').all();
    return periods.map(p => ({
        ...p,
        entry_count: _db.prepare(`
            SELECT COUNT(*) as c FROM journal_entries
            WHERE entry_date BETWEEN ? AND ? AND status != 'reversed'
        `).get(p.start_date, p.end_date).c,
    }));
}

function savePeriod(data) {
    if (data.id) {
        _db.prepare(`
            UPDATE accounting_periods SET period_name=?, start_date=?, end_date=? WHERE id=?
        `).run(data.period_name, data.start_date, data.end_date, data.id);
        return { success: true };
    }
    const info = _db.prepare(`
        INSERT INTO accounting_periods (period_name, start_date, end_date, status)
        VALUES (?,?,?,'open')
    `).run(data.period_name, data.start_date, data.end_date);
    return { success: true, id: info.lastInsertRowid };
}

function lockPeriod(periodId, lockType, userId = 1) {
    const period = _db.prepare('SELECT * FROM accounting_periods WHERE id = ?').get(periodId);
    if (!period) throw new Error('الفترة غير موجودة');
    _db.prepare(`
        UPDATE accounting_periods
        SET status = ?, locked_by = ?, locked_at = datetime('now')
        WHERE id = ?
    `).run(lockType, userId, periodId);
    return { success: true };
}

function unlockPeriod(periodId) {
    _db.prepare(`UPDATE accounting_periods SET status = 'open', locked_by = NULL, locked_at = NULL WHERE id = ?`).run(periodId);
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    initAccounting,
    postJournalEntry,
    getJournalEntries,
    getJournalEntry,
    reverseJournalEntry,
    getBalanceSheet,
    getCashFlowStatement,
    getIncomeStatement,
    postOpeningBalances,
    hasOpeningBalances,
    getAccountsHierarchical,
    addAccountNew,
    getPeriods,
    savePeriod,
    lockPeriod,
    unlockPeriod,
    nextJvRef,
    toHalala,
    fromHalala,
    fmtDate,
};
