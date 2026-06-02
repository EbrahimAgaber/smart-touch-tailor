import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLicenseStore } from '../store/useLicenseStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function UpgradeBanner() {
  const navigate = useNavigate();
  const activeTier = useLicenseStore(s => s.tier);
  const simulatedTier = useSubscriptionStore(s => s.simulatedTier);
  const currentTier = simulatedTier || activeTier;

  // Only show the upgrade banner if they are currently Starter (S)
  if (currentTier !== 'S') return null;

  return (
    <div 
      onClick={() => navigate('/subscription-hub')}
      style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
        color: '#ffffff',
        padding: '10px 24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        fontWeight: '800',
        direction: 'rtl',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
        animation: 'slideInTop 0.5s ease-out',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        gap: '12px',
        flexWrap: 'wrap',
        fontFamily: "'Tajawal', sans-serif"
      }}
      className="active-press"
    >
      {/* Decorative background glow */}
      <div 
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '250px',
          height: '250px',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          fontWeight: '900',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <Sparkles size={12} className="animate-pulse" />
          <span>الأساسي (Core)</span>
        </div>
        <span style={{ fontSize: '13px', letterSpacing: '0.2px' }}>
          أطلق الإمكانيات الكاملة! رقّ اشتراكك الآن إلى باقة <strong> المحترف (pro)</strong> بسعر <strong>199 ريال/شهر</strong> فقط لتفعيل <strong> جميع مميزات التطبيق من ZATCA Phase 2 إلى المحاسبة المتقدمة</strong> ونظام العملاء <strong>CRM</strong> .
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 1, color: '#fbcfe8' }}>
        <span>استكشف عروض الترقية والإضافات</span>
        <ArrowLeft size={16} style={{ transition: 'transform 0.2s' }} />
      </div>
    </div>
  );
}
