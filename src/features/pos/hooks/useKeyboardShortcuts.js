import { useEffect, useCallback, useRef } from 'react';

/**
 * useKeyboardShortcuts
 * Registers all POS keyboard shortcuts (F1–F12 + Ctrl combos).
 * Shortcuts are disabled when an <input> or <textarea> has focus,
 * EXCEPT for F-keys which are always captured.
 */
export function useKeyboardShortcuts({
  onFocusSearch,
  onOpenPayment,
  onPrintQuotation,
  onCustomerLookup,
  onClearCart,
  onToggleViewMode,
  onToggleCart,
  onHoldOrder,
  onOpenHeld,
  onKickDrawer,
  onCustomerDisplay,
  onSettings,
  onToggleDark,
  onUndoRemove,
  onJumpCategory,   // (n: 1–9) => void
  onEscape,
  canPay = false,
  canClear = false,
  canHold = false,
  enabled = true,
}) {
  // Keep callbacks in refs so we don't re-register on every render
  const cbRef = useRef({});
  useEffect(() => {
    cbRef.current = {
      onFocusSearch, onOpenPayment, onPrintQuotation, onCustomerLookup,
      onClearCart, onToggleViewMode, onToggleCart, onHoldOrder,
      onOpenHeld, onKickDrawer, onCustomerDisplay, onSettings,
      onToggleDark, onUndoRemove, onJumpCategory, onEscape,
      canPay, canClear, canHold,
    };
  });

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const cb = cbRef.current;
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const ctrl = e.ctrlKey || e.metaKey;

      // ── F-keys (always captured, even in inputs) ──
      if (e.key === 'F1') { e.preventDefault(); cb.onFocusSearch?.(); return; }
      if (e.key === 'F2') { e.preventDefault(); if (cb.canPay)   cb.onOpenPayment?.();     return; }
      if (e.key === 'F3') { e.preventDefault(); cb.onPrintQuotation?.();                    return; }
      if (e.key === 'F4') { e.preventDefault(); cb.onCustomerLookup?.();                    return; }
      if (e.key === 'F5') { e.preventDefault(); if (cb.canClear) cb.onClearCart?.();       return; }
      if (e.key === 'F6') { e.preventDefault(); cb.onToggleViewMode?.();                    return; }
      if (e.key === 'F7') { e.preventDefault(); cb.onToggleCart?.();                        return; }
      if (e.key === 'F8') { e.preventDefault(); if (cb.canHold)  cb.onHoldOrder?.();       return; }
      if (e.key === 'F9') { e.preventDefault(); cb.onOpenHeld?.();                          return; }
      if (e.key === 'F10') { e.preventDefault(); cb.onKickDrawer?.();                       return; }
      if (e.key === 'F11') { e.preventDefault(); cb.onCustomerDisplay?.();                  return; }
      if (e.key === 'F12') { e.preventDefault(); cb.onSettings?.();                         return; }

      // ── Escape ──
      if (e.key === 'Escape') { cb.onEscape?.(); return; }

      // ── Below shortcuts are blocked when typing in an input ──
      if (inInput) return;

      // ── Ctrl combos ──
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); cb.onToggleDark?.();  return; }
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); cb.onUndoRemove?.();  return; }

      // ── Ctrl+1–9: jump to category N ──
      if (ctrl && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        cb.onJumpCategory?.(parseInt(e.key, 10));
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
