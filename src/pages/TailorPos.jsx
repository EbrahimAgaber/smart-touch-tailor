import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import TailorWorkOrder from '../components/TailorWorkOrder';
import { GarmentIcon } from '../components/GarmentIcons';
import { Zap, ShoppingBag, FileText, Eye, Plus, Check, Printer, RotateCcw, UserPlus, ArrowRight, ArrowLeft, Lock, X, CreditCard, ShoppingCart, FileSpreadsheet, Copy, Send, Ruler, Factory, Share2 } from 'lucide-react';
import { useTailorPos } from '../hooks/useTailorPos';
import TailorPrintModal from '../components/mulam/TailorPrintModal';
import TailorWhatsAppModal from '../components/mulam/TailorWhatsAppModal';
import { printTailorWorkOrderDirect, generateTailorWhatsAppText } from '../utils/tailorPrintAndShare';
import { playPaymentChime } from '../utils/audioFeedback';
import './TailorPos.css';

export default function TailorPos() {
    const navigate = useNavigate();
    const {
        loading,
        fabrics,
        phone, setPhone,
        name, setName,
        customer,
        customerProfiles,
        latestProfile,
        profileLoaded,
        invoiceNumber,
        deliveryDate, setDeliveryDate, setDeliveryDays,
        items, setItems,
        activeItemIndex, setActiveItemIndex,
        paid, setPaid,
        discount, setDiscount,
        paymentMethod, setPaymentMethod,
        splitCash, setSplitCash,
        splitCard,
        saving,
        staff,
        tailorId, setTailorId,
        cutterId, setCutterId,
        activeItem,
        handleLoadProfile,
        loadProfile,
        resetForm,
        updateMeasurement,
        updateConfig,
        setGarmentType,
        cloneItem,
        addItem,
        removeItem,
        handleSaveProfile,
        processOrder,
        createTailorOrder,
        handleMeasurementKeyDown,
        subtotalBeforeDiscount,
        vat,
        total,
        balance,
        orderPayload,
        isUrgent, setIsUrgent,
        urgentFee, setUrgentFee,
        isGift, setIsGift,
        recipientName, setRecipientName,
        recipientPhone, setRecipientPhone,
        processOrderDirectPay,
        completedOrder, setCompletedOrder,
        SIZING_PRESETS, applyStandardSize
    } = useTailorPos();

    const printRef = useRef();
    const phoneInputRef = useRef(null);

    // Work Order Drawer Toggle (eliminates 33% permanent screen hog)
    const [showWorkOrderDrawer, setShowWorkOrderDrawer] = useState(false);
    const [showProfilesModal, setShowProfilesModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [settings, setSettings] = useState({});

    const handleCheckoutToPOS = useCallback(async () => {
        const handoffData = await createTailorOrder('pending');
        if (handoffData) {
            navigate('/pos', { state: { tailorHandoff: handoffData } });
        }
    }, [createTailorOrder, navigate]);

    // ── Global Hotkeys for Tailor Pos Station ─────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = e.target?.tagName?.toLowerCase();
            const isInput = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

            if (e.key === 'F1') {
                e.preventDefault();
                phoneInputRef.current?.focus();
                phoneInputRef.current?.select();
            } else if (e.key === 'F2' && !isInput) {
                e.preventDefault();
                addItem();
            } else if (e.key === 'F3' && !isInput) {
                e.preventDefault();
                setShowProfilesModal(prev => !prev);
            } else if (e.key === 'F4' && !isInput) {
                e.preventDefault();
                setShowWorkOrderDrawer(prev => !prev);
            } else if (e.key === 'F8') {
                e.preventDefault();
                setPaymentMethod('Cash');
            } else if (e.key === 'F9') {
                e.preventDefault();
                setPaymentMethod('Card');
            } else if (e.key === 'F10') {
                e.preventDefault();
                if (!saving) {
                    processOrderDirectPay().then(res => {
                        if (res) playPaymentChime();
                    });
                }
            } else if (e.key === 'F12') {
                e.preventDefault();
                if (!saving) {
                    handleCheckoutToPOS();
                }
            } else if (e.key === 'Escape') {
                if (showWorkOrderDrawer) setShowWorkOrderDrawer(false);
                else if (showProfilesModal) setShowProfilesModal(false);
                else if (showPrintModal) setShowPrintModal(false);
                else if (showWhatsAppModal) setShowWhatsAppModal(false);
                else if (completedOrder) setCompletedOrder(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [addItem, saving, processOrderDirectPay, handleCheckoutToPOS, setPaymentMethod, showWorkOrderDrawer, showProfilesModal, showPrintModal, showWhatsAppModal, completedOrder, setCompletedOrder]);

    useEffect(() => {
        window.api?.getSettings?.().then(s => {
            if (s) setSettings(s);
        }).catch(err => console.warn('Failed to load settings:', err));
    }, []);

    const handleDirectPrintA4 = async (targetOrder = null) => {
        const orderToPrint = targetOrder || completedOrder || orderPayload;
        await printTailorWorkOrderDirect(orderToPrint, fabrics, settings);
    };

    // Global Unit Sync
    const [unit, setUnit] = useState(() => localStorage.getItem('mulam_preferred_unit') || 'in');

    useEffect(() => {
        const handleUnitEvent = (e) => {
            if (e.detail?.unit) {
                setUnit(e.detail.unit);
            }
        };
        window.addEventListener('mulam:unit-changed', handleUnitEvent);
        return () => window.removeEventListener('mulam:unit-changed', handleUnitEvent);
    }, []);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--bg-app, #f1f5f9)',
                color: 'var(--text-muted, #64748b)',
                fontSize: '18px',
                fontWeight: 700
            }}>
                جاري تجهيز محطة التفصيل...
            </div>
        );
    }

    // Convert values based on active unit
    const displayVal = (val) => {
        if (!val) return '';
        return unit === 'cm' ? (parseFloat(val) * 2.54).toFixed(1) : val;
    };

    const handleUnitChange = (e, fKey) => {
        let val = e.target.value;
        if (unit === 'cm' && val) {
            val = (parseFloat(val) / 2.54).toFixed(2);
        }
        updateMeasurement(fKey, val);
    };

    return (
        <div dir="rtl" className="tailor-pos-root">
            {/* Unified Mulam Pipeline Navigation Rail */}
            <MulamSubNav
                activeTab="pos"
                currentUnit={unit}
                onUnitChange={setUnit}
            />

            {/* Top Operational Action Strip */}
            <div style={{
                padding: '10px 20px',
                background: 'var(--bg-card, #ffffff)',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        رقم الفاتورة: <strong style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--primary, #6366f1)' }}>#INV-{invoiceNumber}</strong>
                    </span>
                    {customer && (
                        <span style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 800
                        }}>
                            عميل مسجل: {customer.name}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Reset / New Order button */}
                    <button
                        type="button"
                        onClick={resetForm}
                        title="بدء طلب جديد وتوليد رقم فاتورة جديد للعميل التالي"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            color: 'var(--text-main, #0f172a)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        <Plus size={15} />
                        <span>طلب جديد</span>
                    </button>

                    {/* Direct Print Work Order A4 */}
                    <button
                        type="button"
                        onClick={() => handleDirectPrintA4()}
                        title="طباعة أمر التشغيل A4 فورياً للطابعة"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        <Printer size={15} />
                        <span>طباعة كرت العمل A4</span>
                    </button>

                    {/* WhatsApp Work Order Share */}
                    <button
                        type="button"
                        onClick={() => setShowWhatsAppModal(true)}
                        title="مشاركة تفاصيل المقاسات وأمر التشغيل مع الخياط عبر واتساب"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        <Send size={15} />
                        <span>مشاركة واتساب</span>
                    </button>

                    {/* On-demand A4 Work Order Preview Button */}
                    <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        title="معاينة نموذج ورقة عمل المعلم كاملة"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            color: 'var(--text-main, #0f172a)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        <Eye size={14} />
                        <span>معاينة الورقة</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/shift?action=close')}
                        style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                        }}
                    >
                        إغلاق الوردية
                    </button>
                </div>
            </div>

            {/* Main Balanced 50% / 50% Dual-Pane Ergonomic Workspace */}
            <main className="tailor-workspace-main">
                
                {/* ══════════════════════════════════════════════════════════════
                    RIGHT PANE (50%): Customer, Fabrics, Items, Urgency, Payment
                   ══════════════════════════════════════════════════════════════ */}
                <section className="tailor-pane-card">
                    {/* Customer Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '10px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                بيانات العميل والحساب
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {customerProfiles && customerProfiles.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowProfilesModal(true)}
                                    style={{
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        padding: '5px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    سجل المقاسات ({customerProfiles.length})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSaveProfile}
                                style={{
                                    background: 'rgba(99, 102, 241, 0.08)',
                                    color: 'var(--primary, #6366f1)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                حفظ المقاس في الملف
                            </button>
                        </div>
                    </div>

                    {/* Customer Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0 }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                    رقم الجوال
                                </label>
                                <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>F1</kbd>
                            </div>
                            <input
                                ref={phoneInputRef}
                                type="tel"
                                placeholder="05xxxxxxxx"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                dir="ltr"
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    background: '#f8fafc',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '14px',
                                    textAlign: 'right'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                اسم العميل
                            </label>
                            <input
                                type="text"
                                placeholder="اسم العميل"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    background: '#f8fafc',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                    </div>

                    {/* Fabric Selection */}
                    <div style={{ flexShrink: 0 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                            اختيار القماش (للقطعة الحالية)
                        </label>
                        <select
                            value={activeItem.fabric_code}
                            onChange={e => {
                                const copy = [...items];
                                copy[activeItemIndex].fabric_code = e.target.value;
                                if (e.target.value === 'BYOF') {
                                    copy[activeItemIndex].price = 150;
                                } else {
                                    const sel = fabrics.find(f => f.ID == e.target.value);
                                    if (sel) copy[activeItemIndex].price = parseFloat(sel.Price || 150);
                                }
                                setItems(copy);
                            }}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                background: '#f8fafc',
                                color: 'var(--text-main, #0f172a)',
                                fontSize: '13px'
                            }}
                        >
                            <option value="BYOF">قماش خارجي (من العميل) — 150 ر.س</option>
                            {fabrics.map(f => (
                                <option key={f.ID} value={f.ID}>
                                    {f.Name} ({f.Price} ر.س)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tailor, Cutter & Delivery Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', flexShrink: 0 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                المعلم المشرف (خياط)
                            </label>
                            <select
                                value={tailorId}
                                onChange={e => setTailorId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    background: '#f8fafc',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '13px'
                                }}
                            >
                                <option value="">-- اختر المعلم --</option>
                                {staff.filter(s => {
                                    const r = (s.role || '').toLowerCase();
                                    return !['admin', 'cashier'].includes(r);
                                }).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                الفصال / القصاص (Cutter)
                            </label>
                            <select
                                value={cutterId}
                                onChange={e => setCutterId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    background: '#f8fafc',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '13px'
                                }}
                            >
                                <option value="">-- اختر الفصال --</option>
                                {staff.filter(s => {
                                    const r = (s.role || '').toLowerCase();
                                    return ['cutter', 'فصال'].includes(r) || !['admin', 'cashier'].includes(r);
                                }).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                موعد التسليم
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={e => setDeliveryDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    background: '#f8fafc',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '13px'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                {[3, 7, 10].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDeliveryDays(d)}
                                        style={{
                                            flex: 1,
                                            padding: '3px',
                                            borderRadius: '6px',
                                            background: '#f8fafc',
                                            border: '1px solid var(--border-subtle, #e2e8f0)',
                                            color: 'var(--text-muted, #64748b)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {d} أيام
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Order Options (Urgent & Gift) */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        flexShrink: 0
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
                            خيارات متقدمة للطلب
                        </div>

                        {/* Urgent Order Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed var(--border-subtle, #e2e8f0)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 700 }}>
                                <input
                                    type="checkbox"
                                    checked={isUrgent}
                                    onChange={e => {
                                        setIsUrgent(e.target.checked);
                                        if (e.target.checked && urgentFee === 0) setUrgentFee(50);
                                    }}
                                />
                                <span style={{ color: isUrgent ? '#f59e0b' : 'inherit' }}>طلب مستعجل (Urgent)</span>
                            </label>
                            {isUrgent && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>رسوم:</span>
                                    <input
                                        type="number"
                                        value={urgentFee}
                                        onChange={e => setUrgentFee(parseFloat(e.target.value) || 0)}
                                        style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', background: '#fff', border: '1px solid #f59e0b', color: '#f59e0b', textAlign: 'center', fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                    <span style={{ fontSize: '12px' }}>ر.س</span>
                                </div>
                            )}
                        </div>

                        {/* Gift Order Toggle */}
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 700, marginBottom: isGift ? '8px' : '0' }}>
                                <input
                                    type="checkbox"
                                    checked={isGift}
                                    onChange={e => setIsGift(e.target.checked)}
                                />
                                <span style={{ color: isGift ? 'var(--primary, #6366f1)' : 'inherit' }}>طلب إهداء (Gift)</span>
                            </label>
                            {isGift && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                                    <input
                                        type="text"
                                        placeholder="اسم المهدي إليه"
                                        value={recipientName}
                                        onChange={e => setRecipientName(e.target.value)}
                                        style={{ padding: '7px 10px', borderRadius: '6px', background: '#fff', border: '1px solid var(--border-subtle, #e2e8f0)', fontSize: '12px' }}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="هاتف المهدي إليه"
                                        value={recipientPhone}
                                        onChange={e => setRecipientPhone(e.target.value)}
                                        dir="ltr"
                                        style={{ padding: '7px 10px', borderRadius: '6px', background: '#fff', border: '1px solid var(--border-subtle, #e2e8f0)', fontSize: '12px', textAlign: 'right' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financial Summary Card */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '13px',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748b)' }}>
                            <span>المجموع الفرعي ({items.length} قطع):</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{subtotalBeforeDiscount.toFixed(2)} ر.س</span>
                        </div>
                        {isUrgent && urgentFee > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                                <span>رسوم الاستعجال:</span>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>+{urgentFee.toFixed(2)} ر.س</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted, #64748b)' }}>
                            <span>الخصم:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={e => setDiscount(e.target.value)}
                                    style={{ width: '65px', padding: '3px 6px', textAlign: 'center', borderRadius: '6px', background: '#fff', border: '1px solid var(--border-subtle, #e2e8f0)', color: 'var(--text-main, #0f172a)', fontFamily: "'IBM Plex Mono', monospace" }}
                                />
                                <span>ر.س</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748b)' }}>
                            <span>ضريبة القيمة المضافة (15%):</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{vat.toFixed(2)} ر.س</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '16px', color: 'var(--text-main, #0f172a)', borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '6px', marginTop: '4px' }}>
                            <span>الإجمالي الكلي:</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--primary, #6366f1)' }}>{total.toFixed(2)} ر.س</span>
                        </div>
                    </div>

                    {/* Action Buttons — Fast Mulam Seasonal Pipeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handleCheckoutToPOS}
                                disabled={saving}
                                style={{
                                    flex: 1.4,
                                    minHeight: '48px',
                                    background: 'var(--primary, #6366f1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 900,
                                    fontSize: '13px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                                title="ترحيل الطلب إلى شاشة الكاشير للتحصيل [F12]"
                            >
                                <ShoppingCart size={16} />
                                <span>تحويل للكاشير</span>
                                <kbd style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}>F12</kbd>
                                <ArrowLeft size={14} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => processOrder('draft')}
                                disabled={saving}
                                style={{
                                    flex: 1,
                                    minHeight: '36px',
                                    background: '#f8fafc',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FileText size={14} />
                                <span>حفظ كمسودة</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowWorkOrderDrawer(true)}
                                style={{
                                    flex: 1.2,
                                    minHeight: '36px',
                                    background: '#f8fafc',
                                    color: 'var(--text-muted, #64748b)',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                <FileSpreadsheet size={14} />
                                <span>ورقة العمل A4</span>
                                <kbd style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace' }}>F4</kbd>
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                style={{
                                    minHeight: '36px',
                                    padding: '0 12px',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                                title="تفريغ الحقول وبدء طلب جديد"
                            >
                                مسح
                            </button>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    LEFT PANE (50%): Pieces, Normalized Measurements, Options
                   ══════════════════════════════════════════════════════════════ */}
                <section className="tailor-pane-card">
                    
                    {/* Pieces & Profile Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', paddingBottom: '10px', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                مقاسات وتفاصيل القطعة ({activeItemIndex + 1} من {items.length})
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {latestProfile && !profileLoaded && (
                                <button
                                    type="button"
                                    onClick={handleLoadProfile}
                                    style={{
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        color: 'var(--primary, #6366f1)',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    استرجاع أحدث مقاس
                                </button>
                            )}
                            {customerProfiles && customerProfiles.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowProfilesModal(true)}
                                    style={{
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    سجل المقاسات ({customerProfiles.length})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={addItem}
                                style={{
                                    background: 'var(--primary, #6366f1)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <span>+ قطعة جديدة</span>
                                <kbd style={{ background: 'rgba(255,255,255,0.25)', padding: '0 4px', borderRadius: '3px', fontSize: '9px', fontFamily: 'monospace' }}>F2</kbd>
                            </button>
                            <button
                                type="button"
                                onClick={cloneItem}
                                style={{
                                    background: '#f8fafc',
                                    color: 'var(--text-muted, #64748b)',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Copy size={12} />
                                <span>تكرار</span>
                            </button>
                        </div>
                    </div>

                    {/* Multi-piece Tabs */}
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', flexShrink: 0, minHeight: '34px', alignItems: 'center' }}>
                        {items.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveItemIndex(idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    border: activeItemIndex === idx
                                        ? '1.5px solid var(--primary, #6366f1)'
                                        : '1px solid var(--border-subtle, #e2e8f0)',
                                    background: activeItemIndex === idx
                                        ? 'rgba(99, 102, 241, 0.1)'
                                        : '#f8fafc',
                                    color: activeItemIndex === idx ? 'var(--primary, #6366f1)' : 'var(--text-muted, #64748b)',
                                    fontWeight: activeItemIndex === idx ? 800 : 600,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                <span>قطعة {idx + 1}</span>
                                {items.length > 1 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                                        style={{ color: '#ef4444', fontWeight: 900, marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}
                                        title="حذف القطعة"
                                    >
                                        <X size={12} />
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Quick Sizing Presets Bar — 1-Click Fast Sizing */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#f8fafc',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        flexShrink: 0,
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={12} color="#f59e0b" />
                            <span>قوالب مقاسات سريعة:</span>
                        </span>
                        {Object.entries(SIZING_PRESETS || {}).map(([k, preset]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => applyStandardSize(k)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    border: '1px solid var(--border-subtle, #cbd5e1)',
                                    color: 'var(--text-main, #0f172a)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                }}
                                title={`تطبيق مقاس ${preset.label}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Garment Type Pills */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                        {[
                            { id: 'thobe', label: 'ثوب رجالي' },
                            { id: 'sirwal', label: 'سروال' },
                            { id: 'shirt', label: 'قميص' },
                            { id: 'bisht', label: 'بشت' }
                        ].map(g => (
                            <button
                                key={g.id}
                                type="button"
                                onClick={() => setGarmentType(g.id)}
                                style={{
                                    flex: '1 1 0',
                                    minWidth: '75px',
                                    minHeight: '38px',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    border: activeItem.garment_type === g.id
                                        ? '2px solid var(--primary, #6366f1)'
                                        : '1px solid var(--border-subtle, #e2e8f0)',
                                    background: activeItem.garment_type === g.id
                                        ? 'rgba(99, 102, 241, 0.08)'
                                        : '#f8fafc',
                                    color: activeItem.garment_type === g.id ? 'var(--primary, #6366f1)' : 'var(--text-muted, #64748b)',
                                    fontWeight: 800,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <GarmentIcon type={g.id} size={18} color={activeItem.garment_type === g.id ? 'var(--primary, #6366f1)' : '#64748b'} />
                                <span>{g.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Standardized 8-Measurement Grid */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '10px',
                        padding: '12px',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                مصفوفة المقاسات الـ 8 المعتمدة
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--primary, #6366f1)', fontWeight: 700 }}>
                                الوحدة: {unit === 'cm' ? 'سنتيمتر (سم)' : 'إنش (بوصة)'}
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                            gap: '8px'
                        }}>
                            {(() => {
                                const t = activeItem.garment_type;
                                let fields = [];
                                if (t === 'sirwal') {
                                    fields = [
                                        { key: 'length', label: 'الطول', next: 'measure_waist' },
                                        { key: 'waist', label: 'الخصر', next: 'measure_hip' },
                                        { key: 'hip', label: 'الورك', next: 'measure_crotch_rise' },
                                        { key: 'crotch_rise', label: 'السرج', next: 'measure_hand_opening' },
                                        { key: 'hand_opening', label: 'وسع الرجل', next: 'measure_notes' }
                                    ];
                                } else if (t === 'suit') {
                                    fields = [
                                        { key: 'length', label: 'طول الجاكيت', next: 'measure_shoulder' },
                                        { key: 'shoulder', label: 'الكتف', next: 'measure_chest' },
                                        { key: 'chest', label: 'الصدر', next: 'measure_waist' },
                                        { key: 'waist', label: 'الوسط', next: 'measure_sleeve' },
                                        { key: 'sleeve', label: 'الكم', next: 'measure_trouser_length' },
                                        { key: 'trouser_length', label: 'طول البنطال', next: 'measure_trouser_waist' },
                                        { key: 'trouser_waist', label: 'وسط البنطال', next: 'measure_crotch_rise' },
                                        { key: 'crotch_rise', label: 'السرج', next: 'measure_notes' }
                                    ];
                                } else {
                                    // Thobe & bespoke garments
                                    fields = [
                                        { key: 'length', label: 'الطول', next: 'measure_shoulder' },
                                        { key: 'shoulder', label: 'الكتف', next: 'measure_chest' },
                                        { key: 'chest', label: 'الصدر', next: 'measure_waist' },
                                        { key: 'waist', label: 'الوسط', next: 'measure_sleeve' },
                                        { key: 'sleeve', label: 'الكم', next: 'measure_neck' },
                                        { key: 'neck', label: 'الرقبة', next: 'measure_wrist' },
                                        { key: 'wrist', label: 'الزند', next: 'measure_hand_opening' },
                                        { key: 'hand_opening', label: 'وسع الكم', next: 'measure_bottom_flare' },
                                        { key: 'bottom_flare', label: 'وسع الدائر', next: 'measure_khaban' },
                                        { key: 'khaban', label: 'الخبن (Hem)', next: 'measure_collar_height' },
                                        { key: 'collar_height', label: 'ارتفاع القلاب', next: 'measure_jabzor' },
                                        { key: 'jabzor', label: 'الجبزور (صدر)', next: 'measure_notes' }
                                    ];
                                }

                                return fields.map((f) => {
                                    const prevVal = latestProfile?.measurements?.[f.key];
                                    return (
                                        <div key={f.key}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '3px' }}>
                                                <span>{f.label}</span>
                                                {prevVal && (
                                                    <span style={{ color: 'var(--primary, #6366f1)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                        ({displayVal(prevVal)})
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    id={`measure_${f.key}`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    pattern="[0-9]*"
                                                    placeholder="0.0"
                                                    value={displayVal(activeItem.measurements[f.key])}
                                                    onChange={e => handleUnitChange(e, f.key)}
                                                    onKeyDown={e => handleMeasurementKeyDown(e, f.next)}
                                                    onFocus={e => e.target.select()}
                                                    dir="ltr"
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        background: '#ffffff',
                                                        color: 'var(--text-main, #0f172a)',
                                                        fontSize: '15px',
                                                        fontWeight: 800,
                                                        textAlign: 'center',
                                                        fontFamily: "'IBM Plex Mono', monospace",
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Baseline Protection Checkbox */}
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                id="temp_adjustment_check"
                                checked={!!activeItem.is_temp_adjustment}
                                onChange={e => {
                                    const updated = [...items];
                                    updated[activeItemIndex] = { ...updated[activeItemIndex], is_temp_adjustment: e.target.checked };
                                    setItems(updated);
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
                            />
                            <label htmlFor="temp_adjustment_check" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Lock size={13} color="#6366f1" />
                                <span>تعديل مؤقت لهذا الطلب فقط (لا تحفظه كمقاس أساسي دائم للعميل)</span>
                            </label>
                        </div>
                    </div>

                    {/* Garment Style Options */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                نوع الياقة (Collar)
                            </label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[
                                    { id: 'classic', label: 'كلاسيك' },
                                    { id: 'mandarin', label: 'ماندرين' },
                                    { id: 'chanel', label: 'قلاب' }
                                ].map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => updateConfig('collar', c.id)}
                                        style={{
                                            flex: 1,
                                            padding: '7px 4px',
                                            borderRadius: '6px',
                                            border: activeItem.config.collar === c.id
                                                ? '1px solid var(--primary, #6366f1)'
                                                : '1px solid var(--border-subtle, #e2e8f0)',
                                            background: activeItem.config.collar === c.id
                                                ? 'rgba(99, 102, 241, 0.08)'
                                                : '#f8fafc',
                                            color: activeItem.config.collar === c.id ? 'var(--primary, #6366f1)' : 'var(--text-muted, #64748b)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                                نوع الكبك (Cuff)
                            </label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[
                                    { id: 'single', label: 'مفرد' },
                                    { id: 'double', label: 'مزدوج' },
                                    { id: 'plain', label: 'سادة' }
                                ].map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => updateConfig('cuff', c.id)}
                                        style={{
                                            flex: 1,
                                            padding: '7px 4px',
                                            borderRadius: '6px',
                                            border: activeItem.config.cuff === c.id
                                                ? '1px solid var(--primary, #6366f1)'
                                                : '1px solid var(--border-subtle, #e2e8f0)',
                                            background: activeItem.config.cuff === c.id
                                                ? 'rgba(99, 102, 241, 0.08)'
                                                : '#f8fafc',
                                            color: activeItem.config.cuff === c.id ? 'var(--primary, #6366f1)' : 'var(--text-muted, #64748b)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tailor Special Instructions */}
                    <div style={{ flexShrink: 0 }}>
                        <label htmlFor="measure_notes" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '5px' }}>
                            تعليمات وملاحظات المعلم الخاصة
                        </label>
                        <textarea
                            id="measure_notes"
                            rows="2"
                            placeholder="خياطة دبل، حشوة خفيفة، وسع إضافي..."
                            value={activeItem.notes}
                            onChange={e => {
                                const copy = [...items];
                                copy[activeItemIndex].notes = e.target.value;
                                setItems(copy);
                            }}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                background: '#f8fafc',
                                color: 'var(--text-main, #0f172a)',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                </section>
            </main>

            {/* ═════════════════════════════════════════════════════════════════
                ON-DEMAND WORK ORDER PREVIEW DRAWER (TailorWorkOrderDrawer)
               ═════════════════════════════════════════════════════════════════ */}
            {showWorkOrderDrawer && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderLeft: '1px solid var(--border-subtle, #e2e8f0)',
                        width: '780px',
                        maxWidth: '95vw',
                        height: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
                        animation: 'slideInLeft 0.25s ease'
                    }}>
                        {/* Drawer Header */}
                        <div style={{
                            padding: '16px 20px',
                            background: '#f8fafc',
                            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                    معاينة ورقة عمل المعلم (A4)
                                </h3>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                                    أمر تشغيل رقم: #INV-{invoiceNumber} | العميل: {name || '—'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => handleDirectPrintA4()}
                                    style={{
                                        background: '#3b82f6',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <Printer size={14} />
                                    <span>طباعة A4</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowWhatsAppModal(true)}
                                    style={{
                                        background: '#10b981',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <Send size={14} />
                                    <span>واتساب</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowWorkOrderDrawer(false)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                        color: 'var(--text-muted, #64748b)',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={14} />
                                    <span>إغلاق</span>
                                </button>
                            </div>
                        </div>

                        {/* Drawer Preview Scroll View */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '20px',
                            background: '#e2e8f0',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{
                                background: '#ffffff',
                                color: '#000000',
                                width: '210mm',
                                minHeight: '297mm',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                padding: '10mm',
                                boxSizing: 'border-box'
                            }}>
                                <TailorWorkOrder orderDetails={orderPayload} fabrics={fabrics} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Measurement Profiles Selection Modal */}
            {showProfilesModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.5)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '720px',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                    سجل مقاسات العميل ({name || phone})
                                </h3>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                                    اختر مقاساً سابقاً لتطبيقه على القطعة الحالية بجميع تفاصيلها
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProfilesModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(!customerProfiles || customerProfiles.length === 0) ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                                    لا توجد مقاسات سابقة مسجلة لهذا العميل
                                </div>
                            ) : (
                                customerProfiles.map((p, idx) => {
                                    const m = p.measurements || {};
                                    return (
                                        <div
                                            key={p.id || idx}
                                            style={{
                                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                                borderRadius: '12px',
                                                padding: '14px',
                                                background: '#ffffff',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>
                                                        {p.garment_type || 'ثوب'} {p.notes ? `(${p.notes})` : ''}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {p.updated_at ? new Date(p.updated_at).toLocaleDateString('ar-SA') : 'سابق'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        loadProfile(p);
                                                        setShowProfilesModal(false);
                                                    }}
                                                    style={{
                                                        background: 'var(--primary, #6366f1)',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        padding: '6px 14px',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    استخدام هذا المقاس ⇦
                                                </button>
                                            </div>

                                            {/* Full 12-Field Matrix View */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
                                                gap: '6px',
                                                background: '#f8fafc',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                fontSize: '11px'
                                            }}>
                                                {[
                                                    { label: 'الطول', val: m.length },
                                                    { label: 'الكتف', val: m.shoulder },
                                                    { label: 'الصدر', val: m.chest },
                                                    { label: 'الوسط', val: m.waist },
                                                    { label: 'الكم', val: m.sleeve },
                                                    { label: 'الرقبة', val: m.neck },
                                                    { label: 'الزند', val: m.wrist || m.cuff },
                                                    { label: 'وسع الكم', val: m.hand_opening || m.bottom },
                                                    { label: 'وسع الدائر', val: m.bottom_flare },
                                                    { label: 'الخبن', val: m.khaban },
                                                    { label: 'ارتفاع القلاب', val: m.collar_height },
                                                    { label: 'الجبزور', val: m.jabzor }
                                                ].map(item => (
                                                    <div key={item.label} style={{ background: '#fff', padding: '4px 6px', borderRadius: '6px', border: '1px solid #edf2f7' }}>
                                                        <div style={{ color: '#64748b', fontSize: '10px' }}>{item.label}</div>
                                                        <div style={{ fontWeight: 800, color: '#0f172a', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                            {item.val ? displayVal(item.val) : '—'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Order Confirmation & Quick Print Modal */}
            {completedOrder && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.65)',
                    zIndex: 2500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '520px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        {/* Header Banner */}
                        <div style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            padding: '20px',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Check size={28} color="#ffffff" strokeWidth={3} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>
                                تم حفظ الطلب واعتماد الدفع بنجاح
                            </h2>
                            <div style={{ fontSize: '13px', opacity: 0.9, fontFamily: "'IBM Plex Mono', monospace" }}>
                                أمر تشغيل: #{completedOrder.orderId || completedOrder.order_id || '---'} | فاتورة: #{completedOrder.invoiceNumber || completedOrder.sale_invoice_id || invoiceNumber}
                            </div>
                        </div>

                        {/* Order Details Body */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: '10px',
                                padding: '14px',
                                border: '1px solid #e2e8f0',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px',
                                fontSize: '13px'
                            }}>
                                <div>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>العميل</span>
                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{name || phone || 'عميل نقدي'}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>الهاتف</span>
                                    <span style={{ fontWeight: 800, color: '#0f172a', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">{phone || '---'}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>عدد القطع</span>
                                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{completedOrder.items?.length || items.length} قطع</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>موعد الاستلام</span>
                                    <span style={{ fontWeight: 800, color: '#6366f1' }}>{deliveryDate || '---'}</span>
                                </div>
                                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>إجمالي الفاتورة</span>
                                    <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '15px', fontFamily: "'IBM Plex Mono', monospace" }}>
                                        {(completedOrder.total || total).toFixed(2)} ر.س
                                    </span>
                                </div>
                                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>المتبقي بذمة العميل</span>
                                    <span style={{
                                        fontWeight: 900,
                                        color: (completedOrder.balance || balance) > 0 ? '#f59e0b' : '#10b981',
                                        fontSize: '15px',
                                        fontFamily: "'IBM Plex Mono', monospace"
                                    }}>
                                        {((completedOrder.balance !== undefined ? completedOrder.balance : balance) || 0).toFixed(2)} ر.س
                                    </span>
                                </div>
                            </div>

                            {/* Print & Next Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleDirectPrintA4(completedOrder)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '10px',
                                            background: '#3b82f6',
                                            color: '#ffffff',
                                            border: 'none',
                                            fontWeight: 800,
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                                        }}
                                    >
                                        <Printer size={16} />
                                        <span>طباعة أمر التشغيل A4</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowPrintModal(true)}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '10px',
                                            background: '#f1f5f9',
                                            color: '#334155',
                                            border: '1px solid #cbd5e1',
                                            fontWeight: 700,
                                            fontSize: '13px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        معاينة
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowWhatsAppModal(true)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        background: '#10b981',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontWeight: 800,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                                    }}
                                >
                                    <Send size={16} />
                                    <span>مشاركة كرت العمل مع الخياط (واتساب)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompletedOrder(null);
                                        resetForm();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '13px',
                                        borderRadius: '10px',
                                        background: '#0f172a',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontWeight: 900,
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <UserPlus size={18} />
                                    <span>تسجيل طلب تفصيل للعميل التالي</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompletedOrder(null);
                                        navigate('/measurements');
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        background: '#ffffff',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Ruler size={15} />
                                    <span>الانتقال لدفتر المقاسات</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Tailor Print Modal */}
            <TailorPrintModal
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                orderDetails={completedOrder || orderPayload}
                fabrics={fabrics}
                settings={settings}
            />

            {/* Tailor WhatsApp Share Modal */}
            <TailorWhatsAppModal
                isOpen={showWhatsAppModal}
                onClose={() => setShowWhatsAppModal(false)}
                title={`مشاركة أمر تشغيل تفصيل #${(completedOrder || orderPayload)?.invoiceNumber || invoiceNumber}`}
                defaultCustomerPhone={(completedOrder || orderPayload)?.customer?.phone || phone}
                customerName={(completedOrder || orderPayload)?.customer?.name || name}
                messageText={generateTailorWhatsAppText(completedOrder || orderPayload, fabrics, settings)}
            />

            {/* Hidden Print Container for A4 Printing */}
            <div className="hidden print:block">
                <TailorWorkOrder ref={printRef} orderDetails={orderPayload} fabrics={fabrics} />
            </div>
        </div>
    );
}
