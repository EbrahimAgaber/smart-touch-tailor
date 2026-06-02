import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

// FIX: Inject keyframes exactly once at module load, not on every render.
// The previous pattern appended duplicate @keyframes rules to <head> on each
// open/close cycle of the modal — thousands of duplicate rules after a busy shift.
if (typeof document !== 'undefined' && !document.getElementById('styled-confirm-keyframes')) {
  const style = document.createElement('style');
  style.id = 'styled-confirm-keyframes';
  style.textContent = `
    @keyframes scFadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `;
  document.head.appendChild(style);
}

/**
 * A premium, non-blocking replacement for window.confirm
 * Usage: 
 * const { confirm } = useStyledConfirm();
 * if (await confirm({ title: 'Delete?', message: '...' })) { ... }
 */

export const StyledConfirm = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'تأكيد الإجراء', 
  message = 'هل أنت متأكد؟',
  type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  confirmText = 'تأكيد',
  cancelText = 'إلغاء'
}) => {
  if (!isOpen) return null;

  const themes = {
    warning: { icon: <AlertCircle size={48} color="#f59e0b" />, bg: '#fff7ed', btn: '#f59e0b' },
    danger:  { icon: <XCircle size={48} color="#ef4444" />, bg: '#fef2f2', btn: '#ef4444' },
    info:    { icon: <Info size={48} color="#3b82f6" />, bg: '#eff6ff', btn: '#3b82f6' },
    success: { icon: <CheckCircle2 size={48} color="#10b981" />, bg: '#ecfdf5', btn: '#10b981' },
  };

  const theme = themes[type] || themes.warning;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', 
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', 
      justifyContent: 'center', zIndex: 9999, animation: 'scFadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '32px', padding: '32px', 
        maxWidth: '420px', width: '90%', textAlign: 'center', 
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        animation: 'scSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }} onClick={e => e.stopPropagation()} dir="rtl">
        
        <div style={{ 
          width: '80px', height: '80px', borderRadius: '24px', 
          background: theme.bg, display: 'flex', alignItems: 'center', 
          justifyContent: 'center', margin: '0 auto 24px' 
        }}>
          {theme.icon}
        </div>

        <h3 style={{ 
          fontSize: '22px', fontWeight: '900', color: '#0f172a', 
          marginBottom: '12px', fontFamily: 'inherit' 
        }}>
          {title}
        </h3>
        
        <p style={{ 
          fontSize: '15px', color: '#64748b', lineHeight: '1.6', 
          marginBottom: '32px', fontFamily: 'inherit' 
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1, padding: '14px', borderRadius: '16px', border: '1px solid #e2e8f0',
              background: 'white', color: '#64748b', fontWeight: '700', 
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s'
            }}>
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            style={{
              flex: 1.5, padding: '14px', borderRadius: '16px', border: 'none',
              background: theme.btn, color: 'white', fontWeight: '800', 
              cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 8px 16px ${theme.btn}40`,
              transition: 'all 0.2s'
            }}>
            {confirmText}
          </button>
        </div>
      </div>

      {/* keyframes injected once at module load above — no per-render <style> tag */}
    </div>
  );
};
