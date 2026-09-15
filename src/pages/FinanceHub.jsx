/**
 * FinanceHub.jsx — Phase 1 Complete Frontend
 * Tabs: P&L · Balance Sheet · Cash Flow · Journal (list + new entry) · Opening Balances · Periods · VAT · Ledger · Trial Balance · CoA
 * All wired to window.api.acct.* (accounting engine Phase 1 backend)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import {
  BarChart3, FileText, Scale, Landmark, List,
  TrendingUp, TrendingDown, DollarSign, Calendar,
  Printer, BookOpen, PlusCircle, RefreshCw, Lock,
  Unlock, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, Clock, RotateCcw, ArrowLeftRight,
  Layers, Settings2
} from 'lucide-react';

// ─── SAR formatter ────────────────────────────────────────────────────────────
const sar = (n, sign = false) => {
  const v = parseFloat(n) || 0;
  const fmt = Math.abs(v).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sign && v < 0) return `(${fmt})`;
  return fmt;
};
const sarColor = (n) => (parseFloat(n) >= 0 ? '#10b981' : '#ef4444');

// ─── Shared style tokens ──────────────────────────────────────────────────────
const S = {
  card: {
    background: 'white', padding: '28px', borderRadius: '20px',
    border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
  },
  cardSm: {
    background: 'white', padding: '20px', borderRadius: '16px',
    border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
  },
  title: { fontSize: '16px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' },
  th: {
    padding: '10px 14px', fontSize: '11px', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap'
  },
  td: { padding: '14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
    fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box'
  },
  btn: (color = '#3b82f6') => ({
    padding: '10px 20px', borderRadius: '10px', border: 'none',
    background: color, color: 'white', fontWeight: '700',
    fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: '6px'
  }),
  btnGhost: {
    padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
    background: 'transparent', color: '#64748b', fontWeight: '700',
    fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: '6px'
  },
  badge: (color, bg) => ({
    padding: '3px 10px', borderRadius: '99px', fontSize: '11px',
    fontWeight: '800', color, background: bg, whiteSpace: 'nowrap'
  }),
  label: { fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' },
  select: {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none',
    fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box'
  },
};

const formatDateLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Period selector used across multiple tabs ────────────────────────────────
function PeriodBar({ range, setRange, onPrint, extra }) {
  const thisMonth = () => {
    const d = new Date();
    setRange({
      startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: formatDateLocal(d)
    });
  };
  const thisYear = () => {
    const d = new Date();
    setRange({
      startDate: `${d.getFullYear()}-01-01`,
      endDate: formatDateLocal(d)
    });
  };
  const today = () => {
    const d = formatDateLocal(new Date());
    setRange({ startDate: d, endDate: d });
  };
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <Calendar size={13} color="#94a3b8" />
        <input type="date" value={range.startDate} onChange={e => setRange(r => ({ ...r, startDate: e.target.value }))}
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
        <input type="date" value={range.endDate} onChange={e => setRange(r => ({ ...r, endDate: e.target.value }))}
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
      </div>
      {[['اليوم', today], ['هذا الشهر', thisMonth], ['هذا العام', thisYear]].map(([lbl, fn]) => (
        <button key={lbl} onClick={fn} style={S.btnGhost}>{lbl}</button>
      ))}
      {extra}
      {onPrint && (
        <button onClick={() => window.print()} style={{ ...S.btnGhost, marginRight: 'auto' }}>
          <Printer size={14} /> طباعة
        </button>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, color = '#3b82f6', sub }) {
  return (
    <div style={{ ...S.cardSm, flex: 1 }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '900', color, direction: 'ltr', textAlign: 'right' }}>
        {sar(value)} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>ر.س</span>
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

// ─── PLRow ────────────────────────────────────────────────────────────────────
function PLRow({ label, val, indent = 0, bold = false, color, sep = false, dim = false }) {
  const c = color || (bold ? '#0f172a' : dim ? '#94a3b8' : '#334155');
  return (
    <>
      {sep && <div style={{ borderTop: '1px solid #f1f5f9', margin: '6px 0' }} />}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 0', paddingRight: indent * 18,
        fontWeight: bold ? '900' : '600', fontSize: bold ? '14px' : '13px',
      }}>
        <span style={{ color: bold ? '#0f172a' : '#475569' }}>{label}</span>
        <span style={{ color: c, direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
          {typeof val === 'string' ? val : `${sar(val, true)} ر.س`}
        </span>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: P&L — UPGRADED (P-006)
// ═══════════════════════════════════════════════════════════════════════════════
function ProfitLossTab() {
  const [range, setRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [compareOn, setCompareOn] = useState(false);
  const [compareRange, setCompareRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0]
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.acct.getIncomeStatement(
        range.startDate, range.endDate,
        compareOn ? compareRange.startDate : null,
        compareOn ? compareRange.endDate : null
      );
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [range, compareOn, compareRange]);

  useEffect(() => { load(); }, [load]);

  const c = data?.current;
  const p = data?.prior;

  const varPct = (cur, pri) => {
    if (!pri || pri === 0) return null;
    const pct = ((cur - pri) / Math.abs(pri)) * 100;
    return pct;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <PeriodBar range={range} setRange={setRange} onPrint />
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={compareOn} onChange={e => setCompareOn(e.target.checked)} />
          مقارنة بفترة سابقة
        </label>
      </div>
      {compareOn && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#eff6ff', padding: '10px 14px', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>فترة المقارنة:</span>
          <input type="date" value={compareRange.startDate} onChange={e => setCompareRange(r => ({ ...r, startDate: e.target.value }))}
            style={{ ...S.input, width: 'auto', padding: '6px 10px' }} />
          <span style={{ color: '#94a3b8' }}>—</span>
          <input type="date" value={compareRange.endDate} onChange={e => setCompareRange(r => ({ ...r, endDate: e.target.value }))}
            style={{ ...S.input, width: 'auto', padding: '6px 10px' }} />
        </div>
      )}

      {c && (
        <>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <KPI label="إيرادات المبيعات" value={c.revenue} color="#3b82f6" />
            <KPI label="إجمالي الربح" value={c.gross_profit} color="#10b981"
              sub={`هامش: ${c.gross_margin_pct}%`} />
            <KPI label="صافي الربح" value={c.net_profit} color={c.net_profit >= 0 ? '#10b981' : '#ef4444'}
              sub={`هامش: ${c.net_margin_pct}%`} />
            <KPI label="إجمالي المصروفات" value={c.total_expenses} color="#f59e0b" />
          </div>

          <div style={{ ...S.card, overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ ...S.title, margin: 0 }}>قائمة الدخل التفصيلية</h3>
              {p && <span style={S.badge('#3b82f6', '#eff6ff')}>مع المقارنة</span>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: '50%' }}>البند</th>
                  <th style={{ ...S.th }}>الفترة الحالية (ر.س)</th>
                  {p && <th style={{ ...S.th }}>الفترة السابقة (ر.س)</th>}
                  {p && <th style={{ ...S.th }}>التغيير</th>}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'الإيرادات', isHeader: true },
                  { label: 'إيرادات المبيعات (4100)', cur: c.revenue, pri: p?.revenue, indent: 1 },
                  { label: 'إيرادات أخرى (4200)', cur: c.other_income, pri: p?.other_income, indent: 1 },
                  { label: 'إجمالي الإيرادات', cur: c.revenue + c.other_income, pri: p ? p.revenue + p.other_income : null, bold: true, sep: true },
                  { label: 'تكلفة البضاعة المباعة (5100)', cur: -c.cogs, pri: p ? -p.cogs : null, color: '#ef4444', indent: 1 },
                  { label: 'إجمالي الربح', cur: c.gross_profit, pri: p?.gross_profit, bold: true, sep: true, color: '#10b981' },
                  { label: 'المصروفات التشغيلية', isHeader: true },
                  ...(c.expenses || []).map(exp => ({ label: exp.name_ar, cur: -exp.amount, pri: p?.expenses?.find(e => e.account_code === exp.account_code) ? -(p.expenses.find(e => e.account_code === exp.account_code).amount) : null, indent: 1, color: exp.amount > 0 ? '#ef4444' : '#64748b' })),
                  { label: 'إجمالي المصروفات', cur: -c.total_expenses, pri: p ? -p.total_expenses : null, bold: true, sep: true, color: '#ef4444' },
                  { label: 'الربح التشغيلي (EBIT)', cur: c.operating_profit, pri: p?.operating_profit, bold: true, sep: true },
                  { label: 'صافي الربح / الخسارة', cur: c.net_profit, pri: p?.net_profit, bold: true, sep: true, color: c.net_profit >= 0 ? '#10b981' : '#ef4444' },
                ].map((row, i) => {
                  if (row.isHeader) return (
                    <tr key={i} style={{ background: '#f8fafc' }}>
                      <td colSpan={p ? 4 : 2} style={{ ...S.td, fontWeight: '800', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {row.label}
                      </td>
                    </tr>
                  );
                  const pct = p && row.pri != null ? varPct(row.cur, row.pri) : null;
                  return (
                    <tr key={i} style={{ borderTop: row.sep ? '2px solid #0f172a' : undefined }}>
                      <td style={{ ...S.td, paddingRight: 14 + (row.indent || 0) * 16, fontWeight: row.bold ? '800' : '600' }}>{row.label}</td>
                      <td style={{ ...S.td, fontWeight: row.bold ? '900' : '700', color: row.color || (row.bold ? '#0f172a' : '#334155'), direction: 'ltr' }}>
                        {sar(row.cur, true)}
                      </td>
                      {p && <td style={{ ...S.td, color: '#94a3b8', direction: 'ltr' }}>{row.pri != null ? sar(row.pri, true) : '—'}</td>}
                      {p && <td style={{ ...S.td }}>
                        {pct != null ? (
                          <span style={S.badge(pct >= 0 ? '#10b981' : '#ef4444', pct >= 0 ? '#ecfdf5' : '#fef2f2')}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: BALANCE SHEET (P-004)
// ═══════════════════════════════════════════════════════════════════════════════
function BalanceSheetTab() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [compareDate, setCompareDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.acct.getBalanceSheet({ asOfDate: asOf, compareDate: compareDate || null });
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [asOf, compareDate]);

  useEffect(() => { load(); }, [load]);

  const Section = ({ title, rows, color, totalLabel, total, compareTotal }) => (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '13px', fontWeight: '800', color, marginBottom: '8px', borderBottom: `2px solid ${color}20`, paddingBottom: '6px' }}>
        {title}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 8px 14px', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
          <span style={{ color: '#475569' }}>{r.name_ar}</span>
          <div style={{ display: 'flex', gap: '24px', direction: 'ltr' }}>
            {compareTotal !== undefined && <span style={{ color: '#94a3b8', minWidth: '80px', textAlign: 'right' }}>{sar(r.compareBalance)}</span>}
            <span style={{ color: '#0f172a', fontWeight: '700', minWidth: '80px', textAlign: 'right' }}>{sar(r.balance)}</span>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontWeight: '900', fontSize: '14px', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
        <span>{totalLabel}</span>
        <div style={{ display: 'flex', gap: '24px', direction: 'ltr' }}>
          {compareTotal !== undefined && <span style={{ color: '#94a3b8', minWidth: '80px', textAlign: 'right' }}>{sar(compareTotal)}</span>}
          <span style={{ color, minWidth: '80px', textAlign: 'right' }}>{sar(total)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>كما في تاريخ:</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ ...S.input, width: 'auto', padding: '7px 12px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>مقارنة بـ:</span>
          <input type="date" value={compareDate} onChange={e => setCompareDate(e.target.value)} style={{ ...S.input, width: 'auto', padding: '7px 12px' }} />
          {compareDate && <button onClick={() => setCompareDate('')} style={S.btnGhost}>مسح</button>}
        </div>
        <button onClick={() => window.print()} style={S.btnGhost}><Printer size={14} />طباعة</button>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left column: Assets */}
          <div style={S.card}>
            <h3 style={{ ...S.title, color: '#3b82f6' }}>الأصول</h3>
            {data.compare_date && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', marginBottom: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                <span>{data.compare_date}</span>
                <span>{data.as_of}</span>
              </div>
            )}
            <Section
              title="الأصول المتداولة"
              rows={data.assets.filter(a => a.account_code < 1500)}
              color="#3b82f6"
              totalLabel="إجمالي الأصول المتداولة"
              total={data.assets.filter(a => a.account_code < 1500).reduce((s, a) => s + a.balance, 0)}
              compareTotal={data.compare_date ? data.assets.filter(a => a.account_code < 1500).reduce((s, a) => s + (a.compareBalance || 0), 0) : undefined}
            />
            <Section
              title="الأصول غير المتداولة"
              rows={data.assets.filter(a => a.account_code >= 1500)}
              color="#6366f1"
              totalLabel="إجمالي الأصول الثابتة"
              total={data.assets.filter(a => a.account_code >= 1500).reduce((s, a) => s + a.balance, 0)}
              compareTotal={data.compare_date ? data.assets.filter(a => a.account_code >= 1500).reduce((s, a) => s + (a.compareBalance || 0), 0) : undefined}
            />
            <div style={{ borderTop: '3px solid #0f172a', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px' }}>
              <span>إجمالي الأصول</span>
              <span style={{ color: '#3b82f6' }}>{sar(data.total_assets)} ر.س</span>
            </div>
          </div>

          {/* Right column: Liabilities + Equity */}
          <div style={S.card}>
            <h3 style={{ ...S.title, color: '#ef4444' }}>الخصوم وحقوق الملكية</h3>
            {data.compare_date && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', marginBottom: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                <span>{data.compare_date}</span>
                <span>{data.as_of}</span>
              </div>
            )}
            <Section
              title="الخصوم المتداولة"
              rows={data.liabilities}
              color="#ef4444"
              totalLabel="إجمالي الخصوم"
              total={data.total_liabilities}
              compareTotal={data.compare_date ? data.liabilities.reduce((s, a) => s + (a.compareBalance || 0), 0) : undefined}
            />
            <Section
              title="حقوق الملكية"
              rows={[
                ...data.equity,
                { name_ar: 'صافي ربح الفترة الحالية', account_code: 9999, balance: data.current_net_income, compareBalance: 0 }
              ]}
              color="#10b981"
              totalLabel="إجمالي حقوق الملكية"
              total={data.total_equity}
              compareTotal={data.compare_date ? data.equity.reduce((s, a) => s + (a.compareBalance || 0), 0) : undefined}
            />
            <div style={{ borderTop: '3px solid #0f172a', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16px' }}>
              <span>إجمالي الخصوم + حقوق الملكية</span>
              <span style={{ color: '#ef4444' }}>{sar(data.total_liab_equity)} ر.س</span>
            </div>
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', background: data.balanced ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {data.balanced
                ? <><CheckCircle size={16} color="#10b981" /><span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>الميزانية متوازنة ✓</span></>
                : <><AlertCircle size={16} color="#ef4444" /><span style={{ fontSize: '13px', fontWeight: '800', color: '#ef4444' }}>تحذير: الميزانية غير متوازنة — الفرق: {sar(Math.abs(data.total_assets - data.total_liab_equity))} ر.س</span></>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CASH FLOW (P-005)
// ═══════════════════════════════════════════════════════════════════════════════
function CashFlowTab() {
  const [range, setRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.acct.getCashFlow({ startDate: range.startDate, endDate: range.endDate });
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const FlowSection = ({ title, items, total, color }) => (
    <div style={{ ...S.cardSm, marginBottom: '16px' }}>
      <div style={{ fontWeight: '800', fontSize: '14px', color, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
        {title}
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0 7px 12px', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
          <span style={{ color: '#475569' }}>{it.label}</span>
          <span style={{ fontWeight: '700', color: it.value >= 0 ? '#10b981' : '#ef4444', direction: 'ltr' }}>
            {it.value >= 0 ? '+' : ''}{sar(it.value)} ر.س
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontWeight: '900', fontSize: '14px', borderTop: '2px solid #e2e8f0', marginTop: '4px' }}>
        <span>صافي {title}</span>
        <span style={{ color: total >= 0 ? '#10b981' : '#ef4444', direction: 'ltr' }}>
          {total >= 0 ? '+' : ''}{sar(total)} ر.س
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1 }}>
      <PeriodBar range={range} setRange={setRange} onPrint />
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          <div>
            <FlowSection
              title="التدفقات التشغيلية"
              color="#3b82f6"
              total={data.operating.total}
              items={[
                { label: 'صافي الربح', value: data.operating.net_income },
                { label: 'إضافة: الاستهلاك', value: data.operating.add_depreciation },
                { label: 'التغيير في الذمم المدينة', value: data.operating.changes.accounts_receivable },
                { label: 'التغيير في المخزون', value: data.operating.changes.inventory },
                { label: 'التغيير في الذمم الدائنة', value: data.operating.changes.accounts_payable },
                { label: 'التغيير في ضريبة القيمة المضافة', value: data.operating.changes.vat_net },
                { label: 'التغيير في الإيراد المؤجل', value: data.operating.changes.deferred_revenue },
              ]}
            />
            <FlowSection
              title="التدفقات الاستثمارية"
              color="#8b5cf6"
              total={data.investing.total}
              items={[
                { label: 'شراء أصول ثابتة', value: data.investing.fixed_asset_additions }
              ]}
            />
            <FlowSection
              title="التدفقات التمويلية"
              color="#10b981"
              total={data.financing.total}
              items={[
                { label: 'تغيير رأس المال', value: data.financing.capital_changes }
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={S.card}>
              <h3 style={{ ...S.title, marginBottom: '16px' }}>ملخص التدفق النقدي</h3>
              {[
                { label: 'صافي تدفق التشغيل', val: data.operating.total, color: '#3b82f6' },
                { label: 'صافي تدفق الاستثمار', val: data.investing.total, color: '#8b5cf6' },
                { label: 'صافي تدفق التمويل', val: data.financing.total, color: '#10b981' },
                { label: 'صافي التغيير في النقد', val: data.net_change_cash, color: data.net_change_cash >= 0 ? '#10b981' : '#ef4444', bold: true },
                { label: 'رصيد النقد الافتتاحي', val: data.opening_cash, color: '#64748b' },
                { label: 'رصيد النقد الختامي', val: data.closing_cash, color: '#0f172a', bold: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px', fontWeight: r.bold ? '900' : '600', borderTop: r.bold && i === 3 ? '2px solid #0f172a' : undefined }}>
                  <span style={{ color: '#475569' }}>{r.label}</span>
                  <span style={{ color: r.color, direction: 'ltr' }}>{sar(r.val)} ر.س</span>
                </div>
              ))}
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '10px', background: data.reconciled ? '#ecfdf5' : '#fef2f2' }}>
                {data.reconciled
                  ? <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>✓ مطابق — الرصيد الختامي يتطابق مع الدفاتر</span>
                  : <span style={{ fontSize: '13px', fontWeight: '800', color: '#ef4444' }}>⚠ فجوة في التطابق: {sar(Math.abs((data.opening_cash + data.net_change_cash) - data.closing_cash))} ر.س</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: JOURNAL ENTRIES (P-003)
// ═══════════════════════════════════════════════════════════════════════════════
function JournalTab() {
  const [view, setView] = useState('list'); // 'list' | 'new'
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    entry_type: 'all'
  });
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    window.api.acct.getAccountsHierarchical().then(setAccounts).catch(() => {});
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.api.acct.getJournalEntries(filters);
      setEntries(Array.isArray(res) ? res : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const entryTypes = ['all', 'Manual', 'Adjusting', 'Closing', 'Opening', 'Depreciation', 'Payroll', 'Reversal', 'Other'];
  const entryTypeAr = { all: 'الكل', Manual: 'يدوي', Adjusting: 'تسويات', Closing: 'إقفال', Opening: 'افتتاحي', Depreciation: 'استهلاك', Payroll: 'رواتب', Reversal: 'عكس', Other: 'أخرى' };
  const statusBadge = (s) => s === 'posted' ? S.badge('#10b981', '#ecfdf5')
    : s === 'reversed' ? S.badge('#94a3b8', '#f8fafc') : S.badge('#f59e0b', '#fffbeb');

  const handleReverse = async (id, ref) => {
    const reason = window.prompt(`سبب عكس القيد ${ref}:`);
    if (!reason) return;
    const date = window.prompt('تاريخ القيد العكسي (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    const res = await window.api.acct.reverseJournalEntry({ entryId: id, reason, reversalDate: date });
    if (res?.success) loadEntries();
    else alert('خطأ: ' + (res?.error || 'فشل العملية'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Calendar size={13} color="#94a3b8" />
            <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
            <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
          </div>
          <select value={filters.entry_type} onChange={e => setFilters(f => ({ ...f, entry_type: e.target.value }))}
            style={{ ...S.select, width: 'auto', padding: '7px 12px' }}>
            {entryTypes.map(t => <option key={t} value={t}>{entryTypeAr[t]}</option>)}
          </select>
        </div>
        <button onClick={() => setView(view === 'new' ? 'list' : 'new')} style={S.btn(view === 'new' ? '#64748b' : '#3b82f6')}>
          <PlusCircle size={15} /> {view === 'new' ? 'العودة للقائمة' : 'قيد جديد'}
        </button>
      </div>

      {view === 'new' ? (
        <NewJournalForm accounts={accounts} onSaved={() => { setView('list'); loadEntries(); }} />
      ) : (
        <div style={{ ...S.card, opacity: loading ? 0.6 : 1 }}>
          <h3 style={S.title}>دفتر اليومية — {entries.length} قيد</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead>
              <tr>
                <th style={S.th}>المرجع</th>
                <th style={S.th}>التاريخ</th>
                <th style={S.th}>البيان</th>
                <th style={S.th}>النوع</th>
                <th style={S.th}>مجموع مدين</th>
                <th style={S.th}>الحالة</th>
                <th style={S.th}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>لا توجد قيود في هذه الفترة</td></tr>
              )}
              {entries.map(e => {
                const totalDr = (e.lines || []).reduce((s, l) => s + l.debit, 0);
                const isOpen = expanded === e.id;
                return [
                  <tr key={e.id} style={{ cursor: 'pointer', background: isOpen ? '#f8fafc' : undefined }}
                    onClick={() => setExpanded(isOpen ? null : e.id)}>
                    <td style={{ ...S.td, fontWeight: '800', color: '#3b82f6' }}>{e.reference_no}</td>
                    <td style={S.td}>{e.entry_date}</td>
                    <td style={S.td}>{e.description}</td>
                    <td style={S.td}><span style={S.badge('#8b5cf6', '#f5f3ff')}>{entryTypeAr[e.entry_type] || e.entry_type}</span></td>
                    <td style={{ ...S.td, direction: 'ltr', fontWeight: '800' }}>{sar(totalDr)}</td>
                    <td style={S.td}><span style={statusBadge(e.status)}>{e.status === 'posted' ? 'مرحّل' : e.status === 'reversed' ? 'معكوس' : e.status}</span></td>
                    <td style={S.td}>
                      {e.status === 'posted' && (
                        <button onClick={ev => { ev.stopPropagation(); handleReverse(e.id, e.reference_no); }}
                          style={{ ...S.btnGhost, padding: '4px 10px', fontSize: '11px' }}>
                          <RotateCcw size={11} /> عكس
                        </button>
                      )}
                      {isOpen ? <ChevronDown size={14} style={{ marginRight: '4px' }} /> : <ChevronRight size={14} style={{ marginRight: '4px' }} />}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={7} style={{ padding: '0 24px 16px', background: '#f8fafc' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th style={{ ...S.th, fontSize: '10px' }}>الحساب</th>
                              <th style={{ ...S.th, fontSize: '10px' }}>مدين</th>
                              <th style={{ ...S.th, fontSize: '10px' }}>دائن</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(e.lines || []).map((l, li) => (
                              <tr key={li}>
                                <td style={{ ...S.td, padding: '8px 14px' }}>{l.account_code} — {l.name_ar}</td>
                                <td style={{ ...S.td, padding: '8px 14px', color: '#10b981', fontWeight: '700', direction: 'ltr' }}>{l.debit > 0 ? sar(l.debit) : '—'}</td>
                                <td style={{ ...S.td, padding: '8px 14px', color: '#ef4444', fontWeight: '700', direction: 'ltr' }}>{l.credit > 0 ? sar(l.credit) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── New Journal Entry Form ───────────────────────────────────────────────────
function NewJournalForm({ accounts, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ entry_date: today, description: '', entry_type: 'Manual', reference_no: '', notes: '' });
  const [lines, setLines] = useState([
    { account_code: '', description: '', debit: '', credit: '' },
    { account_code: '', description: '', debit: '', credit: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.acct.nextJvRef().then(ref => setForm(f => ({ ...f, reference_no: ref }))).catch(() => {});
  }, []);

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const addLine = () => setLines(l => [...l, { account_code: '', description: '', debit: '', credit: '' }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const setLine = (i, field, val) => setLines(l => l.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const save = async () => {
    setError('');
    if (!form.description) return setError('أدخل البيان');
    if (!balanced) return setError(`القيد غير متوازن — الفرق: ${sar(Math.abs(totalDr - totalCr))} ر.س`);
    const validLines = lines.filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) return setError('يجب أن يحتوي القيد على سطرين على الأقل');

    setSaving(true);
    const res = await window.api.acct.postJournalEntry({
      ...form,
      lines: validLines.map(l => ({
        account_code: parseInt(l.account_code),
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || form.description
      }))
    });
    setSaving(false);
    if (res?.success) onSaved();
    else setError(res?.error || 'فشل حفظ القيد');
  };

  const leafAccounts = accounts.filter(a => a.level >= 3 && a.is_active);

  return (
    <div style={S.card}>
      <h3 style={S.title}>قيد يومية جديد</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'التاريخ *', field: 'entry_date', type: 'date' },
          { label: 'رقم المرجع', field: 'reference_no', type: 'text', placeholder: 'JV-2026-0001' },
          { label: 'نوع القيد', field: 'entry_type', type: 'select', opts: ['Manual', 'Adjusting', 'Closing', 'Opening', 'Depreciation', 'Payroll', 'Other'] },
        ].map(f => (
          <div key={f.field}>
            <div style={S.label}>{f.label}</div>
            {f.type === 'select'
              ? <select value={form[f.field]} onChange={e => setForm(v => ({ ...v, [f.field]: e.target.value }))} style={S.select}>
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              : <input type={f.type} value={form[f.field]} onChange={e => setForm(v => ({ ...v, [f.field]: e.target.value }))}
                placeholder={f.placeholder || ''} style={S.input} />}
          </div>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={S.label}>البيان *</div>
          <input value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
            placeholder="وصف القيد المحاسبي" style={S.input} />
        </div>
      </div>

      {/* Lines table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: '40%' }}>الحساب</th>
            <th style={{ ...S.th, width: '20%' }}>بيان السطر</th>
            <th style={{ ...S.th, width: '15%' }}>مدين (Dr)</th>
            <th style={{ ...S.th, width: '15%' }}>دائن (Cr)</th>
            <th style={{ ...S.th, width: '10%' }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ ...S.td, padding: '6px 8px' }}>
                <select value={l.account_code} onChange={e => setLine(i, 'account_code', e.target.value)}
                  style={{ ...S.select, padding: '8px 10px' }}>
                  <option value="">اختر الحساب</option>
                  {leafAccounts.map(a => (
                    <option key={a.account_code} value={a.account_code}>{a.account_code} — {a.name_ar}</option>
                  ))}
                </select>
              </td>
              <td style={{ ...S.td, padding: '6px 8px' }}>
                <input value={l.description} onChange={e => setLine(i, 'description', e.target.value)}
                  placeholder="بيان اختياري" style={{ ...S.input, padding: '8px 10px' }} />
              </td>
              <td style={{ ...S.td, padding: '6px 8px' }}>
                <input type="number" value={l.debit} onChange={e => { setLine(i, 'debit', e.target.value); if (e.target.value) setLine(i, 'credit', ''); }}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...S.input, padding: '8px 10px', textAlign: 'right', direction: 'ltr', color: '#10b981', fontWeight: '700' }} />
              </td>
              <td style={{ ...S.td, padding: '6px 8px' }}>
                <input type="number" value={l.credit} onChange={e => { setLine(i, 'credit', e.target.value); if (e.target.value) setLine(i, 'debit', ''); }}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...S.input, padding: '8px 10px', textAlign: 'right', direction: 'ltr', color: '#ef4444', fontWeight: '700' }} />
              </td>
              <td style={{ ...S.td, padding: '6px 8px' }}>
                {lines.length > 2 && (
                  <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc', fontWeight: '900' }}>
            <td colSpan={2} style={{ ...S.td, fontWeight: '800', color: '#64748b' }}>الإجمالي</td>
            <td style={{ ...S.td, color: '#10b981', direction: 'ltr', fontWeight: '900' }}>{sar(totalDr)}</td>
            <td style={{ ...S.td, color: '#ef4444', direction: 'ltr', fontWeight: '900' }}>{sar(totalCr)}</td>
            <td style={S.td}></td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={addLine} style={S.btnGhost}><PlusCircle size={14} /> إضافة سطر</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px 14px', borderRadius: '10px', background: balanced ? '#ecfdf5' : '#fef2f2', fontSize: '13px', fontWeight: '800', color: balanced ? '#10b981' : '#ef4444' }}>
            {balanced ? '✓ متوازن' : `⚠ غير متوازن — الفرق: ${sar(Math.abs(totalDr - totalCr))} ر.س`}
          </div>
          {error && <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '700' }}>{error}</span>}
          <button onClick={save} disabled={!balanced || saving} style={S.btn(balanced ? '#10b981' : '#94a3b8')}>
            {saving ? <RefreshCw size={14} className="spin" /> : <BookOpen size={14} />}
            {saving ? 'جاري الحفظ...' : 'ترحيل القيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OPENING BALANCES (P-007)
// ═══════════════════════════════════════════════════════════════════════════════
function OpeningBalancesTab() {
  const [accounts, setAccounts] = useState([]);
  const [hasOB, setHasOB] = useState(null);
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [balances, setBalances] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      window.api.acct.getAccountsHierarchical(),
      window.api.acct.hasOpeningBalances()
    ]).then(([accts, ob]) => {
      setAccounts(accts.filter(a => a.level === 3 && a.is_active));
      setHasOB(ob);
    }).catch(() => {});
  }, []);

  const leafAccounts = accounts;
  const setVal = (code, side, val) => setBalances(b => ({ ...b, [`${code}_${side}`]: val }));
  const getVal = (code, side) => balances[`${code}_${side}`] || '';

  const totalDr = leafAccounts.reduce((s, a) => s + (parseFloat(getVal(a.account_code, 'dr')) || 0), 0);
  const totalCr = leafAccounts.reduce((s, a) => s + (parseFloat(getVal(a.account_code, 'cr')) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const save = async () => {
    setMsg('');
    if (!balanced) return setMsg('الأرصدة الافتتاحية غير متوازنة');
    const lines = leafAccounts
      .filter(a => getVal(a.account_code, 'dr') || getVal(a.account_code, 'cr'))
      .map(a => ({ account_code: a.account_code, debit: parseFloat(getVal(a.account_code, 'dr')) || 0, credit: parseFloat(getVal(a.account_code, 'cr')) || 0 }));
    if (lines.length === 0) return setMsg('لم تُدخل أي أرصدة');
    setSaving(true);
    const res = await window.api.acct.postOpeningBalances({ openingDate, balances: lines });
    setSaving(false);
    if (res?.success) { setMsg('✓ تم ترحيل الأرصدة الافتتاحية بنجاح'); setHasOB(true); }
    else setMsg('خطأ: ' + (res?.error || 'فشل الترحيل'));
  };

  if (hasOB === null) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>جاري التحميل…</div>;
  if (hasOB) return (
    <div style={{ ...S.card, textAlign: 'center', padding: '60px' }}>
      <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px' }} />
      <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '8px' }}>تم ترحيل الأرصدة الافتتاحية</h3>
      <p style={{ color: '#64748b', fontSize: '14px' }}>لا يمكن ترحيل الأرصدة الافتتاحية إلا مرة واحدة. لتصحيح خطأ، استخدم قيد عكسي من تبويب دفتر اليومية.</p>
    </div>
  );

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ ...S.title, margin: 0 }}>أرصدة افتتاحية (معالج الإعداد)</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={S.label}>تاريخ الافتتاح:</span>
          <input type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} style={{ ...S.input, width: 'auto', padding: '7px 12px' }} />
        </div>
      </div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', background: '#fffbeb', padding: '10px 14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
        ⚠ أدخل الأرصدة الختامية من النظام السابق أو من آخر ميزانية مراجعة. يجب أن يتساوى إجمالي المدين والدائن. هذه العملية لا يمكن التراجع عنها (فقط العكس).
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: '50%' }}>الحساب</th>
            <th style={S.th}>مدين (Dr)</th>
            <th style={S.th}>دائن (Cr)</th>
          </tr>
        </thead>
        <tbody>
          {leafAccounts.map(a => (
            <tr key={a.account_code}>
              <td style={S.td}><span style={{ color: '#3b82f6', fontWeight: '700' }}>{a.account_code}</span> — {a.name_ar}</td>
              <td style={{ ...S.td, padding: '8px' }}>
                <input type="number" value={getVal(a.account_code, 'dr')} onChange={e => setVal(a.account_code, 'dr', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...S.input, padding: '8px 10px', textAlign: 'right', direction: 'ltr', width: '130px', color: '#10b981', fontWeight: '700' }} />
              </td>
              <td style={{ ...S.td, padding: '8px' }}>
                <input type="number" value={getVal(a.account_code, 'cr')} onChange={e => setVal(a.account_code, 'cr', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  style={{ ...S.input, padding: '8px 10px', textAlign: 'right', direction: 'ltr', width: '130px', color: '#ef4444', fontWeight: '700' }} />
              </td>
            </tr>
          ))}
          <tr style={{ background: '#f8fafc', fontWeight: '900', borderTop: '2px solid #0f172a' }}>
            <td style={{ ...S.td, fontWeight: '800' }}>الإجمالي</td>
            <td style={{ ...S.td, color: '#10b981', direction: 'ltr', fontWeight: '900' }}>{sar(totalDr)}</td>
            <td style={{ ...S.td, color: '#ef4444', direction: 'ltr', fontWeight: '900' }}>{sar(totalCr)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        {msg && <span style={{ fontSize: '13px', fontWeight: '700', color: msg.startsWith('✓') ? '#10b981' : '#ef4444' }}>{msg}</span>}
        <div style={{ marginRight: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ padding: '8px 14px', borderRadius: '10px', background: balanced ? '#ecfdf5' : '#fef2f2', fontSize: '13px', fontWeight: '800', color: balanced ? '#10b981' : '#ef4444' }}>
            {balanced ? '✓ متوازن' : `⚠ الفرق: ${sar(Math.abs(totalDr - totalCr))} ر.س`}
          </div>
          <button onClick={save} disabled={!balanced || saving} style={S.btn(balanced ? '#10b981' : '#94a3b8')}>
            {saving ? 'جاري الترحيل...' : 'ترحيل الأرصدة الافتتاحية'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ACCOUNTING PERIODS (P-017)
// ═══════════════════════════════════════════════════════════════════════════════
function PeriodsTab() {
  const [periods, setPeriods] = useState([]);
  const [form, setForm] = useState({ period_name: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    window.api.acct.getPeriods().then(p => { setPeriods(p || []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    if (!form.period_name || !form.start_date || !form.end_date) return setMsg('أدخل جميع البيانات');
    const res = await window.api.acct.savePeriod(form);
    if (res?.success) { setForm({ period_name: '', start_date: '', end_date: '' }); setMsg(''); load(); }
    else setMsg(res?.error || 'فشل الحفظ');
  };

  const lock = async (id, lockType) => {
    const labels = { soft_locked: 'قفل مؤقت', hard_locked: 'قفل نهائي' };
    if (!window.confirm(`هل تريد ${labels[lockType]} هذه الفترة؟`)) return;
    const res = await window.api.acct.lockPeriod({ periodId: id, lockType, userId: 1 });
    if (res?.success) load(); else alert(res?.error || 'فشل القفل');
  };

  const unlock = async (id) => {
    if (!window.confirm('هل تريد فتح هذه الفترة؟')) return;
    const res = await window.api.acct.unlockPeriod({ periodId: id });
    if (res?.success) load(); else alert(res?.error || 'فشل الفتح');
  };

  const statusBadge = (s) => {
    if (s === 'open') return S.badge('#10b981', '#ecfdf5');
    if (s === 'soft_locked') return S.badge('#f59e0b', '#fffbeb');
    return S.badge('#ef4444', '#fef2f2');
  };
  const statusAr = { open: 'مفتوحة', soft_locked: 'قفل مؤقت', hard_locked: 'قفل نهائي' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', opacity: loading ? 0.6 : 1 }}>
      <div style={S.card}>
        <h3 style={S.title}>إضافة فترة محاسبية</h3>
        {[
          { label: 'اسم الفترة', field: 'period_name', type: 'text', placeholder: 'يناير 2026' },
          { label: 'تاريخ البداية', field: 'start_date', type: 'date' },
          { label: 'تاريخ النهاية', field: 'end_date', type: 'date' },
        ].map(f => (
          <div key={f.field} style={{ marginBottom: '12px' }}>
            <div style={S.label}>{f.label}</div>
            <input type={f.type} value={form[f.field]} onChange={e => setForm(v => ({ ...v, [f.field]: e.target.value }))}
              placeholder={f.placeholder || ''} style={S.input} />
          </div>
        ))}
        {msg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>{msg}</div>}
        <button onClick={save} style={{ ...S.btn('#3b82f6'), width: '100%' }}>إضافة الفترة</button>
      </div>
      <div style={S.card}>
        <h3 style={S.title}>الفترات المحاسبية</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr>
              <th style={S.th}>الفترة</th>
              <th style={S.th}>من</th>
              <th style={S.th}>إلى</th>
              <th style={S.th}>القيود</th>
              <th style={S.th}>الحالة</th>
              <th style={S.th}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '32px' }}>لا توجد فترات محاسبية. أضف فترة للبدء.</td></tr>}
            {periods.map(p => (
              <tr key={p.id}>
                <td style={{ ...S.td, fontWeight: '800' }}>{p.period_name}</td>
                <td style={S.td}>{p.start_date}</td>
                <td style={S.td}>{p.end_date}</td>
                <td style={{ ...S.td, color: '#3b82f6', fontWeight: '700' }}>{p.entry_count ?? 0}</td>
                <td style={S.td}><span style={statusBadge(p.status)}>{statusAr[p.status] || p.status}</span></td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {p.status === 'open' && <>
                      <button onClick={() => lock(p.id, 'soft_locked')} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: '11px' }}><Lock size={11} />قفل مؤقت</button>
                      <button onClick={() => lock(p.id, 'hard_locked')} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: '#fca5a5' }}><Lock size={11} />قفل نهائي</button>
                    </>}
                    {(p.status === 'soft_locked') && (
                      <button onClick={() => unlock(p.id)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: '11px', color: '#10b981' }}><Unlock size={11} />فتح</button>
                    )}
                    {p.status === 'hard_locked' && <span style={{ fontSize: '11px', color: '#94a3b8' }}>مقفول نهائياً</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VAT REPORT (existing, enhanced)
// ═══════════════════════════════════════════════════════════════════════════════
function VATTab() {
  const now = new Date();
  const [range, setRange] = useState({
    startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    endDate: formatDateLocal(now)
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.getVATReport(range).then(r => { setData(r); setLoading(false); }).catch(() => setLoading(false));
  }, [range]);

  // Quick period presets
  const setPreset = (key) => {
    const d = new Date();
    let s, e;
    if (key === 'thisMonth') {
      s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
      e = formatDateLocal(d);
    } else if (key === 'lastMonth') {
      const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      s = `${pm.getFullYear()}-${String(pm.getMonth()+1).padStart(2,'0')}-01`;
      e = `${pm.getFullYear()}-${String(pm.getMonth()+1).padStart(2,'0')}-${new Date(pm.getFullYear(), pm.getMonth()+1, 0).getDate()}`;
    } else if (key === 'thisQuarter') {
      const qm = Math.floor(d.getMonth() / 3) * 3;
      s = `${d.getFullYear()}-${String(qm+1).padStart(2,'0')}-01`;
      e = formatDateLocal(d);
    } else if (key === 'lastQuarter') {
      const qm = Math.floor(d.getMonth() / 3) * 3 - 3;
      const qd = new Date(d.getFullYear(), qm, 1);
      s = `${qd.getFullYear()}-${String(qd.getMonth()+1).padStart(2,'0')}-01`;
      const qe = new Date(qd.getFullYear(), qd.getMonth() + 3, 0);
      e = `${qe.getFullYear()}-${String(qe.getMonth()+1).padStart(2,'0')}-${qe.getDate()}`;
    }
    setRange({ startDate: s, endDate: e });
  };

  const outputVAT = parseFloat(data?.vatOutput ?? 0);
  const inputVAT  = parseFloat(data?.vatInput ?? 0);
  const netVAT    = parseFloat(data?.netVAT ?? 0);
  const maxBar    = Math.max(outputVAT, inputVAT, 1);

  const VATCard = ({ title, value, subtitle, accent, icon }) => (
    <div style={{
      background: 'white', padding: '20px 24px', borderRadius: '18px',
      border: `1.5px solid ${accent}20`, boxShadow: `0 2px 12px ${accent}08`,
      display: 'flex', alignItems: 'center', gap: '16px', flex: 1
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px',
        background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px'
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
        <div style={{ fontSize: '22px', fontWeight: '900', color: accent, fontFamily: "'Inter', sans-serif", direction: 'ltr', textAlign: 'right' }}>{sar(value)} <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>ر.س</span></div>
        {subtitle && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
      {/* Period Controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <PeriodBar range={range} setRange={setRange} onPrint />
        <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
          {[['thisMonth','هذا الشهر'],['lastMonth','الشهر الماضي'],['thisQuarter','هذا الربع'],['lastQuarter','الربع الماضي']].map(([k,l]) => (
            <button key={k} onClick={() => setPreset(k)} style={{
              padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontSize: '11px', fontWeight: '700',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {data?.isUnregistered && (
        <div style={{ padding: '16px 20px', borderRadius: '16px', background: '#eef2ff', border: '1.5px solid #6366f1', color: '#3730a3', fontSize: '13px', fontWeight: '700' }}>
          ℹ️ المنشأة غير مسجلة بضريبة القيمة المضافة (Not Registered). جميع المبيعات تعامل بدون ضريبة 0.00 ر.س ولا يلزم تقديم إقرار ضريبي لهيئة الزكاة.
        </div>
      )}

      {data && !data.isUnregistered && (
        <>
          {/* KPI Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <VATCard title="المبيعات الخاضعة" value={data.taxableAmount} subtitle={`${data.invoiceCount || 0} فاتورة`} accent="#3b82f6" icon="📊" />
            <VATCard title="ضريبة المخرجات" value={outputVAT} subtitle="المحصّلة من العملاء" accent="#ef4444" icon="📤" />
            <VATCard title="ضريبة المدخلات" value={inputVAT} subtitle="المدفوعة للموردين" accent="#10b981" icon="📥" />
            <VATCard title="صافي الضريبة" value={Math.abs(netVAT)} subtitle={netVAT > 0 ? 'مستحقة الدفع' : netVAT < 0 ? 'مستردة لصالحك' : 'متوازن'} accent={netVAT > 0 ? '#ef4444' : '#10b981'} icon={netVAT > 0 ? '💳' : '💰'} />
          </div>

          {/* Visual Breakdown */}
          <div style={S.card}>
            <h3 style={{ ...S.title, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>تحليل ضريبة القيمة المضافة</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>( {range.startDate} — {range.endDate} )</span>
            </h3>

            {/* Output vs Input Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Output VAT Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>ضريبة المخرجات (Output VAT)</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444', fontFamily: "'Inter', sans-serif" }}>{sar(outputVAT)} ر.س</span>
                </div>
                <div style={{ height: '12px', background: '#fee2e2', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '6px', width: `${(outputVAT / maxBar) * 100}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* Input VAT Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>ضريبة المدخلات (Input VAT)</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', fontFamily: "'Inter', sans-serif" }}>{sar(inputVAT)} ر.س</span>
                </div>
                <div style={{ height: '12px', background: '#d1fae5', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '6px', width: `${(inputVAT / maxBar) * 100}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            </div>

            {/* Net Result Banner */}
            <div style={{
              padding: '24px', borderRadius: '18px',
              background: netVAT > 0
                ? 'linear-gradient(135deg, #fef2f2, #fff1f2)'
                : netVAT < 0
                  ? 'linear-gradient(135deg, #ecfdf5, #f0fdf4)'
                  : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
              border: `1.5px solid ${netVAT > 0 ? '#fecaca' : netVAT < 0 ? '#bbf7d0' : '#e2e8f0'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>
                  {netVAT > 0 ? '⚠️ ضريبة مستحقة الدفع لهيئة الزكاة' : netVAT < 0 ? '✅ رصيد مسترد لصالح المنشأة' : '⚖️ لا ضريبة مستحقة — متوازن'}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>
                  الفرق بين ضريبة المخرجات والمدخلات
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: '32px', fontWeight: '900',
                  fontFamily: "'Inter', sans-serif",
                  color: netVAT > 0 ? '#dc2626' : netVAT < 0 ? '#059669' : '#374151',
                  direction: 'ltr'
                }}>
                  {netVAT < 0 && '−'}{sar(Math.abs(netVAT))}
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginLeft: '4px' }}>ر.س</span>
                </div>
                <span style={S.badge(netVAT > 0 ? '#dc2626' : '#059669', netVAT > 0 ? '#fef2f2' : '#ecfdf5')}>
                  {netVAT > 0 ? 'واجبة السداد' : netVAT < 0 ? 'رصيد دائن (Credit)' : 'صفر'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Zero state */}
      {!loading && !data && (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#374151', marginBottom: '8px' }}>لا توجد بيانات ضريبية</div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>تأكد من وجود مبيعات أو مصروفات مسجلة في الفترة المحددة</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GENERAL LEDGER (existing, kept)
// ═══════════════════════════════════════════════════════════════════════════════
function LedgerTab() {
  const [range, setRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.getGeneralLedger({ startDate: range.startDate, endDate: range.endDate })
      .then(r => { setEntries(r || []); setLoading(false); }).catch(() => setLoading(false));
  }, [range]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: loading ? 0.6 : 1 }}>
      <PeriodBar range={range} setRange={setRange} onPrint />
      <div style={S.card}>
        <h3 style={S.title}>دفتر الأستاذ العام — {entries.length} قيد</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={S.th}>التاريخ</th>
                <th style={S.th}>الحساب</th>
                <th style={S.th}>البيان</th>
                <th style={S.th}>مدين</th>
                <th style={S.th}>دائن</th>
                <th style={S.th}>المرجع</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>لا قيود في هذه الفترة</td></tr>}
              {entries.map((l, i) => (
                <tr key={i}>
                  <td style={S.td}>{new Date(l.date).toLocaleDateString('ar-SA')}</td>
                  <td style={S.td}><span style={{ fontWeight: '800', color: '#3b82f6' }}>{l.account_code}</span> — {l.name_ar}</td>
                  <td style={S.td}>{l.description}</td>
                  <td style={{ ...S.td, color: '#10b981', fontWeight: '800', direction: 'ltr' }}>{l.debit > 0 ? sar(l.debit) : '—'}</td>
                  <td style={{ ...S.td, color: '#ef4444', fontWeight: '800', direction: 'ltr' }}>{l.credit > 0 ? sar(l.credit) : '—'}</td>
                  <td style={{ ...S.td, fontSize: '11px', color: '#94a3b8' }}>{l.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TRIAL BALANCE (existing, kept)
// ═══════════════════════════════════════════════════════════════════════════════
function TrialBalanceTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.getTrialBalance().then(r => { setData(r || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const totDr = data.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
  const totCr = data.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
  const balanced = Math.abs(totDr - totCr) < 0.01;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: loading ? 0.6 : 1 }}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ ...S.title, margin: 0 }}>ميزان المراجعة (Trial Balance)</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={S.badge(balanced ? '#10b981' : '#ef4444', balanced ? '#ecfdf5' : '#fef2f2')}>
              {balanced ? '✅ متوازن' : '⚠️ غير متوازن'}
            </span>
            <button onClick={() => window.print()} style={S.btnGhost}><Printer size={14} />طباعة</button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr>
              <th style={S.th}>كود الحساب</th>
              <th style={S.th}>اسم الحساب</th>
              <th style={S.th}>النوع</th>
              <th style={S.th}>مدين (Dr)</th>
              <th style={S.th}>دائن (Cr)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a, i) => (
              <tr key={i}>
                <td style={{ ...S.td, fontWeight: '800', color: '#3b82f6' }}>{a.account_code}</td>
                <td style={S.td}>{a.name_ar}</td>
                <td style={S.td}><span style={S.badge('#8b5cf6', '#f5f3ff')}>{a.type}</span></td>
                <td style={{ ...S.td, color: '#10b981', fontWeight: '800', direction: 'ltr' }}>{a.balance > 0 ? sar(a.balance) : '—'}</td>
                <td style={{ ...S.td, color: '#ef4444', fontWeight: '800', direction: 'ltr' }}>{a.balance < 0 ? sar(Math.abs(a.balance)) : '—'}</td>
              </tr>
            ))}
            <tr style={{ background: '#f8fafc', fontWeight: '900', borderTop: '2px solid #0f172a' }}>
              <td colSpan={3} style={S.td}>الإجمالي</td>
              <td style={{ ...S.td, color: '#10b981', direction: 'ltr', fontWeight: '900' }}>{sar(totDr)}</td>
              <td style={{ ...S.td, color: '#ef4444', direction: 'ltr', fontWeight: '900' }}>{sar(totCr)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CHART OF ACCOUNTS (upgraded)
// ═══════════════════════════════════════════════════════════════════════════════
function CoATab() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ code: '', name_ar: '', name_en: '', type: 'Asset', parent_code: '', level: '3', normal_balance: 'debit' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    window.api.acct.getAccountsHierarchical().then(r => { setAccounts(r || []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    if (!form.code || !form.name_ar || !form.type) return setMsg('أدخل الكود والاسم والنوع');
    const res = await window.api.acct.addAccountNew({ ...form, code: parseInt(form.code), parent_code: form.parent_code ? parseInt(form.parent_code) : null });
    if (res?.success) { setForm({ code: '', name_ar: '', name_en: '', type: 'Asset', parent_code: '', level: '3', normal_balance: 'debit' }); setMsg(''); load(); }
    else setMsg(res?.error || 'فشل الحفظ');
  };

  const typeColors = { Asset: '#3b82f6', Liability: '#ef4444', Equity: '#8b5cf6', Revenue: '#10b981', Expense: '#f59e0b' };
  const grouped = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' }}>
      <div style={S.card}>
        <h3 style={S.title}>إضافة حساب جديد</h3>
        {[
          { label: 'كود الحساب *', field: 'code', type: 'number', placeholder: '5800' },
          { label: 'الاسم بالعربية *', field: 'name_ar', type: 'text', placeholder: 'اسم الحساب' },
          { label: 'الاسم بالإنجليزية', field: 'name_en', type: 'text', placeholder: 'Account Name' },
          { label: 'كود الحساب الأب', field: 'parent_code', type: 'number', placeholder: '5000' },
          { label: 'المستوى (1-4)', field: 'level', type: 'number', placeholder: '3' },
        ].map(f => (
          <div key={f.field} style={{ marginBottom: '10px' }}>
            <div style={S.label}>{f.label}</div>
            <input type={f.type} value={form[f.field]} onChange={e => setForm(v => ({ ...v, [f.field]: e.target.value }))}
              placeholder={f.placeholder} style={S.input} />
          </div>
        ))}
        <div style={{ marginBottom: '10px' }}>
          <div style={S.label}>نوع الحساب *</div>
          <select value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))} style={S.select}>
            {grouped.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <div style={S.label}>الرصيد الطبيعي</div>
          <select value={form.normal_balance} onChange={e => setForm(v => ({ ...v, normal_balance: e.target.value }))} style={S.select}>
            <option value="debit">مدين (Debit)</option>
            <option value="credit">دائن (Credit)</option>
          </select>
        </div>
        {msg && <div style={{ color: msg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>{msg}</div>}
        <button onClick={save} style={{ ...S.btn('#3b82f6'), width: '100%' }}>إضافة الحساب</button>
        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
          ملاحظة: لا يمكن حذف الحسابات النظامية.
        </p>
      </div>
      <div style={{ ...S.card, opacity: loading ? 0.6 : 1 }}>
        <h3 style={S.title}>دليل الحسابات الهرمي ({accounts.length} حساب)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead>
              <tr>
                <th style={S.th}>الكود</th>
                <th style={S.th}>الاسم</th>
                <th style={S.th}>النوع</th>
                <th style={S.th}>المستوى</th>
                <th style={S.th}>الرصيد الحالي</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={i} style={{ background: a.level === 1 ? '#f8fafc' : a.level === 2 ? '#fafafa' : 'white' }}>
                  <td style={{ ...S.td, fontWeight: a.level <= 2 ? '900' : '700', color: typeColors[a.type] || '#64748b', paddingRight: 14 + (a.level - 1) * 14 }}>
                    {a.account_code}
                  </td>
                  <td style={{ ...S.td, fontWeight: a.level <= 2 ? '800' : '600', paddingRight: 14 + (a.level - 1) * 14 }}>
                    {a.name_ar}
                    {a.is_system ? <span style={{ ...S.badge('#94a3b8', '#f8fafc'), marginRight: '6px', fontSize: '9px' }}>نظام</span> : null}
                  </td>
                  <td style={S.td}><span style={S.badge(typeColors[a.type] || '#64748b', `${typeColors[a.type]}15` || '#f8fafc')}>{a.type}</span></td>
                  <td style={S.td}>{a.level}</td>
                  <td style={{ ...S.td, direction: 'ltr', fontWeight: '800', color: (a.balance || 0) >= 0 ? '#0f172a' : '#ef4444' }}>
                    {sar(a.balance || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FinanceHub COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'pl',       label: 'قائمة الدخل',       icon: <BarChart3 size={15} />,     group: 'statements' },
  { id: 'bs',       label: 'الميزانية',           icon: <Scale size={15} />,         group: 'statements' },
  { id: 'cf',       label: 'التدفق النقدي',       icon: <ArrowLeftRight size={15} />,group: 'statements' },
  { id: 'journal',  label: 'اليومية',             icon: <BookOpen size={15} />,      group: 'journal' },
  { id: 'ob',       label: 'الأرصدة الافتتاحية', icon: <Layers size={15} />,        group: 'journal' },
  { id: 'periods',  label: 'الفترات',             icon: <Lock size={15} />,          group: 'journal' },
  { id: 'vat',      label: 'ضريبة القيمة المضافة',icon: <FileText size={15} />,      group: 'reports' },
  { id: 'ledger',   label: 'دفتر الأستاذ',        icon: <List size={15} />,          group: 'reports' },
  { id: 'tb',       label: 'ميزان المراجعة',       icon: <Scale size={15} />,         group: 'reports' },
  { id: 'coa',      label: 'دليل الحسابات',        icon: <Landmark size={15} />,      group: 'reports' },
];

const GROUP_LABELS = { statements: 'القوائم المالية', journal: 'دفتر اليومية', reports: 'التقارير والدفاتر' };

export default function FinanceHub() {
  const [activeTab, setActiveTab] = useState('pl');

  return (
    <AppLayout title="المركز المالي والمحاسبة">
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* Tab bar */}
        <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {Object.entries(GROUP_LABELS).map(([grp, grpLabel]) => (
            <div key={grp} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f8fafc', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: '10px', minWidth: '100px' }}>
                {grpLabel}
              </span>
              {TABS.filter(t => t.group === grp).map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '700', fontSize: '12px', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: activeTab === t.id ? '#eff6ff' : 'transparent',
                  color: activeTab === t.id ? '#3b82f6' : '#64748b',
                  boxShadow: activeTab === t.id ? '0 0 0 1px #bfdbfe' : 'none',
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeTab === 'pl'      && <ProfitLossTab />}
          {activeTab === 'bs'      && <BalanceSheetTab />}
          {activeTab === 'cf'      && <CashFlowTab />}
          {activeTab === 'journal' && <JournalTab />}
          {activeTab === 'ob'      && <OpeningBalancesTab />}
          {activeTab === 'periods' && <PeriodsTab />}
          {activeTab === 'vat'     && <VATTab />}
          {activeTab === 'ledger'  && <LedgerTab />}
          {activeTab === 'tb'      && <TrialBalanceTab />}
          {activeTab === 'coa'     && <CoATab />}
        </div>

      </div>
    </AppLayout>
  );
}
