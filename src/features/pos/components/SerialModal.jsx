import { memo, useEffect } from 'react';

const SerialModal = memo(function SerialModal({ serialTarget, serialInput, setSerialInput, onConfirm, onClose }) {
  useEffect(() => { document.body.dataset.modalOpen = '1'; return () => delete document.body.dataset.modalOpen; }, []);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.7)', backdropFilter:'blur(8px)', zIndex:1700, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', width:'90%', maxWidth:'440px', borderRadius:'28px', padding:'36px', boxShadow:'var(--shadow-premium)' }} dir="rtl">
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          <div style={{ width:'48px', height:'48px', background:'#f0f9ff', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>📋</div>
          <h3 style={{ fontSize:'20px', fontWeight:'900' }}>رقم السيريال — {serialTarget?.Name}</h3>
        </div>
        <p style={{ fontSize:'14px', color:'var(--text-secondary)', marginBottom:'20px' }}>هذا الصنف يتطلب إدخال الرقم التسلسلي قبل الإضافة.</p>
        <div style={{ marginBottom:'24px' }}>
          <label style={{ fontSize:'13px', fontWeight:'800', display:'block', marginBottom:'8px' }}>الرقم التسلسلي *</label>
          <input autoFocus type="text" value={serialInput} onChange={e=>setSerialInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&serialInput.trim()) onConfirm(); }}
            placeholder="امسح الباركود أو أدخل الرقم يدوياً..."
            style={{ width:'100%', padding:'16px', borderRadius:'14px', border:'2px solid var(--primary)', fontSize:'15px', fontWeight:'700', outline:'none', boxSizing:'border-box', direction:'ltr', textAlign:'left' }} />
        </div>
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'14px', borderRadius:'16px', border:'1px solid var(--border)', background:'white', fontWeight:'800', cursor:'pointer' }}>إلغاء</button>
          <button disabled={!serialInput.trim()} onClick={onConfirm}
            style={{ flex:2, padding:'14px', borderRadius:'16px', border:'none', background:serialInput.trim()?'var(--primary)':'var(--text-muted)', color:'white', fontWeight:'900', cursor:serialInput.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
            ✓ تأكيد وإضافة للطلب
          </button>
        </div>
      </div>
    </div>
  );
});
export default SerialModal;
