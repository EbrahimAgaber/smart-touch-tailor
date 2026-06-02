import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Wrench, CheckCircle, Clock } from 'lucide-react';

export default function Services() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = () => {
    window.api?.getHeldOrders?.().then(data => {
      // Filter out only service orders
      const services = (data || []).filter(o => o.order_type === 'service');
      setTickets(services);
    }).catch(e => console.error(e)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    await window.api?.updateHeldOrderStatus?.(id, status);
    fetchTickets();
  };

  const columns = [
    { id: 'pending', title: 'قيد الانتظار', icon: <Clock size={18} color="#f59e0b" />, bg: '#fef3c7' },
    { id: 'diagnosing', title: 'قيد التنفيذ / تشخيص', icon: <Wrench size={18} color="#3b82f6" />, bg: '#eff6ff' },
    { id: 'ready', title: 'جاهز للتسليم', icon: <CheckCircle size={18} color="#10b981" />, bg: '#ecfdf5' },
  ];

  if (loading) return <AppLayout title="الخدمات والصيانة"><div style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>جاري التحميل...</div></AppLayout>;

  return (
    <AppLayout title="لوحة الخدمات والصيانة">
      <div dir="rtl" style={{ display:'flex', gap:'20px', flex:1, minHeight:0 }}>
        {columns.map(col => {
          const colTickets = tickets.filter(t => (t.kds_status || 'pending') === col.id);
          return (
            <div key={col.id} style={{ flex:1, background:'white', borderRadius:'20px', boxShadow:'0 4px 12px rgba(0,0,0,0.03)', display:'flex', flexDirection:'column', overflow:'hidden', border:'1px solid #e2e8f0' }}>
              <div style={{ padding:'16px', background: col.bg, borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:'10px' }}>
                {col.icon}
                <div style={{ fontWeight:'800', fontSize:'15px', color:'#0f172a' }}>{col.title}</div>
                <div style={{ marginRight:'auto', background:'white', padding:'2px 8px', borderRadius:'99px', fontSize:'12px', fontWeight:'700', color:'#64748b' }}>{colTickets.length}</div>
              </div>
              <div style={{ padding:'14px', flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'12px', background:'#f8fafc' }}>
                {colTickets.length === 0 ? (
                   <div style={{ textAlign:'center', color:'#cbd5e1', padding:'30px 0', fontSize:'13px', fontWeight:'600' }}>لا يوجد تذاكر</div>
                ) : colTickets.map(t => (
                  <div key={t.id} style={{ background:'white', borderRadius:'14px', padding:'16px', border:'1px solid #e2e8f0', boxShadow:'0 2px 4px rgba(0,0,0,0.02)', display:'flex', flexDirection:'column', gap:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ fontWeight:'900', fontSize:'15px', color:'#0f172a' }}>{t.label}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>تذكرة #{t.id}</div>
                    </div>
                    {t.note && <div style={{ fontSize:'12px', color:'#64748b', background:'#f1f5f9', padding:'8px', borderRadius:'8px' }}>{t.note}</div>}
                    <div style={{ fontSize:'12px', color:'#3b82f6', fontWeight:'700' }}>{(t.items||[]).length} أصناف في الطلب</div>
                    
                    <div style={{ display:'flex', gap:'8px', marginTop:'10px', borderTop:'1px dashed #e2e8f0', paddingTop:'12px' }}>
                      {col.id !== 'pending' && <button onClick={() => updateStatus(t.id, col.id === 'ready' ? 'diagnosing' : 'pending')} style={{ flex:1, padding:'8px', fontSize:'11px', background:'#f1f5f9', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', color:'#64748b' }}>⬅️ تراجع</button>}
                      {col.id !== 'ready' && <button onClick={() => updateStatus(t.id, col.id === 'pending' ? 'diagnosing' : 'ready')} style={{ flex:1, padding:'8px', fontSize:'11px', background:'#3b82f6', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'700', color:'white' }}>التالي ➡️</button>}
                      {col.id === 'ready' && (
                        <button
                          onClick={() => {
                            // Navigate to POS with the held order items pre-loaded
                            navigate('/pos', { state: { resumeHeld: t } });
                          }}
                          style={{ flex:1, textAlign:'center', padding:'8px', fontSize:'11px', background:'#10b981', border:'none', borderRadius:'8px', fontWeight:'800', color:'white', cursor:'pointer', fontFamily:'inherit' }}
                        >
                          💳 إرسال للكاشير للدفع
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
