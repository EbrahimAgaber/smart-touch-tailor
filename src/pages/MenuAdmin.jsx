import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import AppLayout from '../components/AppLayout';
import LabelPrintModal from '../components/LabelPrintModal';
import { 
  Package, Search, Plus, X, Edit3, Trash2, Barcode, 
  History, FileDown, Layers, ShieldCheck, Hash, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Tag,
  Info, Box, Settings, Image as ImageIcon, Upload
} from 'lucide-react';

const BLANKS = { 
  Name:'', Price:0, Category:'عام', Cost:0, Stock:0, Barcode:'', 
  IsService: false, Unit: 'وحدة', MinStockLevel: 5,
  BulkUnitName: '', BulkUnitSize: 1, Image: '',
  Metadata: { requires_serial: false, warranty_days: 0 }
};

export default function MenuAdmin() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(BLANKS);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // History Modal
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyProduct, setHistoryProduct] = useState(null);

  // Label Print Modal
  const [labelProduct,  setLabelProduct]  = useState(null);
  const [labelSettings, setLabelSettings] = useState(null);

  const load = () => {
    window.api.getMenu()
      .then(data => setItems(data || []))
      .catch(err => console.error(err));
  };

  const location = useLocation();

  useEffect(() => { 
    load();
    if (location.state?.editItem) {
      startEdit(location.state.editItem);
    }
    window.api.getSettings().then(setLabelSettings).catch(() => {});
  }, [location.state]);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateMeta = (k, v) => setForm(f => ({ ...f, Metadata: { ...f.Metadata, [k]: v } }));

  const handleImageUpload = async () => {
    setUploading(true);
    try {
      const base64 = await window.api.pickImageFile();
      if (base64) {
        updateField('Image', base64);
      }
    } catch (e) {
      alert('فشل تحميل الصورة: ' + e.message);
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.Name || form.Price === '') return alert('يرجى إدخال الاسم والسعر');
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        Price: parseFloat(form.Price), 
        Cost: parseFloat(form.Cost || 0), 
        Stock: parseFloat(form.Stock || 0),
        MinStockLevel: parseFloat(form.MinStockLevel || 0),
        BulkUnitSize: parseFloat(form.BulkUnitSize || 1)
      };
      
      if (editId) {
        await window.api.editMenuItem({ ...payload, ID: editId });
      } else {
        await window.api.addMenuItem(payload);
      }
      
      setForm(BLANKS);
      setEditId(null);
      load();
    } catch (err) {
      alert('خطأ في الحفظ: ' + err.message);
    }
    setSaving(false);
  };

  const startEdit = (item) => { 
    setForm({ 
      Name: item.Name, Price: item.Price, Category: item.Category || 'عام', 
      Cost: item.Cost || 0, Stock: item.Stock || 0, Barcode: item.Barcode || '',
      IsService: !!item.IsService, Unit: item.Unit || 'وحدة',
      MinStockLevel: item.MinStockLevel || 0,
      BulkUnitName: item.BulkUnitName || '',
      BulkUnitSize: item.BulkUnitSize || 1, Image: item.Image || '',
      Metadata: item.Metadata || { requires_serial: false, warranty_days: 0 }
    }); 
    setEditId(item.ID); 
  };

  const del = async (id) => { 
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return; 
    await window.api.deleteMenuItem(id); 
    load(); 
  };

  const openHistory = async (product) => {
    setHistoryProduct(product);
    try {
      const data = await window.api.getStockHistory(product.ID);
      setHistory(data || []);
      setShowHistory(true);
    } catch (e) { console.error(e); }
  };

  const handleImportCSV = async () => {
    try {
      const filePath = await window.api.pickCSVFile();
      if (!filePath) return;
      const result = await window.api.importCSV(filePath);
      alert(`✅ تم استيراد ${result.count} منتج بنجاح!`);
      load();
    } catch (e) { alert('خطأ في الاستيراد: ' + e.message); }
  };

  const filtered = items.filter(i => 
    !search || 
    i.Name.toLowerCase().includes(search.toLowerCase()) ||
    (i.Barcode && i.Barcode.includes(search))
  );

  return (
    <AppLayout title="إدارة المنتجات والقائمة">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start flex-1 min-h-0">
        
        {/* ── LEFT: FORM ────────────────────────────────────────── */}
        <div style={{ background:'white', borderRadius:'24px', padding:'28px', border:'1px solid #f1f5f9', position:'sticky', top:0, maxHeight:'90vh', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
            <h3 style={{ fontWeight:'900', fontSize:'18px', color:'#0f172a' }}>
              {editId ? '✏️ تعديل بيانات المنتج' : '✨ إضافة منتج جديد'}
            </h3>
            {!editId && (
              <button onClick={handleImportCSV} style={{ padding:'6px 12px', background:'#f0fdf4', color:'#166534', border:'1px solid #dcfce7', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                📥 استيراد CSV
              </button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            {/* Section: Basic Info */}
            <div style={formSection}>
              <SectionHeader icon={<Info size={16}/>} label="المعلومات الأساسية" />
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <F label="اسم المنتج *" value={form.Name} onChange={v => updateField('Name', v)} placeholder="مثال: آيفون 15 برو" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="سعر البيع *" type="number" value={form.Price} onChange={v => updateField('Price', v)} placeholder="0.00" />
                  <F label="القسم" value={form.Category} onChange={v => updateField('Category', v)} placeholder="عام" />
                </div>
                <F label="الباركود" value={form.Barcode} onChange={v => updateField('Barcode', v)} placeholder="امسح أو أدخل الباركود" />
                
                {/* Product Image Upload */}
                <div style={{ display:'flex', alignItems:'center', gap:'20px', marginTop:'10px' }}>
                  <div style={{ width:'80px', height:'80px', borderRadius:'16px', background:'#f8fafc', border:'2px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                    {form.Image
                      ? <img src={form.Image} alt="product" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                      : <ImageIcon size={32} color="#cbd5e1"/>}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'12px', color:'#64748b', marginBottom:'10px', lineHeight:'1.6' }}>
                      صورة المنتج تظهر في واجهة نقطة البيع.
                    </p>
                    <button type="button" onClick={handleImageUpload} disabled={uploading}
                      style={{ padding:'8px 16px', background:'#f1f5f9', color:'#334155', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px', opacity: uploading ? .6 : 1 }}>
                      <Upload size={14}/> {uploading ? 'جاري التحميل...' : 'اختر صورة'}
                    </button>
                    {form.Image && (
                      <button type="button" onClick={() => updateField('Image','')} style={{ marginTop:'8px', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit' }}>
                        × حذف الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Inventory & Cost */}
            <div style={formSection}>
              <SectionHeader icon={<Box size={16}/>} label="المخزون والتكاليف" />
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="التكلفة (SAR)" type="number" value={form.Cost} onChange={v => updateField('Cost', v)} placeholder="0.00" />
                  <div>
                    <label style={{ display:'block', marginBottom:'6px', fontWeight:'800', fontSize:'12px', color:'#64748b' }}>وحدة القياس</label>
                    <input
                      list="zatca-units"
                      value={form.Unit || ''}
                      onChange={e => updateField('Unit', e.target.value)}
                      placeholder="وحدة / قطعة"
                      style={{ width:'100%', padding:'12px 14px', borderRadius:'14px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                    />
                    <datalist id="zatca-units">
                      <option value="وحدة / قطعة (PCE)" />
                      <option value="كجم (KGM)" />
                      <option value="جرام (GRM)" />
                      <option value="لتر (LTR)" />
                      <option value="مل (MLT)" />
                      <option value="متر (MTR)" />
                      <option value="سم (CMT)" />
                      <option value="ساعة (HUR)" />
                      <option value="يوم (DAY)" />
                      <option value="خدمة (ZZZ)" />
                      <option value="طن (TNE)" />
                      <option value="صندوق (BX)" />
                      <option value="كرتون (CT)" />
                      <option value="حزمة (PK)" />
                      <option value="دزينة (DZN)" />
                    </datalist>
                    <p style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>
                      اختر وحدة من القائمة لضمان توافق ZATCA. القيم غير المعروفة ستُعامل كـ PCE.
                    </p>
                  </div>
                </div>
                
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #e2e8f0' }}>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:'#475569' }}>🛎️ عنصر خدمة (لا يخصم مخزون)</span>
                  <button type="button" onClick={() => updateField('IsService', !form.IsService)} style={{ width:'44px', height:'24px', borderRadius:'99px', border:'none', cursor:'pointer', background: form.IsService ? '#8b5cf6' : '#cbd5e1', position:'relative', transition:'all 0.2s' }}>
                    <div style={{ position:'absolute', top:'3px', left: form.IsService ? '22px' : '4px', width:'18px', height:'18px', background:'white', borderRadius:'50%', transition:'all 0.2s' }} />
                  </button>
                </div>

                {!form.IsService && (
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <F label="الكمية الحالية" type="number" value={form.Stock} onChange={v => updateField('Stock', v)} />
                    <F label="تنبيه نقص المخزون" type="number" value={form.MinStockLevel} onChange={v => updateField('MinStockLevel', v)} />
                  </div>
                )}
              </div>
            </div>

            {/* Section: Bulk & Wholesale */}
            {!form.IsService && (
              <div style={formSection}>
                <SectionHeader icon={<Layers size={16}/>} label="وحدات الجملة" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="اسم وحدة الجملة" value={form.BulkUnitName} onChange={v => updateField('BulkUnitName', v)} placeholder="كرتون / ربطة" />
                  <F label="العدد داخل الجملة" type="number" value={form.BulkUnitSize} onChange={v => updateField('BulkUnitSize', v)} />
                </div>
              </div>
            )}

            {/* Section: Advanced Settings */}
            <div style={formSection}>
              <SectionHeader icon={<Settings size={16}/>} label="إعدادات متقدمة" />
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'13px', fontWeight:'600', color:'#0f172a', cursor:'pointer' }}>
                  <input type="checkbox" checked={form.Metadata.requires_serial} onChange={e => updateMeta('requires_serial', e.target.checked)} style={{ width:'18px', height:'18px', accentColor:'#3b82f6' }} />
                  يتطلب رقم تسلسلي (Serial/IMEI)
                </label>
                <F label="مدة الضمان (بالأيام)" type="number" value={form.Metadata.warranty_days} onChange={v => updateMeta('warranty_days', v)} />
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:'12px', marginTop:'32px' }}>
            <button onClick={save} disabled={saving || !form.Name} style={{ ...actionBtn, background:'#3b82f6', color:'white', flex:2 }}>
              {saving ? 'جاري الحفظ...' : editId ? 'تحديث البيانات' : 'إضافة المنتج'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(BLANKS); }} style={{ ...actionBtn, background:'#f1f5f9', color:'#64748b', flex:1 }}>
                إلغاء
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: TABLE ────────────────────────────────────────── */}
        <div style={{ background:'white', borderRadius:'24px', padding:'28px', border:'1px solid #f1f5f9', display:'flex', flexDirection:'column', height:'100%', minHeight:0 }} className="max-lg:order-first">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <Package size={24} color="#3b82f6" />
              <h3 style={{ fontWeight:'900', fontSize:'18px' }}>قائمة المنتجات ({items.length})</h3>
            </div>
            <div style={{ position:'relative', width:'300px' }}>
              <Search size={16} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود..." style={{ width:'100%', padding:'12px 42px 12px 16px', borderRadius:'14px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px' }} />
            </div>
          </div>

          <div style={{ overflowX:'auto', overflowY:'auto', flex:1, minHeight:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #f1f5f9' }}>
                  <th style={TH}>المنتج / الباركود</th>
                  <th style={TH} className="max-sm:hidden">القسم</th>
                  <th style={TH} className="max-md:hidden">السعر / التكلفة</th>
                  <th style={TH}>المخزون</th>
                  <th style={TH}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isLow = !p.IsService && p.Stock <= (p.MinStockLevel || 0);
                  const margin = p.Price > 0 && p.Cost > 0 ? (((p.Price - p.Cost) / p.Price) * 100).toFixed(0) : null;
                  
                  return (
                    <tr key={p.ID} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={TD}>
                        <div style={{ fontWeight:'800', color:'#1e293b' }}>{p.Name}</div>
                        <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px', display:'flex', alignItems:'center', gap:'4px' }}>
                          <Barcode size={10} /> {p.Barcode || 'بدون باركود'}
                        </div>
                      </td>
                      <td style={TD} className="max-sm:hidden"><Pill>{p.Category || 'عام'}</Pill></td>
                      <td style={TD} className="max-md:hidden">
                        <div style={{ fontWeight:'800', color:'#3b82f6' }}>SAR {parseFloat(p.Price || 0).toFixed(2)}</div>
                        <div style={{ fontSize:'11px', color:'#94a3b8' }}>التكلفة: {p.Cost ? p.Cost.toFixed(2) : '0.00'}</div>
                        {margin && <div style={{ fontSize:'10px', color: margin > 20 ? '#10b981' : '#f59e0b', fontWeight:'700' }}>الهامش: {margin}%</div>}
                      </td>
                      <td style={TD}>
                        {p.IsService ? (
                          <Pill color="purple">🛎️ خدمة</Pill>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <div style={{ padding:'4px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'800', background: isLow ? '#fef2f2' : '#f0fdf4', color: isLow ? '#ef4444' : '#10b981' }}>
                              {p.Stock} {p.Unit || 'وحدة'}
                            </div>
                            {isLow && <AlertCircle size={14} color="#ef4444" />}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={() => setLabelProduct(p)} style={{ ...iconBtn, color:'#3b82f6' }} title="طباعة ملصق"><Tag size={16} /></button>
                          <button onClick={() => openHistory(p)} style={iconBtn} title="سجل الحركة"><History size={16} /></button>
                          <button onClick={() => startEdit(p)} style={iconBtn} title="تعديل"><Edit3 size={16} /></button>
                          <button onClick={() => del(p.ID)} style={{ ...iconBtn, color:'#ef4444' }} title="حذف"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── LABEL PRINT MODAL ─────────────────────────────────── */}
      {labelProduct && labelSettings && (
        <LabelPrintModal
          product={labelProduct}
          settings={labelSettings}
          onClose={() => setLabelProduct(null)}
        />
      )}

      {/* ── HISTORY MODAL ────────────────────────────────────────── */}
      {showHistory && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'700px' }}>
            <div style={{ padding:'24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ fontWeight:'900', fontSize:'18px' }}>سجل حركة المخزون</h3>
                <p style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>{historyProduct?.Name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24}/></button>
            </div>
            <div style={{ padding:'24px', maxHeight:'60vh', overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
                <thead>
                  <tr style={{ color:'#94a3b8', fontSize:'12px' }}>
                    <th style={{ padding:'12px' }}>النوع</th>
                    <th style={{ padding:'12px' }}>الكمية</th>
                    <th style={{ padding:'12px' }}>السبب</th>
                    <th style={{ padding:'12px' }}>المرجع</th>
                    <th style={{ padding:'12px' }}>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'12px' }}>
                        {h.change_amount > 0 ? <ArrowUpRight color="#10b981" size={16}/> : <ArrowDownRight color="#ef4444" size={16}/>}
                      </td>
                      <td style={{ padding:'12px', fontWeight:'800', color: h.change_amount > 0 ? '#10b981' : '#ef4444' }}>
                        {h.change_amount > 0 ? `+${h.change_amount}` : h.change_amount}
                      </td>
                      <td style={{ padding:'12px', fontSize:'13px' }}>
                        {h.reason === 'sale' ? 'مبيعات' : h.reason === 'purchase' ? 'توريد مشتريات' : h.reason === 'adjustment' ? 'تعديل يدوي' : h.reason}
                      </td>
                      <td style={{ padding:'12px', fontSize:'11px', color:'#94a3b8' }}>{h.reference_id || '—'}</td>
                      <td style={{ padding:'12px', fontSize:'12px' }}>{new Date(h.timestamp).toLocaleString('ar-SA')}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>لا توجد حركات مسجلة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── UI COMPONENTS ───────────────────────────────────────────────

function F({ label, value, onChange, placeholder, type='text' }) {
  return (
    <div>
      <label style={{ display:'block', marginBottom:'6px', fontWeight:'800', fontSize:'12px', color:'#64748b' }}>{label}</label>
      <input type={type} value={value||''} onChange={e => onChange(e.target.value)} placeholder={placeholder} 
        style={{ width:'100%', padding:'12px 14px', borderRadius:'14px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', color:'#475569' }}>
      <div style={{ width:'28px', height:'28px', background:'#f1f5f9', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'#3b82f6' }}>{icon}</div>
      <span style={{ fontSize:'13px', fontWeight:'900', letterSpacing:'-0.3px' }}>{label}</span>
    </div>
  );
}

function Pill({ children, color }) {
  const styles = {
    blue: { bg: '#eff6ff', text: '#3b82f6' },
    green: { bg: '#f0fdf4', text: '#16a34a' },
    orange: { bg: '#fff7ed', text: '#ea580c' },
    purple: { bg: '#f5f3ff', text: '#8b5cf6' },
    gray: { bg: '#f8fafc', text: '#64748b' }
  };
  const theme = styles[color] || styles.blue;
  return <span style={{ background:theme.bg, color:theme.text, padding:'4px 12px', borderRadius:'99px', fontSize:'11px', fontWeight:'800' }}>{children}</span>;
}

// ── STYLES ─────────────────────────────────────────────────────

const formSection = { background:'#ffffff', padding:'0', borderTop:'1px solid #f1f5f9', paddingTop:'16px' };
const TH = { textAlign:'right', padding:'16px 12px', fontSize:'12px', color:'#94a3b8', fontWeight:'800' };
const TD = { padding:'16px 12px', fontSize:'14px', verticalAlign:'middle' };
const actionBtn = { padding:'14px', borderRadius:'16px', border:'none', fontSize:'14px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' };
const iconBtn = { width:'34px', height:'34px', borderRadius:'10px', border:'1px solid #f1f5f9', background:'white', color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' };
const overlay = { position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modal = { background:'white', borderRadius:'28px', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', width:'90%', overflow:'hidden', direction:'rtl' };
