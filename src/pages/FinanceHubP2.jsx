/**
 * FinanceHubP2.jsx — Phase 2 & 3 Accounting Frontend
 * ─────────────────────────────────────────────────────────────────────────────
 * Tabs:
 *   AR Aging · Customer Statement · Fixed Assets · Payroll
 *   Bank Reconciliation · VAT Return · Accruals · Budget · Subsidiary Ledgers
 *   GL Drill-Down · Deferred Revenue · Break-Even · VAT Settings · Inventory Costing
 *
 * Accessed via FinanceHub as a second set of tabs or standalone.
 * All calls go through window.api.p2.*
 */
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Users, Building2, Landmark, BarChart3, FileText,
  Wallet, Calendar, PlusCircle, Play, CheckCircle,
  AlertCircle, RefreshCw, ChevronDown, ChevronRight,
  Banknote, TrendingUp, TrendingDown, ArrowLeftRight,
  BookOpen, Settings2, Printer, Scale, GitBranch, Layers, Package, PercentCircle
} from 'lucide-react';
import { GLDrillDownModal } from './GLDrillDown';
import { DeferredRevenueTab } from './DeferredRevenueTab';
import { BreakEvenTab } from './BreakEvenTab';
import { VATSettings } from './VATSettings';
import { InventoryCostingTab } from './InventoryCostingTab';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sar = (n, showSign = false) => {
  const v = parseFloat(n) || 0;
  const fmt = Math.abs(v).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (showSign && v < 0) return `(${fmt})`;
  return fmt;
};
const sarColor = (n) => parseFloat(n) >= 0 ? '#10b981' : '#ef4444';
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

