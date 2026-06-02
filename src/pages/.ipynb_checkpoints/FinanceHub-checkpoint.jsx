import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { 
  BarChart3, FileText, Scale, Landmark, List, 
  TrendingUp, TrendingDown, DollarSign,
  Calendar, Printer 
} from 'lucide-react';

export default function FinanceHub() {
  const [activeTab, setActiveTab] = useState('pl');
  const [range, setRange] = useState({ 
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0] 
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    pl: null,
    vat: null,
    ledger: [],
    trialBalance: [],
    accounts: []
  });

  // fetchData depends on activeTab and range — both are in the dep array, so this is correct
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, [activeTab, range]);

  const fetchData = async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      if (activeTab === 'pl') {
        const res = await window.api.getFinancialReport(range);
        setData(prev => ({ ...prev, pl: res }));
      } else if (activeTab === 'vat') {
        const res = await window.api.getVATReport(range);
        setData(prev => ({ ...prev, vat: res }));
      } else if (activeTab === 'ledger') {
        const res = await window.api.getGeneralLedger({ startDate: range.startDate, endDate: range.endDate });
        setData(prev => ({ ...prev, ledger: res }));
      } else if (activeTab === 'tb') {
        const res = await window.api.getTrialBalance();
        setData(prev => ({ ...prev, trialBalance: res }));
      } else if (activeTab === 'coa') {
        const res = await window.api.getAccounts();
        setData(prev => ({ ...prev, accounts: res }));
      }
    } catch (e) { console.error('Fetch error:', e); }
    setLoading(false);
  };

  const tabs = [
    { id: 'pl', label: 'قائمة الدخل (P&L)', icon: <BarChart3 size={18}/> },
    { id: 'vat', label: 'تقرير الضريبة', icon: <FileText size={18}/> },
    { id: 'ledger', label: 'دفتر الأستاذ', icon: <List size={18}/> },
    { id: 'tb', label: 'ميزان المراجعة', icon: <Scale size={18}/> },
    { id: 'coa', label: 'دليل الحسابات', icon: <Landmark size={18}/> },
  ];

  return (
    <AppLayout title="المركز المالي والحسابات">
      <div dir="rtl" style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>
        
        {/* Header Controls */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'16px 24px', borderRadius:'20px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                display:'flex', alignItems:'center', gap:'8px', padding:'10px 16px', borderRadius:'12px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'13px', fontFamily:'inherit', transition:'all 0.2s',
                background: activeTab === t.id ? '#eff6ff' : 'transparent',
                color: activeTab === t.id ? '#3b82f6' : '#64748b'
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#f8fafc', padding:'6px 12px', borderRadius:'12px', border:'1px solid #e2e8f0' }}>
              <Calendar size={14} color="#94a3b8"/>
              <input type="date" value={range.startDate} onChange={e => setRange(r=>({...r, startDate:e.target.value}))} style={dateInp} />
              <span style={{ color:'#94a3b8' }}>←</span>
              <input type="date" value={range.endDate} onChange={e => setRange(r=>({...r, endDate:e.target.value}))} style={dateInp} />
            </div>
            <button onClick={() => window.print()} style={{ padding:'10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', cursor:'pointer', color:'#64748b' }}><Printer size={18}/></button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ opacity: loading ? 0.6 : 1, transition:'opacity 0.2s', flex:1, overflowY:'auto', minHeight:0 }}>
          {activeTab === 'pl' && <ProfitLossView data={data.pl} />}
          {activeTab === 'vat' && <VATView data={data.vat} />}
          {activeTab === 'ledger' && <LedgerView data={data.ledger} />}
          {activeTab === 'tb' && <TrialBalanceView data={data.trialBalance} />}
          {activeTab === 'coa' && <AccountsView data={data.accounts} onRefresh={fetchData} />}
        </div>

      </div>
    </AppLayout>
  );
}

