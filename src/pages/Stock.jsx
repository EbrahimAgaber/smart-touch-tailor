import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import LabelPrintModal from '../components/LabelPrintModal';
import { 
  Package, Search, AlertTriangle, TrendingUp, Barcode, 
  Edit3, X, Trash2, CheckCircle2,
  History, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

export default function Stock() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const searchRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'margin_audit'
  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Label State
  const [labelProduct, setLabelProduct] = useState(null);
  const [settings, setSettings] = useState({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // intentional: runs once on mount
  useEffect(() => {
    fetchProducts();
    fetchSettings();
    if (searchRef.current) searchRef.current.focus();
  }, []);

  const fetchSettings = async () => {
    try {
      const s = await window.api.getSettings();
      if (s) setSettings(s);
    } catch (_e) { /* silent fail */ }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await window.api.getMenu();
      setProducts(data || []);
    } catch (e) {
      console.error("Fetch failed:", e);
    }
    setLoading(false);
  };

  const handleEditRedirect = (p) => {
    navigate('/menu-admin', { state: { editItem: p } });
  };


  const handleDelete = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    await window.api.deleteMenuItem(id);
    fetchProducts();
  };

  const openHistory = async (product) => {
    setSelectedProduct(product);
    try {
      const data = await window.api.getStockHistory(product.ID);
      setHistory(data || []);
      setShowHistory(true);
    } catch (e) { console.error(e); }
  };



  const filtered = products.filter(p => 
    p.Name.toLowerCase().includes(search.toLowerCase()) || 
    (p.Barcode && p.Barcode.includes(search))
  );

  const stats = {
    totalItems: products.length,
    lowStock: products.filter(p => !p.IsService && p.Stock <= (p.MinStockLevel || 5)).length,
    inventoryValue: products.reduce((acc, p) => acc + (p.Stock * p.Cost), 0)
  };

  return (
        <AppLayout title="إدارة المخزون والباركود">
          <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>
        
        {/* TOP BAR / STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px' }}>
           <StatCard icon={<Package color="#3b82f6"/>} label="إجمالي المنتجات" value={stats.totalItems} color="#3b82f6" />
           <StatCard icon={<AlertTriangle color="#ef4444"/>} label="تنبيهات المخزون" value={stats.lowStock} color="#ef4444" />
           <StatCard icon={<TrendingUp color="#10b981"/>} label="قيمة المخزون" value={`SAR ${stats.inventoryValue.toLocaleString()}`} color="#10b981" />
        </div>

        {/* SEARCH & ACTIONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', background:'white', padding:'20px', borderRadius:'24px', border:'1px solid #f1f5f9' }}>
            <div style={{ position:'relative', width:'100%', maxWidth:'400px' }}>
              <Search size={18} style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
              <input 
                ref={searchRef}
                type="text" 
                placeholder="ابحث بالاسم أو الباركود..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', padding:'12px 48px 12px 16px', borderRadius:'14px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px' }}
              />
            </div>
           <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
             <div style={{ display:'flex', background:'#f1f5f9', padding:'4px', borderRadius:'14px', marginRight:'10px' }}>
                <button onClick={() => setActiveTab('inventory')} style={{ ...tabBtn, background: activeTab==='inventory' ? 'white' : 'transparent', boxShadow: activeTab==='inventory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>المخزون</button>
                <button onClick={() => setActiveTab('margin_audit')} style={{ ...tabBtn, background: activeTab==='margin_audit' ? 'white' : 'transparent', boxShadow: activeTab==='margin_audit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>تدقيق الهوامش</button>
             </div>
             <button onClick={() => navigate('/settings')} style={{ ...primaryBtnStyle, background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0' }}>
               ⚙️ إعدادات الملصق
             </button>
             <button onClick={() => navigate('/menu-admin')} style={primaryBtnStyle}>
               🏷️ إدارة المنتجات
             </button>
           </div>
        </div>

        {activeTab === 'inventory' ? (
          <InventoryView loading={loading} filtered={filtered} onEdit={handleEditRedirect} onDelete={handleDelete} onHistory={openHistory} onPrint={setLabelProduct} />
        ) : (
          <MarginAuditView loading={loading} products={products} onEdit={handleEditRedirect} />
        )}
      </div>


      {/* HISTORY MODAL */}
      {showHistory && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, maxWidth:'800px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
               <h2 style={{ fontSize:'18px', fontWeight:'800' }}>سجل حركة المنتج: {selectedProduct?.Name}</h2>
               <button onClick={() => setShowHistory(false)} style={{ border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer' }}><X /></button>
            </div>
            
            <div style={{ maxHeight:'400px', overflowY:'auto', borderRadius:'16px', border:'1px solid #f1f5f9' }}>
               <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
                 <thead style={{ background:'#f8fafc', position:'sticky', top:0 }}>
                   <tr>
                     <th style={thStyle}>الحدث</th>
                     <th style={thStyle}>الكمية</th>
                     <th style={thStyle}>السبب</th>
                     <th style={thStyle}>المرجع</th>
                     <th style={thStyle}>التاريخ</th>
                   </tr>
                 </thead>
                 <tbody>
                   {history.map(h => (
                     <tr key={h.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                       <td style={tdStyle}>
                         {h.change_amount > 0 ? <ArrowUpCircle size={16} color="#10b981" /> : <ArrowDownCircle size={16} color="#ef4444" />}
                       </td>
                       <td style={{ ...tdStyle, fontWeight:'800', color: h.change_amount > 0 ? '#10b981' : '#ef4444' }}>
                         {h.change_amount > 0 ? `+${h.change_amount}` : h.change_amount}
                       </td>
                       <td style={tdStyle}>
                         <span style={{ fontSize:'12px', fontWeight:'700', color:'#64748b' }}>
                           {h.reason === 'sale' ? 'مبيعات' : h.reason === 'purchase' ? 'توريد مشتريات' : h.reason === 'adjustment' ? 'تعديل يدوي' : h.reason}
                         </span>
                       </td>
                       <td style={tdStyle}><span style={{ fontSize:'11px', color:'#94a3b8' }}>{h.reference_id}</span></td>
                       <td style={tdStyle}><span style={{ fontSize:'11px' }}>{new Date(h.timestamp).toLocaleString('ar-SA')}</span></td>
                     </tr>
                   ))}
                   {history.length === 0 && (
                     <tr><td colSpan="5" style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>لا توجد حركات مسجلة لهذا المنتج</td></tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
      {/* LABEL PRINT MODAL */}
      {labelProduct && settings?.business_name_ar !== undefined && (
        <LabelPrintModal
          product={labelProduct}
          settings={settings}
          onClose={() => setLabelProduct(null)}
        />
      )}
    </AppLayout>
  );
}

function InventoryView({ loading, filtered, onEdit, onDelete, onHistory, onPrint }) {
  if (loading) {
    return (
      <div style={{ background:'white', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
          <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
            <tr>
              <th style={thStyle}>المنتج / الباركود</th>
              <th style={thStyle}>القسم</th>
              <th style={thStyle}>سعر البيع</th>
              <th style={thStyle}>التكلفة</th>
              <th style={thStyle}>الكمية</th>
              <th style={thStyle}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #f8fafc' }}>
                <td style={tdStyle}>
                  <div className="skeleton" style={{ width:'140px', height:'14px', marginBottom:'8px' }} />
                  <div className="skeleton" style={{ width:'80px', height:'10px' }} />
                </td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'60px', height:'18px', borderRadius:'6px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'70px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'70px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'50px', height:'18px', borderRadius:'8px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'100px', height:'32px', borderRadius:'8px' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ background:'white', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
        <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
          <tr>
            <th style={thStyle}>المنتج / الباركود</th>
            <th style={thStyle}>القسم</th>
            <th style={thStyle}>سعر البيع</th>
            <th style={thStyle}>التكلفة</th>
            <th style={thStyle}>الكمية</th>
            <th style={thStyle}>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.ID} style={{ borderBottom:'1px solid #f8fafc' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight:'700', color:'#1e293b' }}>{p.Name}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', display:'flex', alignItems:'center', gap:'4px', marginTop:'4px' }}>
                  <Barcode size={12} /> {p.Barcode || 'بدون باركود'}
                </div>
              </td>
              <td style={tdStyle}><span style={badgeStyle}>{p.Category}</span></td>
              <td style={tdStyle}><span style={{ fontWeight:'700' }}>SAR {p.Price.toFixed(2)}</span></td>
              <td style={tdStyle}><span style={{ color:'#64748b' }}>SAR {p.Cost.toFixed(2)}</span></td>
              <td style={tdStyle}>
                {p.IsService ? (
                  <span style={{ padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', background:'#f5f3ff', color:'#8b5cf6' }}>🛎️ خدمة</span>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', background: p.Stock <= (p.MinStockLevel || 5) ? '#fef2f2' : '#ecfdf5', color: p.Stock <= (p.MinStockLevel || 5) ? '#ef4444' : '#10b981' }}>
                      {p.Stock} {p.Unit || 'وحدة'}
                    </span>
                    {p.Stock <= (p.MinStockLevel || 5) && <AlertTriangle size={14} color="#ef4444" />}
                  </div>
                )}
              </td>
              <td style={tdStyle}>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => onHistory(p)} style={{ ...iconBtnStyle, color:'#64748b' }}><History size={16} /></button>
                  <button onClick={() => onPrint(p)} style={{ ...iconBtnStyle, color:'#3b82f6' }}><Barcode size={16} /></button>
                  <button onClick={() => onEdit(p)} style={iconBtnStyle}><Edit3 size={16} /></button>
                  <button onClick={() => onDelete(p.ID)} style={{ ...iconBtnStyle, color:'#ef4444' }}><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginAuditView({ loading, products, onEdit }) {
  if (loading) {
    return (
      <div style={{ background:'white', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
        <div style={{ padding:'20px 24px', background:'#fff7ed', borderBottom:'1px solid #fed7aa', display:'flex', alignItems:'center', gap:'12px' }}>
          <div className="skeleton" style={{ width:'20px', height:'20px', borderRadius:'50%' }} />
          <div style={{ flex:1 }}>
            <div className="skeleton" style={{ width:'120px', height:'14px', marginBottom:'6px' }} />
            <div className="skeleton" style={{ width:'80%', height:'10px' }} />
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
          <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
            <tr>
              <th style={thStyle}>المنتج</th>
              <th style={thStyle}>سعر البيع</th>
              <th style={thStyle}>التكلفة (Cost)</th>
              <th style={thStyle}>هامش الربح</th>
              <th style={thStyle}>الحالة</th>
              <th style={thStyle}>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #f8fafc' }}>
                <td style={tdStyle}><div className="skeleton" style={{ width:'120px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'80px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'80px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'60px', height:'14px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'70px', height:'18px', borderRadius:'6px' }} /></td>
                <td style={tdStyle}><div className="skeleton" style={{ width:'100px', height:'32px', borderRadius:'14px' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ background:'white', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
      <div style={{ padding:'20px 24px', background:'#fff7ed', borderBottom:'1px solid #fed7aa', display:'flex', alignItems:'center', gap:'12px' }}>
        <AlertTriangle color="#f97316" size={20} />
        <div>
          <div style={{ fontWeight:'800', color:'#9a3412', fontSize:'14px' }}>تدقيق هوامش الربح</div>
          <div style={{ fontSize:'12px', color:'#c2410c' }}>المنتجات التي ليس لها تكلفة (0.00) تسبب تقارير أرباح خاطئة بنسبة 100%. يرجى تصحيح التكلفة أدناه.</div>
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
        <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
          <tr>
            <th style={thStyle}>المنتج</th>
            <th style={thStyle}>سعر البيع</th>
            <th style={thStyle}>التكلفة (Cost)</th>
            <th style={thStyle}>هامش الربح</th>
            <th style={thStyle}>الحالة</th>
            <th style={thStyle}>الإجراء</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const margin = p.Price > 0 ? ((p.Price - p.Cost) / p.Price * 100) : 0;
            const isInvalid = p.Cost <= 0 && !p.IsService;
            return (
              <tr key={p.ID} style={{ borderBottom:'1px solid #f8fafc', background: isInvalid ? '#fffaf5' : 'transparent' }}>
                <td style={tdStyle}><span style={{ fontWeight:'700' }}>{p.Name}</span></td>
                <td style={tdStyle}>SAR {p.Price.toFixed(2)}</td>
                <td style={{ ...tdStyle, color: isInvalid ? '#ef4444' : '#0f172a', fontWeight: isInvalid ? '800' : '400' }}>
                  SAR {p.Cost.toFixed(2)}
                </td>
                <td style={{ ...tdStyle, fontWeight:'800', color: margin < 10 ? '#ef4444' : '#10b981' }}>
                  {margin.toFixed(1)}%
                </td>
                <td style={tdStyle}>
                  {isInvalid ? (
                    <span style={{ color:'#ef4444', fontSize:'12px', fontWeight:'800' }}>⚠️ تكلفة مفقودة</span>
                  ) : (
                    <span style={{ color:'#10b981', fontSize:'12px', fontWeight:'800' }}>✅ سليم</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => onEdit(p)} style={{ ...primaryBtnStyle, padding:'8px 16px', fontSize:'12px' }}>تعديل التكلفة</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tabBtn = { padding:'10px 20px', borderRadius:'10px', border:'none', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' };



function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background:'white', padding:'24px', borderRadius:'24px', border:`1px solid ${color}20`, display:'flex', alignItems:'center', gap:'16px' }}>
      <div style={{ width:'48px', height:'48px', background:`${color}10`, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize:'13px', color:'#94a3b8', fontWeight:'600' }}>{label}</div>
        <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a' }}>{value}</div>
      </div>
    </div>
  );
}



// STYLES
const thStyle = { padding:'16px 20px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' };
const tdStyle = { padding:'16px 20px', fontSize:'14px' };
const badgeStyle = { background:'#eff6ff', color:'#3b82f6', padding:'4px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700' };
const iconBtnStyle = { border:'none', background:'transparent', color:'#94a3b8', cursor:'pointer', padding:'4px' };
const primaryBtnStyle = { 
  background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white', border:'none', 
  padding:'12px 24px', borderRadius:'14px', fontWeight:'700', cursor:'pointer',
  display:'flex', alignItems:'center', gap:'8px', fontSize:'14px'
};
const modalOverlayStyle = {
  position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(15, 23, 42, 0.4)',
  backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
};
const modalStyle = {
  background:'white', width:'100%', maxWidth:'600px', borderRadius:'32px', padding:'32px',
  boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', direction:'rtl'
};
