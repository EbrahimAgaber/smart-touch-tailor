import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket, Building2, Globe, Shield,
  Package, ChevronLeft, ChevronRight,
  CheckCircle2, Store, Utensils, Pill,
  Shirt, Laptop, Scissors, Upload,
  Receipt
} from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'tailor', label: 'خياطة ومقاسات', icon: <Scissors size={24} /> },
  { value: 'retail', label: 'تجزئة عامة', icon: <Store size={24} /> },
  { value: 'fruit_and_vegetables', label: 'خضار وفواكه', icon: <Package size={24} /> },
  { value: 'restaurant', label: 'مطعم / كافيه', icon: <Utensils size={24} /> },
  { value: 'grocery', label: 'تموينات / سوبر ماركت', icon: <Package size={24} /> },
  { value: 'pharmacy', label: 'صيدلية', icon: <Pill size={24} /> },
  { value: 'clothing', label: 'ملابس وأزياء', icon: <Shirt size={24} /> },
  { value: 'electronics', label: 'إلكترونيات', icon: <Laptop size={24} /> },
  { value: 'salon', label: 'صالون حلاقة', icon: <Scissors size={24} /> },
];

const COUNTRIES = [
  { value: 'sa', label: 'المملكة العربية السعودية 🇸🇦', vat: '0.15', currency: 'SAR' },
  { value: 'ae', label: 'الإمارات العربية المتحدة 🇦🇪', vat: '0.05', currency: 'AED' },
  { value: 'om', label: 'سلطنة عُمان 🇴🇲', vat: '0.05', currency: 'OMR' },
  { value: 'bh', label: 'البحرين 🇧🇭', vat: '0.10', currency: 'BHD' },
  { value: 'kw', label: 'الكويت 🇰🇼', vat: '0', currency: 'KWD' },
  { value: 'qa', label: 'قطر 🇶🇦', vat: '0', currency: 'QAR' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name_ar: '',
    business_type: 'tailor',
    zatca_otp: '',
    country: 'sa',
    vat_rate: '0.15',
    currency: 'SAR',
    vat_number: '',
    crn: '',
    address_street: '',
    address_building: '',
    address_district: '',
    address_postal: '',
    address_city: '',
    business_logo: '',
    // cost is now explicit — defaults to empty so no misleading COGS is injected
    firstProduct: { name: '', price: '', cost: '', category: 'عام' }
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const isValidTIN = (v) => !v || /^3\d{14}$/.test(v);
  const isValidCRN = (v) => !v || /^\d{10}$/.test(v);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleCountryChange = (cCode) => {
    const c = COUNTRIES.find(x => x.value === cCode);
    if (c) {
      setForm(f => ({ ...f, country: cCode, vat_rate: c.vat, currency: c.currency }));
    }
  };

  const handleLogoUpload = async () => {
    try {
      const base64 = await window.api.pickImageFile();
      if (base64) update('business_logo', base64);
    } catch (e) { alert('خطأ في تحميل الشعار'); }
  };

  const finish = async () => {
    setLoading(true);
    try {
      // 1. Save Settings (including CRN and VAT number entered in step 3)
      await window.api.saveSettings({
        ...form,
        business_type: 'tailor', // STRICTLY FORCED TO TAILOR
        business_name_en: form.business_name_ar,
        branch_name: 'الفرع الرئيسي',
        invoice_prefix: 'INV-',
        receipt_width: '80',
        auto_print: 'false',
      });

      // 2. ZATCA device registration — only for Saudi Arabia with a VAT number.
      //    The merchant enters their OTP from the Fatoorah portal in step 3.
      //    If onboarding fails we show a warning but do NOT block setup —
      //    the merchant can retry from Settings → هيئة الزكاة at any time.
      if (form.country === 'sa' && form.vat_number && form.zatca_otp) {
        try {
          const onboardRes = await window.api.onboardZatcaDevice({ otp: form.zatca_otp });
          if (!onboardRes.success) {
            console.warn('[Onboarding] ZATCA device registration failed:', onboardRes.error);
            // Non-blocking: continue setup and let merchant retry from Settings
          }
        } catch (onboardErr) {
          console.warn('[Onboarding] ZATCA onboard error (non-fatal):', onboardErr.message);
        }
      }

      // 3. Add First Product if name and price are filled
      if (form.firstProduct.name && form.firstProduct.price) {
        const price = parseFloat(form.firstProduct.price) || 0;
        const cost  = parseFloat(form.firstProduct.cost)  || 0;
        await window.api.addMenuItem({
          Name: form.firstProduct.name,
          Price: price,
          Category: form.firstProduct.category,
          Cost: cost,
          Stock: 100,
          IsService: 0
        });
      }

      navigate('/dashboard');
    } catch (e) {
      alert('خطأ أثناء الحفظ: ' + e.message);
    }
    setLoading(false);
  };

  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  return (
    <div dir="rtl" style={wrapperStyle}>
      <div style={pageStyle}>
        <div style={containerStyle}>

        {/* Progress Bar */}
        <div style={progressContainer}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={progressStep(s <= step)}></div>
          ))}
        </div>

        {step === 1 && (
          <div style={stepContent}>
            <div style={iconBox}><Building2 size={32} color="#3b82f6" /></div>
            <h2 style={title}>مرحباً بك في البصمة الذكية! 👋</h2>
            <p style={subtitle}>لنبدأ بتجهيز متجرك في أقل من دقيقة. ما هو اسم نشاطك التجاري؟</p>

            <div style={field}>
              <label style={label}>اسم المنشأة بالعربي</label>
              <input
                style={input}
                value={form.business_name_ar}
                onChange={e => update('business_name_ar', e.target.value)}
                placeholder="مثال: مخبز السعادة"
                autoFocus
              />
            </div>

            <label style={label}>نوع النشاط</label>
            <div style={grid}>
              {BUSINESS_TYPES.map(t => (
                <div
                  key={t.value}
                  onClick={() => update('business_type', t.value)}
                  style={card(form.business_type === t.value)}
                >
                  {t.icon}
                  <span style={{ fontSize: '13px', fontWeight: '700', marginTop: '8px' }}>{t.label}</span>
                </div>
              ))}
            </div>

            <button onClick={next} disabled={!form.business_name_ar} style={primaryBtn}>
              المتابعة <ChevronLeft size={20} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={stepContent}>
            <div style={iconBox}><Globe size={32} color="#10b981" /></div>
            <h2 style={title}>أين يقع متجرك؟ 📍</h2>
            <p style={subtitle}>سنقوم بضبط العملة ونسبة الضريبة تلقائياً بناءً على دولتك.</p>

            <div style={gridCountry}>
              {COUNTRIES.map(c => (
                <div
                  key={c.value}
                  onClick={() => handleCountryChange(c.value)}
                  style={countryCard(form.country === c.value)}
                >
                  <span style={{ fontSize: '14px', fontWeight: '800' }}>{c.label}</span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    الضريبة: {parseFloat(c.vat) * 100}% • العملة: {c.currency}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right', width: '100%' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px', color: '#0f172a' }}>تفاصيل العنوان (مطلوبة لمتطلبات الفاتورة الإلكترونية)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>اسم الشارع</label>
                  <input style={input} value={form.address_street} onChange={e => update('address_street', e.target.value)} placeholder="مثال: شارع العليا" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>رقم المبنى</label>
                  <input style={input} value={form.address_building} onChange={e => update('address_building', e.target.value)} placeholder="مثال: 1234" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>الحي</label>
                  <input style={input} value={form.address_district} onChange={e => update('address_district', e.target.value)} placeholder="مثال: حي الصحافة" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>المدينة</label>
                  <input style={input} value={form.address_city} onChange={e => update('address_city', e.target.value)} placeholder="مثال: الرياض" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>الرمز البريدي</label>
                  <input style={input} value={form.address_postal} onChange={e => update('address_postal', e.target.value)} placeholder="مثال: 12345" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>اسم الشارع الإضافي</label>
                  <input style={input} value={form.address_additional_street||''} onChange={e => update('address_additional_street', e.target.value)} placeholder="مثال: طريق الملك فهد" />
                </div>
                <div style={{ marginBottom: '0' }}>
                  <label style={label}>رقم القطعة (PlotID)</label>
                  <input style={input} value={form.address_plot_id||''} onChange={e => update('address_plot_id', e.target.value)} placeholder="مثال: 4321" />
                </div>
              </div>
            </div>

            <div style={actions}>
              <button onClick={prev} style={secondaryBtn}><ChevronRight size={20} /> السابق</button>
              <button onClick={next} style={primaryBtn}>المتابعة <ChevronLeft size={20} /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={stepContent}>
            <div style={iconBox}><Shield size={32} color="#f59e0b" /></div>
            <h2 style={title}>المتطلبات الضريبية 🧾</h2>
            <p style={subtitle}>أضف شعارك ورقمك الضريبي ليظهر على الفواتير المطبوعة.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', width: '100%' }}>
              <div onClick={handleLogoUpload} style={logoUploadBox}>
                {form.business_logo
                  ? <img src={form.business_logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <Upload size={24} color="#94a3b8" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>شعار المنشأة</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>انقر للرفع (PNG/JPG)</div>
              </div>
            </div>

            <div style={field}>
              <label style={label}>الرقم الضريبي (VAT Number)</label>
              <input
                style={input}
                value={form.vat_number}
                onChange={e => update('vat_number', e.target.value)}
                onBlur={e => setErrors(p => ({ ...p, vat_number: isValidTIN(e.target.value) ? null : 'يجب أن يكون 15 رقماً ويبدأ بـ 3' }))}
                placeholder="300XXXXXXXXX3"
              />
              {errors.vat_number && <p style={{ color:'#ef4444', fontSize:'11px', marginTop:'4px' }}>{errors.vat_number}</p>}
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>اتركه فارغاً إذا كنت غير مسجل في الضريبة حالياً.</p>
            </div>

            <div style={field}>
              <label style={label}>رقم السجل التجاري (CRN)</label>
              <input
                style={input}
                value={form.crn}
                onChange={e => update('crn', e.target.value)}
                placeholder="1010XXXXXX"
              />
            </div>

            <div style={field}>
              <label style={label}>رمز OTP من منصة فاتورة (اختياري)</label>
              <input
                style={input}
                value={form.zatca_otp}
                onChange={e => update('zatca_otp', e.target.value)}
                placeholder="6 أرقام من بوابة فاتورة ZATCA"
                maxLength={6}
              />
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                إذا لم يكن لديك رمز OTP الآن، اتركه فارغاً وأكمل التسجيل لاحقاً من الإعدادات ← هيئة الزكاة.
              </p>
            </div>

            <div style={actions}>
              <button onClick={prev} style={secondaryBtn}><ChevronRight size={20} /> السابق</button>
              <button onClick={() => {
                const errs = {};
                if (form.vat_number && !isValidTIN(form.vat_number)) errs.vat_number = 'رقم ضريبة القيمة المضافة يجب أن يكون 15 رقماً ويبدأ بـ 3';
                if (form.crn && !isValidCRN(form.crn)) errs.crn = 'رقم السجل التجاري يجب أن يكون 10 أرقام';
                if (Object.keys(errs).length) { setErrors(errs); return; }
                next();
              }} style={primaryBtn}>المتابعة <ChevronLeft size={20} /></button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={stepContent}>
            <div style={iconBox}><Rocket size={32} color="#8b5cf6" /></div>
            <h2 style={title}>جاهز للانطلاق! 🚀</h2>
            <p style={subtitle}>أضف أول منتج لتبدأ أول عملية بيع فوراً. (اختياري)</p>

            <div style={{ ...field, background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={label}>اسم المنتج</label>
                <input
                  style={input}
                  value={form.firstProduct.name}
                  onChange={e => update('firstProduct', { ...form.firstProduct, name: e.target.value })}
                  placeholder="مثال: قهوة عربي"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>السعر</label>
                  <input
                    type="number"
                    style={input}
                    value={form.firstProduct.price}
                    onChange={e => update('firstProduct', { ...form.firstProduct, price: e.target.value })}
                    placeholder="15.00"
                    min="0"
                  />
                </div>
                <div>
                  <label style={label}>التكلفة</label>
                  <input
                    type="number"
                    style={input}
                    value={form.firstProduct.cost}
                    onChange={e => update('firstProduct', { ...form.firstProduct, cost: e.target.value })}
                    placeholder="10.00"
                    min="0"
                  />
                </div>
                <div>
                  <label style={label}>القسم</label>
                  <select
                    style={input}
                    value={form.firstProduct.category}
                    onChange={e => update('firstProduct', { ...form.firstProduct, category: e.target.value })}
                  >
                    <option>عام</option>
                    <option>مشروبات</option>
                    <option>مأكولات</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'right' }}>
                💡 التكلفة تُستخدم لحساب هامش الربح في التقارير. يمكن تعديلها لاحقاً من إدارة المنتجات.
              </p>
            </div>

            <div style={actions}>
              <button onClick={prev} style={secondaryBtn}><ChevronRight size={20} /> السابق</button>
              <button onClick={finish} disabled={loading} style={finishBtn}>
                {loading ? 'جاري الحفظ...' : 'ابدأ استخدام النظام الآن ✨'}
              </button>
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}

const wrapperStyle = { height: '100vh', overflowY: 'auto', background: '#f8fafc', fontFamily: 'inherit' };
const pageStyle = { minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(20px, 4vh, 40px) 16px' };
const containerStyle = { background: 'white', padding: 'clamp(24px, 5vw, 48px)', borderRadius: '40px', maxWidth: '520px', width: '100%', boxShadow: '0 25px 70px rgba(0,0,0,0.05)', position: 'relative' };
const progressContainer = { display: 'flex', gap: '8px', marginBottom: '40px' };
const progressStep = (active) => ({ flex: 1, height: '6px', borderRadius: '3px', background: active ? '#3b82f6' : '#f1f5f9', transition: 'all 0.3s' });
const stepContent = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: 'fadeIn 0.4s' };
const iconBox = { width: '72px', height: '72px', borderRadius: '24px', background: '#f1f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' };
const title = { fontSize: '24px', fontWeight: '900', color: '#0f172a', marginBottom: '12px' };
const subtitle = { fontSize: '15px', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' };
const field = { width: '100%', textAlign: 'right', marginBottom: '20px' };
const label = { display: 'block', fontSize: '13px', fontWeight: '800', color: '#475569', marginBottom: '8px' };
const input = { width: '100%', padding: '14px 16px', borderRadius: '16px', border: '2px solid #f1f5f9', fontSize: '15px', outline: 'none', fontFamily: 'inherit', background: '#fcfdfe', boxSizing: 'border-box', transition: 'border-color 0.2s' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px', width: '100%', marginBottom: '32px' };
const gridCountry = { ...grid, gridTemplateColumns: '1fr', gap: '8px' };
const card = (active) => ({ padding: '16px', borderRadius: '18px', border: active ? '2px solid #3b82f6' : '2px solid #f1f5f9', background: active ? '#eff6ff' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', color: active ? '#1d4ed8' : '#64748b' });
const countryCard = (active) => ({ ...card(active), alignItems: 'flex-start', textAlign: 'right', padding: '14px 20px' });
const actions = { display: 'flex', gap: '12px', width: '100%', marginTop: '10px' };
const primaryBtn = { flex: 2, padding: '16px', borderRadius: '16px', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 8px 20px rgba(37,99,235,0.3)', fontFamily: 'inherit' };
const secondaryBtn = { flex: 1, padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: 'white', color: '#64748b', fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' };
const finishBtn = { ...primaryBtn, background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 8px 20px rgba(16,185,129,0.3)' };
const logoUploadBox = { width: '80px', height: '80px', borderRadius: '20px', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f8fafc', overflow: 'hidden' };
