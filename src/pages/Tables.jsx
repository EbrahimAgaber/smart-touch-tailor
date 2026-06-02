import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { 
  Users, Coffee, Plus, Trash2, X, Save, 
  MapPin, CheckCircle2, AlertCircle 
} from 'lucide-react';

const STATUS_COLORS = {
  available: { bg: '#ecfdf5', color: '#059669', label: 'متاح' },
  occupied:  { bg: '#fef2f2', color: '#ef4444', label: 'مشغول' },
  reserved:  { bg: '#eff6ff', color: '#3b82f6', label: 'محجوز' },
  dirty:     { bg: '#fffbeb', color: '#d97706', label: 'بحاجة لتنظيف' },
};

export default function Tables() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isMapView, setIsMapView] = useState(false);
  const [activeZone, setActiveZone] = useState('');
  const [newTable, setNewTable] = useState({ name: '', zone: 'الصالة الرئيسية', capacity: 4 });

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const data = await window.api.getTables();
      setTables(data || []);
      if (data && data.length > 0 && !activeZone) {
        setActiveZone(data[0].zone);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDragEnd = async (tableId, e) => {
    if (!isMapView) return;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left - 50); // Adjust for card half-width
    const y = Math.round(e.clientY - rect.top - 50);
    
    // Optimistic update
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, x_pos: x, y_pos: y } : t));
    
    try {
      await window.api.updateTablePosition(tableId, x, y);
    } catch (err) {
      console.error("Failed to save position", err);
    }
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!newTable.name) return;
    await window.api.addTable(newTable);
    setNewTable({ name: '', zone: 'الصالة الرئيسية', capacity: 4 });
    setShowAddModal(false);
    fetchTables();
  };

  const handleTableClick = (table) => {
    if (table.current_order_id) {
       // Resume the held order associated with this table
       // In a real app, we'd navigate to POS with a specific order ID context
       navigate('/pos');
    } else {
       // Start a new order for this table
       navigate('/pos', { state: { tableId: table.id, tableName: table.name } });
    }
  };

  const zones = Array.from(new Set(tables.map(t => t.zone)));

  return (
    <AppLayout title="إدارة الطاولات">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>
        
        {/* Header Actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'12px' }}>
             <button onClick={() => setIsMapView(!isMapView)} style={{ ...toggleBtn(isMapView), padding:'10px 20px' }}>
               {isMapView ? '📋 عرض القائمة' : '🗺️ عرض الخريطة'}
             </button>
             {isMapView && (
                <select value={activeZone} onChange={e => setActiveZone(e.target.value)} style={inputStyle}>
                  {Array.from(new Set(tables.map(t => t.zone))).map(z => <option key={z} value={z}>{z}</option>)}
                </select>
             )}
          </div>
          <button onClick={() => setShowAddModal(true)} style={primaryBtn}>
            <Plus size={18} /> إضافة طاولة جديدة
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>جاري تحميل الخريطة...</div>
        ) : tables.length === 0 ? (
          <div style={{ textAlign:'center', padding:'100px', background:'white', borderRadius:'24px', border:'2px dashed #e2e8f0' }}>
            <div style={{ fontSize:'60px', marginBottom:'16px' }}>🍽️</div>
            <h3 style={{ fontWeight:'800', color:'#0f172a' }}>لا توجد طاولات حالياً</h3>
            <p style={{ color:'#94a3b8', fontSize:'14px', marginBottom:'20px' }}>ابدأ بإضافة طاولات المنشأة لتتمكن من إدارة الطلبات المحلية.</p>
            <button onClick={() => setShowAddModal(true)} style={primaryBtn}>+ أضف طاولتك الأولى</button>
          </div>
        ) : isMapView ? (
          /* CANVAS MAP VIEW */
          <div style={{ 
            flex:1, minHeight:0, background:'#f1f5f9', borderRadius:'32px', 
            position:'relative', overflow:'hidden', border:'2px dashed #cbd5e1',
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }}
          onDragOver={e => e.preventDefault()}>
             <div style={{ position:'absolute', top:20, right:20, padding:'8px 16px', background:'white', borderRadius:'12px', fontSize:'12px', color:'#94a3b8', fontWeight:'700', boxShadow:'0 4px 6px rgba(0,0,0,0.05)' }}>
               💡 اسحب الطاولات لتوزيعها على الخريطة
             </div>
             {tables.filter(t => t.zone === activeZone).map(table => {
               const status = STATUS_COLORS[table.status] || STATUS_COLORS.available;
               return (
                 <div key={table.id}
                   draggable
                   onDragEnd={(e) => handleDragEnd(table.id, e)}
                   onClick={() => handleTableClick(table)}
                   style={{
                     position: 'absolute',
                     left: table.x_pos || 50,
                     top: table.y_pos || 50,
                     width: '120px',
                     height: '140px',
                     background: 'white',
                     borderRadius: '24px',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center',
                     cursor: 'grab',
                     boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                     border: `3px solid ${table.current_order_id ? status.color : 'white'}`,
                     transition: 'transform 0.1s, border-color 0.2s',
                   }}>
                    <div style={{ fontSize:'32px' }}>{table.capacity > 6 ? '🛋️' : '🪑'}</div>
                    <div style={{ fontWeight:'900', fontSize:'14px', color:'#1e293b', marginTop:'4px' }}>{table.name}</div>
                    <div style={{ fontSize:'10px', color: status.color, fontWeight:'800', marginTop:'2px' }}>{status.label}</div>
                 </div>
               );
             })}
          </div>
        ) : (
          /* LIST VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', overflowY:'auto', flex:1, minHeight:0 }}>
             {tables.map(table => {
               const status = STATUS_COLORS[table.status] || STATUS_COLORS.available;
               return (
                 <div key={table.id} onClick={() => handleTableClick(table)} 
                      style={{ background: 'white', borderRadius: '24px', padding: '24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: `2px solid ${table.current_order_id ? status.color : 'transparent'}`, transition: 'all 0.2s' }}>
                   <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                     <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                       {table.capacity > 6 ? '🛋️' : '🪑'}
                     </div>
                     <div>
                       <div style={{ fontWeight: '900', fontSize: '18px', color: '#0f172a' }}>{table.name}</div>
                       <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                         <span>📍 {table.zone}</span>
                         <span>•</span>
                         <span>👥 {table.capacity}</span>
                       </div>
                     </div>
                   </div>
                   <div style={{ background: status.bg, color: status.color, padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '800' }}>
                     {status.label}
                   </div>
                 </div>
               );
             })}
          </div>
        )}
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div style={overlay}>
          <div style={modal} dir="rtl">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px' }}>إضافة طاولة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTable} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={labelStyle}>اسم/رقم الطاولة</label>
                <input style={inputStyle} value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} placeholder="مثال: طاولة 5" required />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div>
                  <label style={labelStyle}>المنطقة/الزون</label>
                  <input style={inputStyle} value={newTable.zone} onChange={e => setNewTable({...newTable, zone: e.target.value})} placeholder="مثال: الطابق العلوي" />
                </div>
                <div>
                  <label style={labelStyle}>عدد الكراسي (السعة)</label>
                  <input type="number" style={inputStyle} value={newTable.capacity} onChange={e => setNewTable({...newTable, capacity: parseInt(e.target.value)})} min="1" />
                </div>
              </div>
              <button type="submit" style={primaryBtnFull}>حفظ الطاولة</button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const primaryBtn = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'12px 24px', borderRadius:'14px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontSize:'14px', fontFamily:'inherit' };
const primaryBtnFull = { ...primaryBtn, width:'100%', marginTop:'10px', padding:'14px' };
const toggleBtn = (active) => ({ borderRadius:'12px', border: active ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: active ? '#eff6ff' : 'white', color: active ? '#1d4ed8' : '#64748b', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' });
const overlay = { position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modal   = { background:'white', borderRadius:'24px', padding:'32px', maxWidth:'480px', width:'95%', boxShadow:'0 20px 50px rgba(0,0,0,0.1)' };
const labelStyle = { display:'block', fontSize:'12px', fontWeight:'800', color:'#64748b', marginBottom:'8px' };
const inputStyle = { width:'200px', padding:'10px 14px', borderRadius:'12px', border:'2px solid #e2e8f0', fontSize:'13px', outline:'none', fontFamily:'inherit', background:'#fcfdfe', boxSizing:'border-box' };
