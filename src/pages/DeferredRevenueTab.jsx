/**
 * DeferredRevenueTab.jsx — P-014 Deferred Revenue Scheduler
 * Create deferred revenue schedules (e.g. annual subscriptions, advance payments).
 * Monthly recognition entries are posted automatically via the scheduler in main.cjs.
 */
import { useState, useEffect } from 'react';
import { PlusCircle, RefreshCw, CheckCircle, Play } from 'lucide-react';

const sar = (n) => (parseFloat(n) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const S = {
  card: { background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box' },
  label: { fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '4px', display: 'block' },
  btn: (color = '#3b82f6') => ({ padding: '9px 20px', borderRadius: '8px', border: 'none', background: color, color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }),
  th: { padding: '10px 14px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', textAlign: 'right' },
  td: { padding: '12px 14px', fontSize: '13px', borderBottom: '1px solid #f8fafc', textAlign: 'right' },
};

const emptyForm = {
  description: '', total_amount: '', monthly_amount: '',
  start_date: '', end_date: '',
  liability_account_code: '2500', revenue_account_code: '4100',
};

export function DeferredRevenueTab() {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [runMonth, setRunMonth] = useState(thisMonth());
  const [running, setRunning] = useState(false);

  const load = () => {
    window.api.p2.getDeferredRevenueSchedules().then(s => setSchedules(s || [])).catch(() => {});
  };
  useEffect(load, []);

  const save = async () => {
    setMsg('');
    if (!form.description || !form.total_amount || !form.monthly_amount || !form.start_date || !form.end_date)
      return setMsg('أدخل جميع الحقول المطلوبة');
    setSaving(true);
    try {
      const res = await window.api.p2.addDeferredRevenueSchedule({
        ...form,
        total_amount: parseFloat(form.total_amount),
        monthly_amount: parseFloat(form.monthly_amount),
        liability_account_code: parseInt(form.liability_account_code) || 2500,
        revenue_account_code: parseInt(form.revenue_account_code) || 4100,
      });
      if (res?.success) { setForm(emptyForm); setMsg('✓ تم إضافة جدول الإيراد المؤجل'); load(); }
      else setMsg(res?.error || 'فشل الإضافة');
    } catch (e) { setMsg(e.message || 'خطأ'); }
    setSaving(false);
  };

  const runRecognition = async () => {
    setRunning(true);
    try {
      const res = await window.api.p2.runDeferredRevenueRecognition({ month: runMonth });
      if (res?.success) setMsg(`✓ تم ترحيل ${res.posted} قيد اعتراف بالإيراد لشهر ${runMonth}`);
      else setMsg(res?.error || 'لا توجد جداول مستحقة لهذا الشهر');
    } catch (e) { setMsg(e.message); }
    setRunning(false);
    load();
  };

  return (
    <div dir="rtl" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
      {/* Form */}
      <div>
        <div style={S.card}>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginBottom: '16px' }}>
            إضافة إيراد مؤجل
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', background: '#eff6ff', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>
            مثال: اشتراك سنوي مبلغ 12,000 ر.س → 1,000 ر.س/شهر تُرحّل تلقائياً.
          </p>
          {[
            { label: 'البيان *', field: 'description', type: 'text', placeholder: 'اشتراك سنوي — عميل X' },
            { label: 'المبلغ الإجمالي (ر.س) *', field: 'total_amount', type: 'number', placeholder: '12000' },
            { label: 'المبلغ الشهري (ر.س) *', field: 'monthly_amount', type: 'number', placeholder: '1000' },
            { label: 'تاريخ البداية *', field: 'start_date', type: 'date' },
            { label: 'تاريخ النهاية *', field: 'end_date', type: 'date' },
            { label: 'حساب الالتزام (إيراد مؤجل)', field: 'liability_account_code', type: 'number', placeholder: '2500' },
            { label: 'حساب الإيراد (عند الاعتراف)', field: 'revenue_account_code', type: 'number', placeholder: '4100' },
          ].map(f => (
            <div key={f.field} style={{ marginBottom: '10px' }}>
              <label style={S.label}>{f.label}</label>
              <input type={f.type} value={form[f.field]} placeholder={f.placeholder || ''}
                onChange={e => setForm(v => ({ ...v, [f.field]: e.target.value }))}
                style={S.input} />
            </div>
          ))}
          {msg && (
            <div style={{ fontSize: '12px', fontWeight: '700', color: msg.startsWith('✓') ? '#10b981' : '#ef4444', marginBottom: '10px' }}>
              {msg}
            </div>
          )}
          <button onClick={save} disabled={saving} style={{ ...S.btn('#3b82f6'), width: '100%', justifyContent: 'center' }}>
            {saving ? <RefreshCw size={14} /> : <PlusCircle size={14} />}
            {saving ? 'جاري الإضافة...' : 'إضافة الجدول + قيد الاستلام'}
          </button>
        </div>

        {/* Manual run */}
        <div style={S.card}>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
            ترحيل يدوي للاعتراف بالإيراد
          </h3>
          <label style={S.label}>الشهر</label>
          <input type="month" value={runMonth} onChange={e => setRunMonth(e.target.value)}
            style={{ ...S.input, marginBottom: '10px' }} />
          <button onClick={runRecognition} disabled={running}
            style={{ ...S.btn('#8b5cf6'), width: '100%', justifyContent: 'center' }}>
            {running ? <RefreshCw size={14} /> : <Play size={14} />}
            {running ? 'جاري الترحيل...' : 'ترحيل اعتراف الإيراد'}
          </button>
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
            يُرحّل تلقائياً أول كل شهر عند تشغيل التطبيق
          </p>
        </div>
      </div>

      {/* Schedules list */}
      <div style={S.card}>
        <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginBottom: '16px' }}>
          جداول الإيراد المؤجل ({schedules.length})
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>البيان</th>
              <th style={S.th}>إجمالي المبلغ</th>
              <th style={S.th}>المبلغ الشهري</th>
              <th style={S.th}>من</th>
              <th style={S.th}>إلى</th>
              <th style={S.th}>آخر ترحيل</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                لا توجد جداول إيراد مؤجل
              </td></tr>
            )}
            {schedules.map(s => (
              <tr key={s.id}>
                <td style={{ ...S.td, fontWeight: '700' }}>{s.description}</td>
                <td style={{ ...S.td, direction: 'ltr', fontWeight: '800', color: '#3b82f6' }}>{sar(s.total_amount)} ر.س</td>
                <td style={{ ...S.td, direction: 'ltr', color: '#10b981', fontWeight: '700' }}>{sar(s.monthly_amount)} ر.س</td>
                <td style={S.td}>{s.start_date}</td>
                <td style={S.td}>{s.end_date}</td>
                <td style={{ ...S.td, fontSize: '11px', color: s.last_posted_date ? '#10b981' : '#94a3b8' }}>
                  {s.last_posted_date || 'لم يُرحّل بعد'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DeferredRevenueTab;
