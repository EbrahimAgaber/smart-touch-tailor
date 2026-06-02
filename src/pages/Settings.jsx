import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastManager';
import AppLayout from '../components/AppLayout';
import { useLicenseStore } from '../store/useLicenseStore';
import LabelPrintSettings from '../components/LabelPrintSettings';
import {
  Building2, Receipt, Globe, Shield,
  Smartphone, Save, CheckCircle2,
  Image as ImageIcon, Upload, Package, CreditCard, MapPin, Wifi,
  AlertTriangle, Server, Palette, FileText, RefreshCw,
  BadgeCheck, Key, Database
} from 'lucide-react';

const BUSINESS_TYPES = [
  { value:'retail',    label:'🛍️ تجزئة عامة' },
  { value:'grocery',   label:'🛒 بقالة / سوبرماركت' },
  { value:'restaurant',label:'🍽️ مطعم / كافيه' },
  { value:'pharmacy',  label:'💊 صيدلية' },
  { value:'clothing',  label:'👕 ملابس' },
  { value:'electronics',label:'📱 إلكترونيات' },
  { value:'salon',     label:'✂️ صالون / سبا' },
  { value:'services',  label:'🛎️ خدمات عامة' },
];

const COUNTRIES = [
  { value:'sa', label:'🇸🇦 المملكة العربية السعودية', vat:'0.15', currency:'SAR', currencyAr:'ريال سعودي' },
  { value:'ae', label:'🇦🇪 الإمارات العربية المتحدة', vat:'0.05', currency:'AED', currencyAr:'درهم إماراتي' },
  { value:'om', label:'🇴🇲 سلطنة عُمان', vat:'0.05',  currency:'OMR', currencyAr:'ريال عُماني' },
  { value:'bh', label:'🇧🇭 البحرين', vat:'0.10',       currency:'BHD', currencyAr:'دينار بحريني' },
  { value:'kw', label:'🇰🇼 الكويت', vat:'0',            currency:'KWD', currencyAr:'دينار كويتي' },
  { value:'qa', label:'🇶🇦 قطر', vat:'0',               currency:'QAR', currencyAr:'ريال قطري' },
  { value:'other', label:'🌍 أخرى', vat:'0',            currency:'USD', currencyAr:'دولار' },
];

// ── ZATCA environments — shown as pill buttons per design proposal ─────────
const ZATCA_ENVS = [
  { value:'sandbox',    label:'بيئة المطورين',  sub:'Sandbox',    icon:'🧪', color:'#6366f1' },
  { value:'simulation', label:'بيئة المحاكاة',  sub:'Simulation', icon:'🔬', color:'#f59e0b' },
  { value:'core',       label:'بيئة الإنتاج',   sub:'Core',       icon:'🏭', color:'#10b981' },
];

const TABS = [
  { id: 'identity',  label: 'هوية المنشأة',    icon: Building2 },
  { id: 'zatca',     label: 'هيئة الزكاة',      icon: Shield },
  { id: 'invoice',   label: 'الفواتير والطباعة', icon: Receipt },
  { id: 'tax',       label: 'الضريبة والعملات', icon: Globe },
  { id: 'system',    label: 'النظام',           icon: Server },
  { id: 'ui',        label: 'واجهة المستخدم',   icon: Palette },
];

