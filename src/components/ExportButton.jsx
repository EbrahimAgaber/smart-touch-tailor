/**
 * ExportButton — drop-in component that wraps the P-019 export engine.
 *
 * Usage:
 *   <ExportButton
 *     label="تصدير PDF"
 *     format="pdf"
 *     title="تقرير المبيعات"
 *     subtitle="يناير — مارس 2026"
 *     headers={['التاريخ','المبلغ']}
 *     rows={[[...],[...]]}
 *     summaryRows={[{label:'الإجمالي', value:'12,500'}]}
 *     filename="sales-q1.pdf"
 *   />
 */
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader } from 'lucide-react';
import { exportPDF, exportExcel, buildLetterheadHTML } from '../utils/exportEngine';

export default function ExportButton({
  label,
  format = 'pdf',         // 'pdf' | 'excel'
  title,
  subtitle = '',
  headers = [],
  rows = [],
  summaryRows = [],
  filename,
  style: extraStyle = {},
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const settings = window.api?.getSettings
        ? await window.api.getSettings().catch(() => ({}))
        : {};

      if (format === 'excel') {
        await exportExcel({
          filename: filename || `${title}.xlsx`,
          sheetName: title,
          headers,
          rows,
          meta: true,
        });
      } else {
        const html = buildLetterheadHTML({
          title,
          subtitle,
          headers,
          rows,
          summaryRows,
          settings,
          logoBase64: settings.logo_image || settings.business_logo || null,
        });
        await exportPDF({ title, html, filename });
      }
    } catch (err) {
      console.error('[ExportButton] Export error:', err);
      alert('حدث خطأ أثناء التصدير: ' + (err.message || err));
    }
    setLoading(false);
  };

  const isPDF   = format === 'pdf';
  const Icon    = loading ? Loader : isPDF ? FileText : FileSpreadsheet;
  const defLabel = isPDF ? 'تصدير PDF' : 'تصدير Excel';

  return (
    <button
      onClick={handleExport}
      disabled={loading || disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '9px 16px',
        background: isPDF ? '#f0f9ff' : '#f0fdf4',
        border: `1.5px solid ${isPDF ? '#bae6fd' : '#a7f3d0'}`,
        borderRadius: '10px',
        color: isPDF ? '#0369a1' : '#059669',
        fontWeight: '700',
        fontSize: '12px',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        opacity: loading || disabled ? 0.65 : 1,
        ...extraStyle,
      }}
      title={`${label || defLabel} — ${title}`}
    >
      <Icon size={14} style={loading ? { animation: 'spin 0.8s linear infinite' } : {}} />
      {label || defLabel}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
