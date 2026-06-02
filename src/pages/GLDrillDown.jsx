/**
 * GLDrillDown.jsx — P-003 General Ledger Drill-Down
 * Click any account in CoA to see all journal_entry_lines for that account.
 * Used as a modal/panel inside FinanceHub CoATab.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, RefreshCw, Download } from 'lucide-react';

const sar = (n) => (parseFloat(n) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'white', borderRadius: '20px', width: '92vw', maxWidth: '1100px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 28px', borderBottom: '1px solid #f1f5f9',
  },
  th: {
    padding: '10px 14px', fontSize: '11px', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  input: {
    padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
    fontSize: '12px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc',
  },
  btn: (color = '#3b82f6') => ({
    padding: '7px 16px', borderRadius: '8px', border: 'none',
    background: color, color: 'white', fontWeight: '700', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '5px',
  }),
};

export function GLDrillDownModal({ accountCode, accountName, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [range, setRange] = useState({ startDate: yearStart, endDate: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.p2.getAccountDrillDown({
        accountCode,
        startDate: range.startDate,
        endDate: range.endDate,
        limit: 500,
      });
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [accountCode, range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal} dir="rtl">
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
              {accountCode} — {accountName}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              حركة دفتر الأستاذ التفصيلية
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Calendar size={13} color="#94a3b8" />
              <input type="date" value={range.startDate}
                onChange={e => setRange(r => ({ ...r, startDate: e.target.value }))}
                style={{ ...S.input, border: 'none', background: 'transparent', padding: '0' }} />
              <span style={{ color: '#94a3b8' }}>—</span>
              <input type="date" value={range.endDate}
                onChange={e => setRange(r => ({ ...r, endDate: e.target.value }))}
                style={{ ...S.input, border: 'none', background: 'transparent', padding: '0' }} />
            </div>
            <button onClick={() => window.print()} style={S.btn('#64748b')}><Download size={13} />طباعة</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {data && (
          <div style={{ display: 'flex', gap: '16px', padding: '14px 28px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {[
              { label: 'إجمالي المدين', val: data.totals?.total_debit, color: '#10b981' },
              { label: 'إجمالي الدائن', val: data.totals?.total_credit, color: '#ef4444' },
              { label: 'صافي الحركة', val: (data.totals?.total_debit || 0) - (data.totals?.total_credit || 0), color: '#3b82f6' },
              { label: 'عدد الحركات', val: null, count: data.lines?.length, color: '#8b5cf6' },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, background: 'white', padding: '12px 16px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: item.color, direction: 'ltr', textAlign: 'right' }}>
                  {item.count != null ? item.count : `${sar(item.val)} ر.س`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px', opacity: loading ? 0.6 : 1 }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> جاري التحميل...
            </div>
          )}
          {data && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                <tr>
                  <th style={S.th}>التاريخ</th>
                  <th style={S.th}>المرجع</th>
                  <th style={S.th}>البيان</th>
                  <th style={S.th}>النوع</th>
                  <th style={S.th}>مدين (Dr)</th>
                  <th style={S.th}>دائن (Cr)</th>
                  <th style={S.th}>الرصيد التراكمي</th>
                  <th style={S.th}>مركز التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {(data.lines || []).length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                      لا توجد حركات في هذه الفترة
                    </td>
                  </tr>
                )}
                {(data.lines || []).map((l, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={S.td}>{l.entry_date}</td>
                    <td style={{ ...S.td, fontWeight: '700', color: '#3b82f6', fontSize: '11px' }}>{l.reference_no}</td>
                    <td style={S.td}>{l.line_description || l.entry_description}</td>
                    <td style={S.td}>
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: '700', background: '#f5f3ff', color: '#8b5cf6' }}>
                        {l.entry_type}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#10b981', fontWeight: '800', direction: 'ltr' }}>
                      {l.debit > 0 ? sar(l.debit) : '—'}
                    </td>
                    <td style={{ ...S.td, color: '#ef4444', fontWeight: '800', direction: 'ltr' }}>
                      {l.credit > 0 ? sar(l.credit) : '—'}
                    </td>
                    <td style={{ ...S.td, direction: 'ltr', fontWeight: '800', color: l.running_balance >= 0 ? '#0f172a' : '#ef4444' }}>
                      {sar(l.running_balance)}
                    </td>
                    <td style={{ ...S.td, fontSize: '11px', color: '#94a3b8' }}>
                      {l.cost_centre_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default GLDrillDownModal;
