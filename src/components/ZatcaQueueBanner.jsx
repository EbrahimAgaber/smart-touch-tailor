import { useEffect, useState, useCallback } from 'react';

// FIX 4 — ZATCA Queue Halt Banner
// Polls zatca:getQueueStatus every 60 s. If halted, renders a red sticky
// banner at the top of AppLayout with invoice details and a resume button.
export default function ZatcaQueueBanner() {
  const [status, setStatus] = useState(null);
  const [resuming, setResuming] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await window.api.getZatcaQueueStatus();
      setStatus(s);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleResume = async () => {
    setResuming(true);
    try {
      await window.api.zatcaResumeQueue();
      await fetchStatus();
    } catch (_) {}
    setResuming(false);
  };

  if (!status?.halted) return null;

  return (
    <div
      dir="rtl"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: '#fef2f2',
        borderBottom: '2px solid #fca5a5',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        fontFamily: 'Tajawal, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <p style={{ margin: 0, fontWeight: 800, color: '#991b1b', fontSize: '14px' }}>
            تم إيقاف إرسال الفواتير لهيئة الزكاة
            {status.lastRejectedInvoice ? ` — الفاتورة ${status.lastRejectedInvoice} مرفوضة` : ''}
          </p>
          {status.lastError && (
            <p style={{ margin: 0, fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
              {status.lastError}
            </p>
          )}
          {status.pendingCount > 0 && (
            <p style={{ margin: 0, fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>
              {status.pendingCount} فاتورة معلقة في الطابور
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => setDetailsOpen(v => !v)}
          style={{
            padding: '7px 14px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#991b1b',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {detailsOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
        </button>
        <button
          onClick={handleResume}
          disabled={resuming}
          style={{
            padding: '7px 16px',
            background: resuming ? '#9ca3af' : '#dc2626',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 800,
            fontSize: '12px',
            cursor: resuming ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {resuming ? 'جاري الاستئناف...' : 'استئناف الإرسال'}
        </button>
      </div>

      {detailsOpen && (
        <div
          style={{
            width: '100%',
            background: '#fff5f5',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '14px 18px',
            fontSize: '12px',
            color: '#7f1d1d',
            lineHeight: 1.7,
          }}
        >
          <strong>سبب الإيقاف:</strong> رُفضت فاتورة بواسطة هيئة الزكاة أو تم اكتشاف تعارض في تسلسل ICV.<br />
          <strong>ما يجب فعله:</strong> راجع الفاتورة المرفوضة، صحح البيانات إن لزم، ثم اضغط "استئناف الإرسال".<br />
          <strong>تحذير:</strong> الاستئناف قبل حل المشكلة قد يؤدي إلى رفض متكرر من هيئة الزكاة.
          {status.lastRejectedInvoice && (
            <><br /><strong>آخر فاتورة مرفوضة:</strong> #{status.lastRejectedInvoice}</>
          )}
        </div>
      )}
    </div>
  );
}
