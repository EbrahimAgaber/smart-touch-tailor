/**
 * useBarcodeScanner
 *
 * Extracts the barcode scanner focus-management logic from Pos.jsx.
 *
 * PRESERVED BEHAVIORS:
 *  - BUG-10: Uses document.body.dataset.modalOpen (set by any modal on mount)
 *    to decide whether to steal focus — no boolean list to maintain.
 *  - Scanner detection: if keystrokes arrive < 100ms apart → hardware scanner.
 *    In that case, barcode is NOT mirrored to the search bar.
 *  - When barcode length > 5 and a product matches, adds to cart immediately.
 *
 * @param {Object} options
 * @param {React.RefObject} options.barcodeRef  - ref attached to the hidden barcode input
 * @param {Array}           options.menu        - full product list
 * @param {Function}        options.addItem     - from useCartStore
 * @param {Function}        options.setSearch   - sets the visible search state
 * @param {Function}        options.toast       - from useToast
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBarcodeScanner({ barcodeRef, menu, addItem, setSearch, toast }) {
  const [barcode, setBarcode] = useState('');
  const lastKeyTime = useRef(0);

  // ── Focus management: restore focus to barcode input when idle ──────────
  useEffect(() => {
    const focusInterval = setInterval(() => {
      const isModalOpen = !!document.body.dataset.modalOpen;
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
      if (!isModalOpen && !isTyping) barcodeRef.current?.focus();
    }, 2000);
    return () => clearInterval(focusInterval);
  }, []); // empty deps — checks DOM attribute, not React state

  // ── Input handler ────────────────────────────────────────────────────────
  const handleBarcodeChange = useCallback((e) => {
    const now = Date.now();
    const isScanner = (now - lastKeyTime.current) < 100;
    lastKeyTime.current = now;
    const val = e.target.value;
    setBarcode(val);

    // Only mirror to search bar if it looks like manual keyboard input
    if (!isScanner && val.length > 0) setSearch(val);

    if (val.length > 5) {
      const item = menu.find(m => m.Barcode === val);
      if (item) {
        addItem(item);
        setBarcode('');
        setSearch('');
      }
    }
  }, [menu, addItem, setSearch]);

  return { barcode, setBarcode, handleBarcodeChange };
}
