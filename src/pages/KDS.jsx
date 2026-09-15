import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { 
  ChefHat, Timer, 
  XCircle, Filter
} from 'lucide-react';

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('All');
  
  // Track hashes to detect new items or orders
  const prevCountRef = useRef(null);

  // ── Professional Chime (Web Audio API) ─────────────────────────
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playNote = (freq, start, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playNote(660, now, 0.1);
      playNote(880, now + 0.1, 0.3);
    } catch (e) { console.warn("Audio Context failed", e); }
  };

  const fetchOrders = async () => {
    try {
      const data = await window.api.getHeldOrders();
      const active = data.filter(o => o.kds_status !== 'served') || [];

      // Create a hash array: id-itemCount to detect modified or new orders
      const newHashes = active.map(o => `${o.id}-${(o.items || []).length}`);
      
      if (prevCountRef.current !== null) {
        let hasNew = false;
        for (const h of newHashes) {
          if (!prevCountRef.current.has(h)) hasNew = true;
        }
        if (hasNew) {
          playChime();
        }
      }
      
      prevCountRef.current = new Set(newHashes);
      setOrders(active);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await window.api.updateHeldOrderStatus(id, status);
      fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const getWaitTime = (createdAt) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now - start) / 60000);
    return diff;
  };

  const getWaitColor = (minutes) => {
    if (minutes > 30) return '#ef4444';
    if (minutes > 15) return '#f59e0b';
    return '#10b981';
  };

  const getOrderTypeBadge = (type) => {
    switch(type) {
      case 'dineIn': return '📍 محلي';
      case 'takeaway': return '🥡 سفري';
      case 'delivery': return '🛵 توصيل';
      case 'service': return '🔧 خدمة';
      case 'counter':
      default: return '🏪 كاونتر';
    }
  };

  const allCategories = ['All', ...new Set(orders.flatMap(o => (o.items || []).map(i => i.Category)).filter(Boolean))];

  let displayOrders = orders;
  if (filterCategory !== 'All') {
      displayOrders = orders.map(o => ({
          ...o,
          items: (o.items || []).filter(i => i.Category === filterCategory)
      })).filter(o => o.items.length > 0);
  }

  return (
    <AppLayout title="شاشة المطبخ (KDS)">
      <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:'20px' }}>
        
        {/* Category Filter */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
            <div style={{ background: 'white', padding: '8px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <Filter size={18} color="#64748b" />
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#64748b' }}>محطة التحضير:</span>
                <select 
                    value={filterCategory} 
                    onChange={e => setFilterCategory(e.target.value)}
                    style={{ border: 'none', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
                >
                    {allCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'جميع الأقسام' : c}</option>)}
                </select>
            </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px' }}>جاري تحميل الطلبات...</div>
        ) : displayOrders.length === 0 ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>
            <ChefHat size={80} style={{ opacity: 0.2, marginBottom:'16px' }} />
            <h3 style={{ fontWeight:'800' }}>لا توجد طلبات نشطة في هذا القسم</h3>
          </div>
        ) : (
          <div style={{ 
            display:'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap:'20px', 
            overflowY:'auto',
            paddingBottom: '20px'
          }}>
            {displayOrders.map(order => {
              const minutes = getWaitTime(order.created_at);
              const color = getWaitColor(minutes);

              return (
                <div key={order.id} style={{ 
                  background:'white', 
                  borderRadius:'24px', 
                  border:`2px solid ${order.kds_status === 'ready' ? '#10b981' : '#f1f5f9'}`,
                  display:'flex', 
                  flexDirection:'column',
                  maxHeight: '500px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
                  overflow:'hidden'
                }}>
                  {/* Header */}
                  <div style={{ 
                    padding:'16px 20px', 
                    background: order.kds_status === 'ready' ? '#ecfdf5' : '#f8fafc',
                    display:'flex', 
                    justifyContent:'space-between', 
                    alignItems:'center',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <div style={{ fontWeight:'900', fontSize:'18px', color:'#1e293b' }}>
                        {order.label || `#${order.id}`}
                      </div>
                      <div style={{ fontSize:'12px', color:'#64748b', fontWeight:'700', marginTop: '4px' }}>
                        {getOrderTypeBadge(order.order_type)}
                      </div>
                    </div>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px', color: color, fontWeight:'800', fontSize:'14px' }}>
                        <Timer size={14} /> {minutes} د
                      </div>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  {order.order_type === 'delivery' && (order.customer_name || order.customer_phone) && (
                    <div style={{ margin: '12px 16px 0 16px', padding: '10px', background: '#eff6ff', borderRadius: '12px', fontSize: '12px', color: '#1e3a8a' }}>
                        <div style={{ fontWeight: 'bold' }}>👤 {order.customer_name || 'عميل غير مسجل'}</div>
                        {order.customer_phone && <div style={{ marginTop: '4px' }}>📞 {order.customer_phone}</div>}
                        {order.customer_address && <div style={{ marginTop: '4px' }}>🏠 {order.customer_address}</div>}
                    </div>
                  )}

                  {/* Items */}
                  <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} style={{ 
                        padding:'10px 0', 
                        borderBottom: idx === order.items.length - 1 ? 'none' : '1px dashed #f1f5f9'
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'800', color:'#0f172a' }}>
                          <span>{item.Name}</span>
                          <span style={{ background:'#eff6ff', color:'#3b82f6', padding:'2px 8px', borderRadius:'6px' }}>×{item.Qty}</span>
                        </div>
                        {item.Note && <div style={{ fontSize:'11px', color:'#ef4444', fontStyle:'italic', marginTop:'4px' }}>⚠️ {item.Note}</div>}
                        {(item.Mods || []).map((m, midx) => (
                          <div key={midx} style={{ fontSize:'11px', color:'#64748b', marginRight:'12px' }}>+ {m.name}</div>
                        ))}
                      </div>
                    ))}
                    {order.note && (
                      <div style={{ marginTop:'12px', padding:'10px', background:'#fff7ed', borderRadius:'12px', fontSize:'12px', color:'#9a3412', border:'1px solid #ffedd5' }}>
                        <strong>ملاحظة عامة:</strong> {order.note}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ padding:'16px', background:'#f8fafc', borderTop:'1px solid #f1f5f9', display:'flex', gap:'10px' }}>
                    {order.kds_status === 'pending' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'preparing')}
                        style={{ ...btnBase, background:'#3b82f6', color:'white' }}
                      >
                         بدء التحضير
                      </button>
                    )}
                    {order.kds_status === 'preparing' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'ready')}
                        style={{ ...btnBase, background:'#10b981', color:'white' }}
                      >
                        جاهز للتسليم
                      </button>
                    )}
                    {order.kds_status === 'ready' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'served')}
                        style={{ ...btnBase, background:'#64748b', color:'white' }}
                      >
                         تم التسليم
                      </button>
                    )}
                    <button 
                      onClick={() => { if(confirm('إلغاء الطلب؟')) updateStatus(order.id, 'served'); }}
                      style={{ padding:'10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', color:'#94a3b8' }}
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const btnBase = { 
  flex: 1, 
  padding: '12px', 
  border: 'none', 
  borderRadius: '12px', 
  fontWeight: '800', 
  fontSize: '14px', 
  cursor: 'pointer', 
  fontFamily: 'inherit',
  display:'flex',
  justifyContent:'center',
  alignItems:'center',
  gap: '8px'
};
