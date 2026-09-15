import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { Gift, Plus, Trash2, Power, Save, X, Search } from 'lucide-react';

const BLANK = {
  name: '',
  type: 'TOTAL', // 'BOGO' | 'BULK' | 'TOTAL'
  buy_product_id: null,
  buy_qty: 1,
  get_product_id: null,
  get_qty: 1,
  discount_value: 10,
  discount_type: 'pct', // 'pct' | 'fixed'
  min_spend: 0,
  active: 1,
  start_date: '',
  end_date: '',
  apply_mode: 'AUTO' // 'AUTO' | 'MANUAL'
};

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [menu, setMenu] = useState([]);
  const [form, setForm] = useState(null); // null means list view, object means edit/new
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    load();
    window.api.getMenu().then(setMenu).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await window.api.getPromotions();
      setPromos(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name) return alert('يرجى إدخال اسم العرض');
    try {
      await window.api.savePromotion(form);
      setForm(null);
      load();
    } catch (e) {
      alert('خطأ في الحفظ: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await window.api.deletePromotion(id);
      load();
    } catch (e) {
      alert('خطأ في الحذف');
    }
  };

  const toggleStatus = async (promo) => {
    try {
      await window.api.togglePromotion({ id: promo.id, active: !promo.active });
      load();
    } catch (e) {
      alert('خطأ في التحديث');
    }
  };

  const filteredMenu = menu.filter(m => m.Name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <AppLayout title="إدارة العروض والخصومات">
      <div dir="rtl" style={{ display:'flex', flexDirection:'column', gap:'20px', flex:1, minHeight:0 }}>
        
        {/* LIST VIEW */}
        {!form && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>قم بإعداد عروض تلقائية (اشترِ 1 واحصل على 1) أو خصومات على إجمالي الفاتورة.</p>
              <button onClick={() => setForm(BLANK)} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <Plus size={18}/> إضافة عرض جديد
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px' }}>جاري التحميل...</div>
            ) : promos.length === 0 ? (
              <div style={{ background:'var(--bg-card)', padding:'60px', borderRadius:'24px', textAlign:'center', border:'2px dashed #e2e8f0' }}>
                <Gift size={48} style={{ color:'#cbd5e1', marginBottom:'16px' }} />
                <h3 style={{ color:'var(--text-muted)', fontWeight:'700' }}>لا توجد عروض حالياً</h3>
                <button onClick={() => setForm(BLANK)} style={{ marginTop:'16px', background:'none', border:'none', color:'#3b82f6', fontWeight:'700', cursor:'pointer' }}>+ أنشئ أول عرض ترويجي</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', overflowY:'auto', flex:1, minHeight:0 }}>
                {promos.map(p => (
                  <div key={p.id} className="hover-lift" style={{ background:'var(--bg-card)', padding:'20px', border:'1px solid #f1f5f9', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                      <div style={{ padding:'6px 12px', background: p.active ? '#ecfdf5' : '#f1f5f9', color: p.active ? '#10b981' : '#94a3b8', borderRadius:'99px', fontSize:'11px', fontWeight:'800' }}>
                        {p.active ? '● نشط حالياً' : '○ متوقف'}
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={() => setForm(p)} style={iconBtn}><Save size={14}/></button>
                        <button onClick={() => handleDelete(p.id)} style={{ ...iconBtn, color:'#ef4444' }}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <h4 style={{ fontWeight:'800', fontSize:'16px', marginBottom:'4px' }}>{p.name}</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                        {p.type === 'BOGO' ? 'اشترِ قطعة واحصل على أخرى' : p.type === 'BULK' ? 'خصم على كمية المنتج' : 'خصم على إجمالي الطلب'}
                      </span>
                      <span style={{ fontSize:'11px', background: p.apply_mode === 'MANUAL' ? '#fff7ed' : '#f0f9ff', color: p.apply_mode === 'MANUAL' ? '#ea580c' : '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {p.apply_mode === 'MANUAL' ? 'يدوي (تحديد من الكاشير)' : 'تلقائي (للجميع)'}
                      </span>
                    </div>
                    
                    <div style={{ background:'var(--bg-card)', borderRadius:'12px', padding:'12px', fontSize:'13px', color:'var(--text-muted)' }}>
                      {p.type === 'TOTAL' && <span>خصم <strong>{p.discount_value}{p.discount_type==='pct'?'%':' ريال'}</strong> عند الشراء بمبلغ أكبر من {p.min_spend} ريال.</span>}
                      {p.type === 'BOGO' && <span>اشترِ {p.buy_qty} من [منتج معين] واحصل على {p.get_qty} مجاناً.</span>}
                    </div>

                    <button onClick={() => toggleStatus(p)} 
                      style={{ width:'100%', marginTop:'16px', padding:'10px', borderRadius:'12px', background: p.active ? '#fff1f2' : '#ecfdf5', color: p.active ? '#ef4444' : '#10b981', border:'none', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontSize:'13px' }}>
                      <Power size={14}/> {p.active ? 'تعطيل العرض' : 'تفعيل العرض'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* EDITOR VIEW */}
        {form && (
          <div style={{ maxWidth:'800px', margin:'0 auto', width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
              <button onClick={() => setForm(null)} style={{ background:'var(--bg-card)', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'8px', cursor:'pointer' }}><X size={20}/></button>
              <h2 style={{ fontWeight:'900', fontSize:'20px' }}>{form.id ? 'تعديل العرض' : 'إنشاء عرض جديد'}</h2>
            </div>

            <div style={{ background:'var(--bg-card)', borderRadius:'24px', padding:'32px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
                
                <section>
                  <label style={lbl}>اسم العرض (يظهر للموظف)</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="مثال: خصم الأعياد" style={inp} />
                </section>

                <section>
                  <label style={lbl}>نوع العرض</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px' }}>
                    {[
                      { id:'TOTAL', l:'على الإجمالي', d:'خصم على مبلغ الفاتورة' },
                      { id:'BOGO',  l:'Buy X Get Y', d:'اشترِ منتج واحصل على آخر' },
                      { id:'BULK',  l:'سعر الجملة', d:'خصم عند شراء كمية معينة' }
                    ].map(t => (
                      <button key={t.id} onClick={() => setForm({...form, type: t.id})}
                        style={{ padding:'16px 12px', borderRadius:'16px', border: form.type===t.id ? '2px solid #3b82f6' : '1px solid #f1f5f9', background: form.type===t.id ? '#eff6ff' : '#f8fafc', cursor:'pointer', textAlign:'center', transition:'all 0.2s' }}>
                        <div style={{ fontWeight:'800', color: form.type===t.id ? '#3b82f6' : '#1e293b', fontSize:'14px' }}>{t.l}</div>
                        <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'4px' }}>{t.d}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label style={lbl}>طريقة التطبيق (من يحصل على العرض؟)</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    {[
                      { id: 'AUTO', l: 'تلقائي (للجميع)', d: 'يُطبق تلقائياً إذا تحققت الشروط' },
                      { id: 'MANUAL', l: 'يدوي (فئات محددة)', d: 'يجب على الكاشير اختياره يدوياً لتطبيقه' }
                    ].map(m => (
                      <button key={m.id} onClick={() => setForm({...form, apply_mode: m.id})}
                        style={{ padding:'12px', borderRadius:'12px', border: (form.apply_mode || 'AUTO') === m.id ? '2px solid #8b5cf6' : '1px solid #f1f5f9', background: (form.apply_mode || 'AUTO') === m.id ? '#f5f3ff' : '#f8fafc', cursor:'pointer', textAlign:'center', transition:'all 0.2s' }}>
                        <div style={{ fontWeight:'800', color: (form.apply_mode || 'AUTO') === m.id ? '#8b5cf6' : '#1e293b', fontSize:'14px' }}>{m.l}</div>
                        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{m.d}</div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Conditional Fields based on Type */}
                <div style={{ padding:'24px', background:'var(--bg-card)', borderRadius:'20px', border:'1px solid #f1f5f9' }}>
                  {form.type === 'TOTAL' && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
                      <section>
                        <label style={lbl}>الحد الأدنى للمشتريات (SAR)</label>
                        <input type="number" value={form.min_spend} onChange={e => setForm({...form, min_spend: parseFloat(e.target.value)})} style={inp} />
                      </section>
                      <section>
                        <label style={lbl}>مقدار الخصم</label>
                        <div style={{ display:'flex', gap:'10px' }}>
                          <input type="number" value={form.discount_value} onChange={e => setForm({...form, discount_value: parseFloat(e.target.value)})} style={{ ...inp, flex:1 }} />
                          <select value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value})} style={{ ...inp, width:'80px' }}>
                            <option value="pct">%</option>
                            <option value="fixed">ريال</option>
                          </select>
                        </div>
                      </section>
                    </div>
                  )}

                  {form.type === 'BOGO' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
                      <section>
                        <label style={lbl}>ابحث عن المنتج</label>
                        <div style={{ position:'relative' }}>
                          <Search size={16} style={{ position:'absolute', right:'12px', top:'14px', color:'var(--text-muted)' }}/>
                          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ابحث باسم الصنف..." style={{ ...inp, paddingRight:'36px' }} />
                        </div>
                        {searchTerm && (
                          <div style={{ maxHeight:'150px', overflowY:'auto', background:'var(--bg-card)', border:'1px solid #e2e8f0', borderRadius:'12px', marginTop:'4px' }}>
                            {filteredMenu.map(m => (
                              <div key={m.ID} onClick={() => { setForm({...form, buy_product_id: m.ID, get_product_id: m.ID}); setSearchTerm(''); }}
                                style={{ padding:'10px', cursor:'pointer', fontSize:'13px', borderBottom:'1px solid #f1f5f9' }}>
                                {m.Name} - SAR {m.Price}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                      {form.buy_product_id && (
                        <div style={{ background:'var(--bg-card)', padding:'16px', borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ fontWeight:'700', fontSize:'14px' }}>
                             🏷️ المنتج المختار: {menu.find(x=>x.ID===form.buy_product_id)?.Name}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <span>اشترِ</span>
                            <input type="number" value={form.buy_qty} onChange={e => setForm({...form, buy_qty: parseInt(e.target.value)})} style={{ ...inp, width:'60px', padding:'6px' }} />
                            <span>احصل على</span>
                            <input type="number" value={form.get_qty} onChange={e => setForm({...form, get_qty: parseInt(e.target.value)})} style={{ ...inp, width:'60px', padding:'6px' }} />
                            <span>مجاناً</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {form.type === 'BULK' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                      <p style={{ fontSize:'12px', color:'var(--text-muted)' }}>سيتم تطبيق خصم عندما تصل كمية الصنف في السلة إلى رقم معين.</p>
                      {/* Similar product selection as BOGO */}
                      <section>
                        <label style={lbl}>ابحث عن المنتج</label>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="اسم الصنف..." style={inp} />
                        {searchTerm && (
                          <div style={{ maxHeight:'150px', overflowY:'auto', background:'var(--bg-card)', border:'1px solid #e2e8f0', borderRadius:'12px', marginTop:'4px' }}>
                            {filteredMenu.map(m => (
                              <div key={m.ID} onClick={() => { setForm({...form, buy_product_id: m.ID}); setSearchTerm(''); }}
                                style={{ padding:'10px', cursor:'pointer', fontSize:'13px', borderBottom:'1px solid #f1f5f9' }}>
                                {m.Name} - SAR {m.Price}
                              </div>
                            ))}
                          </div>
                        )}
                        {form.buy_product_id && <div style={{ marginTop:'8px', fontWeight:'700', fontSize:'13px' }}>✅ {menu.find(x=>x.ID===form.buy_product_id)?.Name}</div>}
                      </section>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
                        <section>
                          <label style={lbl}>الكمية المطلوبة للخصم</label>
                          <input type="number" value={form.buy_qty} onChange={e => setForm({...form, buy_qty: parseInt(e.target.value)})} style={inp} />
                        </section>
                        <section>
                          <label style={lbl}>نسبة الخصم (%)</label>
                          <input type="number" value={form.discount_value} onChange={e => setForm({...form, discount_value: parseFloat(e.target.value)})} style={inp} />
                        </section>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
                  <section>
                    <label style={lbl}>تاريخ البدء</label>
                    <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} style={inp} />
                  </section>
                  <section>
                    <label style={lbl}>تاريخ الانتهاء (اختياري)</label>
                    <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} style={inp} />
                  </section>
                </div>

                <button onClick={handleSave} className="btn btn-primary" style={{ padding:'16px', fontSize:'16px', fontWeight:'900', marginTop:'10px' }}>
                  <Save size={20}/> {form.id ? 'تحديث التغييرات' : 'تفعيل العرض الترويجي'}
                </button>

              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

const lbl = { display:'block', marginBottom:'8px', fontWeight:'700', fontSize:'13px', color:'var(--text-muted)' };
const inp = { width:'100%', padding:'12px 16px', borderRadius:'14px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none' };
const iconBtn = { background:'var(--bg-card)', border:'1px solid #f1f5f9', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'var(--text-muted)' };
