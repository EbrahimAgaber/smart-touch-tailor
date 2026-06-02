import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { useLicenseStore } from '../store/useLicenseStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { useToast } from '../components/ToastManager';
import { 
  Check, X, Zap, Lock
} from 'lucide-react';

const TIER_PRICING = {
  S: { name: 'الأساسي (Core)', monthly: 0, yearly: 0, lifetime: 800, color: '#3b82f6', desc: 'مناسبة للأنشطة البسيطة والمبتدئين، ميزات أساسية متكاملة مدى الحياة' },
  G: { name: 'النمو (Growth)', monthly: 0, yearly: 0, lifetime: 1000, color: '#f59e0b', desc: 'مثالية للأنشطة المتنامية التي تحتاج ZATCA المرحلة الثانية ونظام عملاء متكامل مدى الحياة' },
  P: { name: 'الاحترافي (Pro)', monthly: 199, yearly: 700, lifetime: 0, color: '#10b981', desc: 'شاملة للمطاعم والشركات، تتضمن شاشة المطبخ KDS والمالية المتقدمة' },
  E: { name: 'المؤسسي (Enterprise)', monthly: 0, yearly: 0, lifetime: 0, color: '#8b5cf6', desc: 'مخصصة للفروع المتعددة والسلاسل التجارية مع دعم فني بأولوية قصوى' }
};

const ADDONS_LIST = [
  { id: 'restaurant', name: 'إضافة إدارة المطعم والطاولات', price: 99, desc: 'تفعيل خريطة الطاولات، نظام المطبخ (KDS)، وتخصيص الجلسات.', emoji: '🍽️' },
  { id: 'finance', name: 'المحاسبة المتكاملة (FinanceHub)', price: 149, desc: 'شجرة الحسابات، قيود اليومية الآلية واليدوية، الميزانية العمومية وقائمة الدخل.', emoji: '🏦' },
  { id: 'sync', name: 'مزامنة الفروع المتعددة', price: 299, desc: 'مزامنة حية للمخزون والمبيعات والموظفين بين فروع متعددة.', emoji: '🌐' }
];

