import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { useToast } from '../components/ToastManager';
import { generateBarcodeSVG } from '../utils/barcodeSvg';
import { Scissors, ScanBarcode, X, Plus, CheckCircle2, Undo2, PackageCheck, Banknote, Tag, User, Save, Clock, Play, Printer, Share2, MessageCircle, AlertCircle, ShieldAlert } from 'lucide-react';

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
    const [staffList, setStaffList] = useState([]);

    // Modal Form State
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [linkedOrderId, setLinkedOrderId] = useState('');
    const [items, setItems] = useState([{ garment_type: 'thobe', instructions: '', fee: 0 }]);
    const [dueDate, setDueDate] = useState('');
    const [deposit, setDeposit] = useState(0);

    // Alteration Lifecycle & Accountability
    const [reason, setReason] = useState('customer_request'); // 'customer_request' | 'fitting_adjustment' | 'tailor_error' | 'cutter_error' | 'fabric_shrinkage'
    const [assignedTailor, setAssignedTailor] = useState('');
    const [faultStaff, setFaultStaff] = useState('');
    const [fittingNotes, setFittingNotes] = useState('');

    useEffect(() => {
        loadTickets();
        loadCustomers();
        loadStaff();
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

    const loadStaff = async () => {
        try {
            const data = await window.api?.getStaff?.();
            if (Array.isArray(data)) {
                setStaffList(data);
            }
        } catch (e) {
            console.error('Failed to load staff list:', e);
        }
    };

    // Print Hanger Barcode Label (Thermal 60x40mm)
    const handlePrintAlterationHangerTag = (ticket) => {
        const ticketNum = `ALT-${String(ticket.id).padStart(4, '0')}`;
        const barcodeSvg = generateBarcodeSVG(ticketNum, { width: 1.5, height: 34, fontSize: 11 });
        const reasonLabels = {
            customer_request: 'رغبة العميل (مدفوع)',
            fitting_adjustment: 'تعديل بروفة قياس',
            tailor_error: 'خطأ خياط (مجاني)',
            cutter_error: 'خطأ تفصيل (مجاني)',
            fabric_shrinkage: 'انكماش قماش'
        };
        const reasonText = reasonLabels[ticket.reason] || ticket.reason || 'تعديل ثوب';
        
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8" />
                <title>ملصق تعليق تعديل - ${ticketNum}</title>
                <style>
                    @page { size: 60mm 40mm; margin: 0; }
                    body {
                        margin: 0;
                        padding: 3mm;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 11px;
                        width: 60mm;
                        box-sizing: border-box;
                        color: #000;
                    }
                    .tag-border {
                        border: 1.5px dashed #000;
                        border-radius: 4px;
                        padding: 2.5mm;
                        text-align: center;
                    }
                    .title { font-size: 12px; font-weight: 900; margin-bottom: 2px; }
                    .ticket-num { font-size: 13px; font-weight: 900; background: #000; color: #fff; padding: 1px 6px; border-radius: 3px; display: inline-block; margin: 1px 0; }
                    .info-row { display: flex; justify-content: space-between; font-size: 9.5px; margin-top: 2px; }
                    .instructions { text-align: right; font-weight: 800; font-size: 9.5px; margin-top: 3px; padding-top: 2px; border-top: 1px solid #000; }
                    .barcode-wrap { margin-top: 3px; }
                </style>
            </head>
            <body>
                <div class="tag-border">
                    <div class="title">ملصق ثوب تعديل</div>
                    <div class="ticket-num">${ticketNum}</div>
                    <div class="info-row">
                        <span>العميل: <strong>${ticket.customer_name || 'عميل'}</strong></span>
                        <span>${ticket.customer_phone || ''}</span>
                    </div>
                    <div class="info-row">
                        <span>السبب: <strong>${reasonText}</strong></span>
                        ${ticket.assigned_tailor ? `<span>المكلف: <strong>${ticket.assigned_tailor}</strong></span>` : ''}
                    </div>
                    <div class="instructions">
                        ${(ticket.items || []).map(i => `• ${i.instructions || i.garment_type || 'تعديل'}`).join('<br>')}
                    </div>
                    <div class="barcode-wrap">${barcodeSvg}</div>
                </div>
            </body>
            </html>
        `;

        if (window.api?.printHTML) {
            window.api.printHTML(html);
            return;
        }

        try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            iframe.style.width = '0';
            iframe.style.height = '0';
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => { try { document.body.removeChild(iframe); } catch(_) {} }, 2000);
            }, 400);
        } catch (e) {
            console.error(e);
        }
    };

    // Share Status via WhatsApp
    const handleShareAlterationWhatsApp = (ticket) => {
        if (!ticket.customer_phone) {
            showToast?.({ type: 'warning', message: 'لا يوجد رقم جوال مسجل لهذا العميل' });
            return;
        }
        const cleanPhone = ticket.customer_phone.replace(/[^0-9]/g, '');
        let saudiPhone = cleanPhone;
        if (saudiPhone.startsWith('05')) saudiPhone = '966' + saudiPhone.substring(1);
        else if (saudiPhone.startsWith('5')) saudiPhone = '966' + saudiPhone;

        const statusText = ticket.status === 'ready' 
            ? '✅ ثوبكم / قطعتكم جاهزة للاستلام في المشغل.' 
            : ticket.status === 'in_progress' 
            ? '✂️ يجري العمل حالياً على تعديل طلبكم بعناية.' 
            : '📋 تم تسجيل تذكرة التعديل في جدول المشغل.';

        const total = parseFloat(ticket.total_fee || 0);
        const dep = parseFloat(ticket.deposit || 0);
        const bal = Math.max(0, total - dep);

        const message = `مرحباً بك ${ticket.customer_name || 'عزيزنا العميل'}،
نود إبلاغكم بشأن تذكرة التعديل رقم #ALT-${String(ticket.id).padStart(4, '0')} في مشغل البصمة الذكية:
${statusText}
${bal > 0 ? `المبلغ المتبقي للاستلام: ${bal.toFixed(2)} ر.س` : 'الحساب: مسدد بالكامل'}
${ticket.target_delivery_date ? `موعد التسليم المتوقع: ${ticket.target_delivery_date}` : ''}
نسعد دائماً بخدمتكم!`;

        const url = `https://wa.me/${saudiPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
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
                target_delivery_date: dueDate,
                reason,
                assigned_tailor: assignedTailor,
                fault_staff: faultStaff,
                fitting_notes: fittingNotes
            };

            const res = await window.api?.tailor?.createAlteration?.(payload);
            if (res && res.success === false) throw new Error(res.error || 'فشل الحفظ');
            
            const ticketId = res?.id || res?.ticket_id || Date.now();
            showToast?.({ type: 'success', message: 'تم حفظ طلب التعديل بنجاح' });
            setShowModal(false);
            setPhone(''); setName(''); setSelectedCustomerId(null); setLinkedOrderId('');
            setItems([{ garment_type: 'thobe', instructions: '', fee: 0 }]);
            setDeposit(0);
            setReason('customer_request');
            setAssignedTailor('');
            setFaultStaff('');
            setFittingNotes('');
            loadTickets();

            // Offline-first Thermal Print with Pure SVG Barcode
            const barcodeSvg = generateBarcodeSVG(`ALT-${String(ticketId).padStart(4, '0')}`, {
                width: 1.8,
                height: 42,
                fontSize: 13
            });

            const reasonLabels = {
                customer_request: 'رغبة العميل (مدفوع)',
                fitting_adjustment: 'تعديل بروفة قياس',
                tailor_error: 'خطأ خياط (مجاني)',
                cutter_error: 'خطأ تفصيل (مجاني)',
                fabric_shrinkage: 'انكماش قماش'
            };

            const html = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="utf-8" />
                    <title>تذكرة تعديل - ALT-${String(ticketId).padStart(4, '0')}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; width: 80mm; padding: 10px; margin: 0; color: #000; }
                        .text-center { text-align: center; }
                        .flex { display: flex; justify-content: space-between; }
                        .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
                        .font-bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h2 class="text-center" style="margin: 0 0 5px 0;">مشغل البصمة الذكية</h2>
                    <div class="text-center border-b">أمر تشغيل معمل وتعديل قطعة</div>
                    <div class="flex" style="margin-top: 8px;"><span>رقم التذكرة:</span> <span class="font-bold">#ALT-${String(ticketId).padStart(4, '0')}</span></div>
                    <div class="flex"><span>العميل:</span> <span>${name}</span></div>
                    <div class="flex"><span>الجوال:</span> <span dir="ltr">${phone}</span></div>
                    <div class="flex"><span>نوع التعديل / السبب:</span> <span>${reasonLabels[reason] || reason}</span></div>
                    ${assignedTailor ? `<div class="flex"><span>المعلم المكلف:</span> <span>${assignedTailor}</span></div>` : ''}
                    ${fittingNotes ? `<div class="flex"><span>ملاحظات البروفة:</span> <span>${fittingNotes}</span></div>` : ''}
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
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.top = '-9999px';
                iframe.style.left = '-9999px';
                iframe.style.width = '0';
                iframe.style.height = '0';
                document.body.appendChild(iframe);
                const doc = iframe.contentWindow.document;
                doc.open();
                doc.write(html);
                doc.close();
                setTimeout(() => {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    setTimeout(() => { try { document.body.removeChild(iframe); } catch(_) {} }, 2000);
                }, 400);
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
                            display: 'flex',
                            alignItems: 'center',
                            pointerEvents: 'none'
                        }}>
                            <ScanBarcode size={18} />
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
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px'
                                }}
                            >
                                <X size={14} />
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
                            <Plus size={16} />
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
                                    <Clock size={16} color="#f59e0b" />
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

                                            {/* Reason & Accountability Badges */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                                {t.reason && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        padding: '2px 7px',
                                                        borderRadius: '6px',
                                                        background: t.reason.includes('error') ? 'rgba(239, 68, 68, 0.15)' : t.reason === 'fitting_adjustment' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                        color: t.reason.includes('error') ? '#ef4444' : t.reason === 'fitting_adjustment' ? '#a855f7' : '#3b82f6'
                                                    }}>
                                                        {t.reason === 'customer_request' ? 'رغبة العميل' : t.reason === 'fitting_adjustment' ? 'بروفة قياس' : t.reason === 'tailor_error' ? 'خطأ خياط (مجاني)' : t.reason === 'cutter_error' ? 'خطأ فصال (مجاني)' : 'انكماش قماش'}
                                                    </span>
                                                )}
                                                {t.assigned_tailor && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary, #6366f1)' }}>
                                                        المعلم: {t.assigned_tailor}
                                                    </span>
                                                )}
                                                {t.fault_staff && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                                        المسؤول: {t.fault_staff}
                                                    </span>
                                                )}
                                            </div>

                                            {t.fitting_notes && (
                                                <div style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168, 85, 247, 0.08)', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(168, 85, 247, 0.3)' }}>
                                                    🔍 <strong>البروفة:</strong> {t.fitting_notes}
                                                </div>
                                            )}

                                            {/* Quick Print & Share Buttons */}
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                                <button
                                                    onClick={() => handlePrintAlterationHangerTag(t)}
                                                    title="طباعة ملصق المعلقة للثوب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: 'var(--bg-card, #ffffff)',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        color: 'var(--text-main, #0f172a)'
                                                    }}
                                                >
                                                    <Printer size={12} />
                                                    <span>ملصق تعليق</span>
                                                </button>
                                                <button
                                                    onClick={() => handleShareAlterationWhatsApp(t)}
                                                    title="مراسلة العميل بالواتساب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: '#128C7E',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <MessageCircle size={12} />
                                                    <span>واتساب</span>
                                                </button>
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
                                                <Play size={14} />
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
                                    <Scissors size={16} color="#3b82f6" />
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

                                            {/* Reason & Accountability Badges */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                                {t.reason && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        padding: '2px 7px',
                                                        borderRadius: '6px',
                                                        background: t.reason.includes('error') ? 'rgba(239, 68, 68, 0.15)' : t.reason === 'fitting_adjustment' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                        color: t.reason.includes('error') ? '#ef4444' : t.reason === 'fitting_adjustment' ? '#a855f7' : '#3b82f6'
                                                    }}>
                                                        {t.reason === 'customer_request' ? 'رغبة العميل' : t.reason === 'fitting_adjustment' ? 'بروفة قياس' : t.reason === 'tailor_error' ? 'خطأ خياط (مجاني)' : t.reason === 'cutter_error' ? 'خطأ فصال (مجاني)' : 'انكماش قماش'}
                                                    </span>
                                                )}
                                                {t.assigned_tailor && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary, #6366f1)' }}>
                                                        المعلم: {t.assigned_tailor}
                                                    </span>
                                                )}
                                                {t.fault_staff && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                                        المسؤول: {t.fault_staff}
                                                    </span>
                                                )}
                                            </div>

                                            {t.fitting_notes && (
                                                <div style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168, 85, 247, 0.08)', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(168, 85, 247, 0.3)' }}>
                                                    🔍 <strong>البروفة:</strong> {t.fitting_notes}
                                                </div>
                                            )}

                                            {/* Quick Print & Share Buttons */}
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                                <button
                                                    onClick={() => handlePrintAlterationHangerTag(t)}
                                                    title="طباعة ملصق المعلقة للثوب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: 'var(--bg-card, #ffffff)',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        color: 'var(--text-main, #0f172a)'
                                                    }}
                                                >
                                                    <Printer size={12} />
                                                    <span>ملصق تعليق</span>
                                                </button>
                                                <button
                                                    onClick={() => handleShareAlterationWhatsApp(t)}
                                                    title="مراسلة العميل بالواتساب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: '#128C7E',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <MessageCircle size={12} />
                                                    <span>واتساب</span>
                                                </button>
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
                                                    <CheckCircle2 size={14} />
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
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Undo2 size={13} />
                                                    <span>تراجع</span>
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
                                    <PackageCheck size={16} color="#10b981" />
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

                                            {/* Reason & Accountability Badges */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                                {t.reason && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        padding: '2px 7px',
                                                        borderRadius: '6px',
                                                        background: t.reason.includes('error') ? 'rgba(239, 68, 68, 0.15)' : t.reason === 'fitting_adjustment' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                        color: t.reason.includes('error') ? '#ef4444' : t.reason === 'fitting_adjustment' ? '#a855f7' : '#3b82f6'
                                                    }}>
                                                        {t.reason === 'customer_request' ? 'رغبة العميل' : t.reason === 'fitting_adjustment' ? 'بروفة قياس' : t.reason === 'tailor_error' ? 'خطأ خياط (مجاني)' : t.reason === 'cutter_error' ? 'خطأ فصال (مجاني)' : 'انكماش قماش'}
                                                    </span>
                                                )}
                                                {t.assigned_tailor && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary, #6366f1)' }}>
                                                        المعلم: {t.assigned_tailor}
                                                    </span>
                                                )}
                                                {t.fault_staff && (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                                        المسؤول: {t.fault_staff}
                                                    </span>
                                                )}
                                            </div>

                                            {t.fitting_notes && (
                                                <div style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168, 85, 247, 0.08)', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(168, 85, 247, 0.3)' }}>
                                                    🔍 <strong>البروفة:</strong> {t.fitting_notes}
                                                </div>
                                            )}

                                            {/* Quick Print & Share Buttons */}
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                                <button
                                                    onClick={() => handlePrintAlterationHangerTag(t)}
                                                    title="طباعة ملصق المعلقة للثوب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: 'var(--bg-card, #ffffff)',
                                                        border: '1px solid var(--border-subtle, #e2e8f0)',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        color: 'var(--text-main, #0f172a)'
                                                    }}
                                                >
                                                    <Printer size={12} />
                                                    <span>ملصق تعليق</span>
                                                </button>
                                                <button
                                                    onClick={() => handleShareAlterationWhatsApp(t)}
                                                    title="مراسلة العميل بالواتساب"
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 8px',
                                                        background: '#128C7E',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <MessageCircle size={12} />
                                                    <span>واتساب</span>
                                                </button>
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
                                                    {bal > 0 ? <Banknote size={15} /> : <PackageCheck size={15} />}
                                                    <span>{bal > 0 ? 'تسليم وتحصيل' : 'تسليم للعميل'}</span>
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
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Undo2 size={13} />
                                                    <span>إعادة للخياط</span>
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
                            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Tag size={18} color="var(--color-primary, #6366f1)" />
                                <span>إصدار تذكرة تعديل جديدة</span>
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                            >
                                <X size={18} />
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
                                                <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <User size={13} color="var(--color-primary, #6366f1)" />
                                                    <span>{c.name}</span>
                                                </span>
                                                <span style={{ color: 'var(--text-muted, #64748b)', fontFamily: "'IBM Plex Mono', monospace" }}>{c.phone}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Alteration Lifecycle & Accountability Section */}
                            <div style={{
                                background: 'rgba(99, 102, 241, 0.05)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                borderRadius: '10px',
                                padding: '14px',
                                marginBottom: '16px'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary, #6366f1)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldAlert size={16} />
                                    <span>دورة التعديل والمسؤولية والبروفة</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '10px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                            سبب التعديل والمسؤولية المالية
                                        </label>
                                        <select
                                            value={reason}
                                            onChange={e => {
                                                const r = e.target.value;
                                                setReason(r);
                                                if (r === 'tailor_error' || r === 'cutter_error') {
                                                    // Set fee to 0 automatically for internal shop errors
                                                    setItems(prev => prev.map(item => ({ ...item, fee: 0 })));
                                                    setDeposit(0);
                                                }
                                            }}
                                            style={{ width: '100%', padding: '9px', borderRadius: '7px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                                        >
                                            <option value="customer_request">رغبة العميل (تعديل مدفوع)</option>
                                            <option value="fitting_adjustment">بروفة قياس (تعديل مقاسات بعد التجربة)</option>
                                            <option value="tailor_error">خطأ خياط (مجاني - مسؤولية الخياط)</option>
                                            <option value="cutter_error">خطأ تفصيل / قص (مجاني - مسؤولية الفصال)</option>
                                            <option value="fabric_shrinkage">انكماش قماش بعد الغسيل</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                            المعلم المكلف بالتعديل
                                        </label>
                                        <select
                                            value={assignedTailor}
                                            onChange={e => setAssignedTailor(e.target.value)}
                                            style={{ width: '100%', padding: '9px', borderRadius: '7px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                                        >
                                            <option value="">-- اختياري: اختر المعلم المكلف --</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.name}>{s.name} ({s.role === 'tailor' ? 'خياط' : s.role === 'cutter' ? 'فصال' : s.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {(reason === 'tailor_error' || reason === 'cutter_error') && (
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                                                الموظف المتسبب بالخطأ (للمساءلة)
                                            </label>
                                            <select
                                                value={faultStaff}
                                                onChange={e => setFaultStaff(e.target.value)}
                                                style={{ width: '100%', padding: '9px', borderRadius: '7px', background: '#111827', border: '1px solid #ef4444', color: '#fff', fontSize: '13px' }}
                                            >
                                                <option value="">-- اختر الموظف المسؤول --</option>
                                                {staffList.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                        ملاحظات البروفة والتجربة (Fitting Notes)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="مثال: قياس التجربة: الياقة مضبوطة، يحتاج تقصير الطول 1.5 سم وتضييق بسيط في المعصم"
                                        value={fittingNotes}
                                        onChange={e => setFittingNotes(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#111827', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
                                    />
                                </div>
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
                                                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <X size={14} />
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
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Save size={16} />
                                <span>حفظ وطباعة التذكرة الفورية</span>
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
