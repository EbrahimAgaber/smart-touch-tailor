/**
 * ═══════════════════════════════════════════════════════════════════
 *  P-019 — Export Engine (Frontend Utility)
 *  Letterheaded PDF via Electron printToPDF + OOXML Excel
 *  Replaces window.print() for all report pages.
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Usage:
 *    import { exportPDF, exportExcel, buildLetterheadHTML } from '../utils/exportEngine';
 *
 *    // PDF — any table / JSX page:
 *    await exportPDF({ title: 'تقرير المبيعات', html: buildLetterheadHTML({ title, rows }) });
 *
 *    // Excel:
 *    await exportExcel({ filename: 'sales.xlsx', sheetName: 'مبيعات', headers: [...], rows: [...] });
 */

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (n ?? '');
}

function todayAr() {
  return new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Letterhead HTML builder ────────────────────────────────────────────────────
/**
 * Produces a complete, self-contained HTML page suitable for printToPDF.
 *
 * @param {object} opts
 * @param {string}   opts.title         - Arabic report title
 * @param {string}   opts.subtitle      - Optional date range or subtitle
 * @param {string[]} opts.headers       - Column headers (Arabic, RTL order)
 * @param {Array[]}  opts.rows          - 2-D array of cell values
 * @param {object[]} [opts.summaryRows] - [{label, value}] appended below table
 * @param {object}   [opts.settings]    - Business settings object
 * @param {string}   [opts.logoBase64]  - Data URI for logo image
 */
export function buildLetterheadHTML({ title, subtitle, headers = [], rows = [], summaryRows = [], settings = {}, logoBase64 = null, clearanceStatus = null, clearedAt = null }) {
  const bizName   = settings.business_name_ar || 'البصمة الذكية';
  // [GAP-4] Canonical key is vat_number (matches Settings.jsx). tax_number is a
  // legacy alias kept for compatibility with any direct DB reads that haven't migrated.
  const vatNo     = settings.vat_number || settings.tax_number || '';
  // [GAP-4] Runtime check — warn but don't block internal reports.
  const vatValid = vatNo && /^3\d{14}$/.test(vatNo);
  const crn       = settings.crn || '';
  const address   = [settings.address_city, settings.address_district].filter(Boolean).join('، ');
  const phone     = settings.phone || '';

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="شعار" style="height:70px;object-fit:contain;" />`
    : `<div style="width:70px;height:70px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;font-weight:900;">ب</div>`;

  const headerCells = headers.map(h => `<th>${h}</th>`).join('');
  const bodyRows = rows.map(row =>
    `<tr>${row.map(cell => `<td>${fmt(cell)}</td>`).join('')}</tr>`
  ).join('');

  const summaryHtml = summaryRows.length
    ? `<table class="summary">
        ${summaryRows.map(r => `<tr><td class="sum-label">${r.label}</td><td class="sum-value">${fmt(r.value)}</td></tr>`).join('')}
      </table>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', 'Tahoma', Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: white;
    padding: 20px 28px 32px;
    direction: rtl;
  }

  /* ── Letterhead ── */
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 3px solid #1d4ed8;
    margin-bottom: 18px;
  }
  .biz-info { display: flex; align-items: center; gap: 14px; }
  .biz-details { display: flex; flex-direction: column; gap: 3px; }
  .biz-name { font-size: 18pt; font-weight: 900; color: #1d4ed8; }
  .biz-meta { font-size: 9pt; color: #64748b; }

  .doc-info { text-align: left; }
  .doc-title { font-size: 15pt; font-weight: 800; color: #1e293b; }
  .doc-sub   { font-size: 10pt; color: #64748b; margin-top: 4px; }
  .doc-date  { font-size: 9pt; color: #94a3b8; margin-top: 2px; }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
    font-size: 10pt;
  }
  th {
    background: #1d4ed8;
    color: white;
    padding: 9px 12px;
    font-weight: 700;
    text-align: right;
    font-size: 9.5pt;
    border: 1px solid #1e40af;
  }
  td {
    padding: 7px 12px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #eff6ff; }

  /* ── Summary table ── */
  .summary {
    margin-top: 20px;
    margin-right: auto;
    min-width: 280px;
    float: left;
    border: 1.5px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }
  .sum-label {
    padding: 8px 16px;
    font-weight: 700;
    background: #f8fafc;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    text-align: right;
  }
  .sum-value {
    padding: 8px 16px;
    font-weight: 800;
    color: #1d4ed8;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    font-feature-settings: "tnum";
  }

  /* ── Footer ── */
  .footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #94a3b8;
    clear: both;
  }

  /* ── Print ── */
  @page { size: A4; margin: 0; }
  @media print {
    body { padding: 16px 22px 24px; }
  }
</style>
</head>
<body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div class="biz-info">
      ${logoHtml}
      <div class="biz-details">
        <div class="biz-name">${bizName}</div>
        ${(vatValid ? vatNo : '') ? `<div class="biz-meta">الرقم الضريبي: ${(vatValid ? vatNo : '')}</div>` : ''}
        ${crn    ? `<div class="biz-meta">السجل التجاري: ${crn}</div>` : ''}
        ${address ? `<div class="biz-meta">${address}</div>` : ''}
        ${phone   ? `<div class="biz-meta">📞 ${phone}</div>` : ''}
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-title">${title}</div>
      ${subtitle ? `<div class="doc-sub">${subtitle}</div>` : ''}
      <div class="doc-date">${todayAr()}</div>
      ${clearanceStatus ? `<div class="biz-meta" style="margin-top:6px;padding:4px 10px;border-radius:6px;font-weight:700;background:${clearanceStatus==='cleared'?'#dcfce7':clearanceStatus==='reported'?'#dbeafe':'#fef9c3'};color:${clearanceStatus==='cleared'?'#15803d':clearanceStatus==='reported'?'#1d4ed8':'#854d0e'}">حالة ZATCA: ${clearanceStatus==='cleared'?'مقبول ✓':clearanceStatus==='reported'?'Reported ✓':'بانتظار'}${clearedAt?' — '+new Date(clearedAt).toLocaleDateString('ar-SA'):''}</div>` : ''}
    </div>
  </div>

  <!-- Data table -->
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  ${summaryHtml}

  <!-- Footer -->
  <div class="footer">
    <span>تم الإنشاء بواسطة نظام البصمة الذكية</span>
    <span>${todayAr()}</span>
  </div>

</body>
</html>`;
}

// ── PDF Export ─────────────────────────────────────────────────────────────────
/**
 * Generate a letterheaded PDF and open a Save-As dialog.
 *
 * @param {object} opts
 * @param {string} opts.title       - Document title (also used as default filename)
 * @param {string} opts.html        - Full HTML from buildLetterheadHTML()
 * @param {string} [opts.filename]  - Override default filename
 */
export async function exportPDF({ title, html, filename }) {
  if (!window.api?.exportToPDF) {
    // Graceful fallback to window.print() if IPC not available (dev/web mode)
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    return { success: true, fallback: true };
  }
  const safeName = (filename || title || 'تقرير').replace(/[\\/:*?"<>|]/g, '_');
  const result = await window.api.exportToPDF({ html, filename: `${safeName}.pdf` });
  return result;
}

// ── Excel Export ───────────────────────────────────────────────────────────────
/**
 * Export tabular data to an OOXML .xlsx file.
 *
 * @param {object} opts
 * @param {string}   opts.filename   - e.g. 'sales-2026-05.xlsx'
 * @param {string}   opts.sheetName  - Arabic sheet name
 * @param {string[]} opts.headers    - Column headers
 * @param {Array[]}  opts.rows       - 2-D array or array-of-objects
 * @param {boolean}  [opts.meta]     - Include business letterhead rows at top
 */
export async function exportExcel({ filename, sheetName, headers, rows, meta = true }) {
  if (!window.api?.exportToExcel) {
    // Fallback: CSV download in browser
    const csv = [headers, ...rows].map(r =>
      r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace('.xlsx', '.csv');
    a.click();
    return { success: true, fallback: true };
  }
  const result = await window.api.exportToExcel({ filename, sheetName, headers, rows, meta });
  return result;
}

// ── Quick helpers for common report types ─────────────────────────────────────

/**
 * Export a sales history array to both PDF and Excel in one call.
 * Reads business settings from window.api automatically.
 */
export async function exportSalesReport({ sales = [], dateRange = '', format = 'pdf' }) {
  const settings = window.api?.getSettings ? await window.api.getSettings() : {};
  const title = 'تقرير المبيعات';
  const subtitle = dateRange;

  const headers  = ['رقم الفاتورة', 'التاريخ', 'العميل', 'طريقة الدفع', 'المبلغ (ريال)', 'الضريبة', 'الحالة'];
  const rows     = sales.map(s => [
    s.invoice,
    (s.sale_date || s.timestamp || '').split('T')[0],
    s.customer_name || 'عميل عام',
    s.payment || s.payment_method || '',
    parseFloat(s.total || s.total_amount || 0).toFixed(2),
    parseFloat(s.tax || s.tax_amount || 0).toFixed(2),
    s.status === 'void' ? 'ملغية' : s.status === 'return' ? 'مرتجع' : 'مدفوعة'
  ]);

  const total   = sales.reduce((s, r) => s + parseFloat(r.total || r.total_amount || 0), 0);
  const vatSum  = sales.reduce((s, r) => s + parseFloat(r.tax || r.tax_amount || 0), 0);
  const count   = sales.length;
  const summaryRows = [
    { label: 'عدد الفواتير', value: count },
    { label: 'إجمالي المبيعات (ريال)', value: total.toFixed(2) },
    { label: 'إجمالي الضريبة (ريال)', value: vatSum.toFixed(2) },
  ];

  if (format === 'excel') {
    return exportExcel({ filename: 'تقرير-المبيعات.xlsx', sheetName: 'مبيعات', headers, rows, meta: true });
  }

  const html = buildLetterheadHTML({ title, subtitle, headers, rows, summaryRows, settings, logoBase64: settings.logo_image });
  return exportPDF({ title, html });
}

/**
 * Export expenditures to PDF or Excel.
 */
export async function exportExpendituresReport({ rows = [], dateRange = '', format = 'pdf' }) {
  const settings = window.api?.getSettings ? await window.api.getSettings() : {};
  const title = 'تقرير المصروفات';
  const headers = ['التاريخ', 'البيان', 'المورد', 'الفئة', 'الصافي (ريال)', 'الضريبة (ريال)', 'الإجمالي (ريال)'];
  const total = rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const dataRows = rows.map(r => [
    (r.expense_date || r.timestamp || '').split('T')[0],
    r.description || '',
    r.supplier_name || '',
    r.category || '',
    parseFloat(r.net_amount || 0).toFixed(2),
    parseFloat(r.vat_amount || 0).toFixed(2),
    parseFloat(r.amount || 0).toFixed(2),
  ]);
  const summaryRows = [{ label: 'إجمالي المصروفات (ريال)', value: total.toFixed(2) }];

  if (format === 'excel') {
    return exportExcel({ filename: 'تقرير-المصروفات.xlsx', sheetName: 'مصروفات', headers, rows: dataRows, meta: true });
  }
  const html = buildLetterheadHTML({ title, subtitle: dateRange, headers, rows: dataRows, summaryRows, settings, logoBase64: settings.logo_image });
  return exportPDF({ title, html });
}

/**
 * Export a generic table.
 * Used by FinanceHub, SalesHistory, Stock, etc.
 */
export async function exportGenericTable({ title, subtitle = '', headers, rows, summaryRows = [], filename, format = 'pdf' }) {
  const settings = window.api?.getSettings ? await window.api.getSettings() : {};
  if (format === 'excel') {
    return exportExcel({ filename: filename || `${title}.xlsx`, sheetName: title, headers, rows, meta: true });
  }
  const html = buildLetterheadHTML({ title, subtitle, headers, rows, summaryRows, settings, logoBase64: settings.logo_image });
  return exportPDF({ title, html, filename });
}
