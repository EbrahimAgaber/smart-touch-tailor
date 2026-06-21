
// ═════════════════════════════════════════════════════════════════════════════
// GAP-06b · Bank Statement FILE import (fs-level)
//  Reads a CSV or Excel file from disk, parses it, and calls importBankStatementRows.
//  Accepts files with flexible column names — auto-detects common bank CSV headers.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * importBankStatementFile
 * @param {number} bank_account_id
 * @param {string} filePath  — absolute path to .csv / .xlsx / .xls
 * @param {object} [columnMap]
 */
function importBankStatementFile(bank_account_id, filePath, columnMap = {}) {
    const ext = require('path').extname(filePath).toLowerCase();
    let rows = [];

    if (ext === '.csv') {
        // Pure Node CSV parse — no external dep needed
        const raw = require('fs').readFileSync(filePath, 'utf8');
        rows = _parseCSV(raw);
    } else if (ext === '.xlsx' || ext === '.xls') {
        // Use adm-zip / xlsx if available, otherwise error gracefully
        try {
            const XLSX = require('xlsx');
            const wb   = XLSX.readFile(filePath);
            const ws   = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        } catch (e) {
            throw new Error('xlsx library not found — install it via: npm install xlsx\n' + e.message);
        }
    } else {
        throw new Error(`Unsupported file type: ${ext}. Use .csv or .xlsx`);
    }

    if (!rows.length) throw new Error('File is empty or has no parseable rows');

    // Auto-detect column mapping from header names (case-insensitive)
    const detectedMap = _detectColumnMap(Object.keys(rows[0] || {}), columnMap);

    return importBankStatementRows({ bank_account_id, rows, columnMap: detectedMap });
}

/**
 * _detectColumnMap — fuzzy header matching for common Saudi bank CSV exports
 * (Al Rajhi, SNB, Riyad Bank, Al Ahli, SABB etc.)
 */
function _detectColumnMap(headers, override = {}) {
    const find = (candidates) => {
        const h = headers.map(x => x.toLowerCase().trim());
        for (const c of candidates) {
            const idx = h.findIndex(x => x.includes(c));
            if (idx >= 0) return headers[idx];
        }
        return null;
    };

    return {
        date:        override.date        || find(['date','تاريخ','transaction date','txn date','value date']) || 'Date',
        description: override.description || find(['description','بيان','particulars','narration','details','وصف']) || 'Description',
        debit:       override.debit       || find(['debit','مدين','withdrawal','amount debit','out']) || 'Debit',
        credit:      override.credit      || find(['credit','دائن','deposit','amount credit','in']) || 'Credit',
        balance:     override.balance     || find(['balance','الرصيد','running balance','bal']) || 'Balance',
        reference:   override.reference   || find(['reference','ref','cheque','chq','مرجع','transaction id','txn id']) || 'Reference',
    };
}

/**
 * _parseCSV — lightweight RFC 4180 CSV parser
 */
function _parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // Find header row (skip blank lines at top)
    let headerIdx = 0;
    while (headerIdx < lines.length && !lines[headerIdx].trim()) headerIdx++;
    if (headerIdx >= lines.length) return [];

    const headers = _csvLine(lines[headerIdx]);
    const rows = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = _csvLine(line);
        if (vals.every(v => !v)) continue; // skip blank rows
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
        rows.push(obj);
    }
    return rows;
}

function _csvLine(line) {
    const result = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
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

/**
 * autoMatchBankLines
 * Exact reconciliation pass:
 *   For each unmatched bank_statement_line, look for a journal_entry_line with:
 *     • same entry_date as transaction_date
 *     • same (debit_halala or credit_halala) amount
 *     • same bank account_code
 *   If found, set is_matched = 1 and link the journal_entry_line_id.
 *
 * Returns { matched, unmatched, total }
 */
function autoMatchBankLines(bank_account_id) {
    // Get the GL account_code for this bank account
    const bankAcct = _db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(bank_account_id);
    if (!bankAcct) throw new Error(`Bank account #${bank_account_id} not found`);

    const glAccountCode = bankAcct.gl_account_code || bankAcct.account_code;

    // Get all unmatched bank statement lines
    const unmatched = _db.prepare(`
        SELECT * FROM bank_statement_lines
        WHERE bank_account_id = ? AND is_matched = 0
        ORDER BY transaction_date, id
    `).all(bank_account_id);

    if (!unmatched.length) return { matched: 0, unmatched: 0, total: 0 };

    let matchedCount = 0;

    const updateLine = _db.prepare(`
        UPDATE bank_statement_lines SET is_matched = 1, journal_entry_line_id = ? WHERE id = ?
    `);

    const findJELine = _db.prepare(`
        SELECT jl.id
        FROM journal_entry_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE jl.account_code = ?
          AND je.entry_date = ?
          AND je.status = 'posted'
          AND (
                (jl.debit_halala = ? AND ? > 0)
             OR (jl.credit_halala = ? AND ? > 0)
          )
          AND jl.id NOT IN (SELECT journal_entry_line_id FROM bank_statement_lines WHERE journal_entry_line_id IS NOT NULL)
        LIMIT 1
    `);

    const doMatch = _db.transaction(() => {
        for (const line of unmatched) {
            const debit  = line.debit_halala  || 0;
            const credit = line.credit_halala || 0;
            const amount = debit > 0 ? debit : credit;
            if (!amount) continue;

            const match = findJELine.get(
                glAccountCode,
                line.transaction_date,
                debit, debit,
                credit, credit,
            );

            if (match) {
                updateLine.run(match.id, line.id);
                matchedCount++;
            }
        }
    });
    doMatch();

    return {
        matched:   matchedCount,
        unmatched: unmatched.length - matchedCount,
        total:     unmatched.length,
    };
}