function ProfitLossView({ data }) {
  if (!data) return <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>لا توجد بيانات مالية لهذه الفترة</div>;
  const metrics = [
    { label: 'إجمالي المبيعات (شامل الضريبة)', value: data.totalSales, color: '#3b82f6', icon: <DollarSign/> },
    { label: 'تكلفة البضاعة المباعة (COGS)', value: data.cogs, color: '#f59e0b', icon: <TrendingDown/> },
    { label: 'إجمالي الربح (Gross Profit)', value: data.grossProfit, color: '#10b981', icon: <TrendingUp/> },
    { label: 'صافي الربح (Net Income)', value: data.netProfit, color: '#8b5cf6', icon: <TrendingUp/> },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px' }}>
        {metrics.map(m => (
          <div key={m.label} style={kpiCard}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:`${m.color}15`, color:m.color, display:'flex', alignItems:'center', justifyContent:'center' }}>{m.icon}</div>
            </div>
            <div style={{ fontSize:'12px', color:'#94a3b8', fontWeight:'700', marginBottom:'4px' }}>{m.label}</div>
            <div style={{ fontSize:'24px', fontWeight:'900', color:'#0f172a' }}>SAR {(m.value ?? 0).toLocaleString(undefined, { minimumFractionDigits:2 })}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <h3 style={cardTitle}>تفاصيل قائمة الدخل</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <PLRow label="إيرادات المبيعات" val={data.revenue} indent={0} />
          <PLRow label="تكلفة المبيعات" val={-data.cogs} indent={0} color="#ef4444" />
          <div style={{ borderTop:'1px solid #f1f5f9', marginTop:'4px', paddingTop:'8px' }}>
            <PLRow label="إجمالي الربح" val={data.grossProfit} indent={0} bold />
          </div>
          <PLRow label="إجمالي المصروفات التشغيلية" val={-data.expenses} indent={0} color="#ef4444" />
          <div style={{ borderTop:'2px solid #0f172a', marginTop:'8px', paddingTop:'12px' }}>
            <PLRow label="صافي الربح / الخسارة" val={data.netProfit} indent={0} bold size="17px" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VATView({ data }) {
  if (!data) return <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>لا توجد بيانات ضريبية لهذه الفترة</div>;
  return (
    <div style={card}>
      <h3 style={cardTitle}>إقرار ضريبة القيمة المضافة</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px' }}>
        <div>
          <h4 style={subTitle}>المبيعات (مخرجات)</h4>
          <PLRow label="المبيعات الخاضعة للضريبة" val={data.taxableAmount} />
          <PLRow label="ضريبة المخرجات" val={data.vatOutput} bold color="#3b82f6" />
        </div>
        <div>
          <h4 style={subTitle}>المشتريات والمصروفات (مدخلات)</h4>
          <PLRow label="ضريبة المدخلات المستردة" val={data.vatInput} bold color="#10b981" />
        </div>
      </div>
      <div style={{ marginTop:'32px', padding:'24px', background:'#f8fafc', borderRadius:'16px', border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:'14px', color:'#64748b', fontWeight:'700' }}>الضريبة المستحقة / (المستردة) للفترة</div>
          <div style={{ fontSize:'24px', fontWeight:'900', color: (data.netVAT ?? 0) >=0 ? '#0f172a' : '#10b981' }}>SAR {(data.netVAT ?? 0).toLocaleString(undefined, { minimumFractionDigits:2 })}</div>
        </div>
        <div style={{ textAlign:'left' }}>
          <span style={{ padding:'6px 16px', borderRadius:'99px', background: data.netVAT >= 0 ? '#fef2f2' : '#ecfdf5', color: data.netVAT >= 0 ? '#ef4444' : '#10b981', fontSize:'13px', fontWeight:'800' }}>
            {(data.netVAT ?? 0) >= 0 ? 'واجبة السداد' : 'رصيد دائن'}
          </span>
        </div>
      </div>
    </div>
  );
}

function LedgerView({ data }) {
  return (
    <div style={card}>
      <h3 style={cardTitle}>دفتر الأستاذ العام</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
             <th style={th}>التاريخ</th>
             <th style={th}>الحساب</th>
             <th style={th}>البيان</th>
             <th style={th}>مدين (Dr)</th>
             <th style={th}>دائن (Cr)</th>
             <th style={th}>المرجع</th>
          </tr>
        </thead>
        <tbody>
          {data.map((l, i) => (
            <tr key={i} style={tr}>
              <td style={td}>{new Date(l.date).toLocaleString('ar-SA', { dateStyle:'short', timeStyle:'short' })}</td>
              <td style={td}><span style={{ fontWeight:'800', color:'#3b82f6' }}>{l.account_code}</span> - {l.name_ar}</td>
              <td style={td}>{l.description}</td>
              <td style={{ ...td, color:'#10b981', fontWeight:'800' }}>{l.debit > 0 ? l.debit.toFixed(2) : '-'}</td>
              <td style={{ ...td, color:'#ef4444', fontWeight:'800' }}>{l.credit > 0 ? l.credit.toFixed(2) : '-'}</td>
              <td style={{ ...td, fontSize:'11px', color:'#94a3b8' }}>{l.reference}</td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>لا توجد قيود في هذه الفترة</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TrialBalanceView({ data }) {
  const totDr = data.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
  const totCr = data.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
  const balanced = Math.abs(totDr - totCr) < 0.01;

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={cardTitle}>ميزان المراجعة (Trial Balance)</h3>
        <div style={{ padding:'4px 12px', borderRadius:'8px', background: balanced ? '#ecfdf5' : '#fef2f2', color: balanced ? '#10b981' : '#ef4444', fontSize:'12px', fontWeight:'800' }}>
          {balanced ? '✅ متوازن' : '⚠️ غير متوازن'}
        </div>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>كود الحساب</th>
            <th style={th}>اسم الحساب</th>
            <th style={th}>النوع</th>
            <th style={th}>مدين (Dr)</th>
            <th style={th}>دائن (Cr)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a, i) => (
            <tr key={i} style={tr}>
              <td style={td}><span style={{ fontWeight:'800' }}>{a.account_code}</span></td>
              <td style={td}>{a.name_ar}</td>
              <td style={td}>{a.type}</td>
              <td style={td}>{a.balance > 0 ? a.balance.toFixed(2) : '-'}</td>
              <td style={td}>{a.balance < 0 ? Math.abs(a.balance).toFixed(2) : '-'}</td>
            </tr>
          ))}
          <tr style={{ background:'#f8fafc', fontWeight:'900', borderTop:'2px solid #0f172a' }}>
            <td colSpan={3} style={td}>الإجمالي</td>
            <td style={td}>{totDr.toFixed(2)}</td>
            <td style={td}>{totCr.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AccountsView({ data, onRefresh }) {
  const [form, setForm] = useState({ account_name:'', account_type:'Asset' });
  const save = async () => {
    if (!form.account_name) return;
    await window.api.addAccount({ name: form.account_name, type: form.account_type, code: Math.floor(Math.random() * 9000) + 1000 });
    setForm({ account_name:'', account_type:'Asset' });
    onRefresh();
  };

  return (
     <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:'20px' }}>
       <div style={card}>
         <h3 style={cardTitle}>إضافة حساب</h3>
         <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <input value={form.account_name} onChange={e => setForm({...form, account_name:e.target.value})} placeholder="اسم الحساب" className="input" />
            <select value={form.account_type} onChange={e => setForm({...form, account_type:e.target.value})} className="input">
               <option value="Asset">أصول (Asset)</option>
               <option value="Liability">خصوم (Liability)</option>
               <option value="Equity">حقوق ملكية (Equity)</option>
               <option value="Revenue">إيرادات (Revenue)</option>
               <option value="Expense">مصروفات (Expense)</option>
            </select>
            <button onClick={save} className="btn btn-primary" style={{ width:'100%' }}>حفظ الحساب</button>
         </div>
       </div>
       <div style={card}>
         <h3 style={cardTitle}>دليل الحسابات</h3>
         <table style={tableStyle}>
           <thead>
             <tr>
               <th style={th}>الكود</th>
               <th style={th}>الاسم</th>
               <th style={th}>النوع</th>
               <th style={th}>الرصيد الحالي</th>
             </tr>
           </thead>
           <tbody>
             {data.map((a, i) => (
                <tr key={i} style={tr}>
                   <td style={td}>{a.account_code}</td>
                   <td style={td}>{a.name_ar}</td>
                   <td style={td}>{a.type}</td>
                   <td style={{ ...td, fontWeight:'800' }}>SAR {(a.balance ?? 0).toLocaleString()}</td>
                </tr>
             ))}
           </tbody>
         </table>
       </div>
     </div>
  );
}

const PLRow = ({ label, val, indent = 0, bold = false, color = '#0f172a', size = '14px' }) => (
  <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', paddingRight: indent * 20, fontSize: size, fontWeight: bold ? '900' : '600' }}>
    <span style={{ color: bold ? '#0f172a' : '#64748b' }}>{label}</span>
    <span style={{ color }}>{(val ?? 0).toLocaleString(undefined, { minimumFractionDigits:2 })} SAR</span>
  </div>
);

const card = { background:'white', padding:'28px', borderRadius:'24px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' };
const kpiCard = { background:'white', padding:'22px', borderRadius:'24px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' };
const cardTitle = { fontSize:'17px', fontWeight:'900', color:'#0f172a', marginBottom:'24px' };
const subTitle = { fontSize:'14px', fontWeight:'800', color:'#64748b', marginBottom:'16px', borderBottom:'1px solid #f1f5f9', paddingBottom:'8px' };
const dateInp = { background:'transparent', border:'none', outline:'none', fontSize:'12px', fontWeight:'700', color:'#1e293b', fontFamily:'inherit' };
const tableStyle = { width:'100%', borderCollapse:'collapse', textAlign:'right' };
const th = { padding:'12px 16px', fontSize:'11px', color:'#94a3b8', textTransform:'uppercase', borderBottom:'1px solid #f1f5f9' };
const td = { padding:'16px', fontSize:'13px', borderBottom:'1px solid #f8fafc' };
const tr = { transition:'background 0.2s' };