export default function Settings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const canAccess = useLicenseStore(s => s.canAccess);

  const isValidTIN      = v => /^3\d{14}$/.test(v);
  const isValidCRN      = v => /^\d{10}$/.test(v);
  const isValidBuilding = v => !v || /^\d{4}$/.test(v);
  const isValidPostal   = v => !v || /^\d{5}$/.test(v);

  const [activeTab, setActiveTab] = useState('identity');
  const [form, setForm] = useState({
    business_name_ar:'', business_name_en:'', branch_name:'',
    vat_number:'', address:'', phone:'', email:'', website:'',
    instagram:'', whatsapp:'', invoice_prefix:'INV-',
    vat_rate:'0.15', country:'sa', currency:'SAR',
    receipt_width:'80', receipt_header:'', receipt_footer:'',
    label_config:'{"showBusinessName":true,"showProductName":true,"showPrice":true,"showBarcode":true,"fieldsOrder":["business","name","price","barcode"],"size":"50x30"}',
    business_logo:'', auto_print:'false', business_type:'retail',
    whatsapp_template:'',
    loyalty_rate:'10', loyalty_redeem_rate:'0.1',
    address_short:'', address_building:'',
    address_street:'', address_secondary:'',
    address_district:'', address_postal:'',
    address_city:'', address_country:'المملكة العربية السعودية',
    address_additional_street:'', address_plot_id:'',
    crn:'',
    national_address_city:'', national_address_country:'المملكة العربية السعودية',
    bank_name:'', bank_account_number:'', bank_iban:'', bank_beneficiary:'',
    network_mode:'standalone', master_ip:'',
    secondary_currency:'', exchange_rate:'1',
    expense_lock_days:'30',
    receipt_printer:'',
    dark_mode:'false',
    date_format:'hijri',
    zatca_env:'sandbox',
    simulationTestsPassed: false,
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [version, setVersion] = useState('1.0.0');
  const [updateStatus, setUpdateStatus] = useState({ status:'idle' });
  const [zatcaDevice, setZatcaDevice] = useState(null);
  const [vatErrors, setVatErrors] = useState({});
  const [certWarning, setCertWarning] = useState(null);
  const [certExpiredModal, setCertExpiredModal] = useState(false);
  const [zatcaOtp, setZatcaOtp] = useState('');
  const resetOnboardingOnChange = v => { setZatcaOtp(v); if (onboardingStatus === 'error') setOnboardingStatus('idle'); };
  const [onboardingStatus, setOnboardingStatus] = useState('idle');
  const [onboardingError, setOnboardingError] = useState('');
  const [simTestStatus, setSimTestStatus] = useState('idle'); // idle | running | done
  const [simTestResults, setSimTestResults] = useState(null);
  const [certExpiresAt, setCertExpiresAt] = useState(null); // FIX 5: cert expiry ISO string
  const [envSwitchError, setEnvSwitchError] = useState('');

  // ── Add-on key activation (inline, no SecurityGuard redirect) ──────────────
  const [addonKey, setAddonKey]           = useState('');
  const [addonKeyStatus, setAddonKeyStatus] = useState('idle'); // idle|loading|success|error
  const [addonKeyError, setAddonKeyError]   = useState('');
  const [addonKeyResult, setAddonKeyResult] = useState(null);
  const { valid: licValid, tierName: licTierName, billing: licBilling,
          daysLeft: licDaysLeft, activeAddons: licAddons, keyType: licKeyType,
          loadLicense } = useLicenseStore(s => ({
    valid:       s.valid,
    tierName:    s.tierName,
    billing:     s.billing,
    daysLeft:    s.daysLeft,
    activeAddons:s.activeAddons,
    keyType:     s.keyType,
    loadLicense: s.loadLicense,
  }));

  const handleAddonActivate = async () => {
    const trimmed = addonKey.trim().toUpperCase();
    if (!trimmed) return;
    setAddonKeyStatus('loading');
    setAddonKeyError('');
    setAddonKeyResult(null);
    try {
      const result = await window.api.validateLicense(trimmed);
      if (result && result.valid) {
        const hwid     = await window.api.getHWID();
        const settings = await window.api.getSettings();
        await window.api.saveSettings({
          ...settings,
          activation_key:  trimmed,
          license_plan:    result.plan,
          license_expiry:  String(result.expiry || 0),
          license_hwid:    hwid,
        });
        setAddonKeyResult(result);
        setAddonKeyStatus('success');
        setAddonKey('');
        // Refresh license store so canAccess() picks up new add-ons immediately
        await loadLicense();
        toast('✅ تم تفعيل مفتاح الإضافة بنجاح! الميزات الجديدة متاحة الآن.', 'success');
      } else {
        const msgs = {
          wrong_device: 'مفتاح الإضافة مخصص لجهاز مختلف.',
          expired:      'انتهت صلاحية مفتاح الإضافة.',
          bad_format:   'تنسيق المفتاح غير صحيح (يجب أن يبدأ بـ A ويكون 19 حرفاً).',
          invalid_key:  'مفتاح الإضافة غير صالح.',
        };
        setAddonKeyError(msgs[result?.reason] || 'فشل التنشيط');
        setAddonKeyStatus('error');
      }
    } catch (err) {
      setAddonKeyError('خطأ في التحقق: ' + (err.message || ''));
      setAddonKeyStatus('error');
    }
  };

  useEffect(() => {
    window.api.getSettings().then(s => {
      if (s) setForm(f => ({ ...f, ...s }));
    }).catch(() => {}).finally(() => setLoading(false));

    window.api.getPrinters?.().then(setPrinters).catch(() => {});
    window.api.getVersion?.().then(setVersion).catch(() => {});
    window.api.getZatcaDevice?.().then(setZatcaDevice).catch(() => {});
    // FIX 5: fetch certificate expiry from main process
    window.api.zatcaGetCertExpiry?.().then(r => { if (r?.certExpiresAt) setCertExpiresAt(r.certExpiresAt); }).catch(() => {});

    const unlisten = window.api.onUpdateStatus?.((data) => setUpdateStatus(data));
    window.api.on?.('zatca:certExpiringSoon', data => setCertWarning({ type:'warn', days: data.daysLeft }));
    window.api.on?.('zatca:certExpired',      ()   => { setCertWarning({ type:'error', days: 0 }); setCertExpiredModal(true); });

    const poll = setInterval(() => {
      window.api.getSyncStatus().then(setSyncStatus).catch(() => {});
    }, 3000);
    return () => { clearInterval(poll); unlisten?.(); };
  }, []);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCountryChange = countryCode => {
    const c = COUNTRIES.find(x => x.value === countryCode);
    if (!c) return;
    setForm(f => ({ ...f, country: countryCode, vat_rate: c.vat, currency: c.currency }));
  };

  const handleLogoUpload = async () => {
    setUploading(true);
    try {
      const base64 = await window.api.pickImageFile();
      if (base64) u('business_logo', base64);
    } catch (e) {
      toast('فشل تحميل الصورة: ' + e.message, 'error');
    }
    setUploading(false);
  };

  const handleExportBackup = async () => {
    try {
      const res = await window.api.exportBackup();
      if (res?.success) toast('✅ تم حفظ النسخة الاحتياطية بنجاح.', 'success');
      else if (res?.error) toast('خطأ: ' + res.error, 'error');
    } catch (e) { toast('خطأ: ' + e.message, 'error'); }
  };

  const handleRestoreBackup = async () => {
    if (!window.confirm('⚠️ تحذير: استعادة النسخة الاحتياطية ستحذف أو تستبدل البيانات الحالية بالكامل. أكمل؟')) return;
    try {
      const res = await window.api.restoreBackup();
      if (res?.error) toast('خطأ في الاستعادة: ' + res.error, 'error');
    } catch (e) { alert('خطأ: ' + e.message); }
  };

  const handleOnboardZatca = async () => {
    if (!zatcaOtp) { toast('الرجاء إدخال رمز OTP من منصة فاتورة', 'error'); return; }
    setOnboardingStatus('loading');
    setOnboardingError('');
    try {
      await window.api.saveSettings(form);
      const res = await window.api.onboardZatcaDevice({ otp: zatcaOtp });
      if (res?.success) {
        setOnboardingStatus('success');
        toast('✅ تم ربط الجهاز بهيئة الزكاة والضريبة والجمارك بنجاح!', 'success');
        const d = await window.api.getZatcaDevice();
        setZatcaDevice(d);
        setZatcaOtp('');
        // [W-4] Reset simulation gate — new CSID means previous simulation results are no longer valid.
        setForm(f => ({ ...f, simulationTestsPassed: false }));
        setSimTestResults(null); setSimTestStatus('idle');
      } else {
        setOnboardingStatus('error');
        setOnboardingError(res?.error || 'Unknown error');
        toast('خطأ في الربط: ' + (res?.error || ''), 'error');
      }
    } catch (e) {
      setOnboardingStatus('error');
      setOnboardingError(e.message);
      toast('خطأ: ' + e.message, 'error');
    }
  };

  const save = async () => {
    const errs = {};
    if (form.vat_number && !isValidTIN(form.vat_number))
      errs.vat_number = 'رقم ضريبة القيمة المضافة يجب أن يكون 15 رقماً ويبدأ بـ 3';
    if (form.crn && !isValidCRN(form.crn))
      errs.crn = 'رقم السجل التجاري يجب أن يكون 10 أرقام';
    if (form.address_building && !isValidBuilding(form.address_building))
      errs.address_building = 'رقم المبنى يجب أن يكون 4 أرقام';
    if (form.address_postal && !isValidPostal(form.address_postal))
      errs.address_postal = 'الرمز البريدي يجب أن يكون 5 أرقام';
    if (Object.keys(errs).length) {
      setVatErrors(errs);
      toast('يوجد أخطاء في بيانات المنشأة', 'error');
      return;
    }
    setVatErrors({});
    try {
      await window.api.saveSettings(form);
      window.__vatRate__ = parseFloat(form.vat_rate) || 0.15;
      window.__dateFormat__ = form.date_format || 'hijri';
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      window.dispatchEvent(new CustomEvent('app:settings-updated'));
    } catch (err) {
      toast('خطأ في الحفظ: ' + err.message, 'error');
      return;
    }
    try {
      await window.api.setSyncMode({ mode: form.network_mode, ip: form.master_ip });
    } catch (err) {
      console.warn('Sync mode update failed (non-fatal):', err.message);
    }
  };

  // ── completion badge per tab ─────────────────────────────────────────────
  const identityFilled = [form.business_name_ar, form.vat_number, form.crn, form.address_city, form.address_street].filter(Boolean).length;
  const identityTotal  = 5;
  const identityDone   = identityFilled === identityTotal;
  const zatcaLinked    = !!(zatcaDevice?.production_csid);

  if (loading) return (
    <AppLayout title="الإعدادات">
      <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>جاري التحميل...</div>
    </AppLayout>
  );

  return (
    <AppLayout title="إعدادات المنشأة">
      <div dir="rtl" style={{ display:'flex', flexDirection:'column', height:'100%', gap:0 }}>

        {/* ── ZATCA cert expired blocking overlay ── */}
        {certExpiredModal && (
          <div style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,0.7)', display:'flex',
            alignItems:'center', justifyContent:'center'
          }}>
            <div style={{
              background:'#fff', borderRadius:'16px', padding:'32px 36px',
              maxWidth:'480px', width:'90%', textAlign:'center',
              boxShadow:'0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔴</div>
              <h2 style={{ color:'#b91c1c', fontWeight:'900', marginBottom:'12px', fontSize:'18px' }}>
                شهادة ZATCA منتهية الصلاحية
              </h2>
              <p style={{ color:'#374151', lineHeight:'1.7', marginBottom:'24px', fontSize:'14px' }}>
                لا يمكن توقيع الفواتير حتى يتم تجديد شهادة الجهاز. يرجى الدخول إلى بوابة ZATCA
                وتجديد الشهادة من قسم الأجهزة.
              </p>
              <a
                href="https://zatca.gov.sa"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.api?.openExternal?.('https://zatca.gov.sa')}
                style={{
                  display:'inline-block', background:'#b91c1c', color:'#fff',
                  padding:'12px 28px', borderRadius:'10px', fontWeight:'800',
                  fontSize:'14px', textDecoration:'none', marginBottom:'12px'
                }}
              >
                🔗 فتح بوابة ZATCA للتجديد
              </a>
              <br/>
              <button
                onClick={() => setCertExpiredModal(false)}
                style={{
                  marginTop:'8px', background:'transparent', border:'1px solid #e5e7eb',
                  borderRadius:'8px', padding:'8px 20px', cursor:'pointer',
                  color:'#6b7280', fontSize:'13px', fontFamily:'inherit'
                }}
              >
                إغلاق (لن يجدد، التوقيع موقوف)
              </button>
            </div>
          </div>
        )}

        {/* ── ZATCA cert warning banner ── */}
        {certWarning && (
          <div style={{
            padding:'12px 20px',
            background: certWarning.type==='error' ? '#fef2f2' : '#fffbeb',
            border:`1px solid ${certWarning.type==='error' ? '#fca5a5' : '#fde68a'}`,
            borderRadius:'12px',
            color: certWarning.type==='error' ? '#b91c1c' : '#92400e',
            fontWeight:'700', display:'flex', alignItems:'center',
            justifyContent:'space-between', gap:'10px', marginBottom:'16px', flexShrink:0
          }}>
            <span>{certWarning.type==='error' ? '🔴 شهادة ZATCA منتهية الصلاحية! الإرسال متوقف.' : `⚠️ شهادة ZATCA تنتهي خلال ${certWarning.days} يوم. يُنصح بتجديدها.`}</span>
            {/* Non-dismissable when expired; dismissable only for warnings */}
            {certWarning.type !== 'error' && (
              <button onClick={() => setCertWarning(null)} style={{ background:'transparent', border:'none', cursor:'pointer', fontWeight:'900', fontSize:'16px' }}>×</button>
            )}
            {certWarning.type === 'error' && (
              <a
                href="https://zatca.gov.sa"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.api?.openExternal?.('https://zatca.gov.sa')}
                style={{ background:'#b91c1c', color:'#fff', padding:'6px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:'800', textDecoration:'none', whiteSpace:'nowrap' }}
              >
                فتح بوابة ZATCA
              </a>
            )}
          </div>
        )}

        {/* ── Saved confirmation ── */}
        {saved && (
          <div style={{
            padding:'12px 20px',
            background:'#ecfdf5', border:'1px solid #a7f3d0',
            borderRadius:'12px', color:'#065f46', fontWeight:'700',
            display:'flex', alignItems:'center', gap:'10px',
            marginBottom:'16px', flexShrink:0
          }}>
            <CheckCircle2 size={18}/> تم حفظ الإعدادات بنجاح!
          </div>
        )}

        {/* ── Main layout: Tab rail + content ── */}
        <div style={{ display:'flex', flex:1, minHeight:0, borderRadius:'20px', border:'1px solid var(--border-subtle)', overflow:'hidden', background:'var(--bg-card)' }}>

          {/* ── Left tab rail ── */}
          <div style={{
            width:'200px', flexShrink:0,
            background:'var(--bg-app)',
            borderLeft:'1px solid var(--border-subtle)',
            display:'flex', flexDirection:'column',
            padding:'12px 10px', gap:'2px'
          }}>
            {TABS.filter(tab => {
              if (tab.id === 'zatca' && !canAccess('settings.zatca')) return false;
              return true;
            }).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tab.id === 'identity'
                ? (!identityDone ? { label:`${identityFilled}/${identityTotal}`, color:'#f59e0b', bg:'#fffbeb' } : null)
                : tab.id === 'zatca'
                ? (!zatcaLinked ? { label:'مطلوب', color:'#ef4444', bg:'#fef2f2' } : { label:'✓', color:'#10b981', bg:'#ecfdf5' })
                : null;

              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'9px',
                    padding:'10px 12px', borderRadius:'10px',
                    border:'none', cursor:'pointer',
                    fontWeight: isActive ? '700' : '500',
                    fontSize:'13px', width:'100%', textAlign:'right',
                    fontFamily:'inherit', transition:'all 0.12s',
                    background: isActive ? (document.documentElement.getAttribute('data-theme')==='dark' ? '#1e3a8a' : '#eff6ff') : 'transparent',
                    color: isActive ? '#2563eb' : 'var(--text-muted)',
                    borderRight: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  }}>
                  <Icon size={16} style={{ flexShrink:0, opacity: isActive ? 1 : 0.65 }}/>
                  <span style={{ flex:1 }}>{tab.label}</span>
                  {badge && (
                    <span style={{
                      fontSize:'10px', fontWeight:'700', padding:'2px 6px',
                      borderRadius:'99px', background:badge.bg, color:badge.color,
                      flexShrink:0
                    }}>{badge.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Content area ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
            <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>

              {/* ══════════════════════════════════════════
                  TAB 1 — هوية المنشأة
              ══════════════════════════════════════════ */}
              {activeTab === 'identity' && (
                <div style={colGap}>
                  <TabHeader icon={<Building2 size={18}/>} title="هوية المنشأة"
                    desc="البيانات الأساسية تظهر في جميع الفواتير والوثائق الرسمية." />

                  {/* Business basics */}
                  <Card title="البيانات الأساسية" icon={<Building2 size={15}/>}>
                    <Field label="نوع النشاط التجاري">
                      <select value={form.business_type} onChange={e => u('business_type', e.target.value)} style={sel}>
                        {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                    <div style={grid2}>
                      <IF label="اسم المنشأة (عربي) *" value={form.business_name_ar} onChange={v => u('business_name_ar',v)} placeholder="مثال: متجر الرواد" err={vatErrors.business_name_ar}/>
                      <IF label="اسم المنشأة (إنجليزي)" value={form.business_name_en} onChange={v => u('business_name_en',v)} placeholder="Al-Ruwwad Store"/>
                      <IF label="اسم الفرع / الموقع" value={form.branch_name} onChange={v => u('branch_name',v)} placeholder="فرع الرياض - العليا"/>
                      <IF label="رقم الهاتف" value={form.phone} onChange={v => u('phone',v)} placeholder="+966 11 XXX XXXX"/>
                      <IF label="البريد الإلكتروني" value={form.email} onChange={v => u('email',v)} placeholder="info@store.com"/>
                      <IF label="الرقم الضريبي (VAT) *" value={form.vat_number} onChange={v => u('vat_number',v)} placeholder="300XXXXXXXXXX13" err={vatErrors.vat_number}/>
                      <IF label="رقم السجل التجاري (CRN) *" value={form.crn} onChange={v => u('crn',v)} placeholder="1010XXXXXX" err={vatErrors.crn}/>
                    </div>
                    <IF label="العنوان الكامل" value={form.address} onChange={v => u('address',v)} placeholder="الرياض، حي العليا، شارع العروبة"/>
                  </Card>

                  {/* Logo */}
                  <Card title="شعار المنشأة" icon={<ImageIcon size={15}/>}>
                    <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
                      <div style={{ width:'80px', height:'80px', borderRadius:'14px', background:'#f8fafc', border:'1.5px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                        {form.business_logo
                          ? <img src={form.business_logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                          : <ImageIcon size={28} color="#cbd5e1"/>}
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:'12px', color:'#64748b', marginBottom:'10px', lineHeight:'1.6' }}>
                          يظهر الشعار في الفاتورة وعلى شاشة البيع. يُفضل PNG بخلفية شفافة.
                        </p>
                        <button onClick={handleLogoUpload} disabled={uploading} style={{ ...btnBlue, fontSize:'12px', padding:'8px 16px', display:'flex', alignItems:'center', gap:'6px', opacity: uploading ? 0.6 : 1 }}>
                          <Upload size={14}/> {uploading ? 'جاري التحميل...' : 'اختر صورة'}
                        </button>
                        {form.business_logo && (
                          <button onClick={() => u('business_logo','')} style={{ marginTop:'6px', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'inherit' }}>
                            × حذف الشعار
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* National address */}
                  <Card title="العنوان الوطني" icon={<MapPin size={15}/>}
                    hint="يظهر في فواتير B2B — احصل عليه من naqaa.gov.sa">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                      <IF label="العنوان المختصر" value={form.address_short} onChange={v => u('address_short',v)} placeholder="TTPA8255"/>
                      <IF label="رقم المبنى" value={form.address_building} onChange={v => u('address_building',v)} placeholder="8255" err={vatErrors.address_building}/>
                      <IF label="الرمز البريدي" value={form.address_postal} onChange={v => u('address_postal',v)} placeholder="29763" err={vatErrors.address_postal}/>
                      <IF label="اسم الشارع" value={form.address_street} onChange={v => u('address_street',v)} placeholder="شارع الملك عبدالعزيز"/>
                      <IF label="الاسم الإضافي للشارع" value={form.address_additional_street} onChange={v => u('address_additional_street',v)} placeholder="طريق الملك عبدالعزيز"/>
                      <IF label="الرقم الفرعي" value={form.address_secondary} onChange={v => u('address_secondary',v)} placeholder="2660"/>
                      <IF label="الحي / المنطقة" value={form.address_district} onChange={v => u('address_district',v)} placeholder="حي الحمراء"/>
                      <IF label="المدينة *" value={form.address_city} onChange={v => u('address_city',v)} placeholder="الرياض"/>
                      <IF label="رقم القطعة" value={form.address_plot_id} onChange={v => u('address_plot_id',v)} placeholder="4321"/>
                    </div>
                  </Card>

                  {/* Bank account */}
                  <Card title="الحساب البنكي" icon={<CreditCard size={15}/>}
                    hint="تظهر هذه البيانات أسفل فواتير A4 لتسهيل التحويل البنكي.">
                    <div style={grid2}>
                      <IF label="اسم البنك" value={form.bank_name} onChange={v => u('bank_name',v)} placeholder="بنك الراجحي"/>
                      <IF label="اسم المستفيد" value={form.bank_beneficiary} onChange={v => u('bank_beneficiary',v)} placeholder="شركة الرواد التجارية"/>
                      <IF label="رقم الحساب" value={form.bank_account_number} onChange={v => u('bank_account_number',v)} placeholder="1234567890"/>
                      <IF label="رقم IBAN" value={form.bank_iban} onChange={v => u('bank_iban',v)} placeholder="SA12 3456 7890..."/>
                    </div>
                  </Card>

                  {/* Social */}
                  <Card title="قنوات التواصل" icon={<Smartphone size={15}/>}>
                    <div style={grid2}>
                      <IF label="رقم واتساب" value={form.whatsapp} onChange={v => u('whatsapp',v)} placeholder="9665XXXXXXXX"/>
                      <IF label="حساب إنستقرام" value={form.instagram} onChange={v => u('instagram',v)} placeholder="@username"/>
                      <IF label="الموقع الإلكتروني" value={form.website} onChange={v => u('website',v)} placeholder="www.store.com"/>
                    </div>
                    <Field label="قالب رسالة الواتساب (اختياري)">
                      <textarea value={form.whatsapp_template} onChange={e => u('whatsapp_template',e.target.value)}
                        style={{ ...inp, minHeight:'56px' }} placeholder="شكراً لتسوقكم من متجرنا. إليكم تفاصيل طلبكم:"/>
                    </Field>
                  </Card>
                </div>
              )}

              {/* ══════════════════════════════════════════
                  TAB 2 — هيئة الزكاة ZATCA
              ══════════════════════════════════════════ */}
              {activeTab === 'zatca' && (
                <div style={colGap}>
                  <TabHeader icon={<Shield size={18}/>} title="هيئة الزكاة والضريبة والجمارك"
                    desc="إدارة ربط الجهاز، بيئة التشغيل، وحالة الشهادات والإرسال." />

                  {/* Queue status card — always shown */}
                  <ZatcaQueueCard />

                  {/* ── Environment — pill buttons per design proposal ── */}
                  <Card title="بيئة التشغيل" icon={<Server size={15}/>}>
                    <Field label="اختر البيئة">
                      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                        {ZATCA_ENVS.map(env => {
                          const active = form.zatca_env === env.value;
                          return (
                            <button key={env.value}
                              onClick={() => {
                                if (env.value === 'core' && form.zatca_env !== 'core' && !form.simulationTestsPassed) {
                                  setEnvSwitchError('يجب اجتياز اختبارات المحاكاة أولاً قبل التبديل إلى بيئة الإنتاج.');
                                  return;
                                }
                                setEnvSwitchError('');
                                if (env.value !== 'core') {
                                  // Reset sim gate when leaving production
                                  setForm(f => ({ ...f, zatca_env: env.value, simulationTestsPassed: false }));
                                } else {
                                  u('zatca_env', env.value);
                                }
                              }}
                              style={{
                                flex:1, minWidth:'110px',
                                padding:'12px 10px',
                                borderRadius:'12px',
                                border: active ? `2px solid ${env.color}` : '1.5px solid var(--border-subtle)',
                                background: active ? `${env.color}12` : 'var(--bg-app)',
                                color: active ? env.color : 'var(--text-muted)',
                                cursor:'pointer', fontFamily:'inherit',
                                fontWeight: active ? '800' : '600',
                                fontSize:'13px',
                                display:'flex', flexDirection:'column',
                                alignItems:'center', gap:'4px',
                                transition:'all 0.15s',
                                boxShadow: active ? `0 0 0 3px ${env.color}20` : 'none',
                              }}>
                              <span style={{ fontSize:'20px' }}>{env.icon}</span>
                              <span>{env.label}</span>
                              <span style={{ fontSize:'10px', opacity:0.7, fontWeight:'500' }}>{env.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    {form.zatca_env === 'sandbox' && (
                      <div style={{
                        borderRadius:'12px', background:'#fffbeb', border:'2px solid #f59e0b',
                        padding:'16px', marginTop:'8px'
                      }}>
                        <p style={{ color:'#92400e', fontWeight:'900', fontSize:'14px', margin:0 }}>
                          ⚠ البيئة التجريبية (Sandbox) — الفواتير لن تُرسل إلى ZATCA الفعلي
                        </p>
                        <p style={{ color:'#b45309', fontSize:'12px', marginTop:'6px', marginBottom:0 }}>
                          استخدم هذه البيئة للاختبار فقط. قبل الإطلاق الفعلي، غيّر الإعداد إلى "إنتاج".
                        </p>
                      </div>
                    )}
                    {envSwitchError && (
                      <div style={{ padding:'10px 12px', background:'#fef2f2', borderRadius:'10px', border:'1px solid #fecaca', fontSize:'12px', color:'#b91c1c', fontWeight:'700' }}>
                        ⛔ {envSwitchError}
                      </div>
                    )}
                    <div style={{ padding:'10px 12px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', fontSize:'12px', color:'#1e40af' }}>
                      💡 بيئة الإنتاج تتطلب رقم ضريبي مسجل. استخدم بيئة المطورين للاختبار.
                    </div>
                  </Card>

                  {/* W-4: Simulation tests — only visible in simulation env */}
                  {form.zatca_env === 'simulation' && (
                    <Card title="اختبارات المحاكاة" icon={<Shield size={15} color="#f59e0b"/>}>
                      <div style={{ fontSize:'13px', color:'#64748b', lineHeight:'1.7' }}>
                        تُرسَل 3 فواتير تمثيلية (B2C، B2B، إشعار دائن) إلى بيئة المحاكاة للتحقق من صحة الإعدادات قبل الانتقال للإنتاج.
                      </div>
                      <button
                        onClick={async () => {
                          setSimTestStatus('running');
                          setSimTestResults(null);
                          try {
                            const res = await window.api.runSimulationTests();
                            setSimTestResults(res);
                            if (res?.allPassed) {
                              const updated = { ...form, simulationTestsPassed: true };
                              setForm(updated);
                              await window.api.saveSettings(updated);
                              toast('✅ جميع اختبارات المحاكاة نجحت! يمكنك الانتقال إلى الإنتاج.', 'success');
                            } else {
                              toast('⚠️ بعض الاختبارات فشلت. راجع النتائج أدناه.', 'error');
                            }
                          } catch (e) {
                            setSimTestResults({ success: false, error: e.message });
                            toast('خطأ: ' + e.message, 'error');
                          }
                          setSimTestStatus('done');
                        }}
                        disabled={simTestStatus === 'running'}
                        style={{ padding:'10px 20px', background:'#f59e0b', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'800', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'8px', opacity: simTestStatus==='running' ? 0.6 : 1 }}
                      >
                        {simTestStatus === 'running' ? '⏳ جاري الاختبار...' : '🔬 تشغيل اختبارات المحاكاة'}
                      </button>

                      {/* Results */}
                      {simTestResults && (
                        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                          {simTestResults.error && !simTestResults.results?.length && (
                            <div style={{ padding:'10px', background:'#fef2f2', borderRadius:'10px', fontSize:'12px', color:'#b91c1c' }}>
                              خطأ: {simTestResults.error}
                            </div>
                          )}
                          {(simTestResults.results || []).map((r, i) => (
                            <div key={i} style={{ padding:'10px 14px', background: r.passed ? '#ecfdf5' : '#fef2f2', borderRadius:'10px', border:`1px solid ${r.passed ? '#bbf7d0' : '#fecaca'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:'13px', fontWeight:'700', color: r.passed ? '#15803d' : '#b91c1c' }}>
                                {r.passed ? '✅' : '❌'} {r.label}
                              </span>
                              {!r.passed && r.details?.error && (
                                <span style={{ fontSize:'11px', color:'#b91c1c' }}>{r.details.error}</span>
                              )}
                            </div>
                          ))}
                          {simTestResults.allPassed && (
                            <div style={{ padding:'10px', background:'#f0fdf4', borderRadius:'10px', fontSize:'12px', color:'#15803d', fontWeight:'700' }}>
                              ✅ جميع الاختبارات نجحت — يمكنك الآن التبديل إلى بيئة الإنتاج.
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Device status / onboarding */}
                  {zatcaDevice?.production_csid ? (
                    <Card title="حالة الجهاز" icon={<BadgeCheck size={15}/>}>
                      <div style={{ padding:'14px', background:'#f0fdf4', borderRadius:'12px', border:'1px solid #bbf7d0', display:'flex', flexDirection:'column', gap:'10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#15803d', fontWeight:'800', fontSize:'14px' }}>
                          <CheckCircle2 size={20}/> الجهاز متصل وموثق (ZATCA Phase 2)
                        </div>
                        <div style={{ fontSize:'12px', color:'#166534', background:'#dcfce7', padding:'8px 12px', borderRadius:'8px', lineHeight:'1.7' }}>
                          <strong>معرف الجهاز (CSID):</strong> {zatcaDevice.device_id}<br/>
                          <strong>رقم التسلسل الحالي (ICV):</strong> {zatcaDevice.current_icv}<br/>
                          <strong>آخر مزامنة:</strong> {new Date(zatcaDevice.updated_at).toLocaleString('ar-SA')}
                        </div>
                        {/* FIX 5: Certificate expiry countdown badge */}
                        {(() => {
                          const expiryStr = certExpiresAt || zatcaDevice.cert_expires_at || zatcaDevice.pcsid_expires_at;
                          if (!expiryStr) return null;
                          const expiryDate = new Date(expiryStr);
                          const daysLeft = Math.ceil((expiryDate - Date.now()) / 86400000);
                          const color = daysLeft < 10 ? '#dc2626' : daysLeft < 30 ? '#d97706' : '#15803d';
                          const bg    = daysLeft < 10 ? '#fef2f2' : daysLeft < 30 ? '#fffbeb' : '#f0fdf4';
                          const border= daysLeft < 10 ? '#fca5a5' : daysLeft < 30 ? '#fde68a' : '#bbf7d0';
                          const icon  = daysLeft < 10 ? '🔴' : daysLeft < 30 ? '⚠️' : '✅';
                          const label = daysLeft <= 0
                            ? 'الشهادة منتهية الصلاحية!'
                            : daysLeft < 30
                            ? `تنتهي خلال ${daysLeft} يوم`
                            : `صالحة حتى ${expiryDate.toLocaleDateString('ar-SA')}`;
                          return (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', padding:'8px 12px', borderRadius:'10px', background: bg, border: `1px solid ${border}` }}>
                              <span style={{ fontSize:'12px', fontWeight:700, color }}>{icon} شهادة الجهاز: {label}</span>
                              <a
                                href="https://zatca.gov.sa"
                                onClick={e => { e.preventDefault(); window.api?.openExternal?.('https://zatca.gov.sa'); }}
                                style={{ fontSize:'11px', color, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}
                              >
                                تجديد الشهادة
                              </a>
                            </div>
                          );
                        })()}
                        <p style={{ fontSize:'11px', color:'#166534' }}>
                          جميع الفواتير يتم توقيعها وإرسالها تلقائياً عبر خدمة المزامنة الخلفية.
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <Card title="ربط الجهاز (Onboarding)" icon={<Key size={15}/>}>
                      <div style={{ padding:'10px 12px', background:'#fffbeb', borderRadius:'10px', border:'1px solid #fde68a', fontSize:'12px', color:'#92400e', lineHeight:'1.6' }}>
                        ⚠️ الجهاز غير مرتبط بمنصة فاتورة حتى الآن. لإصدار فواتير مطابقة للمرحلة الثانية، اتبع الخطوات:
                      </div>

                      {/* Step guide */}
                      <div style={{ display:'flex', flexDirection:'column', gap:'6px', padding:'4px 0' }}>
                        {[
                          { n:1, title:'سجّل الدخول على portal.zatca.gov.sa', sub:'باستخدام الهوية الرقمية' },
                          { n:2, title:'اذهب إلى "الأجهزة" وأضف جهازاً جديداً', sub:'أدخل اسم الجهاز والرقم الضريبي' },
                          { n:3, title:'انسخ كود OTP وأدخله أدناه', sub:'الكود صالح لمدة 15 دقيقة' },
                        ].map((s, i, arr) => (
                          <div key={s.n}>
                            <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                              <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#eff6ff', color:'#2563eb', fontSize:'12px', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'2px' }}>{s.n}</div>
                              <div>
                                <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--text-main)' }}>{s.title}</div>
                                <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{s.sub}</div>
                              </div>
                            </div>
                            {i < arr.length - 1 && <div style={{ width:'1px', height:'14px', background:'#e2e8f0', margin:'4px 0 4px 23px' }}/>}
                          </div>
                        ))}
                      </div>

                      <IF label="رمز الربط (OTP)" value={zatcaOtp} onChange={resetOnboardingOnChange} placeholder="أدخل كود التفعيل هنا (مثال: 123456)"/>
                      <button onClick={handleOnboardZatca}
                        disabled={onboardingStatus === 'loading' || !zatcaOtp}
                        style={{ ...btnGreen, width:'100%', justifyContent:'center', padding:'12px', fontSize:'13px', opacity: (onboardingStatus==='loading' || !zatcaOtp) ? 0.6 : 1 }}>
                        {onboardingStatus === 'loading' ? 'جاري الاتصال وإنشاء المفاتيح...' : '🔗 تفعيل وربط الجهاز'}
                      </button>
                      {onboardingStatus === 'error' && (
                        <div style={{ padding:'10px', background:'#fef2f2', borderRadius:'10px', fontSize:'11px', color:'#b91c1c' }}>
                          فشل الربط: {onboardingError}
                        </div>
                      )}
                      {onboardingStatus === 'success' && (
                        <div style={{ padding:'10px', background:'#f0fdf4', borderRadius:'10px', fontSize:'11px', color:'#15803d' }}>
                          ✅ نجاح! يرجى حفظ الإعدادات لحفظ البيئة.
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════
                  TAB 3 — الفواتير والطباعة
              ══════════════════════════════════════════ */}
              {activeTab === 'invoice' && (
                <div style={colGap}>
                  <TabHeader icon={<Receipt size={18}/>} title="الفواتير والطباعة"
                    desc="إعدادات الطابعة، تخصيص الفاتورة، والطباعة التلقائية." />

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:'20px', alignItems:'start' }}>
                    <div style={colGap}>
                      <Card title="إعدادات الطابعة" icon={<Receipt size={15}/>}>
                        <Field label="اختيار الطابعة الافتراضية">
                          <select value={form.receipt_printer} onChange={e => u('receipt_printer',e.target.value)} style={sel}>
                            <option value="">طابعة النظام الافتراضية</option>
                            {printers.map(p => <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(الافتراضية)' : ''}</option>)}
                          </select>
                        </Field>
                        <Field label="عرض ورق الطابعة">
                          <div style={{ display:'flex', gap:'8px' }}>
                            {['80', '58', 'A4'].map(w => (
                              <button key={w} onClick={() => u('receipt_width', w)}
                                style={{ padding:'7px 18px', borderRadius:'10px', border:'1px solid', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit',
                                  background: form.receipt_width === w ? '#eff6ff' : 'var(--bg-app)',
                                  color: form.receipt_width === w ? '#2563eb' : 'var(--text-muted)',
                                  borderColor: form.receipt_width === w ? '#bfdbfe' : 'var(--border-subtle)'
                                }}>
                                {w}{w !== 'A4' && 'mm'}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="طباعة تلقائية عند الدفع">
                          <select value={form.auto_print} onChange={e => u('auto_print',e.target.value)} style={sel}>
                            <option value="false">لا — اسألني أولاً</option>
                            <option value="true">نعم — طباعة فورية</option>
                          </select>
                        </Field>
                      </Card>

                      <Card title="ملصقات المنتجات" icon={<Receipt size={15}/>}>
                        <LabelPrintSettings
                          value={form.label_config}
                          onChange={v => u('label_config', v)}
                          settings={form}
                          printers={printers}
                        />
                      </Card>

                      <Card title="تخصيص الفاتورة" icon={<FileText size={15}/>}>
                        <div style={grid2}>
                          <Field label="بادئة رقم الفاتورة">
                            <input value={form.invoice_prefix} onChange={e => u('invoice_prefix',e.target.value)} style={inp} placeholder="INV-"/>
                          </Field>
                        </div>
                        <Field label="نص الترويسة (أعلى الفاتورة)">
                          <textarea value={form.receipt_header} onChange={e => u('receipt_header',e.target.value)}
                            style={{ ...inp, minHeight:'60px', resize:'vertical' }} placeholder="أهلاً بكم في متجرنا"/>
                        </Field>
                        <Field label="نص التذييل (شروط الاسترجاع)">
                          <textarea value={form.receipt_footer} onChange={e => u('receipt_footer',e.target.value)}
                            style={{ ...inp, minHeight:'60px', resize:'vertical' }} placeholder="لا يُقبل الاسترجاع بعد 7 أيام • شكراً لزيارتكم"/>
                        </Field>
                      </Card>
                    </div>

                    {/* Live receipt preview */}
                    <div>
                      <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'10px', textAlign:'center', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                        معاينة الفاتورة
                      </div>
                      <div style={{
                        margin:'0 auto',
                        width: form.receipt_width === 'A4' ? '200px' : form.receipt_width === '58' ? '100px' : '140px',
                        background:'white', border:'1px solid #e2e8f0',
                        borderRadius:'8px', padding:'12px 10px',
                        fontFamily:'monospace', fontSize:'10px',
                        color:'#334155', boxShadow:'0 4px 16px rgba(0,0,0,0.07)',
                        transition:'width 0.25s ease'
                      }}>
                        {form.business_logo && (
                          <div style={{ textAlign:'center', marginBottom:'6px' }}>
                            <img src={form.business_logo} alt="logo" style={{ height:'28px', objectFit:'contain' }}/>
                          </div>
                        )}
                        <div style={{ textAlign:'center', fontWeight:'bold', fontSize:'11px', marginBottom:'2px' }}>{form.business_name_ar || 'اسم المنشأة'}</div>
                        {form.receipt_header && <div style={{ textAlign:'center', fontSize:'9px', color:'#64748b', marginBottom:'4px' }}>{form.receipt_header}</div>}
                        <div style={{ borderTop:'1px dashed #cbd5e1', paddingTop:'6px', marginTop:'4px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}><span>رقم:</span><span>{form.invoice_prefix}0042</span></div>
                          <div style={{ display:'flex', justifyContent:'space-between' }}><span>التاريخ:</span><span>١٤٤٦/٠٣/١٤</span></div>
                        </div>
                        <div style={{ borderTop:'1px dashed #cbd5e1', paddingTop:'6px', marginTop:'6px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}><span>البند 1</span><span>50.00</span></div>
                          <div style={{ display:'flex', justifyContent:'space-between' }}><span>البند 2</span><span>65.00</span></div>
                        </div>
                        <div style={{ borderTop:'1px dashed #cbd5e1', paddingTop:'6px', marginTop:'6px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold' }}><span>المجموع</span><span>115.00</span></div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#64748b' }}><span>ض.ق.م ({(parseFloat(form.vat_rate||0)*100).toFixed(0)}%)</span><span>{(115 * parseFloat(form.vat_rate||0)).toFixed(2)}</span></div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', marginTop:'2px' }}><span>الإجمالي</span><span>{(115 * (1 + parseFloat(form.vat_rate||0))).toFixed(2)}</span></div>
                        </div>
                        {form.receipt_footer && <div style={{ textAlign:'center', fontSize:'8px', color:'#94a3b8', borderTop:'1px dashed #cbd5e1', paddingTop:'6px', marginTop:'6px', lineHeight:'1.5' }}>{form.receipt_footer}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════
                  TAB 4 — الضريبة والعملات
              ══════════════════════════════════════════ */}
              {activeTab === 'tax' && (
                <div style={colGap}>
                  <TabHeader icon={<Globe size={18}/>} title="الضريبة والعملات"
                    desc="إعدادات الدولة، نسبة الضريبة، والعملات." />

                  <Card title="الدولة والضريبة" icon={<Globe size={15}/>}>
                    <Field label="الدولة">
                      <select value={form.country} onChange={e => handleCountryChange(e.target.value)} style={sel}>
                        {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <div style={{ display:'flex', gap:'16px', padding:'14px', background:'var(--bg-app)', borderRadius:'12px', border:'1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'2px' }}>نسبة الضريبة المطبقة</div>
                        <div style={{ fontSize:'26px', fontWeight:'900', color:'#3b82f6' }}>{(parseFloat(form.vat_rate||0)*100).toFixed(0)}%</div>
                      </div>
                      <div style={{ width:'1px', background:'var(--border-subtle)' }}/>
                      <div>
                        <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'2px' }}>العملة</div>
                        <div style={{ fontSize:'18px', fontWeight:'800', color:'var(--text-main)' }}>{form.currency}</div>
                      </div>
                    </div>
                    <Field label="نسبة الضريبة (يدوياً)">
                      <input type="number" min="0" max="100" step="0.5"
                        value={(parseFloat(form.vat_rate||0)*100).toFixed(1)}
                        onChange={e => u('vat_rate', (parseFloat(e.target.value)||0)/100)}
                        style={{ ...inp, width:'120px' }}/>
                    </Field>
                    <div style={{ padding:'10px 12px', background:'#fffbeb', borderRadius:'10px', border:'1px solid #fde68a', fontSize:'11px', color:'#92400e' }}>
                      ⚠️ تغيير الضريبة يؤثر على الفواتير الجديدة فقط. لن تتغير البيانات السابقة.
                    </div>
                  </Card>

                  <Card title="العملات المتعددة" icon={<Globe size={15}/>}>
                    <div style={grid2}>
                      <IF label="العملة الثانوية (اختياري)" value={form.secondary_currency} onChange={v => u('secondary_currency',v)} placeholder="USD"/>
                      <IF label="سعر الصرف (1 SAR = ?)" value={form.exchange_rate} onChange={v => u('exchange_rate',v)} placeholder="0.27"/>
                    </div>
                  </Card>

                  <Card title="برنامج الولاء" icon={<Shield size={15}/>}>
                    <div style={grid2}>
                      <Field label="نقاط مكتسبة لكل SAR مدفوع">
                        <input type="number" value={form.loyalty_rate} onChange={e => u('loyalty_rate',e.target.value)} style={inp} placeholder="10"/>
                      </Field>
                      <Field label="قيمة النقطة عند الاستبدال (SAR)">
                        <input type="number" step="0.01" value={form.loyalty_redeem_rate} onChange={e => u('loyalty_redeem_rate',e.target.value)} style={inp} placeholder="0.10"/>
                      </Field>
                    </div>
                    <div style={{ padding:'10px 12px', background:'#ecfdf5', borderRadius:'10px', fontSize:'12px', color:'#065f46' }}>
                      💡 كل 10 ريال = {form.loyalty_rate} نقطة • كل نقطة = {form.loyalty_redeem_rate} ريال خصم
                    </div>
                  </Card>
                </div>
              )}

              {/* ══════════════════════════════════════════
                  TAB 5 — النظام
              ══════════════════════════════════════════ */}
              {activeTab === 'system' && (
                <div style={colGap}>
                  <TabHeader icon={<Server size={18}/>} title="النظام"
                    desc="إعدادات الشبكة، الأمان، النسخ الاحتياطي، والتحديثات." />

                  {canAccess('settings.network') && (
                    <Card title="الشبكة والمزامنة" icon={<Wifi size={15}/>}>
                      <Field label="وضع الشبكة">
                        <select value={form.network_mode} onChange={e => u('network_mode', e.target.value)} style={sel}>
                          <option value="standalone">جهاز مستقل (Standalone)</option>
                          <option value="master">جهاز رئيسي / سيرفر (Master Node)</option>
                          <option value="slave">جهاز فرعي (Client/Cashier Node)</option>
                        </select>
                      </Field>
                      {form.network_mode === 'slave' && (
                        <IF label="عنوان IP للجهاز الرئيسي" value={form.master_ip} onChange={v => u('master_ip',v)} placeholder="192.168.1.15"/>
                      )}
                      {syncStatus && (
                        <div style={{ padding:'12px', background: syncStatus.status==='sync_error' ? '#fef2f2' : '#eff6ff', borderRadius:'10px', fontSize:'12px', color: syncStatus.status==='sync_error' ? '#b91c1c' : '#1e40af' }}>
                          <div style={{ fontWeight:'bold', marginBottom:'4px' }}>الحالة: {syncStatus.status}</div>
                          {syncStatus.lastSync && <div>آخر مزامنة: {new Date(syncStatus.lastSync).toLocaleTimeString()}</div>}
                          {form.network_mode === 'slave' && (
                            <button onClick={() => window.api.forceSync()} style={{ marginTop:'8px', padding:'6px 12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'inherit' }}>
                              فرض المزامنة الآن
                            </button>
                          )}
                        </div>
                      )}
                    </Card>
                  )}

                  <Card title="أمان البيانات والقيود" icon={<Shield size={15}/>}>
                    <Field label="قفل تعديل المصروفات (بالأيام)">
                      <input type="number" value={form.expense_lock_days} onChange={e => u('expense_lock_days',e.target.value)} style={{ ...inp, width:'120px' }} placeholder="30"/>
                      <p style={{ fontSize:'11px', color:'#64748b', marginTop:'4px' }}>يمنع تعديل أو حذف أي مصروف مر عليه أكثر من هذه المدة.</p>
                    </Field>
                  </Card>

                  <Card title="إدارة المنتجات" icon={<Package size={15}/>}>
                    <p style={{ fontSize:'12px', color:'#64748b', lineHeight:1.6 }}>
                      لاستيراد المنتجات من Excel/CSV أو إضافة منتجات يدوياً، انتقل إلى صفحة إدارة المنتجات.
                    </p>
                    <button onClick={() => navigate('/menu-admin')}
                      style={{ ...btnOutlineBlue, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', width:'100%' }}>
                      🏷️ الذهاب لإدارة المنتجات
                    </button>
                  </Card>

                  <Card title="النسخ الاحتياطي والأمان" icon={<Database size={15}/>}>
                    <p style={{ fontSize:'12px', color:'#64748b', lineHeight:1.6 }}>
                      يقوم النظام بحفظ نسخ تلقائية. يمكنك تصديرها يدوياً لحفظها على قرص خارجي.
                    </p>
                    <div style={{ display:'flex', gap:'10px' }}>
                      <button onClick={handleExportBackup} style={{ ...btnOutlineBlue, flex:1, justifyContent:'center' }}>
                        💾 تصدير كملف
                      </button>
                      <button onClick={handleRestoreBackup} style={{ ...btnOutlineDanger, flex:1, justifyContent:'center' }}>
                        🔄 استعادة نسخة
                      </button>
                    </div>
                  </Card>

                  {/* ── License & Add-on Key Card ──────────────────────────── */}
                  <Card title="الترخيص والإضافات" icon={<Key size={15}/>}>
                    {/* Current license status */}
                    <div style={{ padding:'12px 14px', background: licValid ? '#f0fdf4' : '#fef2f2', borderRadius:'12px', border:`1px solid ${licValid ? '#bbf7d0' : '#fecaca'}`, display:'flex', flexDirection:'column', gap:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'12px', fontWeight:'700', color: licValid ? '#15803d' : '#b91c1c' }}>
                          {licValid ? '✅ ترخيص فعّال' : '❌ لا يوجد ترخيص صالح'}
                        </span>
                        {licKeyType === 'addon' && (
                          <span style={{ fontSize:'10px', fontWeight:'800', padding:'2px 8px', borderRadius:'99px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>مفتاح إضافة</span>
                        )}
                      </div>
                      {licValid && (
                        <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:'4px' }}>
                          <div><strong>الباقة:</strong> {licTierName} • {licBilling}</div>
                          {licDaysLeft !== null && licDaysLeft !== Infinity && (
                            <div><strong>الصلاحية:</strong> {licDaysLeft} يوم متبقي</div>
                          )}
                          {licDaysLeft === Infinity && <div><strong>الصلاحية:</strong> مدى الحياة</div>}
                          {licAddons && licAddons.length > 0 && (
                            <div>
                              <strong>الإضافات المفعّلة:</strong>{' '}
                              {licAddons.map(a => ({
                                restaurant: '🍽️ مطعم/KDS',
                                finance:    '📊 محاسبة',
                                sync:       '🔄 مزامنة',
                              }[a] || a)).join(' • ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add-on key input */}
                    <div style={{ padding:'12px 14px', background:'#fffbeb', borderRadius:'12px', border:'1px solid #fde68a', fontSize:'12px', color:'#92400e', lineHeight:'1.6' }}>
                      💡 مفتاح الإضافة يمنح ميزات إضافية (مطعم، محاسبة، مزامنة) بدون تغيير الباقة الأساسية.
                    </div>

                    <Field label="مفتاح الإضافة (Add-on Key)">
                      <input
                        type="text"
                        value={addonKey}
                        onChange={e => { setAddonKey(e.target.value.toUpperCase()); setAddonKeyStatus('idle'); setAddonKeyError(''); }}
                        placeholder="A1SRFN...  (19 حرف، يبدأ بـ A)"
                        dir="ltr"
                        style={{ ...inp, fontFamily:'monospace', letterSpacing:'0.06em', fontWeight:'700',
                          borderColor: addonKeyStatus === 'error' ? '#fca5a5' : addonKeyStatus === 'success' ? '#bbf7d0' : undefined }}
                      />
                      {addonKeyError && (
                        <span style={{ fontSize:'11px', color:'#ef4444', fontWeight:'700', display:'flex', alignItems:'center', gap:'4px' }}>
                          ⚠️ {addonKeyError}
                        </span>
                      )}
                      {addonKeyStatus === 'success' && addonKeyResult && (
                        <span style={{ fontSize:'11px', color:'#15803d', fontWeight:'700' }}>
                          ✅ تم التفعيل — الإضافات النشطة: {(addonKeyResult.activeAddons || []).map(a => ({restaurant:'مطعم',finance:'محاسبة',sync:'مزامنة'}[a]||a)).join(', ')}
                        </span>
                      )}
                    </Field>

                    <button
                      onClick={handleAddonActivate}
                      disabled={!addonKey.trim() || addonKeyStatus === 'loading'}
                      style={{ ...btnBlue,
                        background: addonKeyStatus === 'success' ? '#10b981' : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                        boxShadow: '0 4px 12px rgba(124,58,237,0.2)',
                        width:'100%', justifyContent:'center',
                        opacity: (!addonKey.trim() || addonKeyStatus === 'loading') ? 0.6 : 1
                      }}
                    >
                      {addonKeyStatus === 'loading' ? '⏳ جاري التحقق...' :
                       addonKeyStatus === 'success' ? <><CheckCircle2 size={16}/> تم التفعيل!</> :
                       <><Key size={15}/> تفعيل مفتاح الإضافة</>}
                    </button>
                  </Card>

                  <Card title="التحديثات والإصدار" icon={<Package size={15}/>}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>الإصدار الحالي:</span>
                      <span style={{ fontSize:'15px', fontWeight:'800', color:'#3b82f6' }}>v{version}</span>
                    </div>

                    {updateStatus.status === 'idle' && (
                      <button onClick={() => window.api.checkForUpdates()}
                        style={{ ...btnOutlineBlue, width:'100%', justifyContent:'center' }}>
                        🔍 التحقق من وجود تحديثات
                      </button>
                    )}
                    {updateStatus.status === 'checking' && (
                      <div style={{ padding:'10px', textAlign:'center', fontSize:'12px', color:'var(--text-muted)' }}>جاري البحث...</div>
                    )}
                    {updateStatus.status === 'downloading' && (
                      <div style={{ padding:'10px', background:'#eff6ff', borderRadius:'10px', fontSize:'12px', color:'#1e40af' }}>
                        جاري التحميل: {Math.floor(updateStatus.progress?.percent || 0)}%
                        <div style={{ width:'100%', height:'4px', background:'#dbeafe', borderRadius:'2px', marginTop:'8px', overflow:'hidden' }}>
                          <div style={{ width:`${updateStatus.progress?.percent || 0}%`, height:'100%', background:'#3b82f6' }}/>
                        </div>
                      </div>
                    )}
                    {updateStatus.status === 'ready' && (
                      <button onClick={() => window.api.installUpdate()} style={{ ...btnGreen, width:'100%', justifyContent:'center' }}>
                        ✨ تحديث متاح — اضغط لإعادة التشغيل والتثبيت
                      </button>
                    )}
                    {updateStatus.status === 'not-available' && (
                      <div style={{ padding:'10px', background:'#f0fdf4', borderRadius:'10px', fontSize:'12px', color:'#15803d', textAlign:'center' }}>
                        ✅ النظام محدث لأحدث إصدار
                      </div>
                    )}
                    {updateStatus.status === 'error' && (
                      <div style={{ padding:'10px', background:'#fef2f2', borderRadius:'10px', fontSize:'11px', color:'#b91c1c' }}>
                        فشل التحقق: {updateStatus.error}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ══════════════════════════════════════════
                  TAB 6 — واجهة المستخدم
              ══════════════════════════════════════════ */}
              {activeTab === 'ui' && (
                <div style={colGap}>
                  <TabHeader icon={<Palette size={18}/>} title="واجهة المستخدم"
                    desc="المظهر العام، صيغة التاريخ، وتفضيلات العرض." />

                  <Card title="المظهر والعرض" icon={<Palette size={15}/>}>
                    <div style={grid2}>
                      <Field label="الوضع الليلي (Dark Mode)">
                        <select value={form.dark_mode} onChange={e => u('dark_mode',e.target.value)} style={sel}>
                          <option value="false">إيقاف (الوضع الفاتح)</option>
                          <option value="true">تفعيل (الوضع الداكن)</option>
                        </select>
                      </Field>
                      <Field label="صيغة التاريخ الافتراضية">
                        <select value={form.date_format} onChange={e => u('date_format',e.target.value)} style={sel}>
                          <option value="hijri">هجري (أم القرى)</option>
                          <option value="gregorian">ميلادي</option>
                        </select>
                      </Field>
                    </div>
                  </Card>
                </div>
              )}

            </div>

            {/* ── Sticky save bar ── */}
            <div style={{
              padding:'14px 24px',
              background:'var(--bg-card)',
              borderTop:'1px solid var(--border-subtle)',
              display:'flex', alignItems:'center',
              justifyContent:'space-between', gap:'12px',
              flexShrink:0
            }}>
              <span style={{ fontSize:'12px', color:'#94a3b8' }}>
                {saved ? '✅ تم الحفظ بنجاح' : 'سيتم تطبيق التغييرات فور الحفظ'}
              </span>
              <button onClick={save} style={{ ...btnBlue, padding:'11px 28px', fontSize:'14px', fontWeight:'800', display:'flex', alignItems:'center', gap:'8px' }}>
                {saved ? <><CheckCircle2 size={16}/> تم الحفظ!</> : <><Save size={16}/> حفظ التغييرات</>}
              </button>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

// ── ZatcaQueueCard ────────────────────────────────────────────────────────
function ZatcaQueueCard() {
  const [status, setStatus] = useState(undefined); // undefined = loading, null = error/unavailable
  useEffect(() => {
    const poll = async () => {
      try {
        const result =
          await window.api.getZatcaQueueStatus?.() ??
          await window.api.getZatcaQueueStatus?.();
        setStatus(result || null);
      } catch {
        setStatus(null);
      }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  if (status === undefined) return (
    <Card title="حالة قائمة الإرسال" icon={<Shield size={15}/>}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ padding:'10px', background:'var(--bg-app)', borderRadius:'10px', textAlign:'center', opacity:0.4 }}>
            <div style={{ fontSize:'20px', fontWeight:'900', color:'var(--text-muted)' }}>—</div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>جاري التحميل</div>
          </div>
        ))}
      </div>
    </Card>
  );

  if (status === null) return null; // API unavailable — hide silently

  const hasFailed = (status.rejectedCount || 0) > 0;

  return (
    <Card title="حالة قائمة الإرسال" icon={<Shield size={15} color={hasFailed ? '#ef4444' : '#10b981'}/>}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
        {[
          { label:'⏳ معلق', val: status.pendingCount || 0,  bg:'#fffbeb', color:'#92400e'  },
          { label:'✅ مُرسَل', val: status.reportedCount || 0, bg:'#ecfdf5', color:'#065f46' },
          { label:'❌ مرفوض', val: status.rejectedCount || 0, bg:'#fef2f2', color:'#b91c1c' },
        ].map(s => (
          <div key={s.label} style={{ padding:'10px 12px', background:s.bg, borderRadius:'10px', textAlign:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'900', color:s.color }}>{s.val}</div>
            <div style={{ fontSize:'11px', color:s.color, marginTop:'2px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {hasFailed && (
        <button onClick={() => window.api.retryZatcaQueue?.()}
          style={{ ...btnDanger, width:'100%', justifyContent:'center' }}>
          <RefreshCw size={14}/> إعادة الإرسال الآن
        </button>
      )}
      {status.isHalted && (
        <div style={{ fontSize:'11px', color:'#b91c1c', padding:'8px 12px', background:'#fef2f2', borderRadius:'8px' }}>
          ⛔ القائمة موقوفة بسبب رفض سابق — راجع الفواتير المرفوضة وأعد الإرسال.
        </div>
      )}
    </Card>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────
function TabHeader({ icon, title, desc }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', paddingBottom:'4px' }}>
      <div style={{ width:'36px', height:'36px', background:'#eff6ff', color:'#2563eb', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize:'16px', fontWeight:'800', color:'var(--text-main)', marginBottom:'3px' }}>{title}</h2>
        <p style={{ fontSize:'13px', color:'#64748b' }}>{desc}</p>
      </div>
    </div>
  );
}

function Card({ title, icon, hint, children }) {
  return (
    <div style={{ background:'var(--bg-card)', borderRadius:'16px', padding:'20px', border:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:'14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ color:'#64748b' }}>{icon}</div>
        <h3 style={{ fontSize:'14px', fontWeight:'800', color:'var(--text-main)' }}>{title}</h3>
      </div>
      {hint && (
        <div style={{ padding:'9px 12px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', fontSize:'12px', color:'#1e40af' }}>
          💡 {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function IF({ label, value, onChange, placeholder, type='text', err }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value||''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inp, borderColor: err ? '#fca5a5' : undefined }}/>
      {err && <span style={{ fontSize:'11px', color:'#ef4444' }}>{err}</span>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

const colGap = { display:'flex', flexDirection:'column', gap:'16px' };
const grid2  = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' };
const inp    = { padding:'10px 12px', borderRadius:'10px', border:'1px solid var(--border-subtle)', fontSize:'13px', outline:'none', background:'var(--bg-app)', color:'var(--text-main)', fontFamily:'inherit', width:'100%', boxSizing:'border-box' };
const sel    = { ...inp, cursor:'pointer' };

const btnBlue = { padding:'10px 18px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'11px', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'7px', boxShadow:'0 4px 12px rgba(37,99,235,0.2)' };
const btnGreen = { ...btnBlue, background:'#10b981', boxShadow:'0 4px 12px rgba(16,185,129,0.2)' };
const btnDanger = { ...btnBlue, background:'#ef4444', boxShadow:'0 4px 12px rgba(239,68,68,0.2)' };
const btnOutlineBlue = { padding:'10px 16px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:'11px', cursor:'pointer', fontWeight:'700', fontFamily:'inherit', fontSize:'13px', display:'flex', alignItems:'center', gap:'7px' };
const btnOutlineDanger = { ...btnOutlineBlue, background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca' };