export default function SubscriptionHub() {
  const { toast } = useToast();
  const activeTier = useLicenseStore(s => s.tier) || 'S';
  const billingCycle = useLicenseStore(s => s.billing) || 'trial';
  const setForceReactivate = useLicenseStore(s => s.setForceReactivate);
  
  const { simulatedTier, setSimulatedTier, resetSimulation } = useSubscriptionStore();
  
  const currentTier = simulatedTier || activeTier;
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'yearly' | 'lifetime'
  const [selectedPlanToBuy, setSelectedPlanToBuy] = useState(null);
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);
  const [activationCodeInput, setActivationCodeInput] = useState('');

  const handleSelectPlan = (tierKey) => {
    setSelectedPlanToBuy(tierKey);
    setShowCheckoutDrawer(true);
  };

  const handleApplySimulatedKey = async () => {
    if (!activationCodeInput.trim()) {
      toast('يرجى إدخال مفتاح التنشيط أولاً', 'warn');
      return;
    }
    
    // Always validate through the main process — never do renderer-side key parsing.
    // The main process holds the HMAC secret and is the only authoritative validator.
    try {
      const result = await window.api?.validateLicense?.(activationCodeInput.trim());
      if (result && result.valid && result.tier) {
        // Apply the real validated tier to the license store
        const settings = await window.api.getSettings();
        await window.api.saveSettings({
          ...settings,
          activation_key:  activationCodeInput.trim().toUpperCase(),
          license_plan:    result.plan,
          license_expiry:  String(result.expiry || 0),
        });
        // Reload license in the renderer store
        await useLicenseStore.getState().loadLicense();
        toast(`✅ تم تفعيل الباقة (الطبقة: ${result.tierName}) بنجاح!`, 'success');
        setShowCheckoutDrawer(false);
        setActivationCodeInput('');
        resetSimulation();
      } else {
        const msgs = {
          wrong_device: 'رمز التنشيط مخصص لجهاز مختلف.',
          expired:      'انتهت صلاحية الرمز. يرجى التواصل مع الدعم.',
          bad_format:   'تنسيق الرمز غير صحيح.',
          invalid_key:  'رمز التنشيط غير صالح.',
        };
        toast(`❌ ${msgs[result?.reason] || 'فشل التحقق من الرمز'}`, 'error');
      }
    } catch (err) {
      toast('خطأ أثناء التحقق من الرمز', 'error');
    }
  };

  return (
    <AppLayout title="الاشتراكات والإضافات المتاحة">
      <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif", display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Active Plan Dashboard Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '24px',
          padding: '28px',
          color: '#ffffff',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Simulated preview indicator */}
          {simulatedTier && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: '#f59e0b',
              color: '#000000',
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: '900',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
            }}>
              ⚙️ وضع محاكاة الباقة نشط
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700' }}>اشتراكك النشط حالياً:</span>
              <span style={{
                background: TIER_PRICING[currentTier]?.color || '#3b82f6',
                color: '#ffffff',
                padding: '3px 12px',
                borderRadius: '99px',
                fontSize: '12px',
                fontWeight: '900'
              }}>{TIER_PRICING[currentTier]?.name}</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', margin: 0 }}>
              {billingCycle === 'trial' ? 'النسخة التجريبية المجانية' : `الباقة المفعّلة: ${TIER_PRICING[currentTier]?.name}`}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px', maxWidth: '500px', lineHeight: '1.6' }}>
              {TIER_PRICING[currentTier]?.desc}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {simulatedTier && (
              <button 
                onClick={() => {
                  resetSimulation();
                  toast('تم العودة للترخيص الأصلي', 'info');
                }}
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '12px 20px', borderRadius: '14px' }}
              >
                ↩ إلغاء المحاكاة
              </button>
            )}
            <button 
              onClick={() => setForceReactivate(true)}
              className="btn"
              style={{ padding: '12px 24px', borderRadius: '14px', background: '#3b82f6', color: '#ffffff', border: 'none', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              🔑
              <span>تنشيط ترخيص جديد</span>
            </button>
            <button 
              onClick={() => window.api?.openExternal?.('https://wa.me/966533174895')}
              className="btn btn-primary"
              style={{ padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Zap size={16} />
              <span>تواصل لتفعيل باقة رسمية</span>
            </button>
          </div>
        </div>

        {/* REDESIGNED: Lifetime Plans (Billed Once) */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>🛡️ باقات مدى الحياة (Lifetime Plans - دفع لمرة واحدة)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>امتلك النظام مدى الحياة بتكلفة مخفضة ومزايا كاملة دون اشتراك دوري.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            {['S', 'G'].map(key => {
              const plan = TIER_PRICING[key];
              const isCurrent = currentTier === key;
              const isPopular = key === 'G';
              
              return (
                <div 
                  key={key}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    border: isCurrent 
                      ? `2.5px solid ${plan.color}` 
                      : '1.5px solid var(--border-subtle)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    position: 'relative',
                    boxShadow: isCurrent 
                      ? `0 8px 30px ${plan.color}25` 
                      : 'none',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  {isPopular && (
                    <span style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '20px',
                      background: '#f59e0b',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 12px',
                      borderRadius: '99px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>الأكثر طلباً 🔥</span>
                  )}

                  {isCurrent && (
                    <span style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '20px',
                      background: plan.color,
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 12px',
                      borderRadius: '99px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>باقة نشطة</span>
                  )}

                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: 'var(--text-main)' }}>{plan.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px', minHeight: '36px' }}>{plan.desc}</p>
                  </div>

                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)' }}>
                        {plan.lifetime.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>SAR</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      تدفع مرة واحدة فقط - ترخيص مدى الحياة
                    </span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>نقطة بيع سريعة متكاملة</span></li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>إدارة المخزون والتنبيهات</span></li>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>الفواتير المبسطة ZATCA المرحلة الأولى</span></li>
                    
                    {key === 'G' && (
                      <>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>ZATCA المرحلة الثانية مدمجة</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>إدارة العملاء والولاء (CRM)</span></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>إدارة الموردين وفواتير المشتريات</span></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>حتى 5 موظفين بصلاحيات مخصصة</span></li>
                      </>
                    )}
                  </ul>

                  <button 
                    onClick={() => handleSelectPlan(key)}
                    disabled={isCurrent}
                    className="btn"
                    style={{
                      marginTop: 'auto',
                      background: isCurrent ? 'var(--bg-app)' : plan.color,
                      color: isCurrent ? 'var(--text-muted)' : '#ffffff',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: isCurrent ? 'default' : 'pointer'
                    }}
                  >
                    {isCurrent ? 'باقة النظام الحالية' : `الترقية إلى ${plan.name} (مدى الحياة)`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* REDESIGNED: Periodic Subscriptions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>☁️ الاشتراكات السحابية الدورية</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>الباقات الاحترافية والمؤسسية للمطاعم الكبيرة ومتعددي الفروع.</p>
            </div>
            
            {/* Pricing Period Toggle */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '4px',
              borderRadius: '16px',
              border: '1.5px solid var(--border-subtle)',
              display: 'inline-flex',
              gap: '2px'
            }}>
              {[
                { id: 'monthly', label: 'دفع شهري' },
                { id: 'yearly', label: 'دفع سنوي' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setBillingPeriod(p.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: '0.2s',
                    background: billingPeriod === p.id ? 'var(--primary)' : 'transparent',
                    color: billingPeriod === p.id ? '#ffffff' : 'var(--text-muted)'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {['P', 'E'].map(key => {
              const plan = TIER_PRICING[key];
              const isCurrent = currentTier === key;
              const price = billingPeriod === 'monthly' ? plan.monthly : plan.yearly;
              const isPro = key === 'P';
              const isEnterprise = key === 'E';
              
              return (
                <div 
                  key={key}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    border: isCurrent 
                      ? `2.5px solid ${plan.color}` 
                      : isPro 
                        ? '2.5px solid #10b981' 
                        : '1.5px solid var(--border-subtle)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    position: 'relative',
                    boxShadow: isCurrent 
                      ? `0 8px 30px ${plan.color}25` 
                      : isPro 
                        ? '0 0 25px rgba(16, 185, 129, 0.15)' 
                        : 'none',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    transform: isPro ? 'scale(1.02)' : 'none',
                    zIndex: isPro ? 2 : 1
                  }}
                >
                  {isPro && (
                    <span style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '20px',
                      background: '#10b981',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 12px',
                      borderRadius: '99px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>الأفضل قيمة ⭐</span>
                  )}

                  {isCurrent && (
                    <span style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '20px',
                      background: plan.color,
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 12px',
                      borderRadius: '99px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>باقة نشطة</span>
                  )}

                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: 'var(--text-main)' }}>{plan.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px', minHeight: '36px' }}>{plan.desc}</p>
                  </div>

                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)' }}>
                        {isEnterprise ? 'سعر مخصص' : price.toLocaleString()}
                      </span>
                      {!isEnterprise && <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>SAR</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {isEnterprise 
                        ? 'حسب عدد الفروع والربط' 
                        : billingPeriod === 'monthly' 
                          ? 'لكل شهر' 
                          : `لكل سنة (وفر 70%)`}
                    </span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>نقطة بيع سريعة متكاملة</span></li>
                    
                    {key === 'P' && (
                      <>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>ZATCA المرحلة الثانية مدمجة</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>شاشة المطبخ (KDS) وصالة المطعم</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>المالية والمحاسبة (Finance Hub)</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>عدد موظفين غير محدود</span></li>
                      </>
                    )}

                    {key === 'E' && (
                      <>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>المالية ونظام المطعم وKDS بالكامل</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>ربط وإدارة الفروع المتعددة</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <strong>إعادة تسمية النظام (White-label)</strong></li>
                        <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981" /> <span>دعم فني بأولوية قصوى ومستمر</span></li>
                      </>
                    )}
                  </ul>

                  {isEnterprise ? (
                    <button 
                      onClick={() => window.api?.openExternal?.('https://wa.me/966533174895?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%AE%D8%B7%D8%A9%20%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D9%8ي%20(Enterprise)')}
                      className="btn"
                      style={{
                        marginTop: 'auto',
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '14px',
                        borderRadius: '12px',
                        fontWeight: '900',
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>تواصل معنا عبر واتساب</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSelectPlan(key)}
                      disabled={isCurrent}
                      className="btn"
                      style={{
                        marginTop: 'auto',
                        background: isCurrent ? 'var(--bg-app)' : plan.color,
                        color: isCurrent ? 'var(--text-muted)' : '#ffffff',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '12px',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: isCurrent ? 'default' : 'pointer'
                      }}
                    >
                      {isCurrent ? 'باقة النظام الحالية' : `الترقية إلى ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add-ons Shop Section — only show to Core/Growth/Trial users
             Pro and Enterprise already include all add-on features natively */}
        {['S', 'G', 'X'].includes(currentTier) && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>🚀 الإضافات المعيارية المتاحة (Modular Add-ons)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>هل تفضل البقاء على باقة أصغر وتفعيل ميزات محددة فقط؟ تواصل مع الدعم للحصول على مفتاح تنشيط إضافة مخصص بعد إتمام الدفع.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {ADDONS_LIST.map(addon => {
              return (
                <div 
                  key={addon.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '20px',
                    border: '1.5px solid var(--border-subtle)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '24px' }}>{addon.emoji}</span>
                      <h4 style={{ fontSize: '15px', fontWeight: '900', margin: 0, color: 'var(--text-main)' }}>{addon.name}</h4>
                    </div>
                    <span style={{
                      background: 'var(--bg-app)',
                      color: 'var(--text-muted)',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Lock size={10} />
                      غير مفعّل
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', minHeight: '34px', lineHeight: '1.5' }}>{addon.desc}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>{addon.price}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>SAR / شهر</span>
                    </div>

                    <button 
                      onClick={() => {
                        // Direct to WhatsApp to purchase — no free activation
                        const msg = encodeURIComponent(`أريد شراء إضافة: ${addon.name} بسعر ${addon.price} SAR/شهر`);
                        window.api?.openExternal?.(`https://wa.me/966533174895?text=${msg}`);
                      }}
                      className="btn"
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '800',
                        border: 'none',
                        background: '#dcfce7',
                        color: '#166534',
                        cursor: 'pointer'
                      }}
                    >
                      شراء عبر واتسآب
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clarify that add-ons require a real license key */}
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={14} />
            <span>بعد إتمام الدفع، ستتلقى مفتاح تنشيط خاصاً بالإضافة. أدخله من زر "تنشيط ترخيص جديد" أعلاه لتفعيل الميزات فوراً.</span>
          </div>
        </div>
        )} {/* end add-ons conditional: Core/Growth/Trial only */}

        {/* Pro/Enterprise users: all add-ons already included */}
        {['P', 'E'].includes(currentTier) && (
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '1.5px solid #bbf7d0',
            borderRadius: '20px',
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span style={{ fontSize: '32px' }}>✅</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#166534' }}>جميع الإضافات مفعلة بالكامل في باقتك</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#166534', opacity: 0.8 }}>
                باقة {TIER_PRICING[currentTier]?.name} تتضمن بشكل كامل: إدارة المطعم والطاولات وKDS، المحاسبة المتكاملة (FinanceHub)، والمزامنة. لا تحتاج إلى شراء أي إضافات منفصلة.
              </p>
            </div>
          </div>
        )}

        {/* Checkout & License Simulation Drawer */}
        {showCheckoutDrawer && selectedPlanToBuy && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--bg-card)',
              height: '100%',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              animation: 'slideInRight 0.3s ease-out',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>🛒 محاكي الدفع والتنشيط V4</h3>
                <button 
                  onClick={() => setShowCheckoutDrawer(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                ><X size={20} /></button>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>الباقة المختارة:</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', margin: '4px 0' }}>
                  {TIER_PRICING[selectedPlanToBuy]?.name} - {['S', 'G'].includes(selectedPlanToBuy) ? 'مدى الحياة (Lifetime)' : (billingPeriod === 'monthly' ? 'شهري' : 'سنوي')}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)' }}>
                  سعر الباقة: {(['S', 'G'].includes(selectedPlanToBuy) ? TIER_PRICING[selectedPlanToBuy]?.lifetime : TIER_PRICING[selectedPlanToBuy]?.[billingPeriod]).toLocaleString()} SAR
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>خطوات الترقية والتنشيط:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>1. تواصل مع الدعم الفني وأرسل معرف جهازك (HWID).</div>
                  <div>2. ستحصل على مفتاح تنشيط V4 مكون من 16 حرفاً.</div>
                  <div>3. أدخل الرمز في الحقل أدناه لتطبيق الترقية مباشرة.</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800' }}>مفتاح التنشيط V4 (مستلم من الدعم الفني):</label>
                <input 
                  type="text" 
                  value={activationCodeInput}
                  onChange={e => setActivationCodeInput(e.target.value.toUpperCase())}
                  placeholder="أدخل رمز التنشيط المستلم من الدعم"
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: '2px solid var(--border-subtle)',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontWeight: '800',
                    outline: 'none',
                    background: 'var(--bg-app)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <button 
                onClick={handleApplySimulatedKey}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', borderRadius: '14px' }}
              >
                تطبيق رمز التنشيط
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
