import { useLicenseStore } from '../store/useLicenseStore';
import { useNavigate } from 'react-router-dom';

/**
 * FeatureGate — wraps any component or route with a subscription tier check.
 *
 * Usage:
 *   <FeatureGate feature="finance_hub">
 *     <FinanceHub />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="tables" fallback={<Navigate to="/pos" replace />}>
 *     <Tables />
 *   </FeatureGate>
 *
 * Props:
 *   feature   {string}      — Feature key from FEATURE_GATES (see useLicenseStore.js)
 *   children  {ReactNode}   — Content to render when access is granted
 *   fallback  {ReactNode}   — Optional custom fallback (default: UpgradePrompt)
 *   silent    {boolean}     — If true, render nothing when locked (no prompt)
 */
export default function FeatureGate({ feature, children, fallback, silent = false }) {
  const canAccess = useLicenseStore(s => s.canAccess(feature));
  const loaded    = useLicenseStore(s => s.loaded);

  // While license info is loading, render nothing to avoid flash
  if (!loaded) return null;

  if (canAccess) return children;

  if (silent) return null;

  if (fallback !== undefined) return fallback;

  return <UpgradePrompt feature={feature} />;
}

/**
 * UpgradePrompt — shown when a feature is locked for the current plan.
 * Displays what plan is needed and a WhatsApp contact button.
 */
function UpgradePrompt({ feature }) {
  const navigate = useNavigate();
  const requiredTier  = useLicenseStore(s => s.requiredTierFor(feature));
  const featureNameAr = useLicenseStore(s => s.featureNameAr(feature));
  const tierNameAr    = useLicenseStore(s => s.tierNameAr(requiredTier));
  const currentTier   = useLicenseStore(s => s.tierName);
  const setForceReactivate = useLicenseStore(s => s.setForceReactivate);

  const handleContact = () => {
    window.api?.openExternal?.('https://wa.me/966533174895');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '2rem',
      textAlign: 'center',
      direction: 'rtl',
    }}>
      {/* Lock icon */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        fontSize: 32,
      }}>
        🔒
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        marginBottom: '0.5rem',
        color: 'var(--color-text-primary, #1a1a1a)',
      }}>
        هذه الميزة غير متاحة في باقتك الحالية
      </h2>

      {/* Feature name */}
      <p style={{
        fontSize: '1rem',
        color: 'var(--color-text-secondary, #666)',
        marginBottom: '0.25rem',
      }}>
        <strong style={{ color: 'var(--color-text-primary, #1a1a1a)' }}>{featureNameAr}</strong>
        {' '}تتطلب باقة{' '}
        <span style={{
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#92400e',
          padding: '2px 10px',
          borderRadius: 12,
          fontWeight: 600,
        }}>
          {tierNameAr || 'أعلى'}
        </span>
        {' '}أو أعلى
      </p>

      {/* Current plan note */}
      {currentTier && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary, #999)', marginBottom: '2rem' }}>
          باقتك الحالية: <strong>{currentTier}</strong>
        </p>
      )}

      {/* Upgrade CTA Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
        <button
          onClick={handleContact}
          style={{
            background: '#25D366',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'opacity 0.2s',
          }}
        >
          <span>📱</span>
          تواصل معنا للترقية عبر واتساب
        </button>

        <button
          onClick={() => setForceReactivate(true)}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'opacity 0.2s',
          }}
        >
          <span>⌨️</span>
          أدخل مفتاح التنشيط المستلم
        </button>

        <button
          onClick={() => {
            // Attempt to go back, or fallback to shift/pos
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/pos');
            }
          }}
          style={{
            background: 'transparent',
            color: 'var(--color-text-secondary, #666)',
            border: '1.5px solid var(--border-subtle, #e2e8f0)',
            borderRadius: 12,
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'background 0.2s',
          }}
        >
          <span>↩️</span>
          الرجوع للخلف
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary, #999)', marginTop: '1.5rem' }}>
        سيتم تفعيل الباقة الجديدة فور استلام مفتاح التنشيط
      </p>
    </div>
  );
}
