
// ═════════════════════════════════════════════════════════════════════════════
// GAP-06b · Bank Statement FILE import (fs-level read + parse)
//  Reads .csv or .xlsx files from disk, auto-detects Saudi bank headers,
//  and delegates to importBankStatementRows for DB persistence.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * importBankStatementFile
 * @param {number} bank_account_id
 * @param {string} filePath   — absolute path to .csv / .xlsx / .xls on disk
 * @param {object} [columnMap] — optional explicit column name overrides
 * @returns same shape as importBankStatementRows
 */
function importBankStatementFile(bank_account_id, filePath, columnMap = {}) {
    const ext = require('path').extname(filePath).toLowerCase();
    let rows = [];

    if (ext === '.csv') {
        const raw = require('fs').readFileSync(filePath, 'utf8');
        rows = _parseCSVText(raw);
    } else if (ext === '.xlsx' || ext === '.xls') {
        try {
            const XLSX = require('xlsx');
            const wb   = XLSX.readFile(filePath);
            const ws   = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        } catch (e) {
            throw new Error(
                'مكتبة xlsx غير مثبّتة — قم بتشغيل: npm install xlsx\n' + e.message
            );
        }
    } else {
        throw new Error(`نوع الملف غير مدعوم: ${ext}. استخدم .csv أو .xlsx`);
    }

    if (!rows.length) throw new Error('الملف فارغ أو لا يحتوي على بيانات');

    const detectedMap = _detectBankColumnMap(Object.keys(rows[0] || {}), columnMap);
    return importBankStatementRows({ bank_account_id, rows, columnMap: detectedMap });
}

/**
 * _detectBankColumnMap
 * Fuzzy match for common Saudi bank CSV export headers.
 * Covers: Al Rajhi, SNB, Riyad Bank, Al Ahli, SABB, BSF
 */
function _detectBankColumnMap(headers, override = {}) {
    const h = headers.map(x => x.toLowerCase().trim());
    const find = (candidates) => {
        for (const c of candidates) {
            const idx = h.findIndex(x => x.includes(c));
            if (idx >= 0) return headers[idx];
        }
        return null;
    };
    return {
        date:        override.date        || find(['date','تاريخ','transaction date','txn date','value date','posting date']) || headers[0] || 'Date',
        description: override.description || find(['description','بيان','particulars','narration','details','وصف','narrative','remarks']) || 'Description',
        debit:       override.debit       || find(['debit','مدين','withdrawal','withdrawals','amount debit','debit amount','out','paid out']) || 'Debit',
        credit:      override.credit      || find(['credit','دائن','deposit','deposits','amount credit','credit amount','in','paid in']) || 'Credit',
        balance:     override.balance     || find(['balance','الرصيد','running balance','bal','closing balance']) || 'Balance',
        reference:   override.reference   || find(['reference','ref','cheque','chq no','مرجع','transaction id','txn id','transaction no','doc no']) || 'Reference',
    };
}

/**
 * _parseCSVText — lightweight RFC 4180 CSV parser (no deps)
 */
function _parseCSVText(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // Skip leading blank/BOM lines to find header
    let hi = 0;
    while (hi < lines.length && !lines[hi].replace(/\uFEFF/g, '').trim()) hi++;
    if (hi >= lines.length) return [];

    const headers = _parseCsvLine(lines[hi].replace(/\uFEFF/g, ''));
    const rows = [];

    for (let i = hi + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = _parseCsvLine(line);
        if (vals.every(v => !v)) continue;
        const obj = {};
        headers.forEach((hdr, idx) => { obj[hdr] = vals[idx] ?? ''; });
        rows.push(obj);
    }
    return rows;
}

function _parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur.trim());
    return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-06c · Auto-Match Bank Statement Lines
//  Exact-match reconciliation:
//    bank_statement_lines.transaction_date  == journal_entries.entry_date
//    bank_statement_lines.debit_halala      == journal_entry_lines.debit_halala  (or credit)
//    journal_entry_lines.account_code       == bank_accounts.gl_account_code
//  Only matches lines not yet paired (is_matched = 0 / journal_entry_line_id IS NULL).
// ═════════════════════════════════════════════════════════════════════════════

/**
 * autoMatchBankLines
 * @param {number} bank_account_id
 * @returns {{ matched, unmatched, total }}
 */
function autoMatchBankLines(bank_account_id) {
    const bankAcct = _db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(bank_account_id);
    if (!bankAcct) throw new Error(`حساب البنك #${bank_account_id} غير موجود`);

    const glCode = bankAcct.gl_account_code || bankAcct.account_code;
    if (!glCode) throw new Error('حساب البنك لا يحتوي على رمز حساب دفتر الأستاذ (gl_account_code)');

    const pendingLines = _db.prepare(`
        SELECT * FROM bank_statement_lines
        WHERE bank_account_id = ? AND is_matched = 0
        ORDER BY transaction_date, id
    `).all(bank_account_id);

    if (!pendingLines.length) return { matched: 0, unmatched: 0, total: 0 };

    const updateStmt = _db.prepare(`
        UPDATE bank_statement_lines
        SET is_matched = 1, journal_entry_line_id = ?
        WHERE id = ?
    `);

    // Prepared statement: find a journal line that:
    //  - hits the right GL account
    //  - has matching date and halala amount
    //  - hasn't already been matched to another bank line
    const findStmt = _db.prepare(`
        SELECT jl.id
        FROM journal_entry_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'posted'
        WHERE jl.account_code = ?
          AND je.entry_date = ?
          AND (
                (? > 0 AND jl.debit_halala  = ?)
             OR (? > 0 AND jl.credit_halala = ?)
          )
          AND jl.id NOT IN (
              SELECT journal_entry_line_id
              FROM bank_statement_lines
              WHERE journal_entry_line_id IS NOT NULL
          )
        ORDER BY je.id ASC
        LIMIT 1
    `);

    let matched = 0;

    const runMatch = _db.transaction(() => {
        for (const line of pendingLines) {
            const dr = line.debit_halala  || 0;
            const cr = line.credit_halala || 0;
            if (!dr && !cr) continue;

            const hit = findStmt.get(
                glCode,
                line.transaction_date,
                dr, dr,   // debit side
                cr, cr,   // credit side
            );

            if (hit) {
                updateStmt.run(hit.id, line.id);
                matched++;
            }
        }
    });
    runMatch();

    return {
        matched,
        unmatched: pendingLines.length - matched,
        total:     pendingLines.length,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — flexible date parser for CSV imports
// ─────────────────────────────────────────────────────────────────────────────
function _parseDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
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
    // GAP-06 Bank Import (row-level)
    importBankStatementRows,
    getBankStatementLines,
    matchStatementLine,
    getStatementImports,
    // GAP-06b Bank Import (file-level: CSV / Excel)
    importBankStatementFile,
    autoMatchBankLines,
    // GAP-07 Retention
    getRetentionManifest,
};
