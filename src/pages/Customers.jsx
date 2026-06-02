import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Search, UserPlus, Phone, Mail, MapPin, Award,
  X, Save, Edit3, ChevronDown, ChevronUp, ShoppingBag, Star
} from 'lucide-react';

const BLANK = { 
  name: '', phone: '', email: '', address: '', tax_id: '',
  id_type: 'CRN', id_value: '',
  na_short: '', na_building: '', na_street: '', na_secondary: '',
  na_district: '', na_postal: '', na_city: '', na_country: 'المملكة العربية السعودية'
};

const ID_TYPES = [
  { value: 'CRN', label: 'السجل التجاري (CRN)' },
  { value: 'PAS', label: 'رقم الجواز (PAS)' },
  { value: 'MOM', label: 'رخصة البلدية (MOM)' },
  { value: 'MLS', label: 'رخصة العمل (MLS)' },
  { value: 'SAG', label: 'رخصة الاستثمار (SAG)' },
  { value: 'GCC', label: 'هوية مجلس التعاون (GCC)' },
  { value: 'OTH', label: 'أخرى (OTH)' },
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  useEffect(() => { fetchCustomers(); }, [search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await window.api.getCustomers({ search });
      setCustomers(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(BLANK);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ 
      name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', tax_id: c.tax_id || '',
      id_type: c.id_type || 'CRN', id_value: c.id_value || '',
      na_short: c.na_short || '', na_building: c.na_building || '', na_street: c.na_street || '', 
      na_secondary: c.na_secondary || '', na_district: c.na_district || '', na_postal: c.na_postal || '', 
      na_city: c.na_city || '', na_country: c.na_country || 'المملكة العربية السعودية'
    });
    setFormError('');
    setShowModal(true);
  };

  const openHistory = async (c) => {
    setHistoryCustomer(c);
    setHistoryLoading(true);
    try {
      const data = await window.api.getCustomerHistory(c.id);
      setHistory(data || []);
    } catch (e) { setHistory([]); }
    setHistoryLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('اسم العميل مطلوب');
    try {
      if (editingId) {
        await window.api.updateCustomer({ ...form, id: editingId });
      } else {
        await window.api.addCustomer(form);
      }
      setShowModal(false);
      setEditingId(null);
      setForm(BLANK);
      fetchCustomers();
    } catch (err) {
      setFormError('حدث خطأ أثناء الحفظ: ' + (err.message || ''));
    }
  };

  const tierColor = (tier) => {
    if (tier === 'gold')   return { bg: '#fef3c7', color: '#d97706', label: '🥇 ذهبي' };
    if (tier === 'silver') return { bg: '#f1f5f9', color: '#64748b', label: '🥈 فضي' };
    return                        { bg: '#fef9f0', color: '#b45309', label: '🥉 برونزي' };
  };

  const totalPoints = customers.reduce((s, c) => s + (c.loyalty_points || 0), 0);
  const totalSpent  = customers.reduce((s, c) => s + (c.total_spent   || 0), 0);

  return (
    <AppLayout title="مركز العملاء (CRM)">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { label:'إجمالي العملاء',     value: customers.length,             color:'#3b82f6', icon:'👥' },
            { label:'نقاط الولاء الكلية', value: totalPoints.toLocaleString(), color:'#8b5cf6', icon:'⭐' },
            { label:'إجمالي المشتريات',   value:`SAR ${totalSpent.toFixed(0)}`,color:'#10b981', icon:'🛍️' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', padding:'20px', borderRadius:'20px', border:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:'32px' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:'12px', color:'#94a3b8', fontWeight:'700' }}>{s.label}</div>
                <div style={{ fontSize:'22px', fontWeight:'900', color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-subtle gap-4 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search size={18} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الجوال أو البريد..."
              style={{ width:'100%', padding:'11px 44px 11px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit' }}
            />
          </div>
          <button onClick={openAdd} style={primaryBtnStyle}>
            <UserPlus size={18} /> إضافة عميل جديد
          </button>
        </div>

        {/* CUSTOMER TABLE */}
        <div style={{ background:'white', borderRadius:'20px', border:'1px solid #f1f5f9', overflowY:'auto', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', flex:1, minHeight:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
            <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
              <tr>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }}>العميل</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }}>الجوال</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }} className="max-md:hidden">نقاط الولاء</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }} className="max-lg:hidden">المستوى</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }} className="max-md:hidden">إجمالي الإنفاق</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }} className="max-xl:hidden">تاريخ التسجيل</th>
                <th style={{ padding:'14px 18px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>جاري التحميل...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.4 }}>👥</div>
                  لا يوجد عملاء{search ? ' مطابقون للبحث' : ' حتى الآن'}
                </td></tr>
              ) : customers.map(c => {
                const tier = tierColor(c.tier);
                return (
                  <tr key={c.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'#3b82f6', fontSize:'16px', border:'2px solid #dbeafe', flexShrink:0 }}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight:'700', color:'#0f172a' }}>{c.name}</div>
                          {c.email && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        {c.phone || <span style={{ color:'#cbd5e1' }}>—</span>}
                        {c.phone && (
                          <button onClick={() => window.api?.openExternal?.(`https://wa.me/${c.phone.replace(/\D/g,'')}`)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#10b981', display:'flex', alignItems:'center', padding:'2px' }} title="مراسلة عبر واتساب">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle} className="max-md:hidden">
                      <span style={{ display:'flex', alignItems:'center', gap:'5px', fontWeight:'700', color:'#8b5cf6' }}>
                        <Star size={14} /> {c.loyalty_points || 0}
                      </span>
                    </td>
                    <td style={tdStyle} className="max-lg:hidden">
                      <span style={{ background: tier.bg, color: tier.color, padding:'4px 10px', borderRadius:'99px', fontSize:'11px', fontWeight:'700' }}>{tier.label}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight:'700', color:'#10b981' }} className="max-md:hidden">SAR {(c.total_spent || 0).toFixed(0)}</td>
                    <td style={{ ...tdStyle, color:'#94a3b8', fontSize:'12px' }} className="max-xl:hidden">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => openHistory(c)} style={iconBtn('#3b82f6','#eff6ff')} title="سجل الشراء">
                          <ShoppingBag size={15} />
                        </button>
                        <button onClick={() => openEdit(c)} style={iconBtn('#f59e0b','#fef3c7')} title="تعديل">
                          <Edit3 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ─────────────────────── */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ background:'white', borderRadius:'24px', maxWidth:'560px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0 }}>{editingId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', overflow:'hidden', flex: 1 }}>
              <div style={{ padding:'24px 32px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap:'16px' }}>
                {formError && (
                  <div style={{ padding:'12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', color:'#dc2626', fontSize:'13px', fontWeight:'700' }}>
                    ⚠️ {formError}
                  </div>
                )}
                <CField label="اسم العميل *" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="مثال: سلطان الزهراني" required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <CField label="رقم الجوال" value={form.phone} onChange={v => setForm({...form, phone: v})} placeholder="05XXXXXXXX" />
                  <CField label="الرقم الضريبي (B2B)" value={form.tax_id} onChange={v => setForm({...form, tax_id: v})} placeholder="رقم تسجيل الضريبة" />
                </div>
                
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div>
                    <label style={cLabel}>معرف آخر</label>
                    <select value={form.id_type} onChange={e => setForm({...form, id_type: e.target.value})} style={cInput}>
                      {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <CField label="رقم المعرف" value={form.id_value} onChange={v => setForm({...form, id_value: v})} placeholder="رقم المعرف..." />
                </div>
                
                <CField label="البريد الإلكتروني" type="email" value={form.email} onChange={v => setForm({...form, email: v})} placeholder="example@email.com" />
                <div>
                  <label style={cLabel}>العنوان الكلاسيكي</label>
                  <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    style={{ ...cInput, minHeight:'70px', resize:'vertical' }} placeholder="المدينة، الحي..." />
                </div>

                {/* National Address section */}
                <div style={{ borderTop:'1px dashed #e2e8f0', paddingTop:'16px', marginTop:'4px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'800', color:'#3b82f6', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    📍 العنوان الوطني (يستخدم للفواتير الضريبية B2B)
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <CField label="العنوان المختصر" value={form.na_short} onChange={v => setForm({...form, na_short: v})} placeholder="مثال: TTPA8255" />
                    <CField label="رقم المبنى" value={form.na_building} onChange={v => setForm({...form, na_building: v})} placeholder="8255" />
                    <CField label="اسم الشارع" value={form.na_street} onChange={v => setForm({...form, na_street: v})} placeholder="الحارث بن عمير" />
                    <CField label="الرقم الفرعي" value={form.na_secondary} onChange={v => setForm({...form, na_secondary: v})} placeholder="2660" />
                    <CField label="الحي" value={form.na_district} onChange={v => setForm({...form, na_district: v})} placeholder="حي الحمراء" />
                    <CField label="الرمز البريدي" value={form.na_postal} onChange={v => setForm({...form, na_postal: v})} placeholder="29763" />
                    <CField label="المدينة" value={form.na_city} onChange={v => setForm({...form, na_city: v})} placeholder="الرياض" />
                    <CField label="الدولة" value={form.na_country} onChange={v => setForm({...form, na_country: v})} placeholder="المملكة العربية السعودية" />
                  </div>
                </div>

              </div>
              <div style={{ padding:'16px 32px', borderTop:'1px solid #f1f5f9', background:'#f8fafc', flexShrink: 0 }}>
                <button type="submit" style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Save size={17} /> {editingId ? 'حفظ التعديلات' : 'إضافة العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PURCHASE HISTORY MODAL ───────────────── */}
      {historyCustomer && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setHistoryCustomer(null)}>
          <div style={{ background:'white', borderRadius:'24px', maxWidth:'620px', width:'95%', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc' }}>
              <div>
                <h3 style={{ fontWeight:'800', fontSize:'18px' }}>سجل مشتريات: {historyCustomer.name}</h3>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>إجمالي الإنفاق: SAR {(historyCustomer.total_spent||0).toFixed(2)} • النقاط: {historyCustomer.loyalty_points}</div>
              </div>
              <button onClick={() => setHistoryCustomer(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={22} /></button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {historyLoading ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>جاري التحميل...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.4 }}>🛒</div>
                  لا توجد مشتريات مسجلة لهذا العميل
                </div>
              ) : history.map((sale, i) => (
                <div key={i} style={{ border:'1px solid #f1f5f9', borderRadius:'14px', marginBottom:'12px', overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                    onClick={() => setExpandedCard(expandedCard === i ? null : i)}>
                    <div>
                      <div style={{ fontWeight:'700', fontSize:'14px', color:'#3b82f6', fontFamily:'monospace' }}>#{sale.invoice}</div>
                      <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('ar-SA') : '—'} • {sale.payment}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <span style={{ fontWeight:'800', color:'#10b981' }}>SAR {parseFloat(sale.total||0).toFixed(2)}</span>
                      <span style={{ background: sale.status==='void' ? '#fef2f2' : '#ecfdf5', color: sale.status==='void' ? '#ef4444' : '#10b981', padding:'3px 8px', borderRadius:'99px', fontSize:'11px', fontWeight:'700' }}>
                        {sale.status==='void' ? 'ملغى' : 'مكتمل'}
                      </span>
                      {expandedCard === i ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                  </div>
                  {expandedCard === i && (
                    <div style={{ padding:'12px 16px' }}>
                      {(sale.items || []).map((it, j) => (
                        <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed #f1f5f9', fontSize:'13px' }}>
                          <span style={{ color:'#475569' }}>{it.Name} × {it.Qty}</span>
                          <span style={{ fontWeight:'700' }}>SAR {(it.Price * it.Qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function CField({ label, value, onChange, type='text', placeholder='', required=false }) {
  return (
    <div>
      <label style={cLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} style={cInput} />
    </div>
  );
}

const tdStyle = { padding:'14px 18px', fontSize:'13px', color:'#334155' };
const primaryBtnStyle = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'11px 22px', borderRadius:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit' };
const overlayStyle = { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const iconBtn = (color, bg) => ({ padding:'7px', background: bg, border:'none', color, borderRadius:'9px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' });
const cLabel = { display:'block', fontSize:'13px', fontWeight:'700', color:'#64748b', marginBottom:'6px' };
const cInput = { width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', outline:'none', fontFamily:'inherit', background:'#fcfdfe', boxSizing:'border-box' };
