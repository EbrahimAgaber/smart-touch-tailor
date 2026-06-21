/**
 * SaudiComplianceTab.jsx — Saudi Labour & Compliance UI
 * ═══════════════════════════════════════════════════════════════════
 *  Covers all 8 compliance gaps addressed in compliance_sa.cjs:
 *
 *  GAP-01 · EOSB Calculator & Journal Posting
 *  GAP-02 · WPS / Mudad SIF Export
 *  GAP-03 · VAT 311 XML Export
 *  GAP-04 · AP Aging (Payables)
 *  GAP-05 · Period-End Closing Wizard
 *  GAP-06 · Bank Statement CSV Import & Row Matching
 *  GAP-07 · Data Retention Manifest (ZATCA 5-year)
 *  GAP-08 · Auto Bank Statement Matching
 *
 *  All calls go through window.api.compliance.*
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, AlertCircle, Download,
  FileText, Users, Landmark, Calendar, Archive,
  Upload, Play, PlusCircle, ArrowUpDown
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sar = (n) => {
  const v = parseFloat(n) || 0;
  return Math.abs(v).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Style tokens ─────────────────────────────────────────────────────────────
const S = {
  card:    { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  th:      { padding: '10px 14px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap' },
  td:      { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
  input:   { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
  label:   { fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '4px', display: 'block' },
  btn:     (color = '#3b82f6') => ({ padding: '9px 18px', borderRadius: '8px', border: 'none', background: color, color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }),
  btnGhost:{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: '600', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  badge:   (color, bg) => ({ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', color, background: bg }),
};

// ─── Atoms ────────────────────────────────────────────────────────────────────
const Loading = () => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>جاري التحميل...</div>
);
const Err = ({ msg }) => msg
  ? <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{msg}</div>
  : null;
const Ok = ({ msg }) => msg
  ? <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontSize: '13px', marginBottom: '16px' }}>{msg}</div>
  : null;

// ─── Sub-tab config ───────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'eosb',      label: 'مكافأة نهاية الخدمة',  icon: <Users size={14}/> },
  { id: 'wps',       label: 'WPS / مدد',             icon: <Download size={14}/> },
  { id: 'vat311',    label: 'VAT 311 XML',           icon: <FileText size={14}/> },
  { id: 'apaging',   label: 'أعمار الدائنين',        icon: <Landmark size={14}/> },
  { id: 'closing',   label: 'قفل الفترة',            icon: <Calendar size={14}/> },
  { id: 'bankimport',label: 'استيراد كشف البنك',     icon: <Upload size={14}/> },
  { id: 'retention', label: 'الاحتفاظ بالبيانات',   icon: <Archive size={14}/> },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export function SaudiComplianceTab() {
  const [activeTab, setActiveTab] = useState('eosb');
  const api = window.api?.compliance;

  if (!api) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        ⚠️ window.api.compliance غير متاح — تأكد من تشغيل التطبيق عبر Electron.
      </div>
    );
  }

  return (
    <div dir="rtl">
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '20px', background: 'white', padding: '8px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '12px', fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: '5px',
              background: activeTab === t.id ? '#0f172a' : 'transparent',
              color:      activeTab === t.id ? 'white'   : '#64748b',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'eosb'       && <EOSBTab       api={api} />}
      {activeTab === 'wps'        && <WPSTab        api={api} />}
      {activeTab === 'vat311'     && <VAT311Tab     api={api} />}
      {activeTab === 'apaging'    && <APAgingTab    api={api} />}
      {activeTab === 'closing'    && <ClosingTab    api={api} />}
      {activeTab === 'bankimport' && <BankImportTab api={api} />}
      {activeTab === 'retention'  && <RetentionTab  api={api} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-01 — EOSB Calculator
// ═════════════════════════════════════════════════════════════════════════════
function EOSBTab({ api }) {
  const [employees, setEmployees]   = useState([]);
  const [selected, setSelected]     = useState('');
  const [result, setResult]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState({ ok: '', err: '' });

  const loadHistory = useCallback(async () => {
    const h = await api.getEOSBHistory();
    setHistory(h || []);
  }, [api]);

  useEffect(() => {
    window.api?.p2?.getEmployees().then(r => setEmployees(r || []));
    loadHistory();
  }, [loadHistory]);

  const calculate = async () => {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    const r = await api.calculateEOSB({ employeeId: parseInt(selected), terminationDate: today() });
    setResult(r);
    setLoading(false);
  };

  const post = async () => {
    if (!result || !selected) return;
    const r = await api.postEOSB({ employeeId: parseInt(selected), createdBy: 1 });
    if (r?.success) {
      setMsg({ ok: 'تم ترحيل قيد مكافأة نهاية الخدمة إلى دفتر اليومية', err: '' });
      setResult(null);
      loadHistory();
    } else {
      setMsg({ ok: '', err: r?.error || 'فشل الترحيل' });
    }
  };

  const emp = employees.find(e => String(e.id) === String(selected));

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      {/* Info banner */}
      <div style={{ ...S.card, background: '#fffbeb', border: '1px solid #fcd34d' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
          📋 مكافأة نهاية الخدمة — المادة 84 نظام العمل السعودي
        </div>
        <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.7' }}>
          السنوات 1-5: نصف راتب عن كل سنة • السنوات 5+: راتب كامل عن كل سنة تجاوزت الخمس سنوات
          {' '}(استقالة: 1/3 الأول للسنوات 1-5، 2/3 للسنوات 5-10، كامل للأكثر من 10).
        </div>
      </div>

      {/* Calculator */}
      <div style={S.card}>
        <div style={{ fontSize: '15px', fontWeight: '900', marginBottom: '16px', color: '#0f172a' }}>
          🧮 احتساب المكافأة
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <span style={S.label}>الموظف</span>
            <select value={selected} onChange={e => { setSelected(e.target.value); setResult(null); }} style={S.select}>
              <option value="">اختر موظفًا...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.job_title || 'موظف'}</option>
              ))}
            </select>
          </div>
          <button onClick={calculate} disabled={!selected || loading} style={{ ...S.btn('#8b5cf6'), opacity: (!selected || loading) ? 0.6 : 1 }}>
            <Play size={13}/> احتساب
          </button>
        </div>

        {loading && <Loading />}

        {result && (
          <div style={{ marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', marginBottom: '12px' }}>
              نتيجة الاحتساب — {emp?.name}
            </div>

            {result.error ? (
              <Err msg={result.error} />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {[
                    ['سنوات الخدمة', `${result.years_of_service?.toFixed(2)} سنة`, '#3b82f6'],
                    ['الراتب الأساسي', `${sar(result.basic_salary)} ر.س`, '#64748b'],
                    ['طريقة الإنهاء', result.termination_type === 'resignation' ? 'استقالة' : 'فصل / إنهاء', '#f59e0b'],
                    ['مكافأة مستحقة', `${sar(result.eosb_amount)} ر.س`, '#10b981'],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '900', color, marginTop: '4px' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {result.breakdown?.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', direction: 'rtl', marginBottom: '12px' }}>
                    <thead>
                      <tr>
                        {['الفترة', 'السنوات', 'معدل المكافأة', 'مكافأة المرحلة'].map((h, i) => (
                          <th key={i} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td style={S.td}>{b.tier}</td>
                          <td style={S.td}>{b.years?.toFixed(2)}</td>
                          <td style={S.td}>{b.rate}× الراتب الشهري</td>
                          <td style={{ ...S.td, fontWeight: '700', color: '#10b981' }}>{sar(b.amount)} ر.س</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981', marginBottom: '12px' }}>
                  الإجمالي: {sar(result.eosb_amount)} ر.س
                </div>
                <button onClick={post} style={S.btn('#10b981')}>
                  <CheckCircle size={13}/> ترحيل إلى اليومية
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>سجل المكافآت المرحّلة</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px' }}>
            <thead>
              <tr>{['الموظف', 'سنوات الخدمة', 'المبلغ', 'التاريخ', 'المرجع'].map((h, i) => (
                <th key={i} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td style={S.td}>{h.employee_name || `موظف #${h.employee_id}`}</td>
                  <td style={S.td}>{h.years_of_service?.toFixed(2)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: '#10b981', fontWeight: '700' }}>{sar(h.eosb_amount)} ر.س</td>
                  <td style={S.td}>{h.calculated_at?.split('T')[0]}</td>
                  <td style={S.td}><span style={S.badge('#1e40af', '#eff6ff')}>{h.journal_entry_ref || '—'}</span></td>
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
// GAP-02 — WPS / Mudad SIF Export
// ═════════════════════════════════════════════════════════════════════════════
function WPSTab({ api }) {
  const [runs, setRuns]     = useState([]);
  const [runId, setRunId]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState({ ok: '', err: '' });

  useEffect(() => {
    window.api?.p2?.getPayrollRuns({}).then(r => setRuns(r || []));
  }, []);

  const exportSIF = async () => {
    if (!runId) return;
    setLoading(true);
    const r = await api.exportWPS({ runId: parseInt(runId) });
    setLoading(false);
    if (r?.success) setMsg({ ok: `تم تصدير ملف WPS SIF إلى: ${r.filePath}`, err: '' });
    else setMsg({ ok: '', err: r?.error || 'فشل التصدير' });
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      <div style={{ ...S.card, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '4px' }}>
          📤 تصدير WPS / Mudad — ملف SIF
        </div>
        <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
          يُصدّر ملف SIF متوافق مع نظام حماية الأجور (WPS) ومنصة مدد لتحديث حالة الدفع لدى وزارة الموارد البشرية.
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <span style={S.label}>اختر كشف الرواتب</span>
            <select value={runId} onChange={e => setRunId(e.target.value)} style={S.select}>
              <option value="">— اختر كشف راتب —</option>
              {runs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.run_month} — {r.status === 'posted' ? '✅ مرحّل' : '⏳ مسودة'} ({sar(r.total_net)} ر.س)
                </option>
              ))}
            </select>
          </div>
          <button onClick={exportSIF} disabled={!runId || loading}
            style={{ ...S.btn('#1d4ed8'), opacity: (!runId || loading) ? 0.6 : 1 }}>
            <Download size={13}/> {loading ? 'جارٍ التصدير...' : 'تصدير SIF'}
          </button>
        </div>

        {runs.length === 0 && (
          <div style={{ marginTop: '16px', fontSize: '13px', color: '#94a3b8' }}>
            لا توجد كشوف رواتب. أنشئ كشف رواتب من تبويب الرواتب أولاً.
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-03 — VAT 311 XML Export
// ═════════════════════════════════════════════════════════════════════════════
function VAT311Tab({ api }) {
  const [range, setRange]   = useState({ startDate: monthStart(), endDate: today() });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState({ ok: '', err: '' });

  const exportXML = async () => {
    setLoading(true);
    const r = await api.exportVAT311({ startDate: range.startDate, endDate: range.endDate });
    setLoading(false);
    if (r?.success) setMsg({ ok: `تم تصدير VAT311 XML إلى: ${r.filePath}`, err: '' });
    else setMsg({ ok: '', err: r?.error || 'فشل التصدير' });
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      <div style={{ ...S.card, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534', marginBottom: '4px' }}>
          🧾 إقرار ضريبة القيمة المضافة — VAT311 XML
        </div>
        <div style={{ fontSize: '12px', color: '#14532d' }}>
          يُصدّر ملف XML متوافق مع مخطط GAZT / ZATCA لإقرار ضريبة القيمة المضافة الدوري (VAT311)
          الجاهز للرفع على بوابة هيئة الزكاة والضريبة والجمارك.
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <span style={S.label}>من</span>
            <input type="date" value={range.startDate} onChange={e => setRange(r => ({ ...r, startDate: e.target.value }))} style={{ ...S.input, width: '160px' }} />
          </div>
          <div>
            <span style={S.label}>إلى</span>
            <input type="date" value={range.endDate} onChange={e => setRange(r => ({ ...r, endDate: e.target.value }))} style={{ ...S.input, width: '160px' }} />
          </div>
          <button onClick={exportXML} disabled={loading}
            style={{ ...S.btn('#16a34a'), opacity: loading ? 0.6 : 1 }}>
            <Download size={13}/> {loading ? 'جارٍ التصدير...' : 'تصدير XML'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-04 — AP Aging (Payables)
// ═════════════════════════════════════════════════════════════════════════════
function APAgingTab({ api }) {
  const [data, setData]     = useState(null);
  const [asOf, setAsOf]     = useState(today());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.getAPAging({ asOfDate: asOf });
    setData(r);
    setLoading(false);
  }, [asOf, api]);

  useEffect(() => { load(); }, [load]);

  const bucketColor = { current: '#10b981', d1_30: '#f59e0b', d31_60: '#f97316', d61_90: '#ef4444', d90plus: '#7f1d1d' };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <span style={S.label}>تقرير بتاريخ</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ ...S.input, width: '160px' }} />
        </div>
        <button onClick={load} style={S.btn()}><RefreshCw size={13}/> تحديث</button>
      </div>

      {loading && <Loading />}

      {!loading && data && (
        <>
          {/* Summary buckets */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {[
              ['جارٍ', data.totals?.current, bucketColor.current],
              ['1-30 يوم', data.totals?.d1_30, bucketColor.d1_30],
              ['31-60 يوم', data.totals?.d31_60, bucketColor.d31_60],
              ['61-90 يوم', data.totals?.d61_90, bucketColor.d61_90],
              ['90+ يوم', data.totals?.d90plus, bucketColor.d90plus],
              ['الإجمالي', data.totals?.total, '#0f172a'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid #f1f5f9', minWidth: '130px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: '17px', fontWeight: '900', color, fontFamily: 'monospace' }}>{sar(val)} ر.س</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
              <thead>
                <tr>
                  {['المورد', 'الإجمالي', 'جارٍ', '1-30', '31-60', '61-90', '90+'].map((h, i) => (
                    <th key={i} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}><b>{r.supplier_name}</b></td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: '700', color: '#ef4444' }}>{sar(r.total)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: bucketColor.current }}>{sar(r.current)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: bucketColor.d1_30 }}>{sar(r.d1_30)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: bucketColor.d31_60 }}>{sar(r.d31_60)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: bucketColor.d61_90 }}>{sar(r.d61_90)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: bucketColor.d90plus }}>{sar(r.d90plus)}</td>
                  </tr>
                ))}
                {(!data.rows || data.rows.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                      لا توجد ذمم دائنة متأخرة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-05 — Period-End Closing Wizard
// ═════════════════════════════════════════════════════════════════════════════
function ClosingTab({ api }) {
  const [periods, setPeriods]   = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ ok: '', err: '' });

  useEffect(() => {
    window.api?.acct?.getPeriods().then(r => setPeriods(r || []));
  }, []);

  const runPreview = async () => {
    if (!periodId) return;
    setLoading(true);
    setPreview(null);
    const r = await api.previewClose({ periodId: parseInt(periodId) });
    setPreview(r);
    setLoading(false);
  };

  const executeClose = async () => {
    if (!periodId || !preview) return;
    if (!confirm('هل أنت متأكد من قفل هذه الفترة المحاسبية؟ لا يمكن التراجع عن هذه العملية.')) return;
    setLoading(true);
    const r = await api.executeClose({ periodId: parseInt(periodId), createdBy: 1 });
    setLoading(false);
    if (r?.success) {
      setMsg({ ok: `تم قفل الفترة بنجاح. الأرباح المحولة: ${sar(r.retained_earnings)} ر.س`, err: '' });
      setPreview(null);
      window.api?.acct?.getPeriods().then(p => setPeriods(p || []));
    } else {
      setMsg({ ok: '', err: r?.error || 'فشل قفل الفترة' });
    }
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      <div style={{ ...S.card, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#9a3412', marginBottom: '4px' }}>
          🔒 معالج قفل الفترة المحاسبية
        </div>
        <div style={{ fontSize: '12px', color: '#7c2d12' }}>
          يقوم المعالج تلقائياً بترحيل رصيد الإيرادات والمصروفات إلى حساب الأرباح المحتجزة،
          وقفل الفترة لمنع أي قيود مستقبلية عليها.
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <span style={S.label}>الفترة المحاسبية</span>
            <select value={periodId} onChange={e => { setPeriodId(e.target.value); setPreview(null); }} style={S.select}>
              <option value="">— اختر فترة —</option>
              {periods.filter(p => p.status !== 'hard_locked').map(p => (
                <option key={p.id} value={p.id}>
                  {p.period_name || p.period_code} — {p.status === 'soft_locked' ? '🔓 مغلقة جزئياً' : '📂 مفتوحة'}
                </option>
              ))}
            </select>
          </div>
          <button onClick={runPreview} disabled={!periodId || loading}
            style={{ ...S.btn('#8b5cf6'), opacity: (!periodId || loading) ? 0.6 : 1 }}>
            <Play size={13}/> معاينة القفل
          </button>
        </div>
      </div>

      {loading && <Loading />}

      {preview && (
        <div style={{ ...S.card, border: '2px solid #f59e0b' }}>
          <div style={{ fontSize: '15px', fontWeight: '900', marginBottom: '12px', color: '#92400e' }}>
            معاينة قيود قفل الفترة
          </div>

          {preview.error ? (
            <Err msg={preview.error} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {[
                  ['إجمالي الإيرادات', preview.total_revenue, '#10b981'],
                  ['إجمالي المصروفات', preview.total_expenses, '#ef4444'],
                  ['صافي الربح/الخسارة', preview.net_income, preview.net_income >= 0 ? '#10b981' : '#ef4444'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{l}</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: c, fontFamily: 'monospace' }}>{sar(v)} ر.س</div>
                  </div>
                ))}
              </div>

              {preview.entries?.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr>{['الحساب', 'البيان', 'مدين', 'دائن'].map((h, i) => (
                      <th key={i} style={S.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((e, i) => (
                      <tr key={i}>
                        <td style={S.td}>{e.account_code}</td>
                        <td style={S.td}>{e.description}</td>
                        <td style={{ ...S.td, color: '#ef4444', fontFamily: 'monospace' }}>{e.debit > 0 ? `${sar(e.debit)} ر.س` : '—'}</td>
                        <td style={{ ...S.td, color: '#10b981', fontFamily: 'monospace' }}>{e.credit > 0 ? `${sar(e.credit)} ر.س` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <button onClick={executeClose} style={S.btn('#ef4444')}>
                <CheckCircle size={13}/> تنفيذ قفل الفترة
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-06 + GAP-08 — Bank Statement Import & Auto-Match
// ═════════════════════════════════════════════════════════════════════════════
function BankImportTab({ api }) {
  const [accounts, setAccounts]     = useState([]);
  const [selectedAcct, setSelectedAcct] = useState('');
  const [imports, setImports]       = useState([]);
  const [lines, setLines]           = useState([]);
  const [selectedImport, setSelectedImport] = useState('');
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState({ ok: '', err: '' });

  useEffect(() => {
    window.api?.p2?.getBankAccounts().then(r => setAccounts(r || []));
  }, []);

  const loadImports = useCallback(async (acctId) => {
    if (!acctId) return;
    const r = await api.getStatementImports({ bankAccountId: parseInt(acctId) });
    setImports(r || []);
  }, [api]);

  const loadLines = useCallback(async (importId) => {
    if (!importId || !selectedAcct) return;
    const r = await api.getBankStatementLines({ bankAccountId: parseInt(selectedAcct), importId: parseInt(importId) });
    setLines(r || []);
  }, [api, selectedAcct]);

  const importCSV = async () => {
    if (!selectedAcct) return;
    setLoading(true);
    const r = await api.importBankFile({ bankAccountId: parseInt(selectedAcct) });
    setLoading(false);
    if (r?.success) {
      setMsg({ ok: `تم استيراد ${r.inserted} سطر من كشف البنك`, err: '' });
      loadImports(selectedAcct);
    } else if (r === false || !r) {
      // Dialog cancelled
    } else {
      setMsg({ ok: '', err: r?.error || 'فشل الاستيراد' });
    }
  };

  const autoMatch = async () => {
    if (!selectedAcct) return;
    setLoading(true);
    const r = await api.autoMatchBankLines({ bankAccountId: parseInt(selectedAcct) });
    setLoading(false);
    if (r?.success) {
      setMsg({ ok: `تمت المطابقة التلقائية: ${r.matched} من ${r.total} سطر`, err: '' });
      if (selectedImport) loadLines(selectedImport);
    } else {
      setMsg({ ok: '', err: r?.error || 'فشلت المطابقة التلقائية' });
    }
  };

  const matchLine = async (lineId) => {
    const jelId = prompt('أدخل رقم سطر اليومية (journal_entry_line_id) للمطابقة:');
    if (!jelId) return;
    const r = await api.matchStatementLine({ lineId, journalEntryLineId: parseInt(jelId) });
    if (r?.success) {
      setMsg({ ok: 'تمت المطابقة', err: '' });
      loadLines(selectedImport);
    } else {
      setMsg({ ok: '', err: r?.error || 'فشلت المطابقة' });
    }
  };

  return (
    <div>
      <Ok msg={msg.ok} /><Err msg={msg.err} />

      <div style={{ ...S.card, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0c4a6e', marginBottom: '4px' }}>
          📂 استيراد كشف الحساب البنكي (CSV)
        </div>
        <div style={{ fontSize: '12px', color: '#0369a1' }}>
          استورد كشف حساب بنكي بصيغة CSV (أعمدة: Date, Description, Debit, Credit, Balance, Reference) ثم طابق البنود مع قيود اليومية.
          تدعم الأداة أيضاً المطابقة التلقائية بناءً على التاريخ والمبلغ.
        </div>
      </div>

      {/* Controls */}
      <div style={S.card}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <span style={S.label}>الحساب البنكي</span>
            <select value={selectedAcct} onChange={e => { setSelectedAcct(e.target.value); loadImports(e.target.value); setLines([]); setSelectedImport(''); }} style={S.select}>
              <option value="">— اختر حساب بنكي —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.bank_name} {a.account_number ? `(${a.account_number})` : ''}</option>
              ))}
            </select>
          </div>
          <button onClick={importCSV} disabled={!selectedAcct || loading}
            style={{ ...S.btn('#0ea5e9'), opacity: (!selectedAcct || loading) ? 0.6 : 1 }}>
            <Upload size={13}/> استيراد CSV
          </button>
          <button onClick={autoMatch} disabled={!selectedAcct || loading}
            style={{ ...S.btn('#8b5cf6'), opacity: (!selectedAcct || loading) ? 0.6 : 1 }}>
            <ArrowUpDown size={13}/> مطابقة تلقائية
          </button>
        </div>
      </div>

      {/* Previous imports */}
      {imports.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>عمليات الاستيراد السابقة</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {imports.map(imp => (
              <button key={imp.id} onClick={() => { setSelectedImport(imp.id); loadLines(imp.id); }}
                style={{
                  ...S.btnGhost, fontSize: '11px',
                  background: selectedImport == imp.id ? '#eff6ff' : 'transparent',
                  borderColor: selectedImport == imp.id ? '#3b82f6' : '#e2e8f0',
                  color: selectedImport == imp.id ? '#1d4ed8' : '#64748b',
                }}>
                {imp.imported_at?.split('T')[0]} — {imp.row_count} سطر
              </button>
            ))}
          </div>

          {/* Statement lines */}
          {lines.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: '12px' }}>
                <thead>
                  <tr>{['التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد', 'الحالة', 'إجراء'].map((h, i) => (
                    <th key={i} style={S.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td style={S.td}>{l.value_date}</td>
                      <td style={S.td}>{l.description}</td>
                      <td style={{ ...S.td, color: '#ef4444', fontFamily: 'monospace' }}>{l.debit_halala > 0 ? sar(l.debit_halala / 100) : '—'}</td>
                      <td style={{ ...S.td, color: '#10b981', fontFamily: 'monospace' }}>{l.credit_halala > 0 ? sar(l.credit_halala / 100) : '—'}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{l.balance_halala != null ? sar(l.balance_halala / 100) : '—'}</td>
                      <td style={S.td}>
                        {l.is_matched
                          ? <span style={S.badge('#16a34a', '#f0fdf4')}>✓ مطابق</span>
                          : <span style={S.badge('#d97706', '#fffbeb')}>⏳ غير مطابق</span>
                        }
                      </td>
                      <td style={S.td}>
                        {!l.is_matched && (
                          <button onClick={() => matchLine(l.id)} style={{ ...S.btnGhost, fontSize: '11px', padding: '3px 8px' }}>
                            مطابقة
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAP-07 — Data Retention Manifest
// ═════════════════════════════════════════════════════════════════════════════
function RetentionTab({ api }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await api.getRetentionManifest();
    setData(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statusColor = {
    compliant:    { color: '#16a34a', bg: '#f0fdf4', label: '✅ متوافق' },
    expiring_soon:{ color: '#d97706', bg: '#fffbeb', label: '⚠️ ينتهي قريباً' },
    expired:      { color: '#dc2626', bg: '#fef2f2', label: '❌ منتهي' },
    missing:      { color: '#7f1d1d', bg: '#fff1f2', label: '🚫 مفقود' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <button onClick={load} disabled={loading} style={S.btn()}>
          <RefreshCw size={13}/> {loading ? 'جاري التحميل...' : 'تحديث البيان'}
        </button>
      </div>

      <div style={{ ...S.card, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b21a8', marginBottom: '4px' }}>
          🗄️ بيان الاحتفاظ بالبيانات — متطلبات ZATCA (5 سنوات)
        </div>
        <div style={{ fontSize: '12px', color: '#581c87' }}>
          تلزم لوائح هيئة الزكاة والضريبة والجمارك بالاحتفاظ بالسجلات الضريبية والفواتير لمدة 5 سنوات.
          يعرض هذا التقرير وضع البيانات المحفوظة حسب الفئة.
        </div>
      </div>

      {loading && <Loading />}

      {!loading && data && (
        <>
          {data.error ? (
            <div style={{ ...S.card, color: '#dc2626' }}>{data.error}</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {[
                  ['إجمالي السجلات', data.summary?.total_records, '#3b82f6'],
                  ['متوافقة', data.summary?.compliant, '#10b981'],
                  ['تنتهي قريباً', data.summary?.expiring_soon, '#f59e0b'],
                  ['منتهية', data.summary?.expired, '#ef4444'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid #f1f5f9', minWidth: '130px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color, fontFamily: 'monospace' }}>{val ?? '—'}</div>
                  </div>
                ))}
              </div>

              {/* Detail table */}
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
                  <thead>
                    <tr>{['الفئة', 'نطاق التواريخ', 'عدد السجلات', 'احتفاظ حتى', 'الحالة'].map((h, i) => (
                      <th key={i} style={S.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((item, i) => {
                      const s = statusColor[item.retention_status] || statusColor.compliant;
                      return (
                        <tr key={i}>
                          <td style={S.td}><b>{item.category_ar || item.category}</b></td>
                          <td style={S.td}>{item.min_date} → {item.max_date}</td>
                          <td style={{ ...S.td, fontFamily: 'monospace' }}>{item.record_count?.toLocaleString()}</td>
                          <td style={S.td}>{item.required_until}</td>
                          <td style={S.td}><span style={S.badge(s.color, s.bg)}>{s.label}</span></td>
                        </tr>
                      );
                    })}
                    {(!data.items || data.items.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>
                          لا توجد بيانات لعرضها
                        </td>
                      </tr>
                    )}
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
