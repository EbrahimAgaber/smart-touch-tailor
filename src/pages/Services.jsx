import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Wrench, CheckCircle, Clock, Plus } from 'lucide-react';

export default function Services() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // New ticket state
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newDevice, setNewDevice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Checkout state
  const [checkoutTicket, setCheckoutTicket] = useState(null);
  const [servicePrice, setServicePrice] = useState('');

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

  const handleCreateTicket = async () => {
    if (!newDevice) {
      setErrorMsg('يرجى إدخال نوع الجهاز أو الخدمة');
      return;
    }
    setErrorMsg('');
    const note = `العميل: ${newCustName || 'غير محدد'} | الهاتف: ${newCustPhone || 'غير محدد'} | المشكلة: ${newDesc}${newPrice ? ' | التكلفة التقديرية: ' + newPrice + ' SAR' : ''}`;
    await window.api?.holdOrder?.({
      label: newDevice,
      items: [],
      note: note,
      order_type: 'service',
      kds_status: 'pending'
    });
    setShowNewTicket(false);
    setNewDevice(''); setNewDesc(''); setNewCustName(''); setNewCustPhone(''); setNewPrice('');
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
      <div dir="rtl" style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
        
        {/* Header Actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h2 style={{ fontSize:'18px', fontWeight:'800', margin:0, color:'#0f172a' }}>تذاكر الصيانة</h2>
          <button onClick={() => setShowNewTicket(true)} style={{ background:'#3b82f6', color:'white', border:'none', padding:'10px 16px', borderRadius:'10px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>
            <Plus size={18} /> تذكرة جديدة
          </button>
        </div>

        <div style={{ display:'flex', gap:'20px', flex:1, minHeight:0 }}>
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
                            setCheckoutTicket(t);
                            setServicePrice('');
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
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} dir="rtl">
          <div style={{ background:'white', padding:'24px', borderRadius:'20px', width:'400px', display:'flex', flexDirection:'column', gap:'16px', boxShadow:'0 10px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin:0, fontWeight:'800', fontSize:'18px', color:'#0f172a' }}>إنشاء تذكرة جديدة</h3>
            {errorMsg && <div style={{ background:'#fef2f2', color:'#ef4444', padding:'10px', borderRadius:'8px', fontSize:'13px', fontWeight:'700' }}>{errorMsg}</div>}
            
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>اسم العميل</label>
              <input placeholder="اختياري" value={newCustName} onChange={e => setNewCustName(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
            
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>رقم الهاتف</label>
              <input placeholder="اختياري" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>نوع الجهاز / الخدمة <span style={{color:'#ef4444'}}>*</span></label>
              <input placeholder="مثال: لابتوب ديل، صيانة شاشة..." value={newDevice} onChange={e => setNewDevice(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>التكلفة التقديرية (SAR)</label>
              <input type="number" placeholder="اختياري" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>وصف المشكلة</label>
              <textarea placeholder="اكتب تفاصيل المشكلة هنا..." value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', minHeight:'80px', fontFamily:'inherit', boxSizing:'border-box', resize:'vertical' }} />
            </div>

            <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
              <button onClick={() => { setShowNewTicket(false); setErrorMsg(''); }} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'800', color:'#475569', fontFamily:'inherit' }}>إلغاء</button>
              <button onClick={handleCreateTicket} style={{ flex:1, padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'800', fontFamily:'inherit' }}>إنشاء التذكرة</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Price Modal */}
      {checkoutTicket && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }} dir="rtl">
          <div style={{ background:'white', padding:'24px', borderRadius:'20px', width:'400px', display:'flex', flexDirection:'column', gap:'16px', boxShadow:'0 10px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin:0, fontWeight:'800', fontSize:'18px', color:'#0f172a' }}>تحديد التكلفة النهائية</h3>
            
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px' }}>المبلغ الإجمالي (SAR) <span style={{color:'#ef4444'}}>*</span></label>
              <input type="number" placeholder="أدخل تكلفة الصيانة هنا..." value={servicePrice} onChange={e => setServicePrice(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontFamily:'inherit', boxSizing:'border-box', fontSize:'16px', fontWeight:'700' }} autoFocus />
            </div>

            <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
              <button onClick={() => setCheckoutTicket(null)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'800', color:'#475569', fontFamily:'inherit' }}>إلغاء</button>
              <button onClick={() => {
                const price = parseFloat(servicePrice);
                if (isNaN(price) || price < 0) return alert('يرجى إدخال مبلغ صحيح');
                navigate('/pos', { state: { resumeHeld: { ...checkoutTicket, final_price: price } } });
              }} style={{ flex:1, padding:'12px', background:'#10b981', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'800', fontFamily:'inherit' }}>إرسال للكاشير</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
