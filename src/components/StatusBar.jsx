import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicenseStore } from '../store/useLicenseStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

/**
 * StatusBar — merged UpgradeBanner + ZatcaQueueBanner in a single 28px strip.
 * Props:
 *   zatcaQueue  — { pending, failed, reported, total } from AppLayout polling
 *   upgradeMsg  — optional override string
 */
export default function StatusBar({ zatcaQueue = {}, upgradeMsg }) {
  const navigate = useNavigate();
  const activeTier = useLicenseStore(s => s.tier);
  const simulatedTier = useSubscriptionStore(s => s.simulatedTier);
  const currentTier = simulatedTier || activeTier;

  const [zatcaStatus, setZatcaStatus] = useState(null);
  const [resuming, setResuming] = useState(false);

  const fetchZatcaStatus = useCallback(async () => {
    try {
      const s = await window.api?.getZatcaQueueStatus?.();
      if (s) setZatcaStatus(s);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchZatcaStatus();
    const id = setInterval(fetchZatcaStatus, 60000);
    return () => clearInterval(id);
  }, [fetchZatcaStatus]);

  const handleResume = async (e) => {
    e.stopPropagation();
    setResuming(true);
    try {
      await window.api?.zatcaResumeQueue?.();
      await fetchZatcaStatus();
    } catch (_) {}
    setResuming(false);
  };

  const showZatca = zatcaStatus?.halted;
  const showUpgrade = !showZatca && currentTier === 'S';

  const pending = zatcaQueue.pending || 0;
  const failed  = zatcaQueue.failed  || 0;

  // Nothing to show
  if (!showZatca && !showUpgrade && pending === 0 && failed === 0) return null;

  /* ── ZATCA halted strip ── */
  if (showZatca) {
    return (
      <div
        dir="rtl"
        style={{
          height: 'var(--zatca-bar-height, 28px)',
          minHeight: 'var(--zatca-bar-height, 28px)',
          background: '#fef2f2',
          borderBottom: '1px solid #fca5a5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: '12px',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-xs)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {/* dot indicator */}
          <span style={{
            display: 'inline-block', width: '7px', height: '7px',
            borderRadius: '50%', background: '#ef4444', flexShrink: 0,
          }} />
          <span style={{ fontWeight: '800', color: '#991b1b', whiteSpace: 'nowrap' }}>
            إرسال ZATCA موقوف
          </span>
          {zatcaStatus.lastRejectedInvoice && (
            <span style={{ color: '#b91c1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — فاتورة {zatcaStatus.lastRejectedInvoice} مرفوضة
            </span>
          )}
          {(zatcaStatus.pendingCount || 0) > 0 && (
            <span style={{ color: '#7f1d1d', whiteSpace: 'nowrap' }}>
              ({zatcaStatus.pendingCount} معلقة)
            </span>
          )}
        </div>
        <button
          onClick={handleResume}
          disabled={resuming}
          style={{
            padding: '2px 12px',
            background: resuming ? '#9ca3af' : '#dc2626',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            color: '#fff',
            fontWeight: '800',
            fontSize: '11px',
            cursor: resuming ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            height: '20px',
            lineHeight: 1,
          }}
        >
          {resuming ? 'جاري...' : 'استئناف الإرسال'}
        </button>
      </div>
    );
  }

  /* ── ZATCA sync counts strip (non-halted) ── */
  if (pending > 0 || failed > 0) {
    return (
      <div
        dir="rtl"
        style={{
          height: 'var(--zatca-bar-height, 28px)',
          minHeight: 'var(--zatca-bar-height, 28px)',
          background: failed > 0 ? '#fef2f2' : '#eff6ff',
          borderBottom: `1px solid ${failed > 0 ? '#fecaca' : '#bfdbfe'}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '14px',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-xs)',
          flexShrink: 0,
        }}
      >
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#3b82f6',
          animation: 'pulse-dot 2s infinite', flexShrink: 0,
        }} />
        <span style={{ fontWeight: '800', color: '#1e40af' }}>
          قيد المزامنة ({pending})
        </span>
        {failed > 0 && (
          <>
            <span style={{ color: '#b91c1c', fontWeight: '800' }}>⚠ فشل ({failed})</span>
            <button
              onClick={() => window.api?.retryZatcaQueue?.()}
              style={{
                background: 'transparent', border: 'none', color: '#b91c1c',
                cursor: 'pointer', textDecoration: 'underline', fontSize: '11px',
                fontFamily: 'inherit', padding: 0,
              }}
            >
              إعادة محاولة
            </button>
          </>
        )}
      </div>
    );
  }

  /* ── Upgrade strip ── */
  return (
    <div
      onClick={() => navigate('/subscription-hub')}
      dir="rtl"
      style={{
        height: 'var(--zatca-bar-height, 28px)',
        minHeight: 'var(--zatca-bar-height, 28px)',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: '12px',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-xs)',
        fontWeight: '700',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#f9a8d4', flexShrink: 0,
        }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {upgradeMsg || 'رقّ إلى المحترف (Pro) بـ 199 ريال/شهر — ZATCA Phase 2 + محاسبة + CRM'}
        </span>
      </div>
      <span style={{ color: '#fbcfe8', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '11px' }}>
        استكشف الترقية ←
      </span>
    </div>
  );
}
