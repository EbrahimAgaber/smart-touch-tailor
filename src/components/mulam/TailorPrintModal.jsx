import React, { useState } from 'react';
import { Printer, Share2, Copy, Check, X, Eye } from 'lucide-react';
import TailorWorkOrder from '../TailorWorkOrder';
import { printTailorWorkOrderDirect, generateTailorWhatsAppText } from '../../utils/tailorPrintAndShare';
import TailorWhatsAppModal from './TailorWhatsAppModal';

export default function TailorPrintModal({
  isOpen,
  onClose,
  orderDetails,
  fabrics = [],
  settings = {}
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !orderDetails) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printTailorWorkOrderDirect(orderDetails, fabrics, settings);
    } catch (e) {
      console.warn('Print error:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  const whatsAppText = generateTailorWhatsAppText(orderDetails, fabrics, settings);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(whatsAppText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
        dir="rtl"
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '900px',
            maxWidth: '96vw',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #334155',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <Printer size={18} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900 }}>
                  كرت تشغيل الخياط (Work Order) — #INV-{orderDetails.invoiceNumber || '—'}
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  العميل: {orderDetails.customer?.name || '—'} | جاهز للطباعة والمشاركة
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: isPrinting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}
              >
                <Printer size={15} />
                <span>{isPrinting ? 'جاري الطباعة...' : 'طباعة كرت العمل A4'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWhatsApp(true)}
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Share2 size={15} />
                <span>مشاركة عبر واتساب</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: '#334155',
                  color: '#f1f5f9',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Scrollable A4 Document View */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: '#cbd5e1',
              padding: '24px 16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                width: '210mm',
                minHeight: '297mm',
                padding: '12mm',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                boxSizing: 'border-box'
              }}
            >
              <TailorWorkOrder orderDetails={orderDetails} fabrics={fabrics} />
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <TailorWhatsAppModal
        isOpen={showWhatsApp}
        onClose={() => setShowWhatsApp(false)}
        title={`مشاركة كرت تفصيل #${orderDetails.invoiceNumber || ''}`}
        defaultCustomerPhone={orderDetails.customer?.phone || ''}
        customerName={orderDetails.customer?.name || ''}
        messageText={whatsAppText}
      />
    </>
  );
}
