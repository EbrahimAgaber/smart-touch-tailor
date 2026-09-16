/**
 * ToastManager — State-driven notification system
 *
 * REPLACES: the showToast() DOM-injection function in the old Pos.jsx.
 *
 * ARCHITECTURE:
 *  - useToast()  → the hook consumed by any component that needs to fire a toast.
 *  - ToastManager → renders all active toasts in a React portal at document.body.
 *
 * USAGE:
 *   const { toast } = useToast();
 *   toast('عملية ناجحة', 'success');   // type: 'success' | 'error' | 'warn'
 */

import { createContext, useCallback, useContext, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

// ── Context ─────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Reducer ─────────────────────────────────────────────────────────
function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload];
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}

// ── Provider ────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const toast = useCallback((msg, type = 'error', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    dispatch({ type: 'ADD', payload: { id, msg, type } });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
  }, []);

  const dismiss = useCallback((id) => dispatch({ type: 'REMOVE', id }), []);

  const showToast = useCallback((msgOrObj, fallbackType = 'info') => {
    if (typeof msgOrObj === 'object' && msgOrObj !== null) {
      toast(msgOrObj.message || msgOrObj.msg || '', msgOrObj.type || fallbackType);
    } else {
      toast(msgOrObj, fallbackType);
    }
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, showToast, dismiss }}>
      {children}
      {createPortal(
        <ToastContainer toasts={toasts} onDismiss={dismiss} />,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ── Config ──────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: 'var(--toast-success-bg)',
    border: 'var(--toast-success-border)',
    color: '#065f46',
    iconColor: '#10b981',
  },
  error: {
    icon: AlertCircle,
    bg: 'var(--toast-error-bg)',
    border: 'var(--toast-error-border)',
    color: '#7f1d1d',
    iconColor: '#ef4444',
  },
  warn: {
    icon: AlertTriangle,
    bg: 'var(--toast-warn-bg)',
    border: 'var(--toast-warn-border)',
    color: '#78350f',
    iconColor: '#f59e0b',
  },
};

// ── UI Components ────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.error;
  const Icon = cfg.icon;

  return (
    <div
      className="toast-item animate-toast-in"
      role="alert"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      <Icon size={18} color={cfg.iconColor} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 700, fontSize: '14px', lineHeight: 1.4 }}>
        {toast.msg}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="إغلاق الإشعار"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: cfg.color, opacity: 0.6, display: 'flex', padding: '2px',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
