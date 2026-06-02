import { Delete, X } from 'lucide-react';

export default function Numpad({ value, onChange, onConfirm, onClose, title = "تعديل الكمية" }) {
  const handleKey = (key) => {
    if (key === 'del') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (!value.includes('.')) onChange(value + '.');
    } else {
      onChange(value + key);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: '800' }}>{title}</span>
          <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
        </div>
        
        <div style={displayStyle}>
          {value || '0'}
        </div>

        <div style={gridStyle}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              style={k === 'del' ? { ...keyStyle, background: '#fee2e2', color: '#ef4444' } : keyStyle}
            >
              {k === 'del' ? <Delete size={20} /> : k}
            </button>
          ))}
        </div>

        <button onClick={onConfirm} style={confirmBtnStyle}>تأكيد</button>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle = {
  background: 'white',
  borderRadius: '24px',
  padding: '24px',
  width: '320px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px'
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8'
};

const displayStyle = {
  background: '#f8fafc',
  padding: '20px',
  borderRadius: '16px',
  fontSize: '32px',
  fontWeight: '800',
  textAlign: 'center',
  marginBottom: '20px',
  color: '#0f172a',
  border: '1px solid #f1f5f9'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  marginBottom: '24px'
};

const keyStyle = {
  height: '60px',
  borderRadius: '16px',
  border: '1px solid #f1f5f9',
  background: 'white',
  fontSize: '20px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit'
};

const confirmBtnStyle = {
  width: '100%',
  padding: '16px',
  borderRadius: '16px',
  border: 'none',
  background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
  color: 'white',
  fontWeight: '800',
  fontSize: '16px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 8px 20px rgba(37,99,235,0.3)'
};
