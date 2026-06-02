import { useEffect, useRef, useState } from 'react';

export function useHardware({ onBarcode }) {
  const [hwStatus, setHwStatus] = useState({ printer: 'idle', drawer: 'closed' });
  const lastKeyTime = useRef(0);
  const barcodeBuffer = useRef('');

  // Global Barcode Listener
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      // Do not process global barcode if a modal is open (e.g. payment modal)
      if (document.body.dataset.modalOpen === '1') return;

      const now = Date.now();
      const isScannerSpeed = now - lastKeyTime.current < 50;
      
      // If time between keystrokes is too long, it's human typing
      if (!isScannerSpeed) {
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          e.preventDefault();
          e.stopPropagation();
          onBarcode(barcodeBuffer.current);
          
          // If the focus was on an input, the scanner might have typed into it.
          // Blur it so the user can see the result, or let Pos.jsx handle clearing.
          if (document.activeElement?.tagName === 'INPUT') {
            document.activeElement.blur();
          }
        }
        barcodeBuffer.current = '';
        return;
      }

      // Collect scanner characters
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        // If we know it's a scanner (buffer > 1), prevent it from typing into inputs
        if (barcodeBuffer.current.length > 1 && document.activeElement?.tagName === 'INPUT') {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeydown, { capture: true });
  }, [onBarcode]);

  // Hardware Actions with try-catch
  const kickDrawer = async () => {
    if (!window.api) return;
    try {
      setHwStatus(prev => ({ ...prev, drawer: 'open' }));
      await window.api.kickDrawer();
      setTimeout(() => setHwStatus(prev => ({ ...prev, drawer: 'closed' })), 3000);
    } catch (e) {
      console.warn('Drawer kick failed:', e);
      // Soft fail, no disruptive toast
    }
  };

  const printReceipt = async (html) => {
    if (!window.api) return;
    try {
      setHwStatus(prev => ({ ...prev, printer: 'printing' }));
      await window.api.printHTML(html);
      setTimeout(() => setHwStatus(prev => ({ ...prev, printer: 'idle' })), 2000);
    } catch (e) {
      setHwStatus(prev => ({ ...prev, printer: 'error' }));
      setTimeout(() => setHwStatus(prev => ({ ...prev, printer: 'idle' })), 10000);
      throw new Error('فشل في طباعة الفاتورة: ' + e.message);
    }
  };

  return { hwStatus, kickDrawer, printReceipt };
}
