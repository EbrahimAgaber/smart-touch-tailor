import { memo, useEffect } from 'react';

const ModifiersModal = memo(function ModifiersModal({ modTarget, selectedMods, setSelectedMods, onConfirm, onClose }) {
  useEffect(() => { document.body.dataset.modalOpen = '1'; return () => delete document.body.dataset.modalOpen; }, []);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1600, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', width:'450px', borderRadius:'24px', padding:'32px' }}>
        <h3 style={{ marginBottom:'24px', fontWeight:'900', fontSize:'20px' }}>إضافات — {modTarget?.Name}</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'28px' }}>
          {modTarget?.Modifiers?.map(m => (
            <label key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'16px', borderRadius:'16px', border:'1px solid var(--border)', cursor:'pointer', transition:'border 0.15s', background: selectedMods.find(x=>x.id===m.id) ? 'var(--primary-light)' : 'white' }}>
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <input type="checkbox" checked={!!selectedMods.find(x=>x.id===m.id)}
                  onChange={e => { if(e.target.checked) setSelectedMods([...selectedMods,m]); else setSelectedMods(selectedMods.filter(x=>x.id!==m.id)); }}
                  style={{ width:'18px', height:'18px', accentColor:'var(--primary)', cursor:'pointer' }} />
                <span style={{ fontWeight:'800' }}>{m.name}</span>
              </div>
              <span style={{ fontWeight:'900', color:'var(--primary)' }}>+ SAR {parseFloat(m.price||0).toFixed(2)}</span>
            </label>
          ))}
        </div>
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'14px', borderRadius:'14px', border:'1px solid var(--border)', background:'white', fontWeight:'800', cursor:'pointer' }}>إلغاء</button>
          <button onClick={onConfirm} style={{ flex:2, padding:'14px', borderRadius:'14px', border:'none', background:'var(--primary)', color:'white', fontWeight:'900', cursor:'pointer' }}>تأكيد الإضافة</button>
        </div>
      </div>
    </div>
  );
});
export default ModifiersModal;
