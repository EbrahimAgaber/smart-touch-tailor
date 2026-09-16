import React, { useState, useEffect } from 'react';
import { Send, Copy, Check, X, User, Scissors, Phone, Link2 } from 'lucide-react';
import { shareViaWhatsAppDirect, formatWhatsAppPhone } from '../../utils/tailorPrintAndShare';

export default function TailorWhatsAppModal({
  isOpen,
  onClose,
  title = 'مشاركة عبر واتساب',
  defaultCustomerPhone = '',
  defaultTailorPhone = '',
  customerName = '',
  messageText = '',
  trackingMessageText = ''
}) {
  const [phoneType, setPhoneType] = useState('customer'); // Default to customer if tracking or tailor
  const [templateType, setTemplateType] = useState(() => trackingMessageText ? 'tracking' : 'work_order');
  const [customPhone, setCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (trackingMessageText) {
        setTemplateType('tracking');
        setPhoneType('customer');
      } else {
        setTemplateType('work_order');
        setPhoneType('tailor');
      }
    }
  }, [isOpen, trackingMessageText]);

  if (!isOpen) return null;

  const currentMessage = templateType === 'tracking' && trackingMessageText ? trackingMessageText : messageText;

  const getTargetPhone = () => {
    if (phoneType === 'customer') return defaultCustomerPhone;
    if (phoneType === 'tailor') return defaultTailorPhone;
    return customPhone;
  };

  const handleSend = () => {
    const target = getTargetPhone();
    shareViaWhatsAppDirect({ phone: target, message: currentMessage });
  };

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)'
      }}
      onClick={onClose}
      dir="rtl"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '10px', display: 'flex' }}>
              <Send size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>{title}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.9 }}>
                إرسال المقاسات وأمر التشغيل فورياً عبر واتساب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Template Choice if tracking available */}
          {trackingMessageText && messageText && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                نوع الرسالة المراد إرسالها:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setTemplateType('tracking'); setPhoneType('customer'); }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: templateType === 'tracking' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: templateType === 'tracking' ? '#eff6ff' : '#ffffff',
                    color: templateType === 'tracking' ? '#1d4ed8' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Link2 size={16} />
                  <span>رابط التتبع الذاتي للعميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTemplateType('work_order'); setPhoneType('tailor'); }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: templateType === 'work_order' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: templateType === 'work_order' ? '#ecfdf5' : '#ffffff',
                    color: templateType === 'work_order' ? '#065f46' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Scissors size={16} />
                  <span>كرت العمل والمقاسات بالكامل</span>
                </button>
              </div>
            </div>
          )}

          {/* Target Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              إرسال الرسالة إلى:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPhoneType('tailor')}
                style={{
                  padding: '10px 6px',
                  borderRadius: '10px',
                  border: phoneType === 'tailor' ? '2px solid #10b981' : '1px solid #cbd5e1',
                  background: phoneType === 'tailor' ? '#ecfdf5' : '#ffffff',
                  color: phoneType === 'tailor' ? '#065f46' : '#475569',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Scissors size={18} />
                <span>معلم الخياطة / الورشة</span>
              </button>

              <button
                type="button"
                onClick={() => setPhoneType('customer')}
                style={{
                  padding: '10px 6px',
                  borderRadius: '10px',
                  border: phoneType === 'customer' ? '2px solid #10b981' : '1px solid #cbd5e1',
                  background: phoneType === 'customer' ? '#ecfdf5' : '#ffffff',
                  color: phoneType === 'customer' ? '#065f46' : '#475569',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <User size={18} />
                <span>العميل ({customerName || 'المحدد'})</span>
              </button>

              <button
                type="button"
                onClick={() => setPhoneType('custom')}
                style={{
                  padding: '10px 6px',
                  borderRadius: '10px',
                  border: phoneType === 'custom' ? '2px solid #10b981' : '1px solid #cbd5e1',
                  background: phoneType === 'custom' ? '#ecfdf5' : '#ffffff',
                  color: phoneType === 'custom' ? '#065f46' : '#475569',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Phone size={18} />
                <span>رقم آخر</span>
              </button>
            </div>
          </div>

          {/* Phone Display / Input */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            {phoneType === 'tailor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>رقم ورشة / معلم التفصيل:</span>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>سيفتح واتساب مباشرة</span>
                </div>
                <input
                  type="tel"
                  placeholder="أدخل رقم هاتف المعلم أو اتركه فارغاً للاختيار من واتساب"
                  value={customPhone || defaultTailorPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    textAlign: 'left',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {phoneType === 'customer' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>رقم جوال العميل:</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }} dir="ltr">
                  {defaultCustomerPhone || 'غير مسجل بالطلب (سيتم فتح واتساب لتحديد المستلم)'}
                </span>
              </div>
            )}

            {phoneType === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>أدخل رقم الجوال المستهدف (مثال: 0501234567):</span>
                <input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    textAlign: 'left',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          {/* Message Preview Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>معاينة نص الرسالة:</span>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copied ? '#10b981' : '#3b82f6',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'تم النسخ بنجاح!' : 'نسخ النص'}</span>
              </button>
            </div>
            <div
              style={{
                background: '#f1f5f9',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                lineHeight: '1.6',
                color: '#334155',
                maxHeight: '140px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'system-ui, sans-serif'
              }}
            >
              {messageText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={handleSend}
            style={{
              flex: 2,
              padding: '12px 16px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Send size={16} />
            <span>فتح واتساب والإرسال الآن</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              flex: 1,
              padding: '12px 14px',
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            <span>{copied ? 'تم النسخ' : 'نسخ فقط'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
