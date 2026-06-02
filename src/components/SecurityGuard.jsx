import { useState, useEffect } from 'react';
import { Lock, Fingerprint, CheckCircle2, Eye, EyeOff, AlertTriangle, Mail, MessageCircle, ArrowRight } from 'lucide-react';

// ── NOTE: All license validation is done in the main process via IPC (window.api.validateLicense / checkLicense).
// The renderer never holds the license secret — it only calls main-process handlers.
// Do NOT add a renderer-side validateKey() here; it would diverge from main.cjs and cause silent mismatches.

const planLabels = {
  trial:    'تجريبي',
  monthly:  'شهري',
  yearly:   'سنوي',
  lifetime: 'مدى الحياة',
  owner:    '👑 وصول المالك',
};

export default function SecurityGuard({ children, forceReactivate = false, onReactivated }) {
  const [isActivated, setIsActivated]   = useState(false);
  const [hwid, setHwid]                 = useState('');
  const [loading, setLoading]           = useState(true);
  const [inputKey, setInputKey]         = useState('');
  const [showRawKey, setShowRawKey]     = useState(false);
  const [showHwid, setShowHwid]         = useState(false);
  const [error, setError]               = useState('');
  const [showSuccess, setShowSuccess]   = useState(false);
  const [licenseInfo, setLicenseInfo]   = useState(null);
  const [expiredInfo, setExpiredInfo]   = useState(null);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    async function checkLicense() {
      if (!window.api?.checkLicense) {
        if (retryCount < maxRetries) { retryCount++; setTimeout(checkLicense, 500); return; }
        setError('فشل الاتصال بمحرك النظام (IPC Error)');
        setLoading(false); return;
      }
      try {
        const id = await window.api.getHWID();
        setHwid(id);
        // Use main-process validation exclusively — renderer-side validateKey
        // uses a different secret and can diverge from main.cjs, causing
        // false positives where renderer considers a key valid but main rejects it.
        const result = await window.api.checkLicense();
        if (result && result.valid) {
          setLicenseInfo(result);
          setIsActivated(true);
          // trialExpired = running as degraded Core — allow in, no block
        } else if (result && result.reason === 'expired') {
          // Non-trial expired keys still show the reactivation screen
          setExpiredInfo({ expiredAt: result.expiredAt ? new Date(result.expiredAt) : null, plan: result.plan });
        }
      } catch (err) { setError('خطأ أثناء محاولة التوثيق مع الإعدادات'); }
      finally { setLoading(false); }
    }
    checkLicense();
  }, []);

  const handleActivate = async () => {
    const trimmedKey = inputKey.trim();
    if (!trimmedKey) return;
    try {
      // Validate via main process to ensure consistency with _gated() checks
      const result = await window.api.validateLicense(trimmedKey);
      if (result && result.valid) {
        const settings = await window.api.getSettings();
        await window.api.saveSettings({
          ...settings,
          activation_key:   trimmedKey,
          license_plan:     result.plan,
          license_expiry:   String(result.expiry || 0),
          license_hwid:     hwid,
        });
        setLicenseInfo(result);
        setShowSuccess(true);
        setTimeout(() => {
          setIsActivated(true);
          setShowSuccess(false);
          if (onReactivated) onReactivated();
        }, 1500);
      } else {
        const msgs = {
          wrong_device:  'رمز التنشيط مخصص لجهاز مختلف.',
          expired:       'انتهت صلاحية الرمز أو الفترة. يرجى التواصل مع الدعم.',
          bad_format:    'تنسيق الرمز غير صحيح.',
          invalid_key:   'رمز التنشيط غير صالح.',
        };
        setError(msgs[(result && result.reason)] || 'فشل التنشيط');
      }
    } catch (err) {
      setError('خطأ في التحقق من الرمز: ' + (err.message || ''));
    }
  };

  if (loading) return null;

  if (expiredInfo || !isActivated || forceReactivate) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#f8fafc] flex items-center justify-center p-8 font-tajawal overflow-y-auto">
        {/* Soft Background Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-50/50 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-50/50 rounded-full blur-[140px]" />
        </div>

        <div className="w-full max-w-[560px] relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Main Clean Card */}
          <div className="bg-white rounded-[40px] shadow-[0_20px_70px_-15px_rgba(15,23,42,0.08)] border border-slate-200/60 overflow-hidden">
            
            <div className="p-10 md:p-14">
              {/* Header Section */}
              <div className="flex flex-col items-center text-center mb-10">
                <div className="w-20 h-20 bg-blue-50 rounded-[28px] flex items-center justify-center mb-6 shadow-sm border border-blue-100/50">
                  <Lock size={32} className="text-blue-600" />
                </div>
                
                <h1 className="text-3xl font-[900] text-slate-900 mb-4 tracking-tight">
                  {expiredInfo ? 'انتهت صلاحية الترخيص' : 'تنشيط النظام مطلوب'}
                </h1>
                <p className="text-slate-500 font-medium text-base leading-relaxed max-w-[380px]">
                  يرجى إدخال رمز التنشيط لمتابعة استخدام نظام البصمة الذكية لإدارة المبيعات بكل سهولة واحترافية.
                </p>
              </div>

              {/* Tips Section */}
              <div className="bg-amber-50/60 border border-amber-200/40 p-5 rounded-[24px] mb-10 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-amber-100">
                  💡
                </div>
                <p className="text-amber-900/80 text-sm font-bold leading-snug">
                  بعد التنشيط، سيتم توجيهك لإعداد متجرك تلقائياً في أقل من دقيقة.
                </p>
              </div>

              {/* HWID Section */}
              <div className="mb-8 flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Fingerprint size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">معرف الجهاز (HWID)</span>
                </div>
                <button 
                  onClick={() => setShowHwid(!showHwid)} 
                  className="text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest border-b-2 border-blue-600/10 hover:border-blue-600/30 pb-0.5"
                >
                  {showHwid ? 'إخفاء المعرف' : 'إظهار المعرف'}
                </button>
              </div>

              {showHwid && (
                <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200/50 font-mono text-[10px] text-slate-500 break-all leading-relaxed text-center animate-in zoom-in-95 duration-300">
                  {hwid || 'جاري جلب المعرف...'}
                </div>
              )}

              {/* Activation Key Input */}
              <div className="mb-10 group/input">
                <div className="relative">
                  <input
                    type={showRawKey ? "text" : "password"}
                    value={inputKey}
                    onChange={e => { setInputKey(e.target.value.toUpperCase()); setError(''); }}
                    placeholder="XXXXXXXXXX"
                    dir="ltr"
                    className={`w-full h-16 bg-white border-2 rounded-2xl px-6 text-center text-xl font-black tracking-[0.1em] text-slate-800 outline-none transition-all duration-500
                      ${error 
                        ? 'border-rose-200 bg-rose-50/30' 
                        : 'border-slate-100 focus:border-blue-600/40 focus:shadow-[0_15px_40px_-12px_rgba(37,99,235,0.1)]'}`}
                  />
                  <button 
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors p-2 rounded-lg hover:bg-slate-50"
                  >
                    {showRawKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {error && (
                  <div className="flex items-center justify-center gap-2 text-rose-600 text-xs font-bold mt-3 animate-in slide-in-from-top-2">
                    <AlertTriangle size={14} />
                    {error}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleActivate}
                disabled={!inputKey.trim() || showSuccess}
                className={`w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-500 transform active:scale-[0.98]
                  ${showSuccess 
                    ? 'bg-emerald-500 text-white shadow-[0_10px_30px_-5px_rgba(16,185,129,0.3)]' 
                    : 'bg-blue-600 text-white shadow-[0_10px_30px_-5px_rgba(37,99,235,0.2)] hover:bg-blue-700 hover:shadow-[0_15px_40px_-10px_rgba(37,99,235,0.3)] hover:-translate-y-0.5'}`}
              >
                {showSuccess ? (
                  <>
                    <CheckCircle2 size={24} className="animate-bounce" />
                    <span>تم التنشيط بنجاح</span>
                  </>
                ) : (
                  <>
                    <span>تنشيط النظام الآن</span>
                    <ArrowRight size={20} className="opacity-40" />
                  </>
                )}
              </button>

              {/* Cancel back to app when user already has a valid key (forceReactivate mode) */}
              {forceReactivate && isActivated && (
                <button
                  onClick={() => { if (onReactivated) onReactivated(); }}
                  className="w-full h-12 rounded-2xl font-black text-sm text-slate-400 bg-transparent border border-slate-200 hover:bg-slate-50 transition-all mt-3"
                >
                  ← رجوع بدون تغيير
                </button>
              )}
            </div>

            {/* Support Section */}
            <div className="bg-slate-50/50 border-t border-slate-100 p-10 pt-8">
              <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                تحتاج للمساعدة؟ تواصل مع الدعم الفني
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => window.api.openExternal('https://wa.me/966533174895')} 
                  className="flex-1 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-700 font-bold text-sm hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-700 transition-all shadow-sm"
                >
                  <MessageCircle size={18} className="text-emerald-500" />
                  واتساب
                </button>
                <button 
                  onClick={() => window.api.openExternal('mailto:ea.gaber10@gmail.com')}
                  className="flex-1 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-700 font-bold text-sm hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700 transition-all shadow-sm"
                >
                  <Mail size={18} className="text-blue-500" />
                  البريد الإلكتروني
                </button>
              </div>
              
              <p className="text-center text-slate-400 text-[10px] font-bold mt-8">
                نحن هنا لمساعدتك على مدار الساعة
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NOTE: The 7-day expiry warning is intentionally NOT rendered here.
  // App.jsx already handles all license banner display (grace + expiry) via
  // the LicenseBanner component + IPC push events from main.cjs.
  // Rendering a second banner here caused the double-banner layout shift that
  // pushed POS content below the viewport.
  // If a "days left" warning is needed in future, add it to LicenseBanner in App.jsx
  // so there is always a single source of truth for the top-banner height.

  return <>{children}</>;
}

export { planLabels };