// ─── Shared Style Tokens ─────────────────────────────────────────────────────
const S = {
  card: { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  th: { padding: '10px 14px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
  btn: (color = '#3b82f6') => ({ padding: '9px 18px', borderRadius: '8px', border: 'none', background: color, color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }),
  btnGhost: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: '600', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '4px', display: 'block' },
  select: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
  badge: (color, bg) => ({ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', color, background: bg }),
};

// ─── Loading & Error atoms ────────────────────────────────────────────────────
const Loading = () => <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>جاري التحميل...</div>;
const Err = ({ msg }) => msg ? <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{msg}</div> : null;
const Ok = ({ msg }) => msg ? <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontSize: '13px', marginBottom: '16px' }}>{msg}</div> : null;

// ─── TABS CONFIG ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'ar',       label: 'أعمار الذمم',        icon: <Users size={15}/> },
  { id: 'assets',   label: 'الأصول الثابتة',     icon: <Building2 size={15}/> },
  { id: 'payroll',  label: 'الرواتب',             icon: <Banknote size={15}/> },
  { id: 'bank',     label: 'مطابقة البنك',        icon: <Landmark size={15}/> },
  { id: 'vat',      label: 'إقرار الضريبة',       icon: <FileText size={15}/> },
  { id: 'accruals', label: 'المستحقات',            icon: <Calendar size={15}/> },
  { id: 'budget',   label: 'الميزانية',            icon: <BarChart3 size={15}/> },
  { id: 'ledgers',  label: 'دفاتر الأستاذ',       icon: <BookOpen size={15}/> },
  { id: 'gldrilldown', label: 'كشف الحساب',       icon: <GitBranch size={15}/> },
  { id: 'deferred', label: 'الإيراد المؤجل',       icon: <Layers size={15}/> },
  { id: 'breakeven',label: 'نقطة التعادل',         icon: <BarChart3 size={15}/> },
  { id: 'vatsettings',label: 'إعدادات الضريبة',   icon: <PercentCircle size={15}/> },
  { id: 'inventory',label: 'تكلفة المخزون',        icon: <Package size={15}/> },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function FinanceHubP2() {
  const [activeTab, setActiveTab] = useState('ar');
  const api = window.api?.p2;

  return (
    <AppLayout title="المحاسبة المتقدمة — المراحل 2 و 3">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '24px', background: 'white', padding: '8px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px',
              background: activeTab === t.id ? '#3b82f6' : 'transparent',
              color: activeTab === t.id ? 'white' : '#64748b' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {!api && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          ⚠️ window.api.p2 غير متاح — تأكد من تشغيل patch_p2.cjs أولاً ثم أعد بناء التطبيق.
        </div>
      )}
      {api && activeTab === 'ar'       && <ARAgingTab       api={api} />}
      {api && activeTab === 'assets'   && <FixedAssetsTab   api={api} />}
      {api && activeTab === 'payroll'  && <PayrollTab       api={api} />}
      {api && activeTab === 'bank'     && <BankRecTab       api={api} />}
      {api && activeTab === 'vat'      && <VATReturnTab     api={api} />}
      {api && activeTab === 'accruals' && <AccrualsTab      api={api} />}
      {api && activeTab === 'budget'   && <BudgetTab        api={api} />}
      {api && activeTab === 'ledgers'  && <SubsidiaryTab    api={api} />}
      {api && activeTab === 'gldrilldown' && <GLDrillDownPageTab api={api} />}
      {api && activeTab === 'deferred'    && <DeferredRevenueTab />}
      {api && activeTab === 'breakeven'   && <BreakEvenTab   api={api} />}
      {api && activeTab === 'vatsettings' && <VATSettings />}
      {api && activeTab === 'inventory'   && <InventoryCostingTab />}
    </AppLayout>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AR AGING TAB (P-008 / P-009 / P-010)
// ═════════════════════════════════════════════════════════════════════════════
function ARAgingTab({ api }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf]       = useState(today());
  const [selected, setSelected] = useState(null); // customer for statement
  const [stmt, setStmt]       = useState(null);
  const [pmt, setPmt]         = useState({ amount: '', method: 'cash', reference: '' });
  const [msg, setMsg]         = useState({ ok: '', err: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.getARAgingReport({ asOfDate: asOf });
    setData(res);
    setLoading(false);
  }, [asOf, api]);

  useEffect(() => { load(); }, [load]);

  const loadStmt = async (row) => {
    setSelected(row);
    const res = await api.getCustomerStatement({ customerId: row.customer_id, startDate: monthStart(), endDate: today() });
    setStmt(res);
  };

  const payCustomer = async () => {
    if (!pmt.amount || !selected) return;
    const res = await api.recordCustomerPayment({
      customer_id: selected.customer_id,
      amount: parseFloat(pmt.amount),
      payment_method: pmt.method,
      reference_no: pmt.reference,
    });
    if (res?.success) {
      setMsg({ ok: `تم تسجيل الدفعة بنجاح`, err: '' });
      setPmt({ amount: '', method: 'cash', reference: '' });
      load();
    } else {
      setMsg({ ok: '', err: res?.error || 'فشل تسجيل الدفعة' });
    }
  };

  const bucketColor = { current: '#10b981', d1_30: '#f59e0b', d31_60: '#f97316', d61_90: '#ef4444', d90plus: '#7f1d1d' };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div><span style={S.label}>تقرير بتاريخ</span><input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ ...S.input, width: '160px' }} /></div>
        <button onClick={load} style={S.btn()}><RefreshCw size={13}/> تحديث</button>
        <div style={{ marginRight: 'auto' }}>
          <ExportToolbar
            getRows={() => (data?.rows||[]).map(r => [r.customer_name, sar(r.total), sar(r.current), sar(r.d1_30), sar(r.d31_60), sar(r.d61_90), sar(r.d90plus)])}
            headers={['العميل','الإجمالي','جارٍ','1-30','31-60','61-90','90+']}
            sheetName="أعمار الذمم" filename={`ar_aging_${asOf}.xlsx`}
          />
        </div>
      </div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      {loading && <Loading />}
      {!loading && data && (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
              <thead>
                <tr>
                  {['العميل','الإجمالي','جارٍ','1-30 يوم','31-60 يوم','61-90 يوم','90+ يوم',''].map((h,i) => (
                    <th key={i} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.customer_id} style={{ cursor: 'pointer' }} onClick={() => loadStmt(r)}>
                    <td style={S.td}><b>{r.customer_name}</b></td>
                    <td style={{ ...S.td, color: '#ef4444', fontWeight: '700' }}>{sar(r.total)}</td>
                    <td style={{ ...S.td, color: bucketColor.current }}>{sar(r.current)}</td>
                    <td style={{ ...S.td, color: bucketColor.d1_30 }}>{sar(r.d1_30)}</td>
                    <td style={{ ...S.td, color: bucketColor.d31_60 }}>{sar(r.d31_60)}</td>
                    <td style={{ ...S.td, color: bucketColor.d61_90 }}>{sar(r.d61_90)}</td>
                    <td style={{ ...S.td, color: bucketColor.d90plus }}>{sar(r.d90plus)}</td>
                    <td style={S.td}><button style={S.btnGhost} onClick={e => { e.stopPropagation(); loadStmt(r); }}>تفاصيل</button></td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: '#f8fafc', fontWeight: '700' }}>
                  <td style={S.td}>المجموع</td>
                  <td style={{ ...S.td, color: '#ef4444' }}>{sar(data.totals.total)}</td>
                  <td style={{ ...S.td, color: bucketColor.current }}>{sar(data.totals.current)}</td>
                  <td style={{ ...S.td, color: bucketColor.d1_30 }}>{sar(data.totals.d1_30)}</td>
                  <td style={{ ...S.td, color: bucketColor.d31_60 }}>{sar(data.totals.d31_60)}</td>
                  <td style={{ ...S.td, color: bucketColor.d61_90 }}>{sar(data.totals.d61_90)}</td>
                  <td style={{ ...S.td, color: bucketColor.d90plus }}>{sar(data.totals.d90plus)}</td>
                  <td style={S.td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Statement Panel */}
      {selected && stmt && (
        <div style={{ ...S.card, borderTop: '3px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>كشف حساب — {selected.customer_name}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>الرصيد الختامي: <b style={{ color: sarColor(stmt.closing_balance) }}>{sar(stmt.closing_balance)} ر.س</b></div>
            </div>
            <button onClick={() => { setSelected(null); setStmt(null); }} style={S.btnGhost}>إغلاق</button>
          </div>

          {/* Payment form */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', padding: '16px', background: '#f8fafc', borderRadius: '10px' }}>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <span style={S.label}>مبلغ الدفعة</span>
              <input type="number" value={pmt.amount} onChange={e => setPmt(p => ({...p, amount: e.target.value}))} placeholder="0.00" style={S.input} />
            </div>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <span style={S.label}>طريقة الدفع</span>
              <select value={pmt.method} onChange={e => setPmt(p => ({...p, method: e.target.value}))} style={S.select}>
                <option value="cash">نقد</option><option value="bank">تحويل بنكي</option><option value="card">بطاقة</option>
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <span style={S.label}>رقم المرجع</span>
              <input value={pmt.reference} onChange={e => setPmt(p => ({...p, reference: e.target.value}))} placeholder="اختياري" style={S.input} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={payCustomer} style={S.btn('#10b981')}><CheckCircle size={13}/> تسجيل دفعة</button>
            </div>
          </div>

          {/* Statement lines */}
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '13px' }}>
            <thead>
              <tr>{['التاريخ','المرجع','البيان','مدين','دائن','الرصيد'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {stmt.lines.map((l, i) => (
                <tr key={i}>
                  <td style={S.td}>{l.date}</td>
                  <td style={S.td}>{l.reference}</td>
                  <td style={S.td}>{l.description}</td>
                  <td style={{ ...S.td, color: l.debit > 0 ? '#ef4444' : '#94a3b8' }}>{l.debit > 0 ? sar(l.debit) : '—'}</td>
                  <td style={{ ...S.td, color: l.credit > 0 ? '#10b981' : '#94a3b8' }}>{l.credit > 0 ? sar(l.credit) : '—'}</td>
                  <td style={{ ...S.td, fontWeight: '700', color: sarColor(l.balance) }}>{sar(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FIXED ASSETS TAB (P-011)
// ═════════════════════════════════════════════════════════════════════════════
function FixedAssetsTab({ api }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [depMonth, setDepMonth] = useState(thisMonth());
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [form, setForm] = useState({ asset_code: '', name: '', category: 'Equipment', purchase_date: today(), purchase_cost: '', residual_value: '0', useful_life_months: '60', depreciation_method: 'straight_line', payment_method: 'cash' });

  const load = useCallback(async () => { setLoading(true); const r = await api.getFixedAssets(); setAssets(r||[]); setLoading(false); }, [api]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const res = await api.addFixedAsset(form);
    if (res?.success) { setMsg({ ok: 'تمت إضافة الأصل', err: '' }); setShowForm(false); setForm({ asset_code: '', name: '', category: 'Equipment', purchase_date: today(), purchase_cost: '', residual_value: '0', useful_life_months: '60', depreciation_method: 'straight_line', payment_method: 'cash' }); load(); }
    else setMsg({ ok: '', err: res?.error || 'فشلت الإضافة' });
  };

  const runDep = async () => {
    const res = await api.runDepreciation({ month: depMonth, createdBy: 1 });
    if (res?.success) setMsg({ ok: `تم ترحيل الاستهلاك — ${depMonth} (${sar(res.total_dep)} ر.س)`, err: '' });
    else setMsg({ ok: '', err: res?.error || 'فشل الاستهلاك' });
    load();
  };

  const dispose = async (asset) => {
    const proceeds = prompt(`متحصلات التخلص من "${asset.name}" (ر.س):`);
    if (proceeds === null) return;
    const res = await api.disposeFixedAsset({ assetId: asset.id, disposalDate: today(), proceeds: parseFloat(proceeds)||0, createdBy: 1 });
    if (res?.success) setMsg({ ok: `تم التخلص من الأصل. ربح/خسارة: ${sar(res.gain_loss)} ر.س`, err: '' });
    else setMsg({ ok: '', err: res?.error });
    load();
  };

  const statusBadge = { active: { color: '#16a34a', bg: '#f0fdf4', label: 'نشط' }, disposed: { color: '#7f1d1d', bg: '#fff1f2', label: 'متخلص' }, fully_depreciated: { color: '#1e40af', bg: '#eff6ff', label: 'مستهلك بالكامل' } };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <button onClick={() => setShowForm(!showForm)} style={S.btn()}><PlusCircle size={13}/> إضافة أصل</button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: 'auto' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>ترحيل استهلاك شهر:</span>
          <input type="month" value={depMonth} onChange={e => setDepMonth(e.target.value)} style={{ ...S.input, width: '140px' }} />
          <button onClick={runDep} style={S.btn('#8b5cf6')}><Play size={13}/> ترحيل</button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ ...S.card, border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: '#1e40af' }}>+ أصل جديد</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              ['asset_code','كود الأصل','text'], ['name','اسم الأصل','text'],
              ['purchase_date','تاريخ الشراء','date'], ['purchase_cost','تكلفة الشراء','number'],
              ['residual_value','القيمة التخريدية','number'], ['useful_life_months','العمر الإنتاجي (شهر)','number'],
            ].map(([k,lbl,type]) => (
              <div key={k}>
                <span style={S.label}>{lbl}</span>
                <input type={type} value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} style={S.input} />
              </div>
            ))}
            <div>
              <span style={S.label}>الفئة</span>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={S.select}>
                {['Equipment','Vehicle','Furniture','IT','Leasehold'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <span style={S.label}>طريقة الاستهلاك</span>
              <select value={form.depreciation_method} onChange={e => setForm(f => ({...f, depreciation_method: e.target.value}))} style={S.select}>
                <option value="straight_line">القسط الثابت</option>
                <option value="declining_balance">القسط المتناقص</option>
              </select>
            </div>
            <div>
              <span style={S.label}>طريقة الدفع</span>
              <select value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))} style={S.select}>
                <option value="cash">نقد</option><option value="credit">آجل (موردون)</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={submit} style={S.btn('#10b981')}><CheckCircle size={13}/> حفظ</button>
            <button onClick={() => setShowForm(false)} style={S.btnGhost}>إلغاء</button>
          </div>
        </div>
      )}

      {loading && <Loading />}
      {!loading && (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead>
              <tr>{['الكود','الاسم','الفئة','التكلفة','م. الاستهلاك','الاستهلاك المتراكم','القيمة الدفترية','الحالة',''].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const sb = statusBadge[a.status] || statusBadge.active;
                return (
                  <tr key={a.id}>
                    <td style={S.td}><b>{a.asset_code}</b></td>
                    <td style={S.td}>{a.name}</td>
                    <td style={S.td}>{a.category}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(a.purchase_cost)}</td>
                    <td style={S.td}>{a.depreciation_method === 'straight_line' ? 'ق. ثابت' : 'ق. متناقص'}</td>
                    <td style={{ ...S.td, color: '#f59e0b', fontFamily: 'monospace' }}>{sar(a.accum_dep)}</td>
                    <td style={{ ...S.td, fontWeight: '700', fontFamily: 'monospace' }}>{sar(a.net_book_value)}</td>
                    <td style={S.td}><span style={S.badge(sb.color, sb.bg)}>{sb.label}</span></td>
                    <td style={S.td}>
                      {a.status === 'active' && <button onClick={() => dispose(a)} style={S.btnGhost}>تخلص</button>}
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا توجد أصول ثابتة مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAYROLL TAB (P-015)
// ═════════════════════════════════════════════════════════════════════════════
function PayrollTab({ api }) {
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns]           = useState([]);
  const [view, setView]           = useState('employees'); // 'employees' | 'runs'
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [month, setMonth]         = useState(thisMonth());
  const [msg, setMsg]             = useState({ ok: '', err: '' });
  const [empForm, setEmpForm]     = useState({ name: '', id_number: '', nationality: 'Saudi', job_title: '', department: '', basic_salary: '', housing_allowance: '', transport_allowance: '', other_allowances: '', gosi_registered: true, bank_iban: '' });

  const loadEmps = useCallback(async () => { const r = await api.getEmployees(); setEmployees(r||[]); }, [api]);
  const loadRuns = useCallback(async () => { const r = await api.getPayrollRuns({}); setRuns(r||[]); }, [api]);

  useEffect(() => { loadEmps(); loadRuns(); }, [loadEmps, loadRuns]);

  const saveEmp = async () => {
    const res = await api.saveEmployee(empForm);
    if (res?.success) { setMsg({ ok: 'تمت إضافة الموظف', err: '' }); setShowEmpForm(false); loadEmps(); }
    else setMsg({ ok: '', err: res?.error });
  };

  const deleteEmp = async (id) => {
    if (!confirm('حذف هذا الموظف من كشف الرواتب؟')) return;
    await api.deleteEmployee(id);
    loadEmps();
  };

  const createRun = async () => {
    const res = await api.createPayrollRun({ month, overrides: [], createdBy: 1 });
    if (res?.success) { setMsg({ ok: `تم إعداد كشف راتب ${month}`, err: '' }); loadRuns(); setView('runs'); }
    else setMsg({ ok: '', err: res?.error });
  };

  const postRun = async (runId) => {
    const res = await api.postPayrollRun({ runId, createdBy: 1 });
    if (res?.success) { setMsg({ ok: 'تم ترحيل كشف الرواتب إلى دفتر اليومية', err: '' }); loadRuns(); }
    else setMsg({ ok: '', err: res?.error });
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setView('employees')} style={{ ...S.btn(view === 'employees' ? '#3b82f6' : '#e2e8f0'), color: view === 'employees' ? 'white' : '#374151' }}><Users size={13}/> الموظفون</button>
        <button onClick={() => setView('runs')} style={{ ...S.btn(view === 'runs' ? '#3b82f6' : '#e2e8f0'), color: view === 'runs' ? 'white' : '#374151' }}><FileText size={13}/> كشوف الرواتب</button>
        {view === 'employees' && <button onClick={() => setShowEmpForm(!showEmpForm)} style={S.btn('#10b981')}><PlusCircle size={13}/> إضافة موظف</button>}
        {view === 'runs' && (
          <>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...S.input, width: '140px' }} />
            <button onClick={createRun} style={S.btn('#8b5cf6')}><Play size={13}/> إعداد كشف {month}</button>
          </>
        )}
      </div>

      {/* Employee form */}
      {showEmpForm && view === 'employees' && (
        <div style={{ ...S.card, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>بيانات الموظف</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {[['name','الاسم'],['id_number','رقم الهوية'],['job_title','المسمى الوظيفي'],['department','القسم'],['basic_salary','الراتب الأساسي'],['housing_allowance','بدل السكن'],['transport_allowance','بدل المواصلات'],['other_allowances','بدلات أخرى'],['bank_iban','IBAN']].map(([k,l]) => (
              <div key={k}><span style={S.label}>{l}</span><input value={empForm[k]} onChange={e => setEmpForm(f => ({...f, [k]: e.target.value}))} style={S.input} /></div>
            ))}
            <div>
              <span style={S.label}>الجنسية</span>
              <select value={empForm.nationality} onChange={e => setEmpForm(f => ({...f, nationality: e.target.value}))} style={S.select}>
                <option value="Saudi">سعودي</option><option value="Non-Saudi">غير سعودي</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={saveEmp} style={S.btn('#10b981')}><CheckCircle size={13}/> حفظ</button>
            <button onClick={() => setShowEmpForm(false)} style={S.btnGhost}>إلغاء</button>
          </div>
        </div>
      )}

      {view === 'employees' && (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead><tr>{['الاسم','الجنسية','المسمى','الراتب الأساسي','إجمالي التعويضات','تسجيل GOSI',''].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.map(e => {
                const total = (e.basic_salary||0) + (e.housing_allowance||0) + (e.transport_allowance||0) + (e.other_allowances||0);
                return (
                  <tr key={e.id}>
                    <td style={S.td}><b>{e.name}</b></td>
                    <td style={S.td}>{e.nationality}</td>
                    <td style={S.td}>{e.job_title||'—'}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(e.basic_salary)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: '700' }}>{sar(total)}</td>
                    <td style={S.td}><span style={S.badge(e.gosi_registered ? '#16a34a':'#94a3b8', e.gosi_registered ? '#f0fdf4':'#f8fafc')}>{e.gosi_registered ? 'نعم':'لا'}</span></td>
                    <td style={S.td}><button onClick={() => deleteEmp(e.id)} style={{ ...S.btnGhost, color: '#ef4444' }}>حذف</button></td>
                  </tr>
                );
              })}
              {employees.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا يوجد موظفون</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'runs' && (
        <div>
          {runs.map(r => (
            <div key={r.id} style={{ ...S.card, border: r.status === 'posted' ? '1px solid #bbf7d0' : '1px solid #fef3c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '900' }}>كشف راتب — {r.run_month}</span>
                  <span style={{ ...S.badge(r.status === 'posted' ? '#16a34a' : '#d97706', r.status === 'posted' ? '#f0fdf4' : '#fffbeb'), marginRight: '10px' }}>{r.status === 'posted' ? 'مرحّل' : 'مسودة'}</span>
                </div>
                {r.status !== 'posted' && <button onClick={() => postRun(r.id)} style={S.btn('#10b981')}><CheckCircle size={13}/> ترحيل إلى اليومية</button>}
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {[['إجمالي الرواتب', r.total_gross, '#ef4444'], ['اشتراكات GOSI (موظف)', r.total_gosi_employee, '#f59e0b'], ['اشتراكات GOSI (صاحب عمل)', r.total_gosi_employer, '#f59e0b'], ['صافي الرواتب', r.total_net, '#10b981']].map(([l,v,c]) => (
                  <div key={l} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', minWidth: '140px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{l}</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: c, fontFamily: 'monospace' }}>{sar(v)}</div>
                  </div>
                ))}
              </div>

              {/* Payroll lines table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px' }}>
                <thead><tr>{['الموظف','الإجمالي','GOSI موظف','GOSI صاحب عمل','استقطاعات','الصافي'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {(r.lines||[]).map(l => (
                    <tr key={l.id}>
                      <td style={S.td}>{l.employee_name}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(l.gross)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#f59e0b' }}>{sar(l.gosi_employee)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#f59e0b' }}>{sar(l.gosi_employer)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(l.other_deductions)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>{sar(l.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {runs.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>لا توجد كشوف رواتب. اختر الشهر وأنشئ كشفاً جديداً.</div>}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT TOOLBAR (P-019) — reusable component for all report tabs
// ═════════════════════════════════════════════════════════════════════════════
function ExportToolbar({ getRows, headers, sheetName, filename, getHtml }) {
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const rows = getRows ? await getRows() : [];
      await window.api?.exportToExcel({ rows, headers, sheetName: sheetName || 'تقرير', filename: filename || 'report.xlsx', meta: true });
    } catch(_) {}
    setExporting(false);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const html = getHtml ? getHtml() : document.querySelector('[data-report-section]')?.innerHTML || document.body.innerHTML;
      const styledHtml = `<html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12px;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:right}th{background:#f5f5f5;font-weight:bold}</style></head><body>${html}</body></html>`;
      await window.api?.exportToPDF({ html: styledHtml, filename: filename ? filename.replace('.xlsx', '.pdf') : 'report.pdf' });
    } catch(_) {}
    setExporting(false);
  };

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <button onClick={exportExcel} disabled={exporting}
        style={{ ...S.btnGhost, fontSize: '11px', padding: '6px 10px', opacity: exporting ? 0.6 : 1 }}>
        📊 Excel
      </button>
      <button onClick={exportPdf} disabled={exporting}
        style={{ ...S.btnGhost, fontSize: '11px', padding: '6px 10px', opacity: exporting ? 0.6 : 1 }}>
        📄 PDF
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BANK RECONCILIATION TAB (P-012) — FULL IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════
function BankRecTab({ api }) {
  const [accounts, setAccounts]     = useState([]);
  const [selectedAcct, setSelectedAcct] = useState(null);
  const [recs, setRecs]             = useState([]);
  const [txns, setTxns]             = useState([]);
  const [unmatched, setUnmatched]   = useState([]);
  const [matches, setMatches]       = useState([]);
  const [cheques, setCheques]       = useState([]);
  const [view, setView]             = useState('recon'); // 'recon' | 'cheques'
  const [activeRec, setActiveRec]   = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [showNewCheque, setShowNewCheque] = useState(false);
  const [form, setForm]             = useState({ period_start: monthStart(), period_end: today(), statement_closing: '', notes: '' });
  const [chequeForm, setChequeForm] = useState({ cheque_number: '', amount: '', payee: '', issue_date: today(), due_date: '', direction: 'issued', bank_account_id: null });
  const [newAcct, setNewAcct]       = useState({ bank_name: '', account_number: '', account_type: 'current' });
  const [msg, setMsg]               = useState({ ok: '', err: '' });

  useEffect(() => { api.getBankAccounts().then(r => setAccounts(r||[])); }, [api]);

  const selectAcct = async (a) => {
    setSelectedAcct(a);
    setActiveRec(null);
    const r  = await api.getBankReconciliations({ bankAccountId: a.id });
    setRecs(r||[]);
    const t  = await api.getBankTransactions({ startDate: monthStart(), endDate: today() });
    setTxns(t||[]);
    const ch = await api.getCheques({ bankAccountId: a.id });
    setCheques(ch||[]);
  };

  const saveAcct = async () => {
    if (!newAcct.bank_name.trim()) return;
    await api.saveBankAccount(newAcct);
    const r = await api.getBankAccounts();
    setAccounts(r||[]);
    setNewAcct({ bank_name: '', account_number: '', account_type: 'current' });
    setMsg({ ok: 'تم إضافة الحساب البنكي', err: '' });
  };

  const saveRec = async () => {
    if (!selectedAcct) return;
    const sysBalance = txns.reduce((s, t) => s + t.debit - t.credit, 0);
    const res = await api.saveBankReconciliation({
      bank_account_id: selectedAcct.id,
      period_start:    form.period_start,
      period_end:      form.period_end,
      statement_closing: parseFloat(form.statement_closing)||0,
      system_balance:    sysBalance,
      status:           'completed',
      notes:            form.notes,
      created_by: 1,
    });
    if (res?.success) {
      setMsg({ ok: 'تم حفظ تقرير المطابقة', err: '' });
      setShowForm(false);
      selectAcct(selectedAcct);
    } else setMsg({ ok: '', err: res?.error || 'خطأ' });
  };

  const openMatch = async (rec) => {
    setActiveRec(rec);
    const u = await api.getUnmatchedBankTransactions({ bankAccountId: selectedAcct.id, startDate: rec.period_start, endDate: rec.period_end, reconciliationId: rec.id });
    setUnmatched(u||[]);
    const m = await api.getBankRecMatches({ reconciliationId: rec.id });
    setMatches(m||[]);
  };

  const doMatch = async (lineId, bankDesc) => {
    const res = await api.matchBankLines({ reconciliation_id: activeRec.id, journal_entry_line_id: lineId, bank_statement_line: bankDesc });
    if (res?.success) {
      openMatch(activeRec);
      setMsg({ ok: 'تمت المطابقة', err: '' });
    }
  };

  const doUnmatch = async (matchId) => {
    await api.unmatchBankLine({ matchId });
    openMatch(activeRec);
  };

  const saveCheque = async () => {
    if (!chequeForm.cheque_number || !chequeForm.amount) return;
    const res = await api.saveCheque({ ...chequeForm, bank_account_id: selectedAcct?.id, amount: parseFloat(chequeForm.amount), created_by: 1 });
    if (res?.success) {
      setMsg({ ok: 'تم إضافة الشيك', err: '' });
      setShowNewCheque(false);
      if (selectedAcct) {
        const ch = await api.getCheques({ bankAccountId: selectedAcct.id });
        setCheques(ch||[]);
      }
    }
  };

  const changeChequeStatus = async (id, status) => {
    await api.updateChequeStatus({ chequeId: id, status });
    if (selectedAcct) {
      const ch = await api.getCheques({ bankAccountId: selectedAcct.id });
      setCheques(ch||[]);
    }
  };

  const sysBalance = txns.reduce((s, t) => s + t.debit - t.credit, 0);
  const statusColor = { issued: '#f59e0b', presented: '#3b82f6', cleared: '#10b981', bounced: '#ef4444' };
  const statusLabel = { issued: 'صادر', presented: 'مقدم', cleared: 'مقاص', bounced: 'مردود' };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      {/* Bank accounts */}
      <div style={S.card}>
        <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>الحسابات البنكية</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {accounts.map(a => (
            <button key={a.id} onClick={() => selectAcct(a)}
              style={{ ...S.btn(selectedAcct?.id === a.id ? '#3b82f6' : '#e2e8f0'), color: selectedAcct?.id === a.id ? 'white' : '#374151' }}>
              🏦 {a.bank_name}{a.account_number ? ` (${a.account_number})` : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input value={newAcct.bank_name} onChange={e => setNewAcct(n => ({...n, bank_name: e.target.value}))} placeholder="اسم البنك" style={{ ...S.input, width: '160px' }} />
          <input value={newAcct.account_number} onChange={e => setNewAcct(n => ({...n, account_number: e.target.value}))} placeholder="رقم الحساب" style={{ ...S.input, width: '160px' }} />
          <button onClick={saveAcct} style={S.btn('#10b981')}>+ إضافة</button>
        </div>
      </div>

      {selectedAcct && (
        <>
          {/* Sub-view tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['recon','المطابقة البنكية'], ['cheques','إدارة الشيكات']].map(([k,l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{ ...S.btn(view === k ? '#3b82f6' : '#e2e8f0'), color: view === k ? 'white' : '#374151' }}>{l}</button>
            ))}
            <div style={{ marginRight: 'auto', fontSize: '13px', color: '#64748b', alignSelf: 'center' }}>
              رصيد النظام (البنك/النقد): <b style={{ color: '#0f172a', fontFamily: 'monospace' }}>{sar(sysBalance)} ر.س</b>
            </div>
          </div>

          {/* ─ RECONCILIATION VIEW ─ */}
          {view === 'recon' && (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: '700' }}>{selectedAcct.bank_name}</div>
                <button onClick={() => setShowForm(!showForm)} style={S.btn()}>+ مطابقة جديدة</button>
              </div>

              {showForm && (
                <div style={{ ...S.card, border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div><span style={S.label}>بداية الفترة</span><input type="date" value={form.period_start} onChange={e => setForm(f => ({...f, period_start: e.target.value}))} style={S.input}/></div>
                    <div><span style={S.label}>نهاية الفترة</span><input type="date" value={form.period_end} onChange={e => setForm(f => ({...f, period_end: e.target.value}))} style={S.input}/></div>
                    <div><span style={S.label}>رصيد كشف البنك</span><input type="number" value={form.statement_closing} onChange={e => setForm(f => ({...f, statement_closing: e.target.value}))} style={S.input} placeholder="0.00"/></div>
                    <div><span style={S.label}>ملاحظات</span><input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input}/></div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>رصيد كشف البنك:</span><b>{sar(form.statement_closing)}</b></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>رصيد النظام:</span><b>{sar(sysBalance)}</b></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontWeight: '700' }}>
                      <span>الفرق:</span>
                      <b style={{ color: Math.abs(parseFloat(form.statement_closing||0) - sysBalance) < 0.01 ? '#10b981' : '#ef4444' }}>
                        {sar((parseFloat(form.statement_closing)||0) - sysBalance)}
                        {Math.abs(parseFloat(form.statement_closing||0) - sysBalance) < 0.01 ? ' ✅' : ' ⚠️'}
                      </b>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveRec} style={S.btn('#10b981')}>✓ حفظ</button>
                    <button onClick={() => setShowForm(false)} style={S.btnGhost}>إلغاء</button>
                  </div>
                </div>
              )}

              {/* Match detail view */}
              {activeRec && (
                <div style={{ ...S.card, border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>مطابقة: {activeRec.period_start} → {activeRec.period_end}</div>
                    <button onClick={() => setActiveRec(null)} style={S.btnGhost}>إغلاق</button>
                  </div>

                  {/* Unmatched JE lines */}
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>حركات النظام غير المطابقة ({unmatched.length})</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', direction: 'rtl' }}>
                      <thead><tr>{['التاريخ','المرجع','البيان','مدين','دائن',''].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {unmatched.map((t, i) => (
                          <tr key={i}>
                            <td style={S.td}>{t.entry_date}</td>
                            <td style={S.td}>{t.reference_no}</td>
                            <td style={S.td}>{t.description}</td>
                            <td style={{ ...S.td, color: '#10b981' }}>{t.debit > 0 ? sar(t.debit) : '—'}</td>
                            <td style={{ ...S.td, color: '#ef4444' }}>{t.credit > 0 ? sar(t.credit) : '—'}</td>
                            <td style={S.td}>
                              <button onClick={() => doMatch(t.id, `${t.description} (${t.entry_date})`)} style={{ ...S.btnGhost, fontSize: '11px', padding: '3px 8px' }}>✓ مطابق</button>
                            </td>
                          </tr>
                        ))}
                        {unmatched.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#10b981' }}>✅ جميع الحركات مطابقة</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Matched pairs */}
                  {matches.length > 0 && (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>حركات مطابقة ({matches.length})</div>
                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {matches.map((m, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0fdf4', fontSize: '12px' }}>
                            <span style={{ color: '#10b981' }}>✓ {m.description || m.bank_statement_line || `حركة #${m.journal_entry_line_id}`}</span>
                            <button onClick={() => doUnmatch(m.id)} style={{ ...S.btnGhost, fontSize: '10px', padding: '2px 6px', color: '#ef4444' }}>إلغاء</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* System transactions */}
              <div style={S.card}>
                <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>حركات النظام — الحسابات البنكية/النقدية</span>
                  <ExportToolbar
                    getRows={() => txns.map(t => [t.entry_date, t.reference_no, t.description, t.debit > 0 ? sar(t.debit) : 0, t.credit > 0 ? sar(t.credit) : 0])}
                    headers={['التاريخ','المرجع','البيان','مدين','دائن']}
                    sheetName="حركات البنك" filename="bank_transactions.xlsx"
                  />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px' }}>
                  <thead><tr>{['التاريخ','المرجع','البيان','مدين','دائن'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {txns.slice(0, 50).map((t, i) => (
                      <tr key={i}>
                        <td style={S.td}>{t.entry_date}</td>
                        <td style={S.td}>{t.reference_no}</td>
                        <td style={S.td}>{t.description}</td>
                        <td style={{ ...S.td, color: '#10b981' }}>{t.debit > 0 ? sar(t.debit) : '—'}</td>
                        <td style={{ ...S.td, color: '#ef4444' }}>{t.credit > 0 ? sar(t.credit) : '—'}</td>
                      </tr>
                    ))}
                    {txns.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا توجد حركات</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Previous reconciliations */}
              {recs.length > 0 && (
                <div style={S.card}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>تقارير المطابقة السابقة</div>
                  {recs.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px', flexWrap: 'wrap', gap: '8px' }}>
                      <span>{r.period_start} → {r.period_end}</span>
                      <span>رصيد البنك: <b>{sar(r.statement_closing)}</b></span>
                      <span>رصيد النظام: <b>{sar(r.system_balance)}</b></span>
                      <span style={{ color: Math.abs(r.difference) < 0.01 ? '#10b981' : '#ef4444', fontWeight: '700' }}>فرق: {sar(r.difference)} {Math.abs(r.difference) < 0.01 ? '✅' : '⚠️'}</span>
                      <button onClick={() => openMatch(r)} style={{ ...S.btnGhost, fontSize: '11px' }}>مطابقة تفصيلية</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─ CHEQUES VIEW ─ */}
          {view === 'cheques' && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                <button onClick={() => setShowNewCheque(!showNewCheque)} style={S.btn('#10b981')}>+ شيك جديد</button>
                <div style={{ fontSize: '12px', color: '#64748b', marginRight: 'auto' }}>انقر على الحالة لتغييرها</div>
              </div>

              {showNewCheque && (
                <div style={{ ...S.card, border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                    {[['cheque_number','رقم الشيك','text'],['amount','المبلغ','number'],['payee','المستفيد','text'],['issue_date','تاريخ الإصدار','date'],['due_date','تاريخ الاستحقاق','date']].map(([k,l,t]) => (
                      <div key={k}><span style={S.label}>{l}</span><input type={t} value={chequeForm[k]} onChange={e => setChequeForm(f => ({...f, [k]: e.target.value}))} style={S.input}/></div>
                    ))}
                    <div>
                      <span style={S.label}>الاتجاه</span>
                      <select value={chequeForm.direction} onChange={e => setChequeForm(f => ({...f, direction: e.target.value}))} style={S.select}>
                        <option value="issued">صادر (ندفع)</option>
                        <option value="received">وارد (نستلم)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveCheque} style={S.btn('#10b981')}>✓ حفظ</button>
                    <button onClick={() => setShowNewCheque(false)} style={S.btnGhost}>إلغاء</button>
                  </div>
                </div>
              )}

              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px' }}>
                  <thead><tr>{['رقم الشيك','المستفيد','المبلغ','الإصدار','الاستحقاق','الاتجاه','الحالة','إجراء'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {cheques.map(c => (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace' }}>{c.cheque_number}</td>
                        <td style={S.td}>{c.payee || '—'}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(c.amount)}</td>
                        <td style={S.td}>{c.issue_date}</td>
                        <td style={S.td}>{c.due_date || '—'}</td>
                        <td style={S.td}>{c.direction === 'issued' ? '↑ صادر' : '↓ وارد'}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge('white', statusColor[c.status] || '#94a3b8'), borderRadius: '6px' }}>{statusLabel[c.status] || c.status}</span>
                        </td>
                        <td style={S.td}>
                          <select value={c.status} onChange={e => changeChequeStatus(c.id, e.target.value)} style={{ ...S.select, width: '100px', padding: '3px 6px', fontSize: '11px' }}>
                            {['issued','presented','cleared','bounced'].map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {cheques.length === 0 && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا توجد شيكات</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VAT RETURN TAB (P-013)
// ═════════════════════════════════════════════════════════════════════════════
function VATReturnTab({ api }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ startDate: monthStart(), endDate: today() });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.getVATReturnBoxes(range);
    setData(r);
    setLoading(false);
  }, [range, api]);

  useEffect(() => { load(); }, [load]);

  const Box = ({ num, label, amount, vat, highlight }) => (
    <div style={{ background: highlight ? '#eff6ff' : '#f8fafc', border: `1px solid ${highlight ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '10px', padding: '14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>الخانة {num}</span>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{label}</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          {amount !== undefined && <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: '700' }}>{sar(amount)} ر.س</div>}
          {vat !== undefined && <div style={{ fontSize: '12px', color: '#8b5cf6', fontFamily: 'monospace' }}>ضريبة: {sar(vat)} ر.س</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><span style={S.label}>من</span><input type="date" value={range.startDate} onChange={e => setRange(r => ({...r, startDate: e.target.value}))} style={{ ...S.input, width: '150px' }}/></div>
        <div><span style={S.label}>إلى</span><input type="date" value={range.endDate} onChange={e => setRange(r => ({...r, endDate: e.target.value}))} style={{ ...S.input, width: '150px' }}/></div>
        <button onClick={load} style={S.btn()}><RefreshCw size={13}/> تحديث</button>
        <div style={{ marginRight: 'auto' }}>
          <ExportToolbar
            getRows={() => data ? [
              ['Box 1 — مبيعات 15%', sar(data.box1_standard_amount), sar(data.box1_standard_vat)],
              ['Box 2 — مبيعات صفر', sar(data.box2_zero_rated), '0.00'],
              ['Box 3 — مبيعات معفاة', sar(data.box3_exempt), '0.00'],
              ['Box 9 — مشتريات 15%', sar(data.box9_purchase_amount), sar(data.box9_purchase_vat)],
              ['Box 13 — صافي الضريبة', '', sar(data.box13_net_vat)],
            ] : []}
            headers={['البند','المبلغ','ضريبة القيمة المضافة']}
            sheetName="إقرار ضريبة" filename={`vat_return_${range.startDate}_${range.endDate}.xlsx`}
          />
        </div>
      </div>

      {loading && <Loading />}
      {!loading && data && (
        <div style={{ maxWidth: '600px' }}>
          <div style={{ fontSize: '16px', fontWeight: '900', marginBottom: '16px', color: '#0f172a' }}>إقرار ضريبة القيمة المضافة — ZATCA</div>

          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>المبيعات</div>
          <Box num={1} label="المبيعات الخاضعة للضريبة (15%)" amount={data.box1_standard_amount} vat={data.box1_standard_vat} highlight />
          <Box num={2} label="المبيعات معدومة الضريبة" amount={data.box2_zero_rated} />
          <Box num={3} label="المبيعات المعفاة" amount={data.box3_exempt} />
          <Box num={4} label="إجمالي المبيعات" amount={data.box4_total_sales} highlight />

          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '8px', marginTop: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>المشتريات</div>
          <Box num={5} label="المشتريات الخاضعة للضريبة" amount={data.box5_input_amount} vat={data.box5_input_vat} highlight />

          <div style={{ background: data.is_refund ? '#fef3c7' : '#f0fdf4', border: `1px solid ${data.is_refund ? '#fcd34d' : '#bbf7d0'}`, borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>الخانة 9 — {data.is_refund ? 'ضريبة مستردة' : 'ضريبة مستحقة'}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>صافي ضريبة القيمة المضافة</div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '900', fontFamily: 'monospace', color: data.is_refund ? '#d97706' : '#10b981' }}>
                {sar(Math.abs(data.box9_vat_due))} ر.س
                {data.is_refund && <span style={{ fontSize: '14px', marginRight: '8px', color: '#d97706' }}>(مبلغ مسترد)</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ACCRUALS TAB (P-014)
// ═════════════════════════════════════════════════════════════════════════════
function AccrualsTab({ api }) {
  const [prepaids, setPrepaids] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [view, setView]         = useState('prepaid');
  const [msg, setMsg]           = useState({ ok: '', err: '' });
  const [amrMonth, setAmrMonth] = useState(thisMonth());
  const [showPForm, setShowPForm] = useState(false);
  const [showRForm, setShowRForm] = useState(false);
  const [pForm, setPForm]       = useState({ description: '', total_amount: '', start_date: today(), end_date: '', monthly_amount: '', expense_account_code: '5300' });
  const [rForm, setRForm]       = useState({ expense_name: '', amount: '', account_code: '5700', day_of_month: '1', start_date: today() });

  const load = useCallback(async () => {
    const p = await api.getPrepaidSchedules();
    const r = await api.getRecurringExpenses();
    setPrepaids(p||[]); setRecurring(r||[]);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const addPrepaid = async () => {
    const res = await api.addPrepaidSchedule({ ...pForm, total_amount: parseFloat(pForm.total_amount), monthly_amount: parseFloat(pForm.monthly_amount), expense_account_code: parseInt(pForm.expense_account_code), created_by: 1 });
    if (res?.success) { setMsg({ ok: 'تمت إضافة جدول الإطفاء', err: '' }); setShowPForm(false); load(); }
    else setMsg({ ok: '', err: res?.error });
  };

  const addRecurring = async () => {
    const res = await api.addRecurringExpense({ ...rForm, amount: parseFloat(rForm.amount), account_code: parseInt(rForm.account_code), day_of_month: parseInt(rForm.day_of_month), created_by: 1 });
    if (res?.success) { setMsg({ ok: 'تمت إضافة المصروف المتكرر', err: '' }); setShowRForm(false); load(); }
    else setMsg({ ok: '', err: res?.error });
  };

  const runAmr = async () => {
    const res = await api.runPrepaidAmortisation({ month: amrMonth, createdBy: 1 });
    if (res?.success) setMsg({ ok: `تم ترحيل ${res.posted} قيد إطفاء لشهر ${amrMonth}`, err: '' });
    else setMsg({ ok: '', err: res?.error });
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setView('prepaid')} style={{ ...S.btn(view === 'prepaid' ? '#3b82f6' : '#e2e8f0'), color: view === 'prepaid' ? 'white' : '#374151' }}>مصروفات مقدمة</button>
        <button onClick={() => setView('recurring')} style={{ ...S.btn(view === 'recurring' ? '#3b82f6' : '#e2e8f0'), color: view === 'recurring' ? 'white' : '#374151' }}>مصروفات متكررة</button>
        {view === 'prepaid' && (
          <>
            <button onClick={() => setShowPForm(!showPForm)} style={S.btn('#10b981')}><PlusCircle size={13}/> إضافة</button>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginRight: 'auto' }}>
              <input type="month" value={amrMonth} onChange={e => setAmrMonth(e.target.value)} style={{ ...S.input, width: '130px' }} />
              <button onClick={runAmr} style={S.btn('#8b5cf6')}><Play size={13}/> ترحيل الإطفاء</button>
            </div>
          </>
        )}
        {view === 'recurring' && <button onClick={() => setShowRForm(!showRForm)} style={S.btn('#10b981')}><PlusCircle size={13}/> إضافة</button>}
      </div>

      {view === 'prepaid' && showPForm && (
        <div style={{ ...S.card, border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {[['description','البيان'],['total_amount','إجمالي المبلغ'],['monthly_amount','المبلغ الشهري'],['start_date','تاريخ البداية'],['end_date','تاريخ النهاية'],['expense_account_code','كود حساب المصروف']].map(([k,l]) => (
              <div key={k}><span style={S.label}>{l}</span><input type={k.includes('date') ? 'date' : k.includes('amount')||k.includes('code') ? 'number' : 'text'} value={pForm[k]} onChange={e => setPForm(f => ({...f, [k]: e.target.value}))} style={S.input}/></div>
            ))}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button onClick={addPrepaid} style={S.btn('#10b981')}><CheckCircle size={13}/> حفظ</button>
            <button onClick={() => setShowPForm(false)} style={S.btnGhost}>إلغاء</button>
          </div>
        </div>
      )}

      {view === 'recurring' && showRForm && (
        <div style={{ ...S.card, border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {[['expense_name','اسم المصروف'],['amount','المبلغ الشهري'],['account_code','كود الحساب'],['day_of_month','يوم الترحيل'],['start_date','تاريخ البداية']].map(([k,l]) => (
              <div key={k}><span style={S.label}>{l}</span><input type={k.includes('date') ? 'date' : k === 'expense_name' ? 'text' : 'number'} value={rForm[k]} onChange={e => setRForm(f => ({...f, [k]: e.target.value}))} style={S.input}/></div>
            ))}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button onClick={addRecurring} style={S.btn('#10b981')}><CheckCircle size={13}/> حفظ</button>
            <button onClick={() => setShowRForm(false)} style={S.btnGhost}>إلغاء</button>
          </div>
        </div>
      )}

      {view === 'prepaid' && (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead><tr>{['البيان','الإجمالي','الشهري','البداية','النهاية','آخر ترحيل'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {prepaids.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{p.description}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(p.total_amount)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(p.monthly_amount)}</td>
                  <td style={S.td}>{p.start_date}</td>
                  <td style={S.td}>{p.end_date}</td>
                  <td style={S.td}>{p.last_posted_date || '—'}</td>
                </tr>
              ))}
              {prepaids.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا توجد مصروفات مقدمة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'recurring' && (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
            <thead><tr>{['الاسم','المبلغ الشهري','كود الحساب','يوم الترحيل','البداية','آخر ترحيل'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {recurring.map(r => (
                <tr key={r.id}>
                  <td style={S.td}>{r.expense_name}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(r.amount)}</td>
                  <td style={S.td}>{r.account_code}</td>
                  <td style={S.td}>{r.day_of_month}</td>
                  <td style={S.td}>{r.start_date}</td>
                  <td style={S.td}>{r.last_posted_date || '—'}</td>
                </tr>
              ))}
              {recurring.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>لا توجد مصروفات متكررة</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BUDGET TAB (P-021)
// ═════════════════════════════════════════════════════════════════════════════
function BudgetTab({ api }) {
  const [subView, setSubView] = useState('budget'); // 'budget' | 'breakeven'
  const [data, setData]   = useState([]);
  const [period, setPeriod] = useState(thisMonth());
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState({}); // {account_code: newBudget}
  const [msg, setMsg]     = useState({ ok: '', err: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.getBudgetVsActual({ period });
    setData(r||[]);
    setLoading(false);
  }, [period, api]);

  useEffect(() => { if (subView === 'budget') load(); }, [load, subView]);

  const saveBudget = async (code, val) => {
    await api.saveBudgetEntry({ period, account_code: code, budgeted_amount: parseFloat(val)||0 });
    setEditing(e => { const n = {...e}; delete n[code]; return n; });
    setMsg({ ok: 'تم حفظ الميزانية', err: '' });
    load();
  };

  const revenue = data.filter(r => r.type === 'Revenue');
  const expenses = data.filter(r => r.type === 'Expense');
  const totalBudgetRev = revenue.reduce((s, r) => s + r.budgeted, 0);
  const totalActualRev = revenue.reduce((s, r) => s + Math.abs(r.actual), 0);
  const totalBudgetExp = expenses.reduce((s, r) => s + r.budgeted, 0);
  const totalActualExp = expenses.reduce((s, r) => s + Math.abs(r.actual), 0);

  const Row = ({ r }) => {
    const isRev = r.type === 'Revenue';
    const actual = Math.abs(r.actual);
    const varAmt = isRev ? (actual - r.budgeted) : (r.budgeted - actual);
    const good = varAmt >= 0;
    return (
      <tr>
        <td style={S.td}>{r.account_code}</td>
        <td style={S.td}>{r.name_ar}</td>
        <td style={S.td}>
          {editing[r.account_code] !== undefined
            ? <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" value={editing[r.account_code]} onChange={e => setEditing(ed => ({...ed, [r.account_code]: e.target.value}))} style={{ ...S.input, width: '100px' }} />
                <button onClick={() => saveBudget(r.account_code, editing[r.account_code])} style={S.btn('#10b981')} >✓</button>
              </div>
            : <span style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => setEditing(ed => ({...ed, [r.account_code]: r.budgeted}))}>{sar(r.budgeted)}</span>
          }
        </td>
        <td style={{ ...S.td, fontFamily: 'monospace' }}>{sar(actual)}</td>
        <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: '700', color: good ? '#10b981' : '#ef4444' }}>
          {good ? '+' : ''}{sar(varAmt)}
        </td>
        <td style={S.td}>
          {r.variance_pct !== null && (
            <span style={{ fontSize: '12px', color: good ? '#10b981' : '#ef4444', fontWeight: '700' }}>
              {good ? '▲' : '▼'} {Math.abs(r.variance_pct).toFixed(1)}%
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* Sub-view toggle: Budget vs Break-Even */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {[['budget','📊 الميزانية التقديرية'], ['breakeven','📈 تحليل نقطة التعادل']].map(([k,l]) => (
          <button key={k} onClick={() => setSubView(k)}
            style={{ ...S.btn(subView === k ? '#3b82f6' : '#e2e8f0'), color: subView === k ? 'white' : '#374151' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── BREAK-EVEN SUB-VIEW ── */}
      {subView === 'breakeven' && <BreakEvenTab api={api} />}

      {/* ── BUDGET SUB-VIEW ── */}
      {subView === 'budget' && (
        <>
          <Ok msg={msg.ok} /><Err msg={msg.err} />
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end' }}>
            <div>
              <span style={S.label}>الفترة</span>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ ...S.input, width: '140px' }} />
            </div>
            <button onClick={load} style={S.btn()}><RefreshCw size={13}/> تحديث</button>
            <div style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'flex-end' }}>انقر على مبلغ الميزانية لتعديله</div>
            <div style={{ marginRight: 'auto' }}>
              <ExportToolbar
                getRows={() => [...revenue, ...expenses].map(r => [r.account_code, r.name_ar, sar(r.budgeted), sar(Math.abs(r.actual)), sar(r.type === 'Revenue' ? Math.abs(r.actual) - r.budgeted : r.budgeted - Math.abs(r.actual))])}
                headers={['الكود','الحساب','الميزانية','الفعلي','الفرق']}
                sheetName="الميزانية التقديرية" filename={`budget_${period}.xlsx`}
              />
            </div>
          </div>

          {/* Summary KPIs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {[
              ['ميزانية الإيرادات', totalBudgetRev, '#3b82f6'],
              ['إيرادات فعلية', totalActualRev, '#10b981'],
              ['ميزانية المصروفات', totalBudgetExp, '#f59e0b'],
              ['مصروفات فعلية', totalActualExp, '#ef4444'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ background: 'white', padding: '14px 18px', borderRadius: '12px', border: '1px solid #f1f5f9', minWidth: '140px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{l}</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: c, fontFamily: 'monospace' }}>{sar(v)}</div>
              </div>
            ))}
          </div>

          {loading && <Loading />}
          {!loading && (
            <div style={S.card}>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', color: '#10b981' }}>الإيرادات</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', marginBottom: '20px' }}>
                <thead><tr>{['الكود','الحساب','الميزانية','الفعلي','الفرق','%'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{revenue.map(r => <Row key={r.account_code} r={r} />)}</tbody>
              </table>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', color: '#ef4444' }}>المصروفات</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
                <thead><tr>{['الكود','الحساب','الميزانية','الفعلي','الفرق','%'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{expenses.map(r => <Row key={r.account_code} r={r} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUBSIDIARY LEDGERS TAB (P-020)
// ═════════════════════════════════════════════════════════════════════════════
function SubsidiaryTab({ api }) {
  const [view, setView]       = useState('control'); // 'control' | 'customer' | 'supplier'
  const [control, setControl] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [ledger, setLedger]   = useState(null);
  const [range, setRange]     = useState({ startDate: monthStart(), endDate: today() });

  useEffect(() => {
    api.getSubsidiaryControlCheck().then(r => setControl(r));
    window.api?.getCustomers({}).then(r => setCustomers(r||[]));
    window.api?.getSuppliers().then(r => setSuppliers(r||[]));
  }, [api]);

  const loadCust = async (id) => {
    setSelectedId(id);
    const r = await api.getCustomerSubsidiaryLedger({ customerId: id, ...range });
    setLedger(r);
  };

  const loadSupp = async (id) => {
    setSelectedId(id);
    const r = await api.getSupplierSubsidiaryLedger({ supplierId: id, ...range });
    setLedger(r);
  };

  const LedgerTable = ({ l }) => l ? (
    <div style={S.card}>
      <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
        {l.customer?.name || l.supplier?.name} — الرصيد الختامي: <span style={{ color: sarColor(l.closing_balance) }}>{sar(l.closing_balance)} ر.س</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '13px' }}>
        <thead><tr>{['التاريخ','المرجع','البيان','مدين','دائن','الرصيد'].map((h,i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {l.lines?.map((line, i) => (
            <tr key={i}>
              <td style={S.td}>{line.date}</td>
              <td style={S.td}>{line.reference}</td>
              <td style={S.td}>{line.description}</td>
              <td style={{ ...S.td, color: '#ef4444' }}>{line.debit > 0 ? sar(line.debit) : '—'}</td>
              <td style={{ ...S.td, color: '#10b981' }}>{line.credit > 0 ? sar(line.credit) : '—'}</td>
              <td style={{ ...S.td, fontWeight: '700', color: sarColor(line.balance) }}>{sar(line.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['control','مطابقة الأستاذ العام'],['customer','دفتر العملاء'],['supplier','دفتر الموردين']].map(([k,l]) => (
          <button key={k} onClick={() => { setView(k); setLedger(null); setSelectedId(null); }}
            style={{ ...S.btn(view === k ? '#3b82f6' : '#e2e8f0'), color: view === k ? 'white' : '#374151' }}>{l}</button>
        ))}
      </div>

      {view === 'control' && control && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'الذمم المدينة (AR)', data: control.ar, gl: 'حساب 1200' },
            { label: 'الذمم الدائنة (AP)', data: control.ap, gl: 'حساب 2100' },
          ].map(({ label, data: d, gl }) => (
            <div key={label} style={{ ...S.card, flex: '1', minWidth: '280px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>{label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>مجموع دفتر الأستاذ المساعد:</span>
                <b style={{ fontFamily: 'monospace' }}>{sar(d?.subsidiary_balance)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>رصيد {gl}:</span>
                <b style={{ fontFamily: 'monospace' }}>{sar(d?.gl_balance)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontWeight: '700', fontSize: '14px' }}>
                <span>نتيجة المطابقة:</span>
                <span style={{ color: d?.reconciled ? '#10b981' : '#ef4444' }}>{d?.reconciled ? '✅ متطابق' : '⚠️ فرق: ' + sar((d?.subsidiary_balance||0) - (d?.gl_balance||0))}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'customer' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
            <div><span style={S.label}>من</span><input type="date" value={range.startDate} onChange={e => setRange(r => ({...r, startDate: e.target.value}))} style={{ ...S.input, width: '140px' }}/></div>
            <div><span style={S.label}>إلى</span><input type="date" value={range.endDate} onChange={e => setRange(r => ({...r, endDate: e.target.value}))} style={{ ...S.input, width: '140px' }}/></div>
            <select value={selectedId||''} onChange={e => loadCust(parseInt(e.target.value))} style={{ ...S.select, width: '220px', alignSelf: 'flex-end' }}>
              <option value="">اختر عميل...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <LedgerTable l={ledger} />
        </div>
      )}

      {view === 'supplier' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
            <div><span style={S.label}>من</span><input type="date" value={range.startDate} onChange={e => setRange(r => ({...r, startDate: e.target.value}))} style={{ ...S.input, width: '140px' }}/></div>
            <div><span style={S.label}>إلى</span><input type="date" value={range.endDate} onChange={e => setRange(r => ({...r, endDate: e.target.value}))} style={{ ...S.input, width: '140px' }}/></div>
            <select value={selectedId||''} onChange={e => loadSupp(parseInt(e.target.value))} style={{ ...S.select, width: '220px', alignSelf: 'flex-end' }}>
              <option value="">اختر مورد...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <LedgerTable l={ledger} />
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GL DRILL-DOWN PAGE TAB (P-003) — wrapper around GLDrillDownModal for page context
// ═════════════════════════════════════════════════════════════════════════════
function GLDrillDownPageTab({ api }) {
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accounts, setAccounts]       = useState([]);
  const [showDrill, setShowDrill]     = useState(false);

  useEffect(() => {
    window.api?.acct?.getAccountsHierarchical().then(data => {
      // Flatten hierarchy to list of leaf accounts
      const flat = [];
      const walk = (nodes) => nodes.forEach(n => {
        if (n.account_code) flat.push(n);
        if (n.children) walk(n.children);
      });
      walk(data || []);
      setAccounts(flat);
    }).catch(() => {});
  }, []);

  const open = () => {
    if (!accountCode) return;
    setShowDrill(true);
  };

  return (
    <div dir="rtl">
      <div style={S.card}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginBottom: '16px' }}>
          كشف حساب دفتر الأستاذ (GL Drill-Down)
        </h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
          اختر حسابًا من القائمة لعرض جميع حركات دفتر اليومية لهذا الحساب مع الرصيد التراكمي.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <span style={S.label}>اختر حسابًا</span>
            <select value={accountCode} onChange={e => {
              setAccountCode(e.target.value);
              const acct = accounts.find(a => String(a.account_code) === e.target.value);
              setAccountName(acct?.name_ar || acct?.name || e.target.value);
            }} style={S.select}>
              <option value="">— اختر حساب —</option>
              {accounts.map(a => (
                <option key={a.account_code} value={a.account_code}>
                  {a.account_code} — {a.name_ar || a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={S.label}>أو أدخل كود يدوًيا</span>
            <input type="number" value={accountCode} onChange={e => { setAccountCode(e.target.value); setAccountName(`حساب ${e.target.value}`); }} placeholder="1111" style={{ ...S.input, width: '120px' }} />
          </div>
          <button onClick={open} disabled={!accountCode}
            style={{ ...S.btn('#3b82f6'), opacity: accountCode ? 1 : 0.5 }}>
            عرض الحركات
          </button>
        </div>
      </div>

      {/* Quick account grid */}
      <div style={S.card}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '12px' }}>حسابات سريعة الوصول</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { code: '4100', name: 'الإيرادات' },
            { code: '5100', name: 'COGS' },
            { code: '1111', name: 'الصندوق' },
            { code: '1112', name: 'البنك' },
            { code: '1200', name: 'ذمم مدينة' },
            { code: '2100', name: 'ذمم دائنة' },
            { code: '5200', name: 'الرواتب' },
            { code: '2400', name: 'ضريبة مدخلات' },
          ].map(({ code, name }) => (
            <button key={code} onClick={() => { setAccountCode(code); setAccountName(name); setShowDrill(true); }}
              style={{ ...S.btnGhost, fontSize: '12px' }}>
              {code} — {name}
            </button>
          ))}
        </div>
      </div>

      {showDrill && accountCode && (
        <GLDrillDownModal
          accountCode={parseInt(accountCode)}
          accountName={accountName}
          onClose={() => setShowDrill(false)}
        />
      )}
    </div>
  );
}
