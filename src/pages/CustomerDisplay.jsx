import { useState, useEffect } from 'react';

export default function CustomerDisplay() {
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [bizName, setBizName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!window.api) return;
    window.api.onCartUpdate((data) => {
      setCart(data.items || []);
      setTotal(data.total || 0);
    });
    window.api.getSettings().then(s => setBizName(s.business_name_ar));
  }, []);

  const handleKeypad = (val) => {
    if (val === 'DEL') setPhone(prev => prev.slice(0, -1));
    else if (phone.length < 10) setPhone(prev => prev + val);
  };

  const handleSubmit = () => {
    if (phone.length < 10) return alert('يرجى إدخال رقم جوال صحيح');
    // IPC bridge to send loyalty data back to POS
    window.api.sendToMain?.('loyalty-signup', phone);
    setPhone('');
    alert('تم استلام طلبك، شكراً لك!');
  };

  return (
    <div dir="rtl" style={container}>
      {/* Sidebar: Totals & Loyalty */}
      <div style={sidebar}>
        <div>
            <h1 style={title}>{bizName || 'نظام البصمة الذكية'}</h1>
            <div style={totalBox}>
                <div style={totalLabel}>الإجمالي المستحق</div>
                <div style={totalValue}>SAR {total.toFixed(2)}</div>
            </div>
        </div>

        {/* INTERACTIVE LOYALTY (Task 2) */}
        <div style={loyaltySection}>
            <div style={{ fontSize:'14px', fontWeight:'800', marginBottom:'12px', textAlign:'center', color:'#94a3b8' }}>⭐ انضم لبرنامج النقاط</div>
            <div style={phoneDisplay}>{phone || 'أدخل رقم جوالك'}</div>
            <div style={keypadGrid}>
                {[1,2,3,4,5,6,7,8,9,'DEL',0].map(n => (
                    <button key={n} onClick={() => handleKeypad(n)} style={keyBtn}>{n}</button>
                ))}
                <button onClick={handleSubmit} style={{ ...keyBtn, background:'#3b82f6', color:'white', gridColumn:'span 1' }}>✓</button>
            </div>
        </div>

        <div style={footer}>شكراً لزيارتكم!</div>
      </div>
      
      {/* Main: Cart Items */}
      <div style={main}>
        <div style={header}>سلة المشتريات</div>
        <div style={cartList}>
          {cart.length === 0 ? (
            <div style={empty}>مرحباً بك في متجرنا</div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} style={cartItem}>
                <div style={{ flex:1 }}>
                  <div style={itemName}>{item.Name}</div>
                  <div style={itemQty}>الكمية: {item.Qty}</div>
                </div>
                <div style={itemPrice}>{(item.Price * item.Qty).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const container = { display:'flex', height:'100vh', background:'#f8fafc', fontFamily:'Arial, sans-serif', overflow:'hidden' };
const sidebar   = { width:'400px', background:'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', color:'white', padding:'32px', display:'flex', flexDirection:'column', justifyContent:'space-between' };
const main      = { flex:1, padding:'40px', display:'flex', flexDirection:'column' };
const title     = { fontSize:'24px', fontWeight:'900', marginBottom:'32px', textAlign:'center' };
const totalBox  = { background:'rgba(255,255,255,0.05)', padding:'24px', borderRadius:'24px', textAlign:'center', border:'1px solid rgba(255,255,255,0.1)' };
const totalLabel= { fontSize:'14px', opacity:0.6, marginBottom:'8px' };
const totalValue= { fontSize:'42px', fontWeight:'900', color:'#3b82f6' };
const footer    = { textAlign:'center', opacity:0.4, fontSize:'12px', marginTop:'20px' };
const header    = { fontSize:'22px', fontWeight:'900', marginBottom:'20px', color:'#1e293b' };
const cartList  = { flex:1, overflowY:'auto', background:'white', borderRadius:'24px', padding:'10px', boxShadow:'0 4px 20px rgba(0,0,0,0.05)' };
const cartItem  = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px', borderBottom:'1px solid #f1f5f9' };
const itemName  = { fontWeight:'800', fontSize:'16px', color:'#334155' };
const itemQty   = { fontSize:'12px', color:'#94a3b8', marginTop:'4px' };
const itemPrice = { fontWeight:'900', fontSize:'18px', color:'#0f172a' };
const empty     = { height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', color:'#cbd5e1', fontWeight:'700' };

const loyaltySection = { marginTop:'auto', padding:'20px', background:'rgba(255,255,255,0.03)', borderRadius:'24px', border:'1px solid rgba(255,255,255,0.05)' };
const phoneDisplay   = { background:'rgba(0,0,0,0.2)', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'20px', fontWeight:'900', marginBottom:'16px', color:'#3b82f6', letterSpacing:'2px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center' };
const keypadGrid     = { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' };
const keyBtn         = { background:'rgba(255,255,255,0.1)', border:'none', color:'white', padding:'12px', borderRadius:'12px', fontWeight:'900', fontSize:'16px', cursor:'pointer' };
