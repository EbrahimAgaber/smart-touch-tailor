import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useTranslation } from 'react-i18next';
import { PlusCircle, Edit3, X, Save, Trash2, Heart, Search } from 'lucide-react';

const BLANK_SPONSOR = { name: '', default_discount: 100, cap_limit: 0, is_active: 1 };

export default function Sponsors() {
  const { t } = useTranslation();
  const [sponsors, setSponsors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK_SPONSOR);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { fetchSponsors(); }, []);

  const fetchSponsors = async () => {
    setLoading(true);
    try {
      const data = await window.api.getSponsors({});
      setSponsors(data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await window.api.updateSponsor({ ...form, id: editingId });
      } else {
        await window.api.addSponsor(form);
      }
      setShowModal(false);
      fetchSponsors();
    } catch (err) {
      alert(err.message || 'Error saving sponsor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الجهة الداعمة؟')) return;
    try {
      await window.api.deleteSponsor(id);
      fetchSponsors();
    } catch (err) {
      alert(err.message || 'Error deleting sponsor');
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(BLANK_SPONSOR);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ ...s });
    setShowModal(true);
  };

  const filtered = sponsors.filter(s => !search || s.name.includes(search));

  const primaryBtnStyle = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'11px 22px', borderRadius:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit' };
  const inputStyle = { width:'100%', padding:'12px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit', backgroundColor:'#f8fafc', color:'var(--text-main)' };
  const tdStyle = { padding:'16px 20px', fontSize:'14px', color:'var(--text-main)', borderBottom:'1px solid #f8fafc' };

  return (
    <AppLayout title="إدارة الجهات الداعمة">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0, height: '100%', paddingBottom: '24px' }}>
        
        {/* STATS (Optional, keeping consistent with CRM) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="hover-lift" style={{ background:'var(--bg-card)', border:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding: '20px', borderRadius: '16px' }}>
            <div style={{ fontSize:'32px' }}>❤️</div>
            <div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>إجمالي الجهات</div>
              <div style={{ fontSize:'22px', fontWeight:'900', color: '#ef4444' }}>{sponsors.length}</div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-subtle gap-4 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={18} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن جهة داعمة..."
                style={{ width:'100%', padding:'11px 44px 11px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNew} style={primaryBtnStyle}>
              <PlusCircle size={18} /> إضافة جهة داعمة
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="hover-lift" style={{ background:'var(--bg-card)', border:'1px solid #f1f5f9', borderRadius: '16px', overflowY:'auto', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', flex:1, minHeight:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
            <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
              <tr>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>اسم الجهة</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>الخصم الافتراضي</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>الحد الأقصى (Cap)</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>الحالة</th>
                <th style={{ padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'var(--text-muted)' }}>جاري التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:'60px', textAlign:'center', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px', opacity:.4 }}>❤️</div>
                  لا توجد جهات داعمة مطابقة
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'#ef4444', fontSize:'16px', border:'2px solid #fee2e2', flexShrink:0 }}>
                        {s.name.charAt(0)}
                      </div>
                      <div style={{ fontWeight:'700', color:'var(--text-main)' }}>{s.name}</div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display:'inline-block', padding:'4px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', fontWeight:'700', color:'#475569' }}>
                      {s.default_discount}%
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display:'inline-block', padding:'4px 10px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'13px', fontWeight:'700', color:'#475569' }}>
                      {s.cap_limit > 0 ? `${s.cap_limit.toFixed(2)} SAR` : 'بدون حد'}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {s.is_active ? 
                      <span style={{ color:'#10b981', background:'#ecfdf5', padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700' }}>نشط</span> : 
                      <span style={{ color:'#ef4444', background:'#fef2f2', padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700' }}>غير نشط</span>
                    }
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => openEdit(s)} style={{ background:'#f1f5f9', border:'none', padding:'8px', borderRadius:'8px', cursor:'pointer', color:'#3b82f6' }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} style={{ background:'#f1f5f9', border:'none', padding:'8px', borderRadius:'8px', cursor:'pointer', color:'#ef4444' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }} onClick={() => setShowModal(false)}>
          <div style={{ background:'var(--bg-card)', width:'100%', maxWidth:'480px', borderRadius:'24px', boxShadow:'0 20px 40px rgba(0,0,0,0.1)', overflow:'hidden', animation:'fadeInUp 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
              <h3 style={{ fontSize:'18px', fontWeight:'800', color:'var(--text-main)', margin:0 }}>{editingId ? 'تعديل جهة داعمة' : 'إضافة جهة داعمة'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{ display:'block', marginBottom:'8px', fontSize:'13px', fontWeight:'700', color:'var(--text-muted)' }}>اسم الجهة الداعمة *</label>
                <input required type="text" style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              
              <div style={{ display:'flex', gap:'16px' }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:'8px', fontSize:'13px', fontWeight:'700', color:'var(--text-muted)' }}>الخصم (%)</label>
                  <input type="number" step="0.01" max="100" min="0" style={inputStyle} value={form.default_discount} onChange={e => setForm({...form, default_discount: parseFloat(e.target.value)||0})} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:'8px', fontSize:'13px', fontWeight:'700', color:'var(--text-muted)' }}>الحد الأقصى للخصم</label>
                  <input type="number" step="0.01" min="0" style={inputStyle} value={form.cap_limit} onChange={e => setForm({...form, cap_limit: parseFloat(e.target.value)||0})} placeholder="0 = بدون حد" />
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'8px', background:'#f8fafc', padding:'12px 16px', borderRadius:'12px', border:'1px solid #f1f5f9' }}>
                <input type="checkbox" id="isActive" style={{ width:'18px', height:'18px', cursor:'pointer' }} checked={!!form.is_active} onChange={e => setForm({...form, is_active: e.target.checked?1:0})} />
                <label htmlFor="isActive" style={{ fontSize:'14px', fontWeight:'700', color:'var(--text-main)', cursor:'pointer', userSelect:'none' }}>الجهة نشطة وتستقبل قسائم</label>
              </div>

              <div style={{ display:'flex', gap:'12px', marginTop:'16px' }}>
                <button type="submit" style={{ ...primaryBtnStyle, flex:1, justifyContent:'center' }}>
                  <Save size={18} /> حفظ
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ background:'#f1f5f9', color:'#475569', border:'none', padding:'11px 22px', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
