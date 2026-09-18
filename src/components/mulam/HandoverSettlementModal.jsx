import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Printer, 
  MessageCircle, 
  Copy, 
  CheckCircle2, 
  Banknote, 
  CreditCard, 
  Smartphone,
  Share2,
  PackageCheck
} from 'lucide-react';
import { openWhatsApp } from '../../utils/whatsapp';
import { 
  printHandoverReceiptDirect, 
  generateHandoverWhatsAppText, 
  formatWhatsAppPhone 
} from '../../utils/tailorPrintAndShare';
import { generateBarcodeSVG } from '../../utils/barcodeSvg';

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

export default function HandoverSettlementModal({
  isOpen,
  onClose,
  order,
  garments = [],
  settings = {},
  onCompleteSuccess
}) {
  const [payMethod, setPayMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printed, setPrinted] = useState(false);
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setCompleted(false);
      setCopied(false);
      setPrinted(false);
      hasAutoPrintedRef.current = false;
      setPayMethod('cash');
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const orderId = order.id || order.orderId;
  const balanceDue = Number(order.balance_due || 0);
  const totalAmount = Number(order.total_amount || 0);
  const depositPaid = Number(order.deposit_paid || order.paid_amount || (totalAmount - balanceDue) || 0);
  const customerName = order.customer_name || order.customer?.name || 'عميل';
  const customerPhone = order.customer_phone || order.customer?.phone || '';

  const handleConfirmAndPrint = async () => {
    setSubmitting(true);
    try {
      // 1. Persist completion in the backend
      const res = await window.api?.tailor?.completeOrder?.({
        order_id: orderId,
        payment_method: payMethod,
        balance_paid: balanceDue,
      });

      if (res && res.success === false) {
        throw new Error(res?.error || 'فشل تسجيل تسليم الطلب');
      }

      // 2. Trigger direct print immediately
      try {
        await printHandoverReceiptDirect({
          order,
          garments,
          paymentMethod: payMethod,
          balancePaid: balanceDue,
          settings
        });
        setPrinted(true);
      } catch (printErr) {
        console.warn('Auto-print error:', printErr);
      }

      // 3. Move to completed state showing receipt preview
      setCompleted(true);
      if (onCompleteSuccess) {
        onCompleteSuccess(orderId);
      }
    } catch (err) {
      console.error('Handover error:', err);
      alert('خطأ في إتمام التسليم: ' + (err.message || 'يرجى المحاولة مجدداً'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualPrint = async () => {
    try {
      await printHandoverReceiptDirect({
        order,
        garments,
        paymentMethod: payMethod,
        balancePaid: balanceDue,
        settings
      });
      setPrinted(true);
    } catch (err) {
      console.error('Manual print error:', err);
    }
  };

  const whatsAppText = generateHandoverWhatsAppText({
    order,
    garments,
    paymentMethod: payMethod,
    balancePaid: balanceDue,
    settings
  });

  const handleWhatsAppSend = () => {
    if (!customerPhone) {
      alert('لا يوجد رقم جوال مسجل للعميل.');
      return;
    }
    openWhatsApp(customerPhone, whatsAppText);
  };

  const handleCopyText = async () => {
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
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: '20px',
          width: '520px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: completed ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-hover, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: completed ? '#10b981' : 'var(--color-primary, #6366f1)',
                color: '#fff',
                padding: '6px',
                borderRadius: '10px',
                display: 'flex'
              }}
            >
              {completed ? <CheckCircle2 size={18} /> : <PackageCheck size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>
                {completed ? 'سند التسليم والمخالصة النهائية' : 'تسليم الطلب النهائي والمخالصة'}
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                طلب رقم #{orderId} • {customerName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {!completed ? (
            /* STEP 1: Handover & Settlement Confirmation */
            <div>
              {/* Customer Banner */}
              <div
                style={{
                  background: 'var(--bg-hover, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 900 }}>{customerName}</div>
                  {customerPhone && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }} dir="ltr">
                      {customerPhone}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800
                  }}
                >
                  جاهز للاستلام
                </div>
              </div>

              {/* Garments Checklist */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted, #64748b)', marginBottom: '6px' }}>
                  الأثواب المنجزة الجاهزة للتسليم ({garments.length} قطعة):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {garments.map((g, idx) => (
                    <div
                      key={g.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-hover, #f8fafc)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span>
                        <span style={{ fontWeight: 800 }}>{g.garment_type || 'ثوب تفصيل'}</span>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px' }}>
                          ({g.fabric_name || 'قماش عميل'})
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>جاهز ومفحوص</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div
                style={{
                  background: 'var(--bg-hover, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>إجمالي قيمة الطلب:</span>
                  <span style={{ fontWeight: 900 }}>{fmt(totalAmount)} ر.س</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted, #64748b)' }}>العربون المسدد سابقاً:</span>
                  <span style={{ fontWeight: 800, color: '#f59e0b' }}>{fmt(depositPaid)} ر.س</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1.5px dashed var(--border-subtle, #e2e8f0)',
                    fontSize: '14px'
                  }}
                >
                  <span style={{ fontWeight: 900, color: balanceDue > 0 ? '#ef4444' : '#10b981' }}>
                    {balanceDue > 0 ? 'المطلوب تحصيله الآن:' : 'الحساب خالص بالكامل:'}
                  </span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: '18px',
                      color: balanceDue > 0 ? '#ef4444' : '#10b981',
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {fmt(balanceDue)} ر.س
                  </span>
                </div>
              </div>

              {/* Payment Method Selector (if balance > 0) */}
              {balanceDue > 0 ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted, #64748b)', marginBottom: '8px' }}>
                    طريقة تحصيل المتبقي:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      { id: 'cash', label: 'نقداً', Icon: Banknote },
                      { id: 'card', label: 'مدى / بطاقة', Icon: CreditCard },
                      { id: 'transfer', label: 'تحويل بنكي', Icon: Smartphone }
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPayMethod(id)}
                        style={{
                          minHeight: '44px',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          border: payMethod === id ? '2px solid var(--color-primary, #6366f1)' : '1px solid var(--border-subtle, #e2e8f0)',
                          background: payMethod === id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-hover, #f8fafc)',
                          color: payMethod === id ? 'var(--color-primary, #6366f1)' : 'var(--text-main, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    textAlign: 'center',
                    color: '#10b981',
                    fontWeight: 800,
                    fontSize: '13px',
                    marginBottom: '16px'
                  }}
                >
                  ✓ لا يوجد أي مبالغ مستحقة على العميل. الطلب مسدد بالكامل مسبقاً.
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Completed & Printable Live Thermal Receipt */
            <div>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <CheckCircle2 size={22} color="#10b981" />
                <div>
                  <div style={{ fontWeight: 900, color: '#10b981', fontSize: '14px' }}>
                    تم تسليم الطلب النهائي وسداد الحساب بنجاح!
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                    تم إرسال أمر الطباعة للطابعة الحرارية. يمكنك إعادة الطباعة أو مشاركة السند عبر واتساب.
                  </div>
                </div>
              </div>

              {/* Thermal Receipt Visual Preview Box */}
              <div
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: '12px',
                  lineHeight: '1.4',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  {settings.business_name_ar || 'مشغل الخياطة الرجالية الراقية'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>
                  سند تسليم نهائي ومخالصة مالية
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>رقم الطلب: #{orderId}</span>
                  <span>{new Date().toLocaleDateString('ar-SA')}</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  العميل: {customerName}
                </div>
                {customerPhone && (
                  <div style={{ fontSize: '10px', color: '#444' }} dir="ltr">
                    جوال: {customerPhone}
                  </div>
                )}
                <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>الأثواب المستلمة:</div>
                {garments.map((g, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span>{idx + 1}. {g.garment_type || 'ثوب'} ({g.fabric_name || 'قماش عميل'})</span>
                    <span>✓ مستلم</span>
                  </div>
                ))}
                <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>الإجمالي:</span>
                  <span>{fmt(totalAmount)} SAR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>العربون السابق:</span>
                  <span>{fmt(depositPaid)} SAR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                  <span>المسدد الآن:</span>
                  <span>{fmt(balanceDue)} SAR ({payMethod === 'cash' ? 'نقدي' : payMethod === 'card' ? 'شبكة' : 'تحويل'})</span>
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#059669' }}>
                  <span>المتبقي:</span>
                  <span>0.00 SAR (خالص تماماً)</span>
                </div>

                <div style={{ textAlign: 'center', marginTop: '10px' }} dangerouslySetInnerHTML={{
                  __html: generateBarcodeSVG(`ORD-${orderId}`, 150, 36)
                }} />

                <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '8px' }}>
                  يُرجى المراجعة خلال 7 أيام لأي ضبط إضافي مجاناً
                </div>
              </div>

              {/* Action Buttons in Step 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleManualPrint}
                  style={{
                    minHeight: '44px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} />
                  <span>{printed ? 'إعادة الطباعة 🖨️' : 'طباعة السند 🖨️'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppSend}
                  style={{
                    minHeight: '44px',
                    borderRadius: '10px',
                    background: '#128C7E',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <MessageCircle size={16} />
                  <span>إرسال بالواتساب 📲</span>
                </button>
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleCopyText}
                  style={{
                    width: '100%',
                    minHeight: '38px',
                    borderRadius: '10px',
                    background: 'var(--bg-hover, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    color: 'var(--text-main, #0f172a)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copied ? 'تم نسخ نص المخالصة بنجاح' : 'نسخ نص المخالصة للحافظة'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            background: 'var(--bg-hover, #f8fafc)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          {!completed ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmAndPrint}
                disabled={submitting}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  borderRadius: '10px',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {submitting ? (
                  <span>جاري التسليم وإصدار السند...</span>
                ) : (
                  <>
                    <Printer size={16} />
                    <span>تأكيد التسليم وطباعة السند الحراري</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '10px',
                background: 'var(--color-primary, #6366f1)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '14px',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              تم الانتهاء والعودة للوحة المعمل ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
