const fs = require('fs');
const path = require('path');

const jsxContent = `import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import LabelPrintModal from '../components/LabelPrintModal';
import { 
  Package, Search, X, Edit3, Trash2, Barcode, 
  History, Info, Upload, Tag, ArrowUpRight, ArrowDownRight, Save,
  Download, Zap, Sparkles
} from 'lucide-react';

const BLANKS = { 
  Name:'', Price:'', Category:'عام', Cost:0, Stock:0, Barcode:'', 
  IsService: false, Unit: 'وحدة / قطعة (PCE)', MinStockLevel: 5,
  BulkUnitName: '', BulkUnitSize: 1, Image: '',
  Metadata: { requires_serial: false, warranty_days: 0 }
};

export default function MenuAdmin() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(BLANKS);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('الكل');
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const sellingPriceRef = useRef(null);
  const currentStockRef = useRef(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyProduct, setHistoryProduct] = useState(null);

  const [labelProduct,  setLabelProduct]  = useState(null);
  const [labelSettings, setLabelSettings] = useState(null);

  const load = () => {
    window.api.getMenu().then(data => setItems(data || [])).catch(console.error);
  };

  const location = useLocation();

  useEffect(() => { 
    load();
    if (location.state?.editItem) startEdit(location.state.editItem);
    window.api.getSettings().then(setLabelSettings).catch(() => {});
    
    if (window.api.onProductsChanged) {
      window.api.onProductsChanged(() => load());
    }
  }, [location.state]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && !showCatalog && !showHistory && !labelProduct) {
        if (e.key === '1') { e.preventDefault(); setActiveTab(1); }
        if (e.key === '2') { e.preventDefault(); setActiveTab(2); }
        if (e.key === '3') { e.preventDefault(); setActiveTab(3); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCatalog, showHistory, labelProduct]);

  useEffect(() => {
    if (showCatalog) {
      if (window.api.getGlobalCatalogCategories) {
        window.api.getGlobalCatalogCategories().then(setCatalogCategories).catch(console.error);
      }
      const timeout = setTimeout(() => {
        if (window.api.getGlobalCatalog) {
          window.api.getGlobalCatalog({ search: catalogSearch, category: catalogCategory }).then(setCatalogItems).catch(console.error);
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [showCatalog, catalogSearch, catalogCategory]);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateMeta = (k, v) => setForm(f => ({ ...f, Metadata: { ...f.Metadata, [k]: v } }));

  const handleImageUpload = async () => {
    setUploading(true);
    try {
      const base64 = await window.api.pickImageFile();
      if (base64) updateField('Image', base64);
    } catch (e) { alert(t('menu.form.image_error') + e.message); }
    setUploading(false);
  };
  
  const handleImportCSV = async () => {
    try {
      if (!window.api.pickCSVFile) return;
      const filePath = await window.api.pickCSVFile();
      if (!filePath) return;
      const result = await window.api.importCSV(filePath);
      alert(t('menu.form.import_success', { count: result.count }));
      load();
    } catch (e) { alert(t('menu.form.import_error') + e.message); }
  };

  const save = async () => {
    if (!form.Name || form.Price === '') return alert(t('menu.form.name_price_required'));
    if (parseFloat(form.Price) < parseFloat(form.Cost)) return alert('سعر البيع أقل من التكلفة!'); 
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        Price: parseFloat(form.Price || 0), 
        Cost: parseFloat(form.Cost || 0), 
        Stock: parseFloat(form.Stock || 0),
        MinStockLevel: parseFloat(form.MinStockLevel || 0),
        BulkUnitSize: parseFloat(form.BulkUnitSize || 1)
      };
      
      if (editId) await window.api.editMenuItem({ ...payload, ID: editId });
      else await window.api.addMenuItem(payload);
      
      setForm(BLANKS);
      setEditId(null);
      setActiveTab(1);
      load(); 
    } catch (err) { alert(t('menu.form.save_error') + err.message); }
    setSaving(false);
  };

  const startEdit = (item) => { 
    setForm({ 
      Name: item.Name, Price: item.Price, Category: item.Category || 'عام', 
      Cost: item.Cost || 0, Stock: item.Stock || 0, Barcode: item.Barcode || '',
      IsService: !!item.IsService, Unit: item.Unit || 'وحدة',
      MinStockLevel: item.MinStockLevel || 0, BulkUnitName: item.BulkUnitName || '',
      BulkUnitSize: item.BulkUnitSize || 1, Image: item.Image || '',
      Metadata: item.Metadata || { requires_serial: false, warranty_days: 0 }
    }); 
    setEditId(item.ID); 
  };

  const del = async (id) => { 
    if (!window.confirm(t('menu.form.delete_confirm'))) return; 
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

  const handleCatalogSelect = (item) => {
    setForm(f => ({ ...f, Name: item.name, Category: item.category, Barcode: item.barcode, Unit: item.unit || 'وحدة / قطعة (PCE)' }));
    setShowCatalog(false);
    setActiveTab(2);
    setTimeout(() => { if (sellingPriceRef.current) sellingPriceRef.current.focus(); }, 150);
  };

  const filtered = items.filter(i => !search || i.Name.toLowerCase().includes(search.toLowerCase()) || (i.Barcode && i.Barcode.includes(search)));

  return (
    <AppLayout title="نقطة البيع">
      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 items-start flex-1 min-h-0" style={{ direction: 'rtl' }}>
        
        {/* ── RIGHT: FORM ────────────────────────────────────────── */}
        <div style={{ background:'white', borderRadius:'24px', display:'flex', flexDirection:'column', height:'90vh', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05)', border:'1px solid #f1f5f9' }}>
          
          <div style={{ padding:'24px', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h3 style={{ fontWeight:'900', fontSize:'20px', color:'#0f172a', display:'flex', alignItems:'center', gap:'8px' }}>
                {editId ? 'تعديل منتج' : 'إضافة منتج جديد'} <Sparkles size={18} color="#eab308" />
              </h3>
              {!editId && (
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setShowCatalog(true)} style={{ padding:'8px 14px', background:'#eff6ff', color:'#2563eb', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                    استيراد سريع <Zap size={14} color="#eab308" />
                  </button>
                  <button onClick={handleImportCSV} style={{ padding:'8px 14px', background:'#f0fdf4', color:'#16a34a', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                    استيراد CSV <Download size={14} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Segmented Pill Tabs */}
            <div style={{ background:'#f8fafc', padding:'6px', borderRadius:'14px', display:'flex', gap:'4px' }}>
              <SegmentBtn active={activeTab===1} onClick={() => setActiveTab(1)}>البيانات الأساسية</SegmentBtn>
              <SegmentBtn active={activeTab===2} onClick={() => setActiveTab(2)}>الأسعار والمخزون</SegmentBtn>
              <SegmentBtn active={activeTab===3} onClick={() => setActiveTab(3)}>إعدادات متقدمة</SegmentBtn>
            </div>
          </div>

          <div style={{ padding:'0 24px 24px 24px', flex:1, overflowY:'auto' }}>
            {/* Tab 1: General Info */}
            <div style={{ display: activeTab === 1 ? 'block' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'6px', marginBottom:'20px' }}>
                 <Info size={16} color="#3b82f6" />
                 <span style={{ fontWeight:'800', color:'#475569', fontSize:'14px' }}>المعلومات الأساسية</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <F label="اسم المنتج *" value={form.Name} onChange={v => updateField('Name', v)} placeholder="مثال: آيفون 15 برو" />
                <div className="grid grid-cols-2 gap-3">
                  <F label="القسم" value={form.Category} onChange={v => updateField('Category', v)} />
                  <F label="سعر البيع *" type="number" value={form.Price} onChange={v => updateField('Price', v)} placeholder="0.00" />
                </div>
                <F label="الباركود" value={form.Barcode} onChange={v => updateField('Barcode', v)} placeholder="امسح أو أدخل الباركود" />
                
                <div style={{ border:'2px dashed #cbd5e1', borderRadius:'16px', padding:'24px', textAlign:'center', marginTop:'10px', background:'#f8fafc', cursor:'pointer' }} onClick={handleImageUpload}>
                  {form.Image ? (
                    <img src={form.Image} alt="product" style={{ height:'100px', objectFit:'contain', margin:'0 auto' }} />
                  ) : (
                    <>
                      <ImageIcon size={32} color="#94a3b8" style={{ margin:'0 auto 12px auto' }}/>
                      <div style={{ fontSize:'13px', color:'#64748b', fontWeight:'700' }}>صورة المنتج تظهر في واجهة نقطة البيع.</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tab 2: Pricing & Stock */}
            <div style={{ display: activeTab === 2 ? 'block' : 'none' }}>
               <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'6px', marginBottom:'20px' }}>
                 <Box size={16} color="#3b82f6" />
                 <span style={{ fontWeight:'800', color:'#475569', fontSize:'14px' }}>المخزون والتكاليف</span>
              </div>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                 <div className="grid grid-cols-2 gap-3">
                   <F label="التكلفة" type="number" value={form.Cost} onChange={v => updateField('Cost', v)} placeholder="0.00" />
                   <div>
                     <label style={{ display:'block', marginBottom:'6px', fontWeight:'800', fontSize:'13px', color:'#475569' }}>سعر البيع *</label>
                     <input ref={sellingPriceRef} type="number" value={form.Price||''} onChange={e => updateField('Price', e.target.value)} placeholder="0.00" style={inputStyle} />
                   </div>
                 </div>
                 
                 <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #e2e8f0' }}>
                   <span style={{ fontSize:'14px', fontWeight:'700', color:'#475569' }}>منتج خدمي (لا يتطلب مخزون)</span>
                   <input type="checkbox" checked={form.IsService} onChange={e => updateField('IsService', e.target.checked)} style={{ width:'20px', height:'20px', accentColor:'#3b82f6' }} />
                 </div>

                 {!form.IsService && (
                   <>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label style={{ display:'block', marginBottom:'6px', fontWeight:'800', fontSize:'13px', color:'#475569' }}>المخزون الحالي</label>
                         <input ref={currentStockRef} type="number" value={form.Stock||''} onChange={e => updateField('Stock', e.target.value)} style={inputStyle} />
                       </div>
                       <F label="تنبيه النقص" type="number" value={form.MinStockLevel} onChange={v => updateField('MinStockLevel', v)} />
                     </div>
                     <div>
                       <label style={{ display:'block', marginBottom:'6px', fontWeight:'800', fontSize:'13px', color:'#475569' }}>وحدة القياس (ZATCA)</label>
                       <select value={form.Unit} onChange={e => updateField('Unit', e.target.value)} style={inputStyle}>
                         <option value="وحدة / قطعة (PCE)">وحدة / قطعة (PCE)</option>
                         <option value="كجم (KGM)">كجم (KGM)</option>
                         <option value="لتر (LTR)">لتر (LTR)</option>
                         <option value="صندوق (BX)">صندوق (BX)</option>
                         <option value="كرتون (CT)">كرتون (CT)</option>
                         <option value="خدمة (ZZZ)">خدمة (ZZZ)</option>
                       </select>
                     </div>
                   </>
                 )}
               </div>
            </div>

            {/* Tab 3: Advanced */}
            <div style={{ display: activeTab === 3 ? 'block' : 'none' }}>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                 <F label="اسم وحدة الجملة" value={form.BulkUnitName} onChange={v => updateField('BulkUnitName', v)} />
                 <F label="حجم الجملة (العدد)" type="number" value={form.BulkUnitSize} onChange={v => updateField('BulkUnitSize', v)} />
                 <div style={{ background:'#f8fafc', padding:'16px', borderRadius:'14px', border:'1px solid #e2e8f0' }}>
                   <label style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'14px', fontWeight:'700', color:'#475569' }}>
                     <input type="checkbox" checked={form.Metadata.requires_serial} onChange={e => updateMeta('requires_serial', e.target.checked)} style={{ width:'18px', height:'18px', accentColor:'#3b82f6' }} />
                     يتطلب إدخال سيريال نمبر (IMEI)
                   </label>
                 </div>
                 <F label="الضمان (أيام)" type="number" value={form.Metadata.warranty_days} onChange={v => updateMeta('warranty_days', v)} />
               </div>
            </div>
          </div>

          <div style={{ padding:'20px 24px', borderTop:'1px solid #f1f5f9', background:'#fafafa', flexShrink:0, display:'flex', gap:'12px', borderBottomLeftRadius:'24px', borderBottomRightRadius:'24px' }}>
            <button onClick={save} disabled={saving || !form.Name} style={{ ...actionBtn, background:'#3b82f6', color:'white', flex:2 }}>
              <Save size={18}/> {saving ? 'جاري الحفظ...' : editId ? 'تحديث البيانات' : 'حفظ المنتج'}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(BLANKS); setActiveTab(1); }} style={{ ...actionBtn, background:'#e2e8f0', color:'#475569', flex:1 }}>
                إلغاء
              </button>
            )}
          </div>
        </div>

        {/* ── LEFT: TABLE ────────────────────────────────────────── */}
        <div style={{ background:'white', borderRadius:'24px', padding:'28px', border:'1px solid #f1f5f9', display:'flex', flexDirection:'column', height:'90vh', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ padding:'8px', background:'#eff6ff', borderRadius:'12px' }}>
                <Package size={24} color="#3b82f6" />
              </div>
              <h3 style={{ fontWeight:'900', fontSize:'20px', color:'#0f172a' }}>قائمة المنتجات ({items.length})</h3>
            </div>
            <div style={{ position:'relative', width:'320px' }}>
              <Search size={18} style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود..." style={{ width:'100%', padding:'12px 16px 12px 42px', borderRadius:'14px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px', fontFamily:'inherit' }} />
            </div>
          </div>

          <div style={{ overflowX:'auto', overflowY:'auto', flex:1, minHeight:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                  <th style={TH}>المنتج / الباركود</th>
                  <th style={TH}>القسم</th>
                  <th style={TH}>السعر / التكلفة</th>
                  <th style={TH}>المخزون</th>
                  <th style={TH}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isLow = !p.IsService && p.Stock <= (p.MinStockLevel || 0);
                  const margin = p.Price > 0 && p.Cost > 0 ? (((p.Price - p.Cost) / p.Price) * 100).toFixed(0) : null;
                  return (
                    <tr key={p.ID} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={TD}>
                        <div style={{ fontWeight:'900', color:'#0f172a', fontSize:'15px' }}>{p.Name}</div>
                        <div style={{ fontSize:'12px', color:'#94a3b8', display:'flex', alignItems:'center', gap:'6px', marginTop:'4px' }}>
                          <Barcode size={12} /> {p.Barcode || 'بدون باركود'}
                        </div>
                      </td>
                      <td style={TD}>
                        <Pill color="blue">{p.Category}</Pill>
                      </td>
                      <td style={TD}>
                        <div style={{ fontWeight:'800', color:'#3b82f6', fontSize:'15px' }}>SAR {parseFloat(p.Price || 0).toFixed(2)}</div>
                        <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>التكلفة: {p.Cost ? p.Cost.toFixed(2) : '0.00'}</div>
                        {margin && <div style={{ fontSize:'11px', color: margin > 20 ? '#10b981' : '#f59e0b', fontWeight:'800' }}>الهامش: %{margin}</div>}
                      </td>
                      <td style={TD}>
                        {p.IsService ? <Pill color="gray">خدمة</Pill> : (
                          <div style={{ display:'inline-block', padding:'6px 14px', borderRadius:'12px', fontSize:'13px', fontWeight:'900', background: isLow ? '#fef2f2' : '#f0fdf4', color: isLow ? '#ef4444' : '#16a34a' }}>
                            {p.Stock} {p.Unit.includes('PCE') ? 'وحدة / قطعة (PCE)' : p.Unit.includes('KGM') ? 'كجم (KGM)' : p.Unit}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        <div style={{ display:'flex', gap:'8px' }}>
                          <button onClick={() => del(p.ID)} style={{ ...iconBtn, color:'#ef4444', borderColor:'#fee2e2' }}><Trash2 size={16} /></button>
                          <button onClick={() => startEdit(p)} style={iconBtn}><Edit3 size={16} /></button>
                          <button onClick={() => openHistory(p)} style={iconBtn}><History size={16} /></button>
                          <button onClick={() => setLabelProduct(p)} style={{ ...iconBtn, color:'#3b82f6', borderColor:'#dbeafe' }}><Tag size={16} /></button>
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

      {/* ── CATALOG MODAL ────────────────────────────────────────── */}
      {showCatalog && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'650px', height:'80vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:'900', fontSize:'18px', display:'flex', alignItems:'center', gap:'8px' }}>
                <Zap size={20} color="#eab308" /> إستيراد سريع من الدليل
              </h3>
              <button onClick={() => setShowCatalog(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24}/></button>
            </div>
            <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9', background:'#fafafa' }}>
              <div style={{ position:'relative', marginBottom:'16px' }}>
                <Search size={18} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
                <input autoFocus value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="ابحث عن منتج أو امسح الباركود..." style={{ width:'100%', padding:'14px 45px 14px 16px', borderRadius:'14px', border:'2px solid #e2e8f0', outline:'none', fontSize:'16px', fontWeight:'700', fontFamily:'inherit' }} />
              </div>
              <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px' }}>
                <button onClick={() => setCatalogCategory('الكل')} style={{ ...chipStyle, background: catalogCategory === 'الكل' ? '#2563eb' : '#fff', color: catalogCategory === 'الكل' ? '#fff' : '#475569' }}>الكل</button>
                {catalogCategories.map(c => (
                  <button key={c.category} onClick={() => setCatalogCategory(c.category)} style={{ ...chipStyle, background: catalogCategory === c.category ? '#2563eb' : '#fff', color: catalogCategory === c.category ? '#fff' : '#475569' }}>
                    {c.category} <span style={{ opacity:0.7, fontSize:'10px' }}>({c.count})</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
              {catalogItems.map(ci => (
                <div key={ci.id} onClick={() => handleCatalogSelect(ci)} style={{ padding:'16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', borderRadius:'12px', transition:'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontWeight:'900', fontSize:'15px', color:'#0f172a' }}>{ci.name}</div>
                    <div style={{ fontSize:'12px', color:'#64748b', display:'flex', gap:'16px', marginTop:'6px' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Barcode size={12}/> {ci.barcode || '—'}</span>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><Package size={12}/> {ci.category}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:'12px', background:'#eff6ff', padding:'6px 12px', borderRadius:'8px', color:'#2563eb', fontWeight:'800' }}>
                    {ci.unit}
                  </div>
                </div>
              ))}
              {catalogItems.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 20px', color:'#94a3b8', fontWeight:'700' }}>لا توجد نتائج مطابقة</div>
              )}
            </div>
          </div>
        </div>
      )}

      {labelProduct && labelSettings && (
        <LabelPrintModal product={labelProduct} settings={labelSettings} onClose={() => setLabelProduct(null)} />
      )}

      {showHistory && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'700px' }}>
            <div style={{ padding:'24px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ fontWeight:'900', fontSize:'18px' }}>سجل المخزون</h3>
                <p style={{ fontSize:'13px', color:'#64748b', marginTop:'4px' }}>{historyProduct?.Name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24}/></button>
            </div>
            <div style={{ padding:'24px', maxHeight:'60vh', overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
                <thead>
                  <tr style={{ color:'#94a3b8', fontSize:'12px' }}>
                    <th style={{ padding:'12px' }}>العملية</th>
                    <th style={{ padding:'12px' }}>الكمية</th>
                    <th style={{ padding:'12px' }}>السبب</th>
                    <th style={{ padding:'12px' }}>المرجع</th>
                    <th style={{ padding:'12px' }}>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                      <td style={{ padding:'12px' }}>{h.change_amount > 0 ? <ArrowUpRight color="#10b981" size={16}/> : <ArrowDownRight color="#ef4444" size={16}/>}</td>
                      <td style={{ padding:'12px', fontWeight:'800', color: h.change_amount > 0 ? '#10b981' : '#ef4444' }}>{h.change_amount > 0 ? \`+\${h.change_amount}\` : h.change_amount}</td>
                      <td style={{ padding:'12px', fontSize:'13px' }}>{h.reason}</td>
                      <td style={{ padding:'12px', fontSize:'11px', color:'#94a3b8' }}>{h.reference_id || '—'}</td>
                      <td style={{ padding:'12px', fontSize:'12px' }}>{new Date(h.timestamp).toLocaleString('ar-SA')}</td>
                    </tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan="5" style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>لا يوجد سجل</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SegmentBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{ 
      flex: 1, padding:'10px', textAlign:'center', borderRadius:'10px', 
      background: active ? '#ffffff' : 'transparent', 
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none', 
      color: active ? '#2563eb' : '#64748b', 
      fontWeight: active ? '900' : '700', 
      fontSize:'13px', cursor:'pointer', border:'none', fontFamily:'inherit', transition:'all 0.2s'
    }}>
      {children}
    </button>
  );
}

function F({ label, value, onChange, placeholder, type='text' }) {
  return (
    <div>
      <label style={{ display:'block', marginBottom:'8px', fontWeight:'800', fontSize:'13px', color:'#475569' }}>{label}</label>
      <input type={type} value={value||''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Pill({ children, color }) {
  const styles = { 
    blue: { bg: '#eff6ff', text: '#2563eb' }, 
    purple: { bg: '#f5f3ff', text: '#8b5cf6' },
    gray: { bg: '#f1f5f9', text: '#475569' }
  };
  const theme = styles[color] || styles.blue;
  return <span style={{ background:theme.bg, color:theme.text, padding:'6px 14px', borderRadius:'99px', fontSize:'12px', fontWeight:'800' }}>{children}</span>;
}

const inputStyle = { width:'100%', padding:'12px 16px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box', color:'#0f172a', fontWeight:'600' };
const TH = { textAlign:'right', padding:'16px 12px', fontSize:'13px', color:'#94a3b8', fontWeight:'800' };
const TD = { padding:'16px 12px', fontSize:'14px', verticalAlign:'middle' };
const actionBtn = { padding:'14px', borderRadius:'14px', border:'none', fontSize:'14px', fontWeight:'900', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' };
const iconBtn = { width:'36px', height:'36px', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' };
const overlay = { position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modal = { background:'white', borderRadius:'24px', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.15)', width:'90%', overflow:'hidden', direction:'rtl' };
const chipStyle = { padding:'8px 16px', borderRadius:'20px', border:'1px solid #e2e8f0', fontSize:'13px', fontWeight:'800', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.2s' };
`;

fs.writeFileSync(path.join(__dirname, 'src', 'pages', 'MenuAdmin.jsx'), jsxContent, 'utf8');
console.log('MenuAdmin.jsx rewritten.');
