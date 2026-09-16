import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { GarmentIcon } from '../components/GarmentIcons';
import { Ruler, Scissors, Printer, Paperclip, Edit3, Save, BarChart2, X, Plus, Send } from 'lucide-react';
import TailorWhatsAppModal from '../components/mulam/TailorWhatsAppModal';
import { printMeasurementProfileDirect, generateMeasurementWhatsAppText } from '../utils/tailorPrintAndShare';

const GARMENT_TYPES = [
  { id: 'thobe',   label: 'ثوب رجالي' },
  { id: 'sirwal',  label: 'سروال' },
  { id: 'shirt',   label: 'قميص' },
  { id: 'bisht',   label: 'بشت' },
  { id: 'suit',    label: 'بدلة' },
];

const NORMALIZED_FIELDS = [
  { key: 'length',       label: 'الطول (Length)' },
  { key: 'shoulder',     label: 'الكتف (Shoulder)' },
  { key: 'chest',        label: 'الصدر (Chest)' },
  { key: 'waist',        label: 'الوسط (Waist)' },
  { key: 'sleeve',       label: 'الكم (Sleeve)' },
  { key: 'neck',         label: 'الرقبة (Neck)' },
  { key: 'wrist',        label: 'الزند (Wrist)' },
  { key: 'hand_opening', label: 'وسع الكم / الرجل (Opening)' },
];

const BLANK = {
  length: '', shoulder: '', chest: '', waist: '', sleeve: '', neck: '', wrist: '', hand_opening: '',
  collar: 'classic', cuff: 'single', pocket: 'normal', notes: '',
};

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('ar-SA'); } catch { return d; }
}

