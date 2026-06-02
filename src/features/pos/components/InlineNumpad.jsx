import React from 'react';
import { Delete } from 'lucide-react';

/**
 * InlineNumpad — Dual-mode numeric input pad
 *
 * Props:
 *   value       {string}   — current string value
 *   onChange    {fn}       — called with new string
 *   onEnter     {fn}       — called when ✓ is pressed (floating mode)
 *   onClose     {fn}       — called when ✕ is pressed (floating mode)
 *   onConfirm   {fn}       — alias for onEnter (docked mode)
 *   position    {object}   — CSS position overrides (floating only)
 *   label       {string}   — label text shown at top
 *   docked      {bool}     — if true, renders inline (no absolute positioning)
 *   mode        {string}   — 'amount' | 'qty' — affects decimal visibility
 */
const InlineNumpad = ({
  value = '',
  onChange,
  onEnter,
  onClose,
  onConfirm,
  position = {},
  label,
  docked = false,
  mode = 'amount',
}) => {
  const handlePress = (key) => {
    if (key === 'C') {
      onChange('');
    } else if (key === 'DEL') {
      onChange(String(value).slice(0, -1));
    } else if (key === '.') {
      if (!String(value).includes('.')) onChange(String(value) + '.');
    } else {
      onChange(String(value) + key);
    }
  };

  const handleConfirm = () => {
    if (onEnter) onEnter();
    else if (onConfirm) onConfirm();
  };

  const keys = mode === 'qty'
    ? ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'DEL']
    : ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'DEL'];

  const containerStyle = docked
    ? {
        background: 'white',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }
    : {
        position: 'absolute',
        ...position,
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18)',
        padding: '16px',
        width: '240px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label || 'أدخل القيمة'}
        </span>
        {!docked && onClose && (
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Display */}
      <div style={{
        background: '#f8fafc',
        border: '2px solid #e2e8f0',
        padding: '12px 16px',
        borderRadius: '12px',
        fontSize: '24px',
        fontWeight: '900',
        textAlign: 'center',
        color: '#0f172a',
        minHeight: '54px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: '0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value !== '' ? value : <span style={{ color: '#cbd5e1', fontSize: '18px' }}>0</span>}
      </div>

      {/* Keys */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {keys.map((k) => {
          const isClear = k === 'C';
          const isDel = k === 'DEL';
          const isDot = k === '.';
          return (
            <button
              key={k}
              onClick={() => handlePress(k)}
              style={{
                padding: '13px 8px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: isClear ? '#fee2e2' : isDel ? '#fef3c7' : 'white',
                color: isClear ? '#ef4444' : isDel ? '#d97706' : '#0f172a',
                fontWeight: 'bold',
                fontSize: isDot ? '20px' : '17px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'background 0.12s, transform 0.1s',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isDel ? <Delete size={17} /> : k}
            </button>
          );
        })}
      </div>

      {/* Confirm button (floating mode) */}
      {!docked && (
        <button
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '13px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '900',
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            letterSpacing: '0.03em',
          }}
        >
          ✓ تأكيد
        </button>
      )}
    </div>
  );
};

export default InlineNumpad;
