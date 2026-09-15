import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import LabelPrintModal from '../components/LabelPrintModal';
import { 
  Package, Search, AlertTriangle, TrendingUp, Barcode, 
  Edit3, X, Trash2, CheckCircle2,
  History, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

export default function Stock() {
  const { t } = useTranslation();
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
    if (!confirm(t('stock.actions.delete_confirm'))) return;
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
        <AppLayout title={t('stock.title')}>
          <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>
        
        {/* TOP BAR / STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px' }}>
           <StatCard icon={<Package color="#3b82f6"/>} label={t('stock.stats.total_items')} value={stats.totalItems} color="#3b82f6" />
           <StatCard icon={<AlertTriangle color="#ef4444"/>} label={t('stock.stats.low_stock')} value={stats.lowStock} color="#ef4444" />
           <StatCard icon={<TrendingUp color="#10b981"/>} label={t('stock.stats.inventory_value')} value={`SAR ${stats.inventoryValue.toLocaleString()}`} color="#10b981" />
        </div>

        {/* SEARCH & ACTIONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', background:'var(--bg-card)', padding:'20px', borderRadius:'24px', border:'1px solid #f1f5f9' }}>
            <div style={{ position:'relative', width:'100%', maxWidth:'400px' }}>
              <Search size={18} style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
              <input 
                ref={searchRef}
                type="text" 
                placeholder={t('stock.actions.search_placeholder')} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', padding:'12px 48px 12px 16px', borderRadius:'14px', border:'1px solid #e2e8f0', outline:'none', fontSize:'14px' }}
              />
            </div>
           <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
             <div style={{ display:'flex', background:'#f1f5f9', padding:'4px', borderRadius:'14px', marginRight:'10px' }}>
                <button onClick={() => setActiveTab('inventory')} style={{ ...tabBtn, background: activeTab==='inventory' ? 'white' : 'transparent', boxShadow: activeTab==='inventory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{t('stock.tabs.inventory')}</button>
                <button onClick={() => setActiveTab('movement_report')} style={{ ...tabBtn, background: activeTab==='movement_report' ? 'white' : 'transparent', boxShadow: activeTab==='movement_report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>تقرير حركة المنتجات</button>
                <button onClick={() => setActiveTab('margin_audit')} style={{ ...tabBtn, background: activeTab==='margin_audit' ? 'white' : 'transparent', boxShadow: activeTab==='margin_audit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{t('stock.tabs.margin_audit')}</button>
             </div>
             <button onClick={() => navigate('/settings')} style={{ ...primaryBtnStyle, background:'var(--bg-card)', color:'var(--text-muted)', border:'1px solid #e2e8f0' }}>
               {t('stock.actions.label_settings')}
             </button>
             <button onClick={() => navigate('/menu-admin')} style={primaryBtnStyle}>
               {t('stock.actions.manage_products')}
             </button>
           </div>
        </div>

        {activeTab === 'inventory' ? (
          <InventoryView loading={loading} filtered={filtered} onEdit={handleEditRedirect} onDelete={handleDelete} onHistory={openHistory} onPrint={setLabelProduct} t={t} />
        ) : activeTab === 'movement_report' ? (
          <MovementReportView />
        ) : (
          <MarginAuditView loading={loading} products={products} onEdit={handleEditRedirect} t={t} />
        )}
      </div>


      {/* HISTORY MODAL */}
      {showHistory && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, maxWidth:'800px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
               <h2 style={{ fontSize:'18px', fontWeight:'800' }}>{t('stock.history.title', { name: selectedProduct?.Name })}</h2>
               <button onClick={() => setShowHistory(false)} style={{ border:'none', background:'transparent', color:'var(--text-muted)', cursor:'pointer' }}><X /></button>
            </div>
            
            <div style={{ maxHeight:'400px', overflowY:'auto', borderRadius:'16px', border:'1px solid #f1f5f9' }}>
               <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
                 <thead style={{ background:'var(--bg-card)', position:'sticky', top:0 }}>
                   <tr>
                     <th style={thStyle}>{t('stock.history.event')}</th>
                     <th style={thStyle}>{t('stock.history.quantity')}</th>
                     <th style={thStyle}>{t('stock.history.reason')}</th>
                     <th style={thStyle}>{t('stock.history.reference')}</th>
                     <th style={thStyle}>{t('stock.history.date')}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {history.map(h => (
                     <tr key={h.id} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
                       <td style={tdStyle}>
                         {h.change_amount > 0 ? <ArrowUpCircle size={16} color="#10b981" /> : <ArrowDownCircle size={16} color="#ef4444" />}
                       </td>
                       <td style={{ ...tdStyle, fontWeight:'800', color: h.change_amount > 0 ? '#10b981' : '#ef4444' }}>
                         {h.change_amount > 0 ? `+${h.change_amount}` : h.change_amount}
                       </td>
                       <td style={tdStyle}>
                         <span style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)' }}>
                           {h.reason === 'sale' ? t('stock.history.reasons.sale') : h.reason === 'purchase' ? t('stock.history.reasons.purchase') : h.reason === 'adjustment' ? t('stock.history.reasons.adjustment') : h.reason}
                         </span>
                       </td>
                       <td style={tdStyle}><span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{h.reference_id}</span></td>
                       <td style={tdStyle}><span style={{ fontSize:'11px' }}>{new Date(h.timestamp).toLocaleString('ar-SA')}</span></td>
                     </tr>
                   ))}
                   {history.length === 0 && (
                     <tr><td colSpan="5" style={{ textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>{t('stock.history.no_history')}</td></tr>
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

function InventoryView({ loading, filtered, onEdit, onDelete, onHistory, onPrint, t }) {
  if (loading) {
    return (
      <div style={{ background:'var(--bg-card)', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
          <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
            <tr>
              <th style={thStyle}>{t('stock.inventory.product')}</th>
              <th style={thStyle}>{t('stock.inventory.category')}</th>
              <th style={thStyle}>{t('stock.inventory.price')}</th>
              <th style={thStyle}>{t('stock.inventory.cost')}</th>
              <th style={thStyle}>{t('stock.inventory.stock')}</th>
              <th style={thStyle}>{t('stock.inventory.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
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
    <div style={{ background:'var(--bg-card)', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
        <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
          <tr>
            <th style={thStyle}>{t('stock.inventory.product')}</th>
            <th style={thStyle}>{t('stock.inventory.category')}</th>
            <th style={thStyle}>{t('stock.inventory.price')}</th>
            <th style={thStyle}>{t('stock.inventory.cost')}</th>
            <th style={thStyle}>{t('stock.inventory.stock')}</th>
            <th style={thStyle}>{t('stock.inventory.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.ID} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight:'700', color:'var(--text-main)' }}>{p.Name}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px', marginTop:'4px' }}>
                  <Barcode size={12} /> {p.Barcode || t('stock.inventory.no_barcode')}
                </div>
              </td>
              <td style={tdStyle}><span style={badgeStyle}>{p.Category}</span></td>
              <td style={tdStyle}><span style={{ fontWeight:'700' , fontFamily: "'Inter', sans-serif"}}>SAR {p.Price.toFixed(2)}</span></td>
              <td style={tdStyle}><span style={{ color:'var(--text-muted)' , fontFamily: "'Inter', sans-serif"}}>SAR {p.Cost.toFixed(2)}</span></td>
              <td style={tdStyle}>
                {p.IsService ? (
                  <span style={{ padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', background:'#f5f3ff', color:'#8b5cf6' }}>{t('stock.inventory.service')}</span>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', background: p.Stock <= (p.MinStockLevel || 5) ? '#fef2f2' : '#ecfdf5', color: p.Stock <= (p.MinStockLevel || 5) ? '#ef4444' : '#10b981' }}>
                      {p.Stock} {p.Unit || t('stock.inventory.unit')}
                    </span>
                    {p.Stock <= (p.MinStockLevel || 5) && <AlertTriangle size={14} color="#ef4444" />}
                  </div>
                )}
              </td>
              <td style={tdStyle}>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => onHistory(p)} style={{ ...iconBtnStyle, color:'var(--text-muted)' }}><History size={16} /></button>
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

function MarginAuditView({ loading, products, onEdit, t }) {
  if (loading) {
    return (
      <div style={{ background:'var(--bg-card)', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
        <div style={{ padding:'20px 24px', background:'#fff7ed', borderBottom:'1px solid #fed7aa', display:'flex', alignItems:'center', gap:'12px' }}>
          <div className="skeleton" style={{ width:'20px', height:'20px', borderRadius:'50%' }} />
          <div style={{ flex:1 }}>
            <div className="skeleton" style={{ width:'120px', height:'14px', marginBottom:'6px' }} />
            <div className="skeleton" style={{ width:'80%', height:'10px' }} />
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
          <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
            <tr>
              <th style={thStyle}>{t('stock.margin_audit.product')}</th>
              <th style={thStyle}>{t('stock.margin_audit.price')}</th>
              <th style={thStyle}>{t('stock.margin_audit.cost')}</th>
              <th style={thStyle}>{t('stock.margin_audit.margin')}</th>
              <th style={thStyle}>{t('stock.margin_audit.status')}</th>
              <th style={thStyle}>{t('stock.margin_audit.action')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc' }}>
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
    <div style={{ background:'var(--bg-card)', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
      <div style={{ padding:'20px 24px', background:'#fff7ed', borderBottom:'1px solid #fed7aa', display:'flex', alignItems:'center', gap:'12px' }}>
        <AlertTriangle color="#f97316" size={20} />
        <div>
          <div style={{ fontWeight:'800', color:'#9a3412', fontSize:'14px' }}>{t('stock.margin_audit.title')}</div>
          <div style={{ fontSize:'12px', color:'#c2410c' }}>{t('stock.margin_audit.subtitle')}</div>
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
        <thead style={{ background:'var(--bg-card)', borderBottom:'1px solid #f1f5f9' }}>
          <tr>
            <th style={thStyle}>{t('stock.margin_audit.product')}</th>
            <th style={thStyle}>{t('stock.margin_audit.price')}</th>
            <th style={thStyle}>{t('stock.margin_audit.cost')}</th>
            <th style={thStyle}>{t('stock.margin_audit.margin')}</th>
            <th style={thStyle}>{t('stock.margin_audit.status')}</th>
            <th style={thStyle}>{t('stock.margin_audit.action')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const margin = p.Price > 0 ? ((p.Price - p.Cost) / p.Price * 100) : 0;
            const isInvalid = p.Cost <= 0 && !p.IsService;
            return (
              <tr key={p.ID} className="hover-lift" style={{ borderBottom:'1px solid #f8fafc', background: isInvalid ? '#fffaf5' : 'transparent' }}>
                <td style={tdStyle}><span style={{ fontWeight:'700' }}>{p.Name}</span></td>
                <td style={{ ...tdStyle, fontFamily: "'Inter', sans-serif" }}>SAR {p.Price.toFixed(2)}</td>
                <td style={{ ...tdStyle, color: isInvalid ? '#ef4444' : '#0f172a', fontWeight: isInvalid ? '800' : '400' }}>
                  SAR {p.Cost.toFixed(2)}
                </td>
                <td style={{ ...tdStyle, fontWeight:'800', color: margin < 10 ? '#ef4444' : '#10b981' }}>
                  {margin.toFixed(1)}%
                </td>
                <td style={tdStyle}>
                  {isInvalid ? (
                    <span style={{ color:'#ef4444', fontSize:'12px', fontWeight:'800' }}>{t('stock.margin_audit.missing_cost')}</span>
                  ) : (
                    <span style={{ color:'#10b981', fontSize:'12px', fontWeight:'800' }}>{t('stock.margin_audit.valid')}</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => onEdit(p)} style={{ ...primaryBtnStyle, padding:'8px 16px', fontSize:'12px' }}>{t('stock.actions.edit_cost')}</button>
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
    <div style={{ background:'var(--bg-card)', padding:'24px', borderRadius:'24px', border:`1px solid ${color}20`, display:'flex', alignItems:'center', gap:'16px' }}>
      <div style={{ width:'48px', height:'48px', background:`${color}10`, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:'600' }}>{label}</div>
        <div style={{ fontSize:'20px', fontWeight:'800', color:'var(--text-main)' }}>{value}</div>
      </div>
    </div>
  );
}



// STYLES
const thStyle = { padding:'16px 20px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'700' };
const tdStyle = { padding:'16px 20px', fontSize:'14px', color:'var(--text-main)' };
const badgeStyle = { background:'#eff6ff', color:'#3b82f6', padding:'4px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700' };
const iconBtnStyle = { border:'none', background:'transparent', color:'var(--text-muted)', cursor:'pointer', padding:'4px' };
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
  background:'var(--bg-card)', width:'100%', maxWidth:'600px', borderRadius:'32px', padding:'32px',
  boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', direction:'rtl'
};

function MovementReportView() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMovements();
  }, [startDate, endDate]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const data = await window.api.getProductMovementReport({ startDate, endDate });
      setMovements(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>تقرير حركة المنتجات</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Tajawal', sans-serif; padding: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: right; }
          th { background: #f8fafc; font-weight: 800; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0 0 10px 0; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>تقرير حركة المنتجات</h2>
          <p style="color:#64748b; font-weight:700;">من: ${startDate} إلى: ${endDate}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>القسم</th>
              <th>الكمية المباعة</th>
              <th>إجمالي الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => `
              <tr>
                <td style="font-weight:700;">${m.product_name}</td>
                <td style="color:#64748b;">${m.category}</td>
                <td style="font-weight:800; color:#3b82f6;">${m.total_qty_sold}</td>
                <td style="font-weight:700;">${Number(m.total_revenue).toFixed(2)} SAR</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const mostSold = movements.length > 0 ? movements[0] : null;
  const leastSold = movements.length > 0 ? movements[movements.length - 1] : null;
  const totalQty = movements.reduce((sum, m) => sum + m.total_qty_sold, 0);
  const totalRev = movements.reduce((sum, m) => sum + m.total_revenue, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight:'5px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', background: 'var(--bg-card)', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>من تاريخ</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '12px 16px', borderRadius: '14px', border: '1px solid #e2e8f0', fontFamily:'inherit', outline:'none' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>إلى تاريخ</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '12px 16px', borderRadius: '14px', border: '1px solid #e2e8f0', fontFamily:'inherit', outline:'none' }} />
        </div>
        <button onClick={handlePrint} style={{ padding: '12px 24px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'8px' }}>
          طباعة التقرير
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ecfdf5', padding: '20px', borderRadius: '20px', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '13px', color: '#047857', fontWeight: '700' }}>الأكثر مبيعاً</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#064e3b', marginTop: '8px' }}>{mostSold ? `${mostSold.product_name} (${mostSold.total_qty_sold})` : '-'}</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '20px', borderRadius: '20px', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '700' }}>الأقل مبيعاً</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#7f1d1d', marginTop: '8px' }}>{leastSold ? `${leastSold.product_name} (${leastSold.total_qty_sold})` : '-'}</div>
        </div>
        <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: '700' }}>إجمالي الكميات المباعة</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#1e3a8a', marginTop: '8px' }}>{totalQty}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#475569', fontWeight: '700' }}>إجمالي الإيرادات</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', marginTop: '8px' }}>{totalRev.toFixed(2)} SAR</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b' }}>المنتج</th>
              <th style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b' }}>القسم</th>
              <th style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b' }}>الكمية المباعة</th>
              <th style={{ padding: '16px 20px', fontSize: '13px', color: '#64748b' }}>إجمالي الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color:'var(--text-muted)' }}>جاري التحميل...</td></tr>
            ) : movements.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color:'var(--text-muted)' }}>لا توجد بيانات لهذه الفترة</td></tr>
            ) : (
              movements.map((m, i) => (
                <tr key={m.product_id} style={{ borderBottom: i === movements.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 20px', fontWeight: '700' }}>{m.product_name}</td>
                  <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '13px' }}>{m.category}</td>
                  <td style={{ padding: '16px 20px', fontWeight: '800', color: '#3b82f6' }}>{m.total_qty_sold}</td>
                  <td style={{ padding: '16px 20px', fontWeight: '700' }}>{Number(m.total_revenue).toFixed(2)} SAR</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