export default function MeasurementCapture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customer_id') ? Number(searchParams.get('customer_id')) : null;

  const [customer,    setCustomer]    = useState(null);
  const [profiles,    setProfiles]    = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [editMode,    setEditMode]    = useState(false);
  const [form,        setForm]        = useState({ ...BLANK, garment_type: 'thobe' });
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [unit,        setUnit]        = useState(() => localStorage.getItem('mulam_preferred_unit') || 'in');
  const [showHistory, setShowHistory] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    window.api?.getSettings?.().then(s => {
      if (s) setSettings(s);
    }).catch(err => console.warn('Failed to load settings:', err));
  }, []);

  // Search View State
  const [allCustomers, setAllCustomers] = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');

  // Unit Conversion Helpers
  const toDisplay = (val) => {
    if (!val) return '';
    return unit === 'cm' ? (parseFloat(val) * 2.54).toFixed(1) : val;
  };

  const toDB = (val) => {
    if (!val) return '';
    return unit === 'cm' ? (parseFloat(val) / 2.54).toFixed(2) : val;
  };

  // Sync unit with MulamSubNav
  useEffect(() => {
    const handleUnitChange = (e) => {
      if (e.detail?.unit) {
        setUnit(e.detail.unit);
      }
    };
    window.addEventListener('mulam:unit-changed', handleUnitChange);
    return () => window.removeEventListener('mulam:unit-changed', handleUnitChange);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (customerId) {
        const [customers, profs, atts] = await Promise.all([
          window.api?.getCustomers?.({ id: customerId }) ?? [],
          window.api?.tailor?.getMeasurements?.({ customer_id: customerId }) ?? [],
          window.api?.tailor?.getAttachments?.(customerId) ?? [],
        ]);
        const cust = Array.isArray(customers) ? customers.find(c => c.id === customerId) || customers[0] : null;
        setCustomer(cust);
        setProfiles(profs || []);
        setAttachments(atts || []);

        if (profs && profs.length > 0) {
          handleSelectProfile(profs[0]);
        }
      } else {
        const custs = await window.api?.getCustomers?.() ?? [];
        setAllCustomers(Array.isArray(custs) ? custs : []);
      }
    } catch (err) {
      setError(err.message || 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleSelectProfile = (p) => {
    setSelected(p);
    const m = p.measurements || {};
    setForm({
      garment_type: p.garment_type || 'thobe',
      length: toDisplay(m.length),
      shoulder: toDisplay(m.shoulder),
      chest: toDisplay(m.chest),
      waist: toDisplay(m.waist),
      sleeve: toDisplay(m.sleeve),
      neck: toDisplay(m.neck),
      wrist: toDisplay(m.wrist || m.cuff || m.cuffs),
      hand_opening: toDisplay(m.hand_opening || m.bottom),
      collar: m.collar || 'classic',
      cuff: m.cuff || m.cuffs || 'single',
      pocket: m.pocket || 'normal',
      notes: m.notes || '',
    });
    setEditMode(false);
  };

  const handleNewProfile = () => {
    setSelected(null);
    setForm({ ...BLANK, garment_type: 'thobe' });
    setEditMode(true);
  };

  const handleSave = async (isDraft = false) => {
    if (!customerId) return;
    const { garment_type, notes, collar, cuff, pocket, ...numericFields } = form;

    const dbMeasurements = { notes, collar, cuff, pocket };

    if (!isDraft) {
      if (!numericFields.length || Number(numericFields.length) <= 0) {
        setError('يرجى إدخال الطول على الأقل لحفظ المقاس');
        return;
      }
    }

    for (const [key, val] of Object.entries(numericFields)) {
      if (val) dbMeasurements[key] = toDB(val);
    }

    setError(null);
    setSaving(true);
    try {
      await window.api?.tailor?.saveProfile?.({
        customer_id: customerId,
        garment_type,
        measurements: dbMeasurements,
        status: isDraft ? 'draft' : 'complete'
      });
      await load();
      setEditMode(false);
    } catch (err) {
      setError(err.message || 'فشل حفظ المقاس');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await window.api?.tailor?.saveAttachment?.({
          customer_id: customerId,
          fileName: file.name,
          base64Data: ev.target.result,
          notes: 'مرفق موديل جديد'
        });
        load();
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Primary Action: Direct Measurement-to-Order Launch ─────────────────────
  const handleStartOrderWithProfile = () => {
    if (!customer) return;
    const params = new URLSearchParams();
    params.set('customerId', customer.id);
    if (customer.phone) params.set('phone', customer.phone);
    if (customer.name) params.set('name', customer.name);
    if (selected?.id) params.set('profileId', selected.id);

    navigate(`/tailor-pos?${params.toString()}`, {
      state: {
        customer,
        preloadedMeasurements: {
          garment_type: form.garment_type,
          length: toDB(form.length),
          shoulder: toDB(form.shoulder),
          chest: toDB(form.chest),
          waist: toDB(form.waist),
          sleeve: toDB(form.sleeve),
          neck: toDB(form.neck),
          wrist: toDB(form.wrist),
          hand_opening: toDB(form.hand_opening),
          collar: form.collar,
          cuff: form.cuff,
          pocket: form.pocket,
          notes: form.notes
        }
      }
    });
  };

  return (
    <div dir="rtl" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-app, #f1f5f9)',
      color: 'var(--text-main, #0f172a)',
      fontFamily: "'Cairo', 'Tajawal', sans-serif",
      overflow: 'hidden'
    }}>
      {/* Unified Mulam Pipeline Navigation Rail */}
      <MulamSubNav
        activeTab="measurements"
        currentUnit={unit}
        onUnitChange={setUnit}
      />

      {/* ── Mode 1: Search and Select Customer View ──────────────────────── */}
      {!customerId ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '30px 20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Ruler size={22} color="var(--color-primary, #6366f1)" />
                <span>دفتر وسجل المقاسات (Measurement Ledger)</span>
              </h2>
              <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '14px', margin: 0 }}>
                ابحث عن عميل للوصول المباشر إلى ملف قياساته، مقارنة السجلات، أو إطلاق تفصيل جديد
              </p>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="ابحث بالاسم أو رقم الجوال..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '15px',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              />
            </div>

            {/* Customers Matches Card */}
            <div style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              {allCustomers
                .filter(c => (c.name || '').includes(searchTerm) || (c.phone && c.phone.includes(searchTerm)))
                .slice(0, 12)
                .map(c => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/measurements?customer_id=${c.id}`)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main, #0f172a)' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                        {c.phone || 'لا يوجد رقم'}
                      </div>
                    </div>
                    <div style={{ color: 'var(--primary, #6366f1)', fontWeight: 800, fontSize: '13px' }}>
                      فتح سجل المقاسات ←
                    </div>
                  </div>
                ))}
              {allCustomers.length > 0 && allCustomers.filter(c => (c.name || '').includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))).length === 0 && (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  لم يتم العثور على عملاء يطابقون كلمة البحث
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (

        /* ── Mode 2: Active Customer Measurement File View ───────────────── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Top Bar for Active Customer with Primary CTA */}
          <div style={{
            padding: '12px 20px',
            background: 'var(--bg-card, #ffffff)',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => navigate('/measurements')}
                style={{
                  background: 'var(--bg-hover, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ← عميل آخر
              </button>
              <div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  ملف العميل: {customer?.name || '—'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-accent, #0ea5e9)', marginRight: '10px', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                  ({customer?.phone || '—'})
                </span>
              </div>
            </div>

            {/* PRIMARY CTA BUTTON: Start Order With This Profile */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleStartOrderWithProfile}
                style={{
                  minHeight: '44px',
                  background: 'var(--color-primary, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 20px',
                  fontWeight: 900,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
                }}
              >
                <Scissors size={18} />
                <span>بدء طلب تفصيل جديد بهذا المقاس</span>
              </button>
            </div>
          </div>

          {/* Dual Panel Layout (Profiles List + Measurement Form) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'row' }}>
            
            {/* Sidebar: Profiles List & History */}
            <div style={{
              width: '320px',
              background: 'var(--bg-card, #ffffff)',
              borderLeft: '1px solid var(--border-subtle, #e2e8f0)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowHistory(true)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    color: 'var(--color-accent, #0ea5e9)',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <BarChart2 size={14} />
                  <span>مقارنة السجل</span>
                </button>
                <button
                  onClick={() => printMeasurementProfileDirect(customer, form, unit, settings)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-hover, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    color: '#3b82f6',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                  title="طباعة نموذج المقاسات A4"
                >
                  <Printer size={14} />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    color: '#10b981',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                  title="مشاركة المقاس مع الخياط عبر واتساب"
                >
                  <Send size={14} />
                  <span>واتساب</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '13px' }}>المقاسات المحفوظة</span>
                <button
                  onClick={handleNewProfile}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--color-primary, #6366f1)',
                    color: 'var(--color-primary, #6366f1)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + مقاس جديد
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                {profiles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted, #64748b)', fontSize: '12px' }}>
                    لا توجد مقاسات مسجلة بعد لهذا العميل
                  </div>
                )}
                {profiles.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProfile(p)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: selected?.id === p.id ? '1px solid var(--color-primary, #6366f1)' : '1px solid var(--border-subtle, #e2e8f0)',
                      background: selected?.id === p.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-hover, #f8fafc)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>
                        {p.garment_type === 'thobe' ? 'ثوب رجالي' : p.garment_type === 'sirwal' ? 'سروال' : p.garment_type === 'shirt' ? 'قميص' : p.garment_type === 'bisht' ? 'بشت' : p.garment_type}
                      </span>
                      {p.status === 'draft' && (
                        <span style={{ background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>
                          مسودة
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                      تحديث: {fmt(p.updated_at)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Attachments Section */}
              <div style={{ borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: '8px' }}>
                  مرفقات وصور الموديل
                </span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/*"
                  style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', width: '100%' }}
                />
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {attachments.map(a => (
                    <div key={a.id} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--bg-hover, #f8fafc)', borderRadius: '4px', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Paperclip size={12} />
                      <span>{a.file_path.split(/[\\/]/).pop()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content: Measurements Grid Form */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '16px', fontSize: '13px' }}>
                  {error}
                </div>
              )}

              <div style={{
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '14px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    {editMode ? 'إدخال / تعديل المقاسات' : 'تفاصيل المقاس المعتمد'}
                  </h3>
                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      style={{
                        padding: '6px 16px',
                        background: 'var(--color-primary, #6366f1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit3 size={13} />
                      <span>تعديل المقاس</span>
                    </button>
                  )}
                </div>

                {/* Garment Type Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '6px' }}>
                    نوع القطعة
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {GARMENT_TYPES.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => editMode && setForm(prev => ({ ...prev, garment_type: g.id }))}
                        disabled={!editMode}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: form.garment_type === g.id
                            ? '1px solid var(--color-accent, #0ea5e9)'
                            : '1px solid var(--border-subtle, #e2e8f0)',
                          background: form.garment_type === g.id
                            ? 'rgba(14, 165, 233, 0.15)'
                            : 'var(--bg-hover, #f8fafc)',
                          color: form.garment_type === g.id ? 'var(--color-accent, #0ea5e9)' : 'var(--text-muted, #64748b)',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: editMode ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <GarmentIcon type={g.id} size={16} color={form.garment_type === g.id ? 'var(--color-accent, #0ea5e9)' : '#64748b'} />
                        <span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Normalized Measurements Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px',
                  marginBottom: '16px'
                }}>
                  {NORMALIZED_FIELDS.map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                        {f.label} ({unit})
                      </label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={form[f.key] || ''}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        disabled={!editMode}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          background: editMode ? 'var(--bg-hover, #f8fafc)' : '#0d131f',
                          color: '#ffffff',
                          fontSize: '15px',
                          fontWeight: 800,
                          textAlign: 'center',
                          fontFamily: "'IBM Plex Mono', monospace"
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Garment Style Config */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                      الياقة (Collar)
                    </label>
                    <select
                      value={form.collar}
                      onChange={e => setForm({ ...form, collar: e.target.value })}
                      disabled={!editMode}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-hover, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', color: '#fff', fontSize: '13px' }}
                    >
                      <option value="classic">كلاسيك</option>
                      <option value="mandarin">ماندرين</option>
                      <option value="chanel">قلاب</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                      الكبك (Cuff)
                    </label>
                    <select
                      value={form.cuff}
                      onChange={e => setForm({ ...form, cuff: e.target.value })}
                      disabled={!editMode}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-hover, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', color: '#fff', fontSize: '13px' }}
                    >
                      <option value="single">مفرد</option>
                      <option value="double">مزدوج</option>
                      <option value="plain">سادة</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                      شكل الجيب (Pocket)
                    </label>
                    <select
                      value={form.pocket}
                      onChange={e => setForm({ ...form, pocket: e.target.value })}
                      disabled={!editMode}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-hover, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', color: '#fff', fontSize: '13px' }}
                    >
                      <option value="normal">عادي</option>
                      <option value="hidden">مخفي</option>
                      <option value="double">مزدوج</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                    ملاحظات المقاس والقصة الخاصة
                  </label>
                  <textarea
                    rows="2"
                    placeholder="ملاحظات وتفاصيل خاصة بالعميل..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    disabled={!editMode}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-hover, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                {/* Save Buttons (when in edit mode) */}
                {editMode && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      style={{
                        flex: 2,
                        minHeight: '44px',
                        background: 'var(--color-primary, #6366f1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 900,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {saving ? 'جاري الحفظ...' : (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Save size={16} />
                          <span>حفظ واعتماد المقاس</span>
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        background: 'var(--bg-hover, #f8fafc)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      حفظ كمسودة
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORICAL DELTA COMPARISON MODAL ─────────────────────────────── */}
      {showHistory && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '24px',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '85vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="var(--color-accent, #0ea5e9)" />
                <span>مقارنة سجل المقاسات التاريخي (History & Delta Diffs)</span>
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #334155' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted, #64748b)' }}>المقاس</th>
                  {profiles.slice(0, 3).map((p, i) => (
                    <th key={p.id} style={{ padding: '10px', color: 'var(--text-main, #0f172a)' }}>
                      {i === 0 ? 'الحالي' : i === 1 ? 'السابق' : 'الأقدم'}<br />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>{fmt(p.updated_at)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NORMALIZED_FIELDS.map(f => (
                  <tr key={f.key} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>{f.label}</td>
                    {profiles.slice(0, 3).map((p, i) => {
                      const val = p.measurements?.[f.key] || 0;
                      const prevVal = profiles[i + 1]?.measurements?.[f.key];
                      const delta = prevVal ? (parseFloat(val) - parseFloat(prevVal)).toFixed(1) : 0;
                      return (
                        <td key={p.id} style={{ padding: '10px', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {val}
                          {delta != 0 && (
                            <span style={{ color: delta > 0 ? '#ef4444' : '#10b981', fontSize: '11px', marginRight: '6px' }}>
                              ({delta > 0 ? `+${delta}` : delta})
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WhatsApp Share Modal */}
      <TailorWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title={`مشاركة مقاسات العميل ${customer?.name || ''}`}
        defaultCustomerPhone={customer?.phone || ''}
        customerName={customer?.name || ''}
        messageText={generateMeasurementWhatsAppText(customer, form, unit)}
      />
    </div>
  );
}
