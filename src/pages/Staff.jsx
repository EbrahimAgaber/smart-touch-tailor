import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useLicenseStore } from '../store/useLicenseStore';
import { UserPlus, Key, Trash2, Edit, Save, X, CheckCircle2, AlertTriangle, Printer, Search } from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'pos',       name: 'نقطة البيع' },
  { id: 'reports',   name: 'التقارير' },
  { id: 'stock',     name: 'المخزون' },
  { id: 'accounts',  name: 'المحاسبة' },
  { id: 'settings',  name: 'الإعدادات' },
  { id: 'customers', name: 'العملاء' },
];

const BLANK = { name: '', pin: '', confirmPin: '', role: 'Cashier', permissions: [], piece_rate: 0 };

export default function Staff() {
  const staffLimit = useLicenseStore(s => s.staffLimit());
  const tierName = useLicenseStore(s => s.tierName);
  const tierNameAr = useLicenseStore(s => s.tierNameAr(tierName));

  const [activeTab, setActiveTab] = useState('staff');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  // Payroll specific states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); return d.toISOString().split('T')[0];
  });
  const [payrollData, setPayrollData] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStaff(); }, []);

  useEffect(() => {
    if (activeTab === 'payroll') {
      fetchPayroll();
    }
  }, [activeTab]);

  const fetchStaff = async () => {
    setLoading(true);
    try { setStaff(await window.api.getStaff()); } catch (_e) { /* silent fail */ }
    setLoading(false);
  };

  const fetchPayroll = async () => {
    setPayrollLoading(true);
    try {
      const payrollFn = window.api?.tailor?.getPayroll || window.api?.getPayroll;
      const cutterFn = window.api?.tailor?.getCutterPayroll || window.api?.getCutterPayroll;
      
      const [tailors, cutters] = await Promise.all([
        payrollFn ? payrollFn({ start_date: startDate, end_date: endDate }) : Promise.resolve([]),
        cutterFn ? cutterFn({ start_date: startDate, end_date: endDate }) : Promise.resolve([])
      ]);

      const merged = [
        ...(tailors || []).map(t => ({ ...t, role_label: 'خياط' })),
        ...(cutters || []).map(c => ({ ...c, tailor_name: c.cutter_name || c.name, role_label: 'فصال / قصاص' }))
      ];
      setPayrollData(merged);
    } catch (err) {
      console.error(err);
    }
    setPayrollLoading(false);
  };

  const openAdd = () => {
    if (staff.length >= staffLimit) {
      alert(`⚠️ لقد وصلت إلى الحد الأقصى للموظفين المسموح به في باقتك الحالية (${tierNameAr}) (الحد الأقصى: ${staffLimit === Infinity ? 'بلا حدود' : staffLimit} موظفين). يرجى الترقية لإضافة المزيد من الموظفين.`);
      return;
    }
    setEditingId(null); setForm({ ...BLANK, cutter_piece_rate: 0 }); setError(''); setShowModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name, pin: '', confirmPin: '', role: s.role,
      permissions: JSON.parse(s.permissions_json || '[]'),
      piece_rate: s.piece_rate || 0,
      cutter_piece_rate: s.cutter_piece_rate || 0
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('يرجى إدخال اسم الموظف');

    if (!editingId) {
      if (form.pin.length < 6) return setError('يجب أن يكون رمز الدخول 6 أرقام على الأقل');
      if (form.pin !== form.confirmPin) return setError('رمز الدخول وتأكيده غير متطابقَين');
    } else {
      if (form.pin && form.pin !== form.confirmPin) return setError('رمز الدخول وتأكيده غير متطابقَين');
      if (form.pin && form.pin.length < 6) return setError('يجب أن يكون رمز الدخول 6 أرقام على الأقل');
    }

    try {
      const payload = {
        name: form.name,
        role: form.role,
        permissions: form.permissions,
        piece_rate: parseFloat(form.piece_rate) || 0,
        cutter_piece_rate: parseFloat(form.cutter_piece_rate) || 0
      };

      if (editingId) {
        const res = await window.api.updateStaff({ id: editingId, pin: form.pin || undefined, ...payload });
        if (res && res.success === false) throw new Error(res.error || 'فشل التحديث');
        setSuccess('تم تعديل بيانات الموظف');
      } else {
        const res = await window.api.addStaff({ pin: form.pin, ...payload });
        if (res && res.success === false) throw new Error(res.error || 'فشل الإضافة');
        setSuccess('تم إضافة الموظف بنجاح');
      }
      setShowModal(false);
      fetchStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('UNIQUE')) setError('رمز الدخول مستخدم بالفعل لموظف آخر');
      else if (msg.includes('STAFF_LIMIT_REACHED')) setError('لقد وصلت للحد الأقصى لعدد الموظفين في باقتك الحالية');
      else setError('حدث خطأ: ' + msg);
    }
  };

  const handleDelete = async (id) => {
    await window.api.deleteStaff(id);
    setDelConfirm(null);
    fetchStaff();
  };

  const togglePerm = (id) => {
    const p = form.permissions;
    setForm({ ...form, permissions: p.includes(id) ? p.filter(x => x !== id) : [...p, id] });
  };

  const handlePrintSettlement = (tailor) => {
    const printContent = `
      <html dir="rtl">
        <head>
          <title>مسير رواتب - ${tailor.tailor_name || tailor.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            h2 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .info { margin-top: 20px; font-size: 18px; line-height: 1.8; }
            .total { margin-top: 30px; font-size: 22px; font-weight: bold; border-top: 2px dashed #ccc; padding-top: 20px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h2>مسير رواتب الخياط</h2>
          <div class="info">
            <p><strong>اسم الخياط:</strong> ${tailor.tailor_name || tailor.name}</p>
            <p><strong>الفترة:</strong> من ${startDate} إلى ${endDate}</p>
            <p><strong>عدد القطع المنجزة:</strong> ${tailor.pieces_completed || 0}</p>
            <p><strong>العمولة الأساسية:</strong> ${(tailor.base_commission || 0).toFixed(2)} ر.س</p>
            <p><strong>المكافآت:</strong> ${(tailor.bonuses || 0).toFixed(2)} ر.س</p>
          </div>
          <div class="total">
            إجمالي المستحق: ${(tailor.total_payout || 0).toFixed(2)} ر.س
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
    }
  };

  return (
    <AppLayout title="إدارة الموظفين والصلاحيات">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '10px' }}>
          <button 
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'staff' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'transparent',
              color: activeTab === 'staff' ? '#fff' : 'var(--text-muted, #64748b)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
            إدارة الموظفين
          </button>
          <button 
            onClick={() => setActiveTab('payroll')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'payroll' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'transparent',
              color: activeTab === 'payroll' ? '#fff' : 'var(--text-muted, #64748b)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
            رواتب الخياطين
          </button>
        </div>

        {activeTab === 'staff' && (
          <>
            {success && (
              <div style={{ padding:'14px 20px', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:'12px', color:'#065f46', fontWeight:'700', display:'flex', alignItems:'center', gap:'10px' }}>
                <CheckCircle2 size={18} /> {success}
              </div>
            )}

            {/* Actions Bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-card)', padding:'20px 24px', borderRadius:'20px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div>
                <div style={{ fontWeight:'800', fontSize:'16px', color:'var(--text-main)' }}>فريق العمل</div>
                <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'2px' }}>إدارة حسابات الدخول وصلاحيات كل موظف</div>
              </div>
              <button onClick={openAdd} style={primaryBtnStyle}>
                <UserPlus size={18} /> إضافة موظف جديد
              </button>
            </div>

            {staff.length >= staffLimit && (
              <div style={{ padding:'16px 20px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'16px', color:'#92400e', fontWeight:'700', fontSize:'14px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.02)' }}>
                <AlertTriangle size={20} color="#d97706" style={{ flexShrink:0 }} />
                <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'12px', justifyContent:'space-between', width:'100%' }}>
                  <span>لقد وصلت إلى الحد الأقصى للموظفين المسموح به في باقة {tierNameAr} (الحد الأقصى: {staffLimit === Infinity ? 'بلا حدود' : staffLimit} موظف).</span>
                  <button onClick={() => window.api?.openExternal?.('https://wa.me/966533174895')} style={{ padding:'6px 14px', background:'#d97706', border:'none', borderRadius:'8px', color:'white', fontWeight:'800', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>🔗 ترقية الاشتراك الآن</button>
                </div>
              </div>
            )}

            {/* Staff Cards Grid */}
            {loading ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}>جاري التحميل...</div>
            ) : staff.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px', color:'var(--text-muted)', background:'var(--bg-card)', borderRadius:'20px', border:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:'48px', marginBottom:'16px', opacity:.4 }}>🛡️</div>
                <div style={{ fontWeight:'700', marginBottom:'8px' }}>لا يوجد موظفون حتى الآن</div>
                <div style={{ fontSize:'13px' }}>ابدأ بإضافة أول موظف</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', overflowY:'auto', flex:1, minHeight:0 }}>
                {staff.map(s => {
                  const perms = JSON.parse(s.permissions_json || '[]');
                  return (
                    <div key={s.id} className="hover-lift" style={{ background:'var(--bg-card)', padding:'24px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', position:'relative', overflow:'hidden', borderRadius: '16px' }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:'4px', background: String(s.role || '').toLowerCase() === 'admin' ? 'linear-gradient(90deg,#8b5cf6,#7c3aed)' : 'linear-gradient(90deg,#3b82f6,#2563eb)' }} />

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                          <div style={{ width:'48px', height:'48px', borderRadius:'14px', background: String(s.role || '').toLowerCase() === 'admin' ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'linear-gradient(135deg,#3b82f6,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'22px' }}>
                            {String(s.role || '').toLowerCase() === 'admin' ? '👑' : String(s.role || '').toLowerCase() === 'tailor' ? '✂️' : String(s.role || '').toLowerCase() === 'cutter' ? '📏' : '👤'}
                          </div>
                          <div>
                            <div style={{ fontWeight:'800', fontSize:'16px', color:'var(--text-main)' }}>{s.name}</div>
                            <div style={{ fontSize:'11px', fontWeight:'700', color: String(s.role || '').toLowerCase() === 'admin' ? '#8b5cf6' : '#3b82f6', background: String(s.role || '').toLowerCase() === 'admin' ? '#f5f3ff' : '#eff6ff', padding:'2px 8px', borderRadius:'99px', display:'inline-block', marginTop:'4px' }}>
                              {String(s.role || '').toLowerCase() === 'admin' ? 'مدير نظام' : String(s.role || '').toLowerCase() === 'tailor' ? 'خياط' : String(s.role || '').toLowerCase() === 'cutter' ? 'فصال' : String(s.role || '').toLowerCase() === 'cashier' ? 'كاشير' : s.role}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'14px', marginBottom:'16px' }}>
                        <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:'700', marginBottom:'8px' }}>الصلاحيات النشطة</div>
                        {perms.length === 0 ? (
                          <div style={{ fontSize:'12px', color:'#cbd5e1' }}>لا توجد صلاحيات محددة</div>
                        ) : (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                            {perms.map(p => (
                              <span key={p} style={{ background:'#eff6ff', color:'#3b82f6', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'99px' }}>
                                {ALL_PERMISSIONS.find(x => x.id === p)?.name || p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={() => openEdit(s)} style={{ flex:1, padding:'10px', background:'#eff6ff', border:'none', color:'#3b82f6', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', fontFamily:'inherit' }}>
                          <Edit size={15} /> تعديل
                        </button>
                        <button onClick={() => setDelConfirm(s.id)} style={{ padding:'10px 14px', background:'#fef2f2', border:'none', color:'#ef4444', borderRadius:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'payroll' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display:'flex', gap: '16px', alignItems: 'center', background:'var(--bg-card)', padding:'20px 24px', borderRadius:'20px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={fGroup}>
                <label style={fLabel}>من تاريخ</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...fInput, padding: '10px 14px' }} />
              </div>
              <div style={fGroup}>
                <label style={fLabel}>إلى تاريخ</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...fInput, padding: '10px 14px' }} />
              </div>
              <button onClick={fetchPayroll} style={{ ...primaryBtnStyle, marginTop: '26px' }}>
                <Search size={18} /> عرض الرواتب
              </button>
            </div>

            {payrollLoading ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}>جاري تحميل الرواتب...</div>
            ) : payrollData.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', background:'var(--bg-card)', borderRadius:'20px', border:'1px solid #f1f5f9' }}>
                لا توجد بيانات للفترة المحددة
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px' }}>
                {payrollData.map((row, idx) => (
                  <div key={idx} style={{ background:'var(--bg-card)', padding:'20px', borderRadius:'16px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>{row.tailor_name || row.name}</h3>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '8px', background: row.role_label === 'خياط' ? '#eff6ff' : '#fef3c7', color: row.role_label === 'خياط' ? '#2563eb' : '#d97706' }}>
                        {row.role_label || 'خياط'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>القطع المنجزة:</span>
                      <span style={{ fontWeight: 'bold' }}>{row.pieces_completed || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>العمولة الأساسية:</span>
                      <span style={{ fontWeight: 'bold' }}>{(row.base_commission || 0).toFixed(2)} ر.س</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>المكافآت:</span>
                      <span style={{ fontWeight: 'bold' }}>{(row.bonuses || 0).toFixed(2)} ر.س</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '16px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>إجمالي المستحق:</span>
                      <span style={{ fontWeight: '900', color: '#10b981', fontSize: '18px' }}>{(row.total_payout || 0).toFixed(2)} ر.س</span>
                    </div>

                    <button onClick={() => handlePrintSettlement(row)} style={{ width: '100%', padding: '10px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
                      <Printer size={16} /> طباعة مسير الراتب
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {delConfirm && (
        <div style={overlayStyle}>
          <div className="hover-lift" style={{ background:'var(--bg-card)', padding:'36px', maxWidth:'400px', width:'90%', textAlign:'center', borderRadius: '24px' }} dir="rtl">
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚠️</div>
            <h3 style={{ fontWeight:'800', marginBottom:'8px' }}>تأكيد الحذف</h3>
            <p style={{ color:'var(--text-muted)', marginBottom:'24px' }}>هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
              <button onClick={() => setDelConfirm(null)} style={{ padding:'12px 24px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>إلغاء</button>
              <button onClick={() => handleDelete(delConfirm)} style={{ padding:'12px 24px', background:'#ef4444', color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit' }}>نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={{ background:'var(--bg-card)', borderRadius:'24px', padding:'32px', maxWidth:'600px', width:'95%', maxHeight:'90vh', overflowY:'auto' }} dir="rtl">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'28px' }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px' }}>{editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={22} /></button>
            </div>

            {error && (
              <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'12px', color:'#dc2626', fontWeight:'700', fontSize:'13px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'8px' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
                <Field label="اسم الموظف *" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="مثال: محمد العمري" />
                <div style={fGroup}>
                  <label style={fLabel}>الدور الوظيفي</label>
                  <input 
                    list="roles-list"
                    value={form.role} 
                    onChange={e => setForm({...form, role: e.target.value})} 
                    style={fInput}
                    placeholder="اختر أو اكتب دور جديد (مثل: مطرز, كاوي)..."
                  />
                  <datalist id="roles-list">
                    <option value="Cashier">كاشير</option>
                    <option value="Admin">مدير نظام</option>
                    <option value="tailor">خياط</option>
                    <option value="cutter">فصال / قصاص</option>
                    <option value="مطرز">مطرز</option>
                    <option value="كاوي">كاوي</option>
                  </datalist>
                </div>
                <Field label={editingId ? 'رمز الدخول الجديد (اتركه فارغاً للإبقاء)' : 'رمز الدخول (PIN) *'} type="password" value={form.pin} onChange={v => setForm({...form, pin: v})} placeholder="••••" maxLength={6} />
                <Field label="تأكيد رمز الدخول *" type="password" value={form.confirmPin} onChange={v => setForm({...form, confirmPin: v})} placeholder="••••" maxLength={6} />
                <Field label="عمولة الخياطة لكل قطعة (Piece Rate)" type="number" value={form.piece_rate} onChange={v => setForm({...form, piece_rate: v})} placeholder="0" />
                <Field label="عمولة التفصيل / القص (Cutter Rate)" type="number" value={form.cutter_piece_rate} onChange={v => setForm({...form, cutter_piece_rate: v})} placeholder="0" />
              </div>

              <div style={{ marginBottom:'24px' }}>
                <label style={{ ...fLabel, display:'block', marginBottom:'12px' }}>الصلاحيات الممنوحة</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px' }}>
                  {ALL_PERMISSIONS.map(p => (
                    <button type="button" key={p.id} onClick={() => togglePerm(p.id)}
                      style={{ padding:'12px', borderRadius:'12px', border: form.permissions.includes(p.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: form.permissions.includes(p.id) ? '#eff6ff' : 'white', color: form.permissions.includes(p.id) ? '#1d4ed8' : '#64748b', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s' }}>
                      {p.name}
                      {form.permissions.includes(p.id) && <CheckCircle2 size={16} color="#3b82f6" />}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', fontSize:'15px', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                <Save size={17} style={{ display:'inline', marginLeft:'8px' }} />
                {editingId ? 'حفظ التعديلات' : 'إضافة الموظف'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Field({ label, value, onChange, type='text', placeholder='', maxLength }) {
  return (
    <div style={fGroup}>
      <label style={fLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        maxLength={maxLength} style={fInput} />
    </div>
  );
}

const primaryBtnStyle = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'12px 24px', borderRadius:'14px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(37,99,235,0.2)' };
const overlayStyle = { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const fGroup = { display:'flex', flexDirection:'column', gap:'8px' };
const fLabel = { fontSize:'13px', fontWeight:'700', color:'var(--text-muted)' };
const fInput = { padding:'16px 20px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', outline:'none', fontFamily:'inherit', background:'var(--bg-card)' };
