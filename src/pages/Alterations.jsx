import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { useToast } from '../components/ToastManager';
import { generateBarcodeSVG } from '../utils/barcodeSvg';

export default function Alterations() {
    const navigate = useNavigate();
    const { showToast } = useToast?.() ?? { showToast: (m) => alert(m.message || m) };
    const [tickets, setTickets] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Search and Scanner Bar
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);

    // Customer Autocomplete Data
    const [customerList, setCustomerList] = useState([]);
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Modal Form State
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [linkedOrderId, setLinkedOrderId] = useState('');
    const [items, setItems] = useState([{ garment_type: 'thobe', instructions: '', fee: 0 }]);
    const [dueDate, setDueDate] = useState('');
    const [deposit, setDeposit] = useState(0);



    useEffect(() => {
        loadTickets();
        loadCustomers();
    }, []);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const data = await window.api?.tailor?.getAlterations?.();
            setTickets(data || []);
        } catch (e) {
            console.error(e);
            showToast?.({ type: 'error', message: 'خطأ في جلب التذاكر' });
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        try {
            const data = await window.api?.getCustomers?.();
            if (Array.isArray(data)) {
                setCustomerList(data);
            }
        } catch (e) {
            console.error('Failed to load customers for autocomplete:', e);
        }
    };

    // Filter customers as user types phone or name
    const handlePhoneChange = (val) => {
        setPhone(val);
        setSelectedCustomerId(null);
        if (val.trim().length >= 2) {
            const matches = customerList.filter(c => 
                (c.phone && c.phone.includes(val)) || 
                (c.name && c.name.toLowerCase().includes(val.toLowerCase()))
            );
            setCustomerSuggestions(matches.slice(0, 6));
            setShowSuggestions(matches.length > 0);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleNameChange = (val) => {
        setName(val);
        if (val.trim().length >= 2 && !phone) {
            const matches = customerList.filter(c => 
                c.name && c.name.toLowerCase().includes(val.toLowerCase())
            );
            setCustomerSuggestions(matches.slice(0, 6));
            setShowSuggestions(matches.length > 0);
        } else if (!phone) {
            setShowSuggestions(false);
        }
    };

    const selectCustomer = (c) => {
        setName(c.name || '');
        setPhone(c.phone || '');
        setSelectedCustomerId(c.id || null);
        setShowSuggestions(false);
    };

    const handleUpdateStatus = async (ticket_id, status) => {
        try {
            await window.api?.tailor?.updateAlterationStatus?.({ ticket_id, status });
            showToast?.({ type: 'success', message: 'تم تحديث الحالة بنجاح' });
            loadTickets();
        } catch (e) {
            console.error(e);
            showToast?.({ type: 'error', message: 'فشل تحديث الحالة' });
        }
    };

    // Handle "تم التسليم" click
    const handleInitiateDelivery = (ticket) => {
        const total = parseFloat(ticket.total_fee || 0);
        const dep = parseFloat(ticket.deposit || 0);
        const outstanding = Math.max(0, total - dep);

        if (outstanding > 0) {
            // Navigate to Pos.jsx for payment settlement
            const handoffData = {
                ticketId: ticket.id,
                customer: { id: ticket.customer_id, name: ticket.customer_name, phone: ticket.customer_phone },
                cartItems: [{
                    id: `alt_pay_${ticket.id}_${Math.random()}`,
                    Name: `سداد متبقي تعديل #${ticket.id}`,
                    Price: outstanding,
                    Qty: 1,
                    Category: 'صيانة / خدمة'
                }],
                total: outstanding,
                depositPaid: dep,
                orderNote: `تعديل #${ticket.id} (${ticket.garment_type})`
            };
            navigate('/pos', { state: { alterationHandoff: handoffData } });
        } else {
            // Direct delivery
            handleUpdateStatus(ticket.id, 'delivered');
        }
    };


    const handleAddItem = () => {
        setItems([...items, { garment_type: 'thobe', instructions: '', fee: 0 }]);
    };

    const handleItemChange = (index, field, val) => {
        const newItems = [...items];
        newItems[index][field] = val;
        setItems(newItems);
    };

    const handleRemoveItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalFee = items.reduce((acc, i) => acc + (parseFloat(i.fee) || 0), 0);
    const balance = Math.max(0, totalFee - (parseFloat(deposit) || 0));

    const handleSave = async () => {
        if (!phone || !name) {
            showToast?.({ type: 'error', message: 'الجوال والاسم مطلوبان' });
            return;
        }
        if (!items.length) {
            showToast?.({ type: 'error', message: 'يجب إضافة قطعة واحدة على الأقل' });
            return;
        }

        try {
            let customerId = selectedCustomerId;
            if (!customerId) {
                const cRes = await window.api?.addCustomer?.({ name, phone });
                if (cRes?.id) customerId = cRes.id;
            }

            const payload = {
                customer_id: customerId,
                linked_order_id: linkedOrderId ? parseInt(linkedOrderId) : null,
                items,
                total_fee: totalFee,
                deposit: parseFloat(deposit || 0),
                target_delivery_date: dueDate
            };

            const res = await window.api?.tailor?.createAlteration?.(payload);
            if (res && res.success === false) throw new Error(res.error || 'فشل الحفظ');
            
            const ticketId = res?.id || res?.ticket_id || Date.now();
            showToast?.({ type: 'success', message: 'تم حفظ طلب التعديل بنجاح' });
            setShowModal(false);
            setPhone(''); setName(''); setSelectedCustomerId(null); setLinkedOrderId('');
            setItems([{ garment_type: 'thobe', instructions: '', fee: 0 }]);
            setDeposit(0);
            loadTickets();

            // Offline-first Thermal Print with Pure SVG Barcode
            const barcodeSvg = generateBarcodeSVG(`ALT-${String(ticketId).padStart(4, '0')}`, {
                width: 1.8,
                height: 42,
                fontSize: 13
            });

            const html = `
                <html dir="rtl">
                <head>
                    <style>
                        body { font-family: 'Tahoma', sans-serif; font-size: 12px; width: 80mm; padding: 10px; margin: 0; color: #000; }
                        .text-center { text-align: center; }
                        .flex { display: flex; justify-content: space-between; }
                        .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
                        .font-bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h2 class="text-center" style="margin: 0 0 5px 0;">تذكرة تعديل خياطة</h2>
                    <div class="text-center border-b">أمر تشغيل معمل وتعديل</div>
                    <div class="flex" style="margin-top: 8px;"><span>رقم التذكرة:</span> <span class="font-bold">#ALT-${String(ticketId).padStart(4, '0')}</span></div>
                    <div class="flex"><span>العميل:</span> <span>${name}</span></div>
                    <div class="flex"><span>الجوال:</span> <span dir="ltr">${phone}</span></div>
                    <div class="border-b" style="margin-top: 5px;"></div>
                    <div style="margin: 6px 0;">
                        ${items.map(i => `<div class="flex"><span>${i.garment_type === 'thobe' ? 'ثوب' : i.garment_type === 'shirt' ? 'قميص' : i.garment_type === 'pants' ? 'سروال' : 'أخرى'}: ${i.instructions}</span> <span>${i.fee} ر.س</span></div>`).join('')}
                    </div>
                    <div class="border-b"></div>
                    <div class="flex"><span>الإجمالي:</span> <span>${totalFee} ر.س</span></div>
                    <div class="flex"><span>العربون المدفوع:</span> <span>${deposit} ر.س</span></div>
                    <div class="flex font-bold"><span>المتبقي:</span> <span>${balance} ر.س</span></div>
                    <div class="text-center font-bold border-b" style="padding: 5px 0; margin-top: 5px;">موعد التسليم: ${dueDate || 'غير محدد'}</div>
                    <div style="text-align: center; margin-top: 15px;">
                        ${barcodeSvg}
                    </div>
                </body>
                </html>
            `;

            if (window.api?.printHTML) {
                window.api.printHTML(html);
            } else {
                const win = window.open('', '_blank', 'width=350,height=500');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                    setTimeout(() => win.print(), 300);
                }
            }

        } catch (e) {
            console.error(e);
            showToast?.({ type: 'error', message: e.message || 'خطأ أثناء الحفظ' });
        }
    };

    // Filter tickets based on barcode / search query
    const filteredTickets = useMemo(() => {
        if (!searchQuery.trim()) return tickets;
        const q = searchQuery.trim().toLowerCase();
        const cleanNumber = q.replace(/^alt-?/i, '');
        return tickets.filter(t => {
            const idStr = String(t.id || '');
            const nameStr = (t.customer_name || '').toLowerCase();
            const phoneStr = (t.customer_phone || '').toLowerCase();
            return idStr.includes(cleanNumber) || nameStr.includes(q) || phoneStr.includes(q);
        });
    }, [tickets, searchQuery]);

    const pendingTickets = filteredTickets.filter(t => t.status === 'pending');
    const inProgressTickets = filteredTickets.filter(t => t.status === 'in_progress');
    const readyTickets = filteredTickets.filter(t => t.status === 'ready');

    return (
        <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app, #f1f5f9)', color: 'var(--text-main, #0f172a)', overflow: 'hidden' }}>
            
            {/* Unified MulamSubNav */}
            <MulamSubNav
                activeTab="alterations"
                counters={{
                    pendingAlterations: tickets.filter(t => t.status !== 'delivered').length
                }}
            />

            {/* Main Content Workspace */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px 20px' }}>
                
                {/* Search & Quick Barcode Scan Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 360px', maxWidth: '600px', position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            right: '12px',
                            color: 'var(--color-accent, #0EA5E9)',
                            fontSize: '18px',
                            pointerEvents: 'none'
                        }}>
                            📷
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="امسح باركود التذكرة أو ابحث برقم التذكرة، الاسم، أو الهاتف..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 42px 10px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                background: 'var(--bg-card, #ffffff)',
                                color: 'var(--text-main, #0f172a)',
                                fontSize: '13px',
                                fontWeight: 600,
                                outline: 'none',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary, #6366f1)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle, #e2e8f0)'}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    left: '10px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted, #64748b)',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: '4px'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => navigate('/tailor-pos')}
                            title="العودة لنقطة التفصيل"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                color: 'var(--text-main, #0f172a)',
                                padding: '10px 16px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                minHeight: '44px',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary, #6366f1)'; e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)'; e.currentTarget.style.background = 'var(--bg-card, #ffffff)'; }}
                        >
                            <span>←</span>
                            <span>العودة للتفصيل</span>
                        </button>

                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'var(--color-primary, #6366f1)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px 20px',
                                fontWeight: 800,
                                fontSize: '14px',
                                cursor: 'pointer',
                                minHeight: '44px',
                                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-primary-hover, #4f46e5)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-primary, #6366f1)'}
                        >
                            <span style={{ fontSize: '16px' }}>➕</span>
                            <span>إصدار تذكرة تعديل جديدة</span>
                        </button>
                    </div>
                </div>

                {/* Kanban Board Container */}
                {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                        جاري تحميل تذاكر التعديل...
                    </div>
                ) : (
                    <div style={{
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                        gap: '16px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        alignItems: 'stretch'
                    }}>
                        
                        {/* 1. Pending Column */}
                        <div style={{
                            background: 'var(--bg-card, #ffffff)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            borderRadius: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '3px solid #f59e0b',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(245,158,11,0.08)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#f59e0b', fontSize: '16px' }}>⏳</span>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                        قيد الانتظار
                                    </h3>
                                </div>
                                <span style={{
                                    background: '#f59e0b',
                                    color: '#000',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontFamily: "'IBM Plex Mono', monospace"
                                }}>
                                    {pendingTickets.length}
                                </span>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pendingTickets.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
                                        لا توجد تذاكر قيد الانتظار
                                    </div>
                                )}
                                {pendingTickets.map(t => {
                                    const total = parseFloat(t.total_fee || 0);
                                    const dep = parseFloat(t.deposit || 0);
                                    const bal = Math.max(0, total - dep);
                                    return (
                                        <div
                                            key={t.id}
                                            style={{
                                                background: 'var(--bg-hover, #f8fafc)',
                                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                                borderRight: '4px solid #f59e0b',
                                                borderRadius: '12px',
                                                padding: '14px',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main, #0f172a)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    #ALT-{String(t.id).padStart(4, '0')}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                                                    جديد
                                                </span>
                                            </div>

                                            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                                                {t.customer_name || 'بدون اسم'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBottom: '8px', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                                                {t.customer_phone || '—'}
                                            </div>

                                            {/* Items Instructions */}
                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>
                                                {t.items?.map((item, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748b)' }}>
                                                        <span>• {item.garment_type === 'thobe' ? 'ثوب' : item.garment_type === 'shirt' ? 'قميص' : item.garment_type === 'pants' ? 'سروال' : 'أخرى'}: {item.instructions}</span>
                                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{item.fee} ر.س</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                                                <span style={{ color: 'var(--text-muted, #64748b)' }}>الموعد: {t.target_delivery_date || 'غير محدد'}</span>
                                                <span style={{ color: bal > 0 ? '#ef4444' : '#10b981', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    {bal > 0 ? `متبقي: ${bal} ر.س` : 'خالص'}
                                                </span>
                                            </div>

                                            {/* >=44px Touch Button */}
                                            <button
                                                onClick={() => handleUpdateStatus(t.id, 'in_progress')}
                                                style={{
                                                    width: '100%',
                                                    minHeight: '44px',
                                                    background: 'var(--color-primary, #6366f1)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontWeight: 800,
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <span>▶️</span>
                                                <span>بدء العمل في التعديل</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. In Progress Column */}
                        <div style={{
                            background: 'var(--bg-card, #ffffff)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            borderRadius: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '3px solid #3b82f6',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(59,130,246,0.08)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#3b82f6', fontSize: '16px' }}>🧵</span>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                        جاري العمل
                                    </h3>
                                </div>
                                <span style={{
                                    background: '#3b82f6',
                                    color: '#fff',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontFamily: "'IBM Plex Mono', monospace"
                                }}>
                                    {inProgressTickets.length}
                                </span>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {inProgressTickets.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
                                        لا توجد تذاكر جارية حالياً
                                    </div>
                                )}
                                {inProgressTickets.map(t => {
                                    const total = parseFloat(t.total_fee || 0);
                                    const dep = parseFloat(t.deposit || 0);
                                    const bal = Math.max(0, total - dep);
                                    return (
                                        <div
                                            key={t.id}
                                            style={{
                                                background: 'var(--bg-hover, #f8fafc)',
                                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                                borderRight: '4px solid #3b82f6',
                                                borderRadius: '12px',
                                                padding: '14px',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main, #0f172a)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    #ALT-{String(t.id).padStart(4, '0')}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800, background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                                                    تحت التنفيذ
                                                </span>
                                            </div>

                                            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                                                {t.customer_name || 'بدون اسم'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBottom: '8px', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                                                {t.customer_phone || '—'}
                                            </div>

                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>
                                                {t.items?.map((item, idx) => (
                                                    <div key={idx} style={{ color: 'var(--text-muted, #64748b)' }}>
                                                        • {item.instructions}
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                                                <span style={{ color: 'var(--text-muted, #64748b)' }}>الموعد: {t.target_delivery_date || 'غير محدد'}</span>
                                                <span style={{ color: bal > 0 ? '#ef4444' : '#10b981', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    {bal > 0 ? `متبقي: ${bal} ر.س` : 'خالص'}
                                                </span>
                                            </div>

                                            {/* Action Buttons (>=44px) */}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleUpdateStatus(t.id, 'ready')}
                                                    style={{
                                                        flex: 2,
                                                        minHeight: '44px',
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 800,
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <span>✅</span>
                                                    <span>جاهز للتسليم</span>
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(t.id, 'pending')}
                                                    title="إعادة لقيد الانتظار"
                                                    style={{
                                                        flex: 1,
                                                        minHeight: '44px',
                                                        background: 'var(--bg-card, #ffffff)',
                                                        color: 'var(--text-muted, #64748b)',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ↩️ تراجع
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Ready Column */}
                        <div style={{
                            background: 'var(--bg-card, #ffffff)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            borderRadius: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '3px solid #10b981',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(16,185,129,0.08)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#10b981', fontSize: '16px' }}>📦</span>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                        جاهز للتسليم
                                    </h3>
                                </div>
                                <span style={{
                                    background: '#10b981',
                                    color: '#fff',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontFamily: "'IBM Plex Mono', monospace"
                                }}>
                                    {readyTickets.length}
                                </span>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {readyTickets.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
                                        لا توجد تذاكر جاهزة للتسليم
                                    </div>
                                )}
                                {readyTickets.map(t => {
                                    const total = parseFloat(t.total_fee || 0);
                                    const dep = parseFloat(t.deposit || 0);
                                    const bal = Math.max(0, total - dep);
                                    return (
                                        <div
                                            key={t.id}
                                            style={{
                                                background: 'var(--bg-hover, #f8fafc)',
                                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                                borderRight: '4px solid #10b981',
                                                borderRadius: '12px',
                                                padding: '14px',
                                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main, #0f172a)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    #ALT-{String(t.id).padStart(4, '0')}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                                                    جاهز
                                                </span>
                                            </div>

                                            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                                                {t.customer_name || 'بدون اسم'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBottom: '8px', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                                                {t.customer_phone || '—'}
                                            </div>

                                            {/* Financial Status Highlight */}
                                            <div style={{
                                                background: bal > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                border: `1px solid ${bal > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                marginBottom: '10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>الرصيد المتبقي:</span>
                                                <span style={{
                                                    fontWeight: 900,
                                                    fontSize: '14px',
                                                    color: bal > 0 ? '#ef4444' : '#10b981',
                                                    fontFamily: "'IBM Plex Mono', monospace"
                                                }}>
                                                    {bal > 0 ? `${bal.toFixed(2)} ر.س` : 'مسدد بالكامل'}
                                                </span>
                                            </div>

                                            {/* Touch Action Buttons (>=44px) */}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleInitiateDelivery(t)}
                                                    style={{
                                                        flex: 2,
                                                        minHeight: '44px',
                                                        background: bal > 0 ? '#f59e0b' : '#10b981',
                                                        color: bal > 0 ? '#000000' : '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 900,
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <span>{bal > 0 ? '💵 تسليم وتحصيل' : '📦 تسليم للعميل'}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(t.id, 'in_progress')}
                                                    title="إعادة للخياط"
                                                    style={{
                                                        flex: 1,
                                                        minHeight: '44px',
                                                        background: 'var(--bg-card, #ffffff)',
                                                        color: 'var(--text-muted, #64748b)',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        borderRadius: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ↩️ إعادة
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* ── NEW ALTERATION MODAL ─────────────────────────────────────── */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                    padding: '16px'
                }}>
                    <div style={{
                        background: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        width: '640px',
                        maxWidth: '95%',
                        maxHeight: '90vh',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        color: 'var(--text-main, #0f172a)'
                    }}>
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                            background: 'var(--bg-hover, #f8fafc)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                🏷️ إصدار تذكرة تعديل جديدة
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', fontSize: '20px', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            {/* Customer Autocomplete Section */}
                            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        رقم الجوال
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="05xxxxxxxx"
                                        value={phone}
                                        onChange={e => handlePhoneChange(e.target.value)}
                                        dir="ltr"
                                        style={{
                                            textAlign: 'right',
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-subtle, #e2e8f0)',
                                            background: 'var(--bg-hover, #f8fafc)',
                                            color: '#fff',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        اسم العميل
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="اسم العميل الكامل"
                                        value={name}
                                        onChange={e => handleNameChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-subtle, #e2e8f0)',
                                            background: 'var(--bg-hover, #f8fafc)',
                                            color: '#fff',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        رقم الطلب المرتبط (اختياري)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="رقم طلب الخياطة (مثال: 5)"
                                        value={linkedOrderId}
                                        onChange={e => setLinkedOrderId(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-subtle, #e2e8f0)',
                                            background: 'var(--bg-hover, #f8fafc)',
                                            color: '#fff',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                {/* Autocomplete Suggestion Flyout */}
                                {showSuggestions && customerSuggestions.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '72px',
                                        left: 0,
                                        right: 0,
                                        background: '#1e293b',
                                        border: '1px solid var(--color-primary, #6366f1)',
                                        borderRadius: '8px',
                                        zIndex: 100,
                                        maxHeight: '180px',
                                        overflowY: 'auto',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                                    }}>
                                        <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-accent, #0ea5e9)', borderBottom: '1px solid #334155', fontWeight: 700 }}>
                                            العملاء المطابقون (انقر للاختيار):
                                        </div>
                                        {customerSuggestions.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => selectCustomer(c)}
                                                style={{
                                                    padding: '8px 12px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #334155',
                                                    fontSize: '13px'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.background = '#283548'}
                                                onMouseOut={e => e.currentTarget.style.background = '#1e293b'}
                                            >
                                                <span style={{ fontWeight: 700 }}>👤 {c.name}</span>
                                                <span style={{ color: 'var(--text-muted, #64748b)', fontFamily: "'IBM Plex Mono', monospace" }}>{c.phone}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Items Section */}
                            <div style={{ borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                                        القطع وخدمات التعديل المطلوبة
                                    </h4>
                                    <button
                                        onClick={handleAddItem}
                                        style={{
                                            background: 'transparent',
                                            border: '1px dashed var(--color-primary, #6366f1)',
                                            color: 'var(--color-primary, #6366f1)',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: 700
                                        }}
                                    >
                                        + إضافة قطعة
                                    </button>
                                </div>

                                {items.map((item, index) => (
                                    <div key={index} style={{
                                        display: 'flex',
                                        gap: '10px',
                                        alignItems: 'center',
                                        marginBottom: '10px',
                                        background: 'var(--bg-hover, #f8fafc)',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ width: '110px' }}>
                                            <select
                                                value={item.garment_type}
                                                onChange={e => handleItemChange(index, 'garment_type', e.target.value)}
                                                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                                            >
                                                <option value="thobe">ثوب</option>
                                                <option value="shirt">قميص</option>
                                                <option value="pants">سروال</option>
                                                <option value="other">أخرى</option>
                                            </select>
                                        </div>
                                        <div style={{ flex: 1, minWidth: '180px' }}>
                                            <input
                                                type="text"
                                                placeholder="التعليمات (مثال: تقصير 1.5 إنش، تضييق صدر)"
                                                value={item.instructions}
                                                onChange={e => handleItemChange(index, 'instructions', e.target.value)}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div style={{ width: '90px' }}>
                                            <input
                                                type="number"
                                                placeholder="الأجرة"
                                                value={item.fee}
                                                onChange={e => handleItemChange(index, 'fee', e.target.value)}
                                                min="0"
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '13px', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace" }}
                                            />
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 800 }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Due Date & Deposit */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        تاريخ وموعد التسليم
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-hover, #f8fafc)', color: '#fff', fontSize: '13px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        العربون المدفوع مقدماً
                                    </label>
                                    <input
                                        type="number"
                                        value={deposit}
                                        onChange={e => setDeposit(e.target.value)}
                                        max={totalFee}
                                        min="0"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-hover, #f8fafc)', color: '#fff', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace" }}
                                    />
                                </div>
                            </div>

                            {/* Summary Bar */}
                            <div style={{
                                padding: '14px',
                                background: 'rgba(14, 165, 233, 0.1)',
                                border: '1px solid rgba(14, 165, 233, 0.3)',
                                borderRadius: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-accent, #0ea5e9)' }}>
                                    الإجمالي: <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{totalFee.toFixed(2)}</strong> ر.س
                                </span>
                                <span style={{ fontWeight: 800, fontSize: '14px', color: balance > 0 ? '#f59e0b' : '#10b981' }}>
                                    المتبقي: <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{balance.toFixed(2)}</strong> ر.س
                                </span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 20px',
                            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            gap: '12px',
                            background: 'var(--bg-hover, #f8fafc)'
                        }}>
                            <button
                                onClick={handleSave}
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
                                💾 حفظ وطباعة التذكرة الفورية
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    flex: 1,
                                    minHeight: '44px',
                                    background: 'var(--bg-card, #ffffff)',
                                    color: 'var(--text-muted, #64748b)',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}



        </div>
    );
}
