import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Search, Truck, Phone, Mail, MapPin, Building2,
  X, Save, Edit3, Trash2, Hash, FileText, DollarSign, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';

const BLANK = { 
  name: '', contact_person: '', phone: '', email: '', tax_id: '', address: '',
  id_type: 'CRN', id_value: '',
  // National Address
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

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');

  // Statement & Payment State
  const [statementSupplier, setStatementSupplier] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await window.api.getSuppliers();
      setSuppliers(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search)) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(BLANK);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ 
      name: s.name, 
      contact_person: s.contact_person || '', 
      phone: s.phone || '', 
      email: s.email || '', 
      tax_id: s.tax_id || '', 
      address: s.address || '',
      id_type: s.id_type || 'CRN',
      id_value: s.id_value || '',
      na_short: s.na_short || '',
      na_building: s.na_building || '',
      na_street: s.na_street || '',
      na_secondary: s.na_secondary || '',
      na_district: s.na_district || '',
      na_postal: s.na_postal || '',
      na_city: s.na_city || '',
      na_country: s.na_country || 'المملكة العربية السعودية',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('اسم المورد مطلوب');
    try {
      if (editingId) {
        await window.api.updateSupplier({ ...form, id: editingId });
      } else {
        await window.api.addSupplier(form);
      }
      setShowModal(false);
      setEditingId(null);
      setForm(BLANK);
      fetchSuppliers();
    } catch (err) {
      setFormError('حدث خطأ أثناء الحفظ (ربما الاسم مكرر)');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
    try {
      await window.api.deleteSupplier(id);
      fetchSuppliers();
    } catch (e) { alert('فشل الحذف'); }
  };

  const openStatement = async (s) => {
    setStatementSupplier(s);
    setLoadingStatement(true);
    setPaymentAmount('');
    setPaymentNote('');
    try {
      const data = await window.api.getSupplierStatement(s.id);
      setStatementData(data);
    } catch (e) {
      console.error(e);
      alert('فشل تحميل كشف الحساب');
    }
    setLoadingStatement(false);
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) return alert('أدخل مبلغ صحيح');
    try {
      await window.api.recordSupplierPayment({
        supplier_id: statementSupplier.id,
        amount: parseFloat(paymentAmount),
        note: paymentNote || 'دفعة سداد المورد'
      });
      // Refresh statement
      openStatement(statementSupplier);
    } catch (e) {
      alert('فشل تسجيل الدفعة');
    }
  };

  return (
    <AppLayout title="إدارة الموردين">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>

        {/* HEADER / CONTROLS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-card)', padding:'16px 20px', borderRadius:'16px', border:'1px solid #f1f5f9', gap:'16px' }}>
          <div style={{ position:'relative', flex:1, maxWidth:'400px' }}>
            <Search size={18} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم المورد أو رقم التواصل..."
              style={{ width:'100%', padding:'11px 44px 11px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit' }}
            />
          </div>
          <button onClick={openAdd} style={primaryBtnStyle}>
            <Truck size={18} /> إضافة مورد جديد
          </button>
        </div>

        {/* SUPPLIER GRID */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}>جاري التحميل...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="hover-lift" style={{ background:'var(--bg-card)', border:'1px dotted #cbd5e1', textAlign:'center', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'50px', marginBottom:'16px', opacity:.3 }}>🚚</div>
            <p style={{ fontWeight:'700' }}>لا يوجد موردون حالياً</p>
            <p style={{ fontSize:'13px', marginTop:'4px' }}>قم بإضافة الموردين لتتمكن من إدارة المشتريات والمخزون بفعالية</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', overflowY:'auto', flex:1, minHeight:0 }}>
            {filteredSuppliers.map(s => (
              <div key={s.id} className="hover-lift" style={{ background:'var(--bg-card)', border:'1px solid #f1f5f9', padding:'20px', display:'flex', flexDirection:'column', gap:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', transition:'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <div style={{ width:'44px', height:'44px', background:'#f0f9ff', color:'#0ea5e9', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #e0f2fe' }}>
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight:'800', fontSize:'16px', color:'var(--text-main)' }}>{s.name}</h4>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:'600' }}>{s.contact_person || 'بدون جهة اتصال'}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'4px' }}>
                    <button onClick={() => openStatement(s)} style={iconBtn('#10b981','#ecfdf5')} title="كشف حساب وسداد"><FileText size={15} /></button>
                    <button onClick={() => openEdit(s)} style={iconBtn('#3b82f6','#eff6ff')} title="تعديل"><Edit3 size={15} /></button>
                    <button onClick={() => handleDelete(s.id)} style={iconBtn('#ef4444','#fef2f2')} title="حذف"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div style={{ borderTop:'1px dashed #f1f5f9', paddingTop:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  <InfoItem icon={<Phone size={13} />} text={s.phone} label="الهاتف" />
                  <InfoItem icon={<Mail size={13} />} text={s.email} label="البريد" />
                  <InfoItem icon={<Hash size={13} />} text={s.tax_id} label="الرقم الضريبي" />
                  <InfoItem icon={<MapPin size={13} />} text={s.address} label="العنوان" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'560px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0 }}>{editingId ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', overflow:'hidden', flex: 1 }}>
              <div style={{ padding:'24px 32px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap:'16px' }}>
                {formError && (
                  <div style={{ padding:'12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', color:'#dc2626', fontSize:'13px', fontWeight:'700' }}>
                    ⚠️ {formError}
                  </div>
                )}
                <FField label="اسم المورد / الشركة *" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="مثال: شركة التوريد الحديثة" required />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <FField label="اسم الشخص المسؤول" value={form.contact_person} onChange={v => setForm({...form, contact_person: v})} placeholder="محمد العلي" />
                  <FField label="رقم الهاتف" value={form.phone} onChange={v => setForm({...form, phone: v})} placeholder="05XXXXXXXX" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <FField label="البريد الإلكتروني" type="email" value={form.email} onChange={v => setForm({...form, email: v})} placeholder="vendor@email.com" />
                  <FField label="الرقم الضريبي (VAT)" value={form.tax_id} onChange={v => setForm({...form, tax_id: v})} placeholder="رقم تسجيل الضريبة" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div>
                    <label style={fLabel}>معرف آخر</label>
                    <select value={form.id_type} onChange={e => setForm({...form, id_type: e.target.value})} style={fInput}>
                      {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <FField label="رقم المعرف" value={form.id_value} onChange={v => setForm({...form, id_value: v})} placeholder="رقم المعرف..." />
                </div>
                <div>
                  <label style={fLabel}>العنوان الكامل</label>
                  <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    style={{ ...fInput, minHeight:'70px', resize:'vertical' }} placeholder="الرياض، الصناعية الجديدة..." />
                </div>
                {/* National Address section */}
                <div style={{ borderTop:'1px dashed #e2e8f0', paddingTop:'16px', marginTop:'4px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'800', color:'#3b82f6', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                    📍 العنوان الوطني (اختياري — يظهر على أوامر الشراء)
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <FField label="العنوان المختصر" value={form.na_short} onChange={v => setForm({...form, na_short: v})} placeholder="TTPA8255" />
                    <FField label="رقم المبنى" value={form.na_building} onChange={v => setForm({...form, na_building: v})} placeholder="8255" />
                    <FField label="اسم الشارع" value={form.na_street} onChange={v => setForm({...form, na_street: v})} placeholder="الحارث بن عمير" />
                    <FField label="الرقم الفرعي" value={form.na_secondary} onChange={v => setForm({...form, na_secondary: v})} placeholder="2660" />
                    <FField label="الحي" value={form.na_district} onChange={v => setForm({...form, na_district: v})} placeholder="حي الحمراء" />
                    <FField label="الرمز البريدي" value={form.na_postal} onChange={v => setForm({...form, na_postal: v})} placeholder="29763" />
                    <FField label="المدينة" value={form.na_city} onChange={v => setForm({...form, na_city: v})} placeholder="الرياض" />
                    <FField label="الدولة" value={form.na_country} onChange={v => setForm({...form, na_country: v})} placeholder="المملكة العربية السعودية" />
                  </div>
                </div>
              </div>
              
              <div style={{ padding:'16px 32px', borderTop:'1px solid #f1f5f9', background:'var(--bg-card)', flexShrink: 0 }}>
                <button type="submit" style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Save size={17} /> {editingId ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATEMENT MODAL */}
      {statementSupplier && (
        <div style={overlayStyle}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', maxWidth:'700px', width:'95%', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }} dir="rtl">
            <div style={{ padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontWeight:'900', fontSize:'20px', margin:0 }}>كشف حساب المورد: {statementSupplier.name}</h2>
                {statementData && (
                  <div style={{ fontSize:'14px', color: statementData.balance > 0 ? '#ef4444' : '#10b981', fontWeight:'800', marginTop:'4px' }}>
                    المطلوب سداده: SAR {Math.max(0, statementData.balance).toFixed(2)}
                  </div>
                )}
              </div>
              <button onClick={() => setStatementSupplier(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>
            
            <div style={{ padding:'24px 32px', overflowY:'auto', flex: 1, display:'flex', flexDirection:'column', gap:'16px' }}>
              {loadingStatement ? (
                <div style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>جاري التحميل...</div>
              ) : statementData ? (
                <>
                  {/* Timeline */}
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', textAlign:'right' }}>
                    <thead style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding:'10px', fontWeight:'800', color:'var(--text-muted)' }}>التاريخ</th>
                        <th style={{ padding:'10px', fontWeight:'800', color:'var(--text-muted)' }}>النوع</th>
                        <th style={{ padding:'10px', fontWeight:'800', color:'var(--text-muted)' }}>البيان</th>
                        <th style={{ padding:'10px', fontWeight:'800', color:'var(--text-muted)' }}>المبلغ</th>
                        <th style={{ padding:'10px', fontWeight:'800', color:'var(--text-muted)' }}>الرصيد التراكمي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.timeline.length === 0 && (
                         <tr><td colSpan="5" style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)' }}>لا توجد حركات مسجلة</td></tr>
                      )}
                      {statementData.timeline.map((t, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={{ padding:'12px 10px', color:'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('ar-SA')}</td>
                          <td style={{ padding:'12px 10px' }}>
                            <span style={{ 
                              padding:'4px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'800',
                              background: t.type === 'invoice' ? '#fee2e2' : '#dcfce7',
                              color: t.type === 'invoice' ? '#ef4444' : '#10b981',
                              display:'inline-flex', alignItems:'center', gap:'4px'
                            }}>
                              {t.type === 'invoice' ? <ArrowUpRight size={12}/> : <ArrowDownLeft size={12}/>}
                              {t.type === 'invoice' ? 'فاتورة مشتريات' : 'دفعة سداد'}
                            </span>
                          </td>
                          <td style={{ padding:'12px 10px', fontWeight:'700' }}>
                            {t.type === 'invoice' ? `فاتورة #${t.id}` : t.note || 'سداد'}
                          </td>
                          <td style={{ padding:'12px 10px', fontWeight:'800', fontFamily:"'Inter', sans-serif" }}>
                            SAR {parseFloat(t.amount || t.total_amount).toFixed(2)}
                          </td>
                          <td style={{ padding:'12px 10px', fontWeight:'800', fontFamily:"'Inter', sans-serif" }}>
                            SAR {t.running_balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Payment Box */}
                  <div style={{ marginTop:'20px', background:'#f8fafc', padding:'20px', borderRadius:'16px', border:'1px solid #e2e8f0' }}>
                    <h3 style={{ fontWeight:'800', fontSize:'15px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <DollarSign size={16} color="#10b981" /> تسجيل دفعة جديدة
                    </h3>
                    <div style={{ display:'flex', gap:'12px', alignItems:'flex-end' }}>
                      <div style={{ flex:1 }}>
                        <label style={fLabel}>المبلغ المدفوع (SAR)</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={{ ...fInput, padding:'12px' }} placeholder="0.00" />
                      </div>
                      <div style={{ flex:2 }}>
                        <label style={fLabel}>ملاحظات (طريقة الدفع / المرجع)</label>
                        <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} style={{ ...fInput, padding:'12px' }} placeholder="رقم الحوالة..." />
                      </div>
                      <button onClick={handleRecordPayment} style={{ ...primaryBtnStyle, background:'#10b981', padding:'12px 20px', height:'43px' }}>
                        تسجيل
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function InfoItem({ icon, text, label }) {
  if (!text) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}>
      <span style={{ color:'var(--text-muted)' }}>{icon}</span>
      <span style={{ color:'var(--text-muted)', fontSize:'11px', fontWeight:'600', minWidth:'80px' }}>{label}:</span>
      <span style={{ color:'var(--text-main)', fontWeight:'700' }}>{text}</span>
    </div>
  );
}

function FField({ label, value, onChange, type='text', placeholder='', required=false }) {
  return (
    <div>
      <label style={fLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} style={fInput} />
    </div>
  );
}

const primaryBtnStyle = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'11px 22px', borderRadius:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit' };
const overlayStyle = { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const iconBtn = (color, bg) => ({ padding:'8px', background: bg, border:'none', color, borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' });
const fLabel = { display:'block', fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', marginBottom:'6px' };
const fInput = { width:'100%', padding:'16px 20px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', outline:'none', fontFamily:'inherit', background:'var(--bg-card)', boxSizing:'border-box' };
