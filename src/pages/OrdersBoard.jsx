import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { useToast } from '../components/ToastManager';

// ── Production Stages Configuration ──────────────────────────────────────────
const STAGES = [
  { id: 'cutting',   label: 'قص',      icon: '✂️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6' },
  { id: 'stitching', label: 'خياطة',   icon: '🧵', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: '#8b5cf6' },
  { id: 'finishing', label: 'تشطيب',   icon: '🪡', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b' },
  { id: 'qc',        label: 'فحص جودة',icon: '🔍', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: '#06b6d4' },
  { id: 'ironing',   label: 'كوي',     icon: '♨️', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: '#ec4899' },
  { id: 'ready',     label: 'جاهز',    icon: '✅', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

function fmt(n) { return Number(n || 0).toFixed(2); }

function timeInStage(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(mins / 60);
  const days  = Math.floor(hrs / 24);
  if (days > 0)  return `${days} يوم`;
  if (hrs > 0)   return `${hrs} ساعة`;
  if (mins > 0)  return `${mins} دقيقة`;
  return 'الآن';
}

function isOverdue(order) {
  if (!order.target_delivery_date) return false;
  return new Date(order.target_delivery_date) < new Date();
}

export default function OrdersBoard() {
  const navigate = useNavigate();
  const { showToast } = useToast?.() ?? { showToast: (m) => console.log(m) };

  const [orders, setOrders] = useState([]);
  const [garmentMap, setGarmentMap] = useState({}); // orderId → garments[]
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null); // garment_id or 'batch-orderId'
  const [showPickup, setShowPickup] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [completing, setCompleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, urgent, ready, overdue

  // ── Load Orders & Garments ────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const data = await window.api?.tailor?.getOrders?.({ exclude_status: 'delivered' }) ?? [];
      setOrders(data);

      const map = {};
      await Promise.all(
        data.map(async (o) => {
          try {
            const garments = await window.api?.tailor?.getGarments?.(o.id) ?? [];
            map[o.id] = garments;
          } catch {
            map[o.id] = [];
          }
        })
      );
      setGarmentMap(map);
    } catch (err) {
      console.error('OrdersBoard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 30000); // 30s auto-refresh
    return () => clearInterval(timer);
  }, [fetchOrders]);

  // ── Stage advance / revert for a single garment ───────────────────────────
  const handleStageChange = async (garmentId, newStage) => {
    setAdvancing(garmentId);
    try {
      const res = await window.api?.tailor?.updateStage?.({ garment_id: garmentId, stage: newStage });
      if (res && res.success === false) throw new Error(res?.error || 'فشل نقل المرحلة');
      
      // Optimistic update
      setGarmentMap(prev => {
        const next = { ...prev };
        for (const orderId of Object.keys(next)) {
          next[orderId] = next[orderId].map(g =>
            g.id === garmentId ? { ...g, production_stage: newStage } : g
          );
        }
        return next;
      });
      showToast?.({ type: 'success', message: 'تم تحديث مرحلة القطعة' });
    } catch (err) {
      showToast?.({ type: 'error', message: 'فشل تحديث المرحلة: ' + err.message });
    } finally {
      setAdvancing(null);
    }
  };

  // ── Batch advance: Advance all non-ready garments in an order ──────────────
  const handleBatchAdvance = async (orderId) => {
    const garments = garmentMap[orderId] || [];
    const nonReady = garments.filter(g => g.production_stage !== 'ready' && g.production_stage !== 'delivered');
    if (nonReady.length === 0) return;

    setAdvancing(`batch-${orderId}`);
    try {
      await Promise.all(
        nonReady.map(g => {
          const currentIdx = STAGE_INDEX[g.production_stage] ?? 0;
          const nextStage = STAGES[Math.min(currentIdx + 1, STAGES.length - 1)].id;
          return window.api?.tailor?.updateStage?.({ garment_id: g.id, stage: nextStage });
        })
      );

      // Optimistic batch update
      setGarmentMap(prev => {
        const next = { ...prev };
        if (next[orderId]) {
          next[orderId] = next[orderId].map(g => {
            const currentIdx = STAGE_INDEX[g.production_stage] ?? 0;
            const nextStage = STAGES[Math.min(currentIdx + 1, STAGES.length - 1)].id;
            return { ...g, production_stage: nextStage };
          });
        }
        return next;
      });

      showToast?.({ type: 'success', message: `تمت ترقية جميع قطع الطلب #${orderId} للمرحلة التالية بنجاح` });
    } catch (err) {
      showToast?.({ type: 'error', message: 'خطأ في الترقية الجماعية: ' + err.message });
    } finally {
      setAdvancing(null);
    }
  };

  // ── Complete order (pickup) ───────────────────────────────────────────────
  const handleCompleteOrder = async () => {
    if (!showPickup) return;
    setCompleting(true);
    try {
      const res = await window.api?.tailor?.completeOrder?.({
        order_id: showPickup.id,
        payment_method: payMethod,
        balance_paid: showPickup.balance_due,
      });
      if (res && res.success === false) throw new Error(res?.error || 'فشل إتمام الطلب');
      
      // Print Collection/Pickup Receipt
      try {
        const orderGarments = garmentMap[showPickup.id] || [];
        const receiptHtml = `
          <html dir="rtl">
          <head>
            <meta charset="utf-8">
            <style>
              * { box-sizing: border-box; }
              @page { margin: 0; size: 80mm auto; }
              body { font-family: 'Tajawal', 'Tahoma', sans-serif; font-size: 12px; margin: 0; padding: 6mm; width: 80mm; color: #000; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
              .flex { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
              .badge { text-align: center; font-weight: 800; font-size: 13px; border: 1.5px dashed #000; padding: 4px 0; margin: 8px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 6px; }
              th, td { padding: 4px 0; border-bottom: 1px dotted #999; font-size: 11px; text-align: right; }
            </style>
          </head>
          <body>
            <div class="text-center font-bold" style="font-size: 15px;">سند تسليم واستلام ثياب</div>
            <div class="text-center" style="font-size: 11px;">مشغل الخياطة الرجالية الراقية</div>
            <div class="badge">تم تسليم الطلب النهائي بنجاح</div>
            <div class="flex"><span>رقم الطلب:</span><span class="font-bold">#${showPickup.id}</span></div>
            <div class="flex"><span>العميل:</span><span>${showPickup.customer_name || 'عميل'}</span></div>
            ${showPickup.customer_phone ? `<div class="flex"><span>الجوال:</span><span dir="ltr">${showPickup.customer_phone}</span></div>` : ''}
            <div class="flex"><span>تاريخ التسليم:</span><span dir="ltr">${new Date().toLocaleString('ar-SA')}</span></div>
            <div class="border-b"></div>
            <table>
              <thead>
                <tr>
                  <th>القطعة</th>
                  <th>القماش</th>
                  <th style="text-align: left;">الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${orderGarments.map(g => `
                  <tr>
                    <td>${g.garment_type || 'ثوب'}</td>
                    <td>${g.fabric_name || 'قماش عميل'}</td>
                    <td style="text-align: left;">مستلم ✔</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="border-b" style="margin-top: 6px;"></div>
            <div class="flex"><span>إجمالي الطلب:</span><span dir="ltr">${fmt(showPickup.total_amount)} SAR</span></div>
            <div class="flex"><span>العربون السابق:</span><span dir="ltr">${fmt(showPickup.deposit_paid)} SAR</span></div>
            <div class="flex font-bold" style="font-size: 13px;"><span>المبلغ المسدد الآن:</span><span dir="ltr">${fmt(showPickup.balance_due)} SAR</span></div>
            <div class="flex"><span>طريقة الدفع:</span><span>${payMethod === 'cash' ? 'نقداً' : payMethod === 'card' ? 'شبكة / مدى' : 'تحويل'}</span></div>
            <div class="flex font-bold" style="color: #10b981; margin-top: 4px;"><span>المتبقي:</span><span>0.00 SAR (خالص)</span></div>
            <div class="text-center" style="font-size: 10px; margin-top: 15px; color: #555;">نشكركم لاختياركم لنا ونتطلع لخدمتكم دائماً</div>
          </body>
          </html>
        `;
        if (window.api?.printHTML) {
          await window.api.printHTML(receiptHtml);
        }
      } catch (printErr) {
        console.warn('Could not auto-print pickup receipt:', printErr);
      }

      showToast?.({ type: 'success', message: `تم تسليم الطلب #${showPickup.id} للعميل ${showPickup.customer_name}` });
      setShowPickup(null);
      fetchOrders();
    } catch (err) {
      showToast?.({ type: 'error', message: err.message });
    } finally {
      setCompleting(false);
    }
  };

  // ── Compute board stage (earliest garment stage) ──────────────────────────
  const getOrderBoardStage = useCallback((orderId) => {
    const garments = garmentMap[orderId] || [];
    if (garments.length === 0) return 'cutting';
    let minIdx = STAGES.length;
    for (const g of garments) {
      const idx = STAGE_INDEX[g.production_stage] ?? 0;
      if (idx < minIdx) minIdx = idx;
    }
    return STAGES[minIdx]?.id ?? 'cutting';
  }, [garmentMap]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.customer_phone || '').includes(q);
        const matchId = String(o.id).includes(q);
        if (!matchName && !matchPhone && !matchId) return false;
      }
      // 2. Status Filters
      if (activeFilter === 'urgent') return Boolean(o.is_urgent);
      if (activeFilter === 'overdue') return isOverdue(o);
      if (activeFilter === 'ready') return getOrderBoardStage(o.id) === 'ready';
      return true;
    });
  }, [orders, searchQuery, activeFilter, getOrderBoardStage]);

  const activeOrdersCount = useMemo(() => orders.length, [orders]);

  const sendWhatsAppReady = (order) => {
    if (!order.customer_phone) {
      showToast?.({ type: 'error', message: 'لا يوجد رقم هاتف مسجل للعميل' });
      return;
    }
    const clean = order.customer_phone.replace(/\D/g, '');
    const intlPhone = clean.startsWith('0') ? '966' + clean.slice(1) : clean.startsWith('966') ? clean : '966' + clean;
    const balanceText = Number(order.balance_due) > 0 ? `المبلغ المتبقي عند الاستلام: ${fmt(order.balance_due)} ر.س.` : 'تم سداد الحساب بالكامل.';
    const msg = `مرحباً ${order.customer_name || 'عميلنا العزيز'}، ثيابكم للطلب رقم #${order.id} أصبحت جاهزة تماماً للاستلام من المشغل! ✨\n${balanceText}\nأهلاً وسهلاً بكم في أي وقت.`;
    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
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
        activeTab="board"
        counters={{ activeOrders: activeOrdersCount }}
      />

      {/* Workshop Board Header Bar */}
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
          <span style={{ fontSize: '22px' }}>🏭</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main, #0f172a)' }}>
              لوحة مراحل الإنتاج والمعمل (Workshop Board)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
              تتبع مسار الأثواب لحظياً — تحديث تلقائي كل 30 ثانية
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="🔍 بحث بالاسم، الجوال أو رقم الطلب..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-hover, #f8fafc)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-hover, #f8fafc)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
            {[
              { id: 'all', label: `الكل (${orders.length})` },
              { id: 'ready', label: '✅ جاهز' },
              { id: 'urgent', label: '⚡ مستعجل' },
              { id: 'overdue', label: '⚠️ متأخر' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeFilter === f.id ? 'var(--color-primary, #6366f1)' : 'transparent',
                  color: activeFilter === f.id ? '#ffffff' : 'var(--text-muted, #64748b)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchOrders}
            style={{
              background: 'var(--bg-hover, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              color: 'var(--text-main, #0f172a)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 تحديث الآن
          </button>
          <button
            onClick={() => navigate('/tailor-pos')}
            style={{
              background: 'var(--color-primary, #6366f1)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>✂️</span>
            <span>تفصيل طلب جديد</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
          جاري تحميل بيانات الورشة والمعمل...
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '16px 20px',
          alignItems: 'stretch'
        }}>
          {STAGES.map((stage) => {
            const stageOrders = filteredOrders.filter(o => getOrderBoardStage(o.id) === stage.id);

            return (
              <div
                key={stage.id}
                style={{
                  minWidth: '310px',
                  maxWidth: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  flexShrink: 0
                }}
              >
                {/* Stage Header */}
                <div style={{
                  background: stage.bg,
                  borderBottom: `3px solid ${stage.border}`,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{stage.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: stage.color }}>{stage.label}</span>
                  </div>
                  <span style={{
                    background: stage.color,
                    color: '#fff',
                    borderRadius: '999px',
                    minWidth: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 900,
                    padding: '0 6px',
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>
                    {stageOrders.length}
                  </span>
                </div>

                {/* Orders List Container */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stageOrders.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: 'var(--text-muted, #64748b)',
                      border: '2px dashed var(--border-subtle, #e2e8f0)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      لا توجد أثواب في مرحلة {stage.label}
                    </div>
                  )}

                  {stageOrders.map(order => {
                    const garments = garmentMap[order.id] || [];
                    const overdue = isOverdue(order);
                    const totalGarments = garments.length;
                    const readyGarments = garments.filter(g => g.production_stage === 'ready' || g.production_stage === 'delivered').length;
                    const progressPercent = totalGarments > 0 ? Math.round((readyGarments / totalGarments) * 100) : 0;
                    const allReady = totalGarments > 0 && readyGarments === totalGarments;
                    const isBatchAdvancing = advancing === `batch-${order.id}`;

                    return (
                      <div
                        key={order.id}
                        style={{
                          background: 'var(--bg-card, #ffffff)',
                          border: overdue ? '2px solid #ef4444' : order.is_urgent ? '1px solid #f59e0b' : '1px solid var(--border-subtle, #e2e8f0)',
                          borderRight: overdue ? '4px solid #ef4444' : order.is_urgent ? '4px solid #f59e0b' : `4px solid ${stage.color}`,
                          borderRadius: '12px',
                          padding: '14px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                      >
                        {/* Order Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>
                              {order.customer_name}
                            </div>
                            {order.customer_phone && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontFamily: "'IBM Plex Mono', monospace" }} dir="ltr">
                                {order.customer_phone}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--primary, #6366f1)', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                              #{order.id}
                            </div>
                            {order.is_urgent ? (
                              <div style={{ fontSize: '10px', fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: '4px', marginTop: '3px', textAlign: 'center' }}>
                                ⚡ مستعجل
                              </div>
                            ) : null}
                            {overdue && (
                              <div style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', marginTop: '3px', textAlign: 'center' }}>
                                ⚠️ متأخر
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Multi-Garment Visual Progress Bar ─────────────── */}
                        <div style={{
                          background: 'var(--bg-hover, #f8fafc)',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '5px' }}>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>إنجاز الطلب:</span>
                            <span style={{ color: progressPercent === 100 ? '#10b981' : '#f59e0b', fontFamily: "'IBM Plex Mono', monospace" }}>
                              {readyGarments} من {totalGarments} قطع جاهزة ({progressPercent}%)
                            </span>
                          </div>
                          {/* Bar track */}
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${progressPercent}%`,
                              height: '100%',
                              background: progressPercent === 100 ? '#10b981' : '#f59e0b',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>

                        {/* Garment Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                          {garments.map(g => {
                            const isReady = g.production_stage === 'ready' || g.production_stage === 'delivered';
                            const gStageIdx = STAGE_INDEX[g.production_stage] ?? 0;
                            const nextStage = STAGES[Math.min(gStageIdx + 1, STAGES.length - 1)];
                            const prevStage = gStageIdx > 0 ? STAGES[gStageIdx - 1] : null;

                            return (
                              <div
                                key={g.id}
                                style={{
                                  background: 'var(--bg-hover, #f8fafc)',
                                  border: '1px solid var(--border-subtle, #e2e8f0)',
                                  borderRadius: '8px',
                                  padding: '8px 10px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 800, color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>
                                    {g.garment_type}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                                    {g.fabric_name || 'قماش عميل'}
                                  </span>
                                </div>

                                {(g.tailor_name || g.cutter_name) && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {g.tailor_name && (
                                      <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        🧵 {g.tailor_name}
                                      </span>
                                    )}
                                    {g.cutter_name && (
                                      <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        📏 {g.cutter_name}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Touch Action Buttons (>=44px height) */}
                                {!isReady ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {nextStage && (
                                      <button
                                        onClick={() => handleStageChange(g.id, nextStage.id)}
                                        disabled={advancing === g.id || isBatchAdvancing}
                                        style={{
                                          flex: 2,
                                          minHeight: '44px',
                                          borderRadius: '8px',
                                          background: 'var(--color-primary, #6366f1)',
                                          color: '#ffffff',
                                          fontWeight: 800,
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          border: 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px',
                                          opacity: advancing === g.id ? 0.6 : 1
                                        }}
                                      >
                                        <span>{advancing === g.id ? '...' : `نقل إلى ${nextStage.label} ⇦`}</span>
                                      </button>
                                    )}
                                    {prevStage && (
                                      <button
                                        onClick={() => handleStageChange(g.id, prevStage.id)}
                                        disabled={advancing === g.id || isBatchAdvancing}
                                        title={`إعادة إلى ${prevStage.label}`}
                                        style={{
                                          flex: 1,
                                          minHeight: '44px',
                                          borderRadius: '8px',
                                          background: 'var(--bg-hover, #f8fafc)',
                                          border: '1px solid var(--border-subtle, #e2e8f0)',
                                          color: 'var(--text-muted, #64748b)',
                                          fontWeight: 700,
                                          fontSize: '11px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ↩️ رجوع
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{
                                    color: '#10b981',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    textAlign: 'center',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    padding: '6px',
                                    borderRadius: '6px'
                                  }}>
                                    ✔ القطعة جاهزة تماماً
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Batch Advance Button (>=44px touch ergonomics) */}
                        {!allReady && (
                          <button
                            onClick={() => handleBatchAdvance(order.id)}
                            disabled={isBatchAdvancing}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#f59e0b',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '12px',
                              cursor: isBatchAdvancing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              marginBottom: '10px'
                            }}
                          >
                            <span>⚡</span>
                            <span>{isBatchAdvancing ? 'جاري الترقية...' : 'نقل كافة القطع المتبقية للمرحلة التالية'}</span>
                          </button>
                        )}

                        {/* Meta & Balance Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 700, margin: '8px 0' }}>
                          <span>⏱ {timeInStage(order.order_date)}</span>
                          {order.target_delivery_date && (
                            <span style={{ color: overdue ? '#ef4444' : 'var(--text-muted, #64748b)' }}>
                              📅 {new Date(order.target_delivery_date).toLocaleDateString('ar-SA')}
                            </span>
                          )}
                        </div>

                        {Number(order.balance_due) > 0 && (
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#ef4444', marginBottom: '8px', fontFamily: "'IBM Plex Mono', monospace" }}>
                            المتبقي للدفع: {fmt(order.balance_due)} ر.س
                          </div>
                        )}

                        {/* Order Level Actions (>=44px) */}
                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', paddingTop: '10px', flexWrap: 'wrap' }}>
                          {allReady && order.customer_phone && (
                            <button
                              onClick={() => sendWhatsAppReady(order)}
                              title="إرسال إشعار واتساب بجاهزية الثوب للاستلام"
                              style={{
                                flex: '1 1 100%',
                                minHeight: '38px',
                                borderRadius: '8px',
                                background: 'rgba(37, 211, 102, 0.12)',
                                border: '1px solid rgba(37, 211, 102, 0.4)',
                                color: '#16a34a',
                                fontWeight: 800,
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>💬</span>
                              <span>إشعار واتساب بالجاهزية</span>
                            </button>
                          )}
                          {Number(order.balance_due) > 0 && (
                            <button
                              onClick={() => { setShowPayment(order); setPayMethod('cash'); }}
                              style={{
                                flex: 1,
                                minHeight: '44px',
                                borderRadius: '8px',
                                background: '#f59e0b',
                                color: '#000',
                                fontWeight: 900,
                                fontSize: '13px',
                                cursor: 'pointer',
                                border: 'none'
                              }}
                            >
                              + دفعة
                            </button>
                          )}
                          {stage.id === 'ready' && allReady && (
                            <button
                              onClick={() => { setShowPickup(order); setPayMethod('cash'); }}
                              style={{
                                flex: 2,
                                minHeight: '44px',
                                borderRadius: '8px',
                                background: '#10b981',
                                color: 'white',
                                fontWeight: 900,
                                fontSize: '13px',
                                cursor: 'pointer',
                                border: 'none'
                              }}
                            >
                              📦 تسليم للعميل
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ PICKUP MODAL ══════════════════════════════════════════════════════ */}
      {showPickup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '20px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover, #f8fafc)' }}>
              <h2 style={{ fontWeight: 800, fontSize: '17px', margin: 0, color: 'var(--text-main, #0f172a)' }}>تسليم الطلب النهائي</h2>
              <button onClick={() => setShowPickup(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: 'var(--bg-hover, #f8fafc)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main, #0f172a)' }}>{showPickup.customer_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px', fontFamily: "'IBM Plex Mono', monospace" }}>طلب رقم #{showPickup.id}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-hover, #f8fafc)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>إجمالي الطلب</div>
                  <div style={{ fontWeight: 900, fontSize: '17px', color: 'var(--text-main, #0f172a)', fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(showPickup.total_amount)} ر.س</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>المسدد سابقاً</div>
                  <div style={{ fontWeight: 900, fontSize: '17px', color: '#f59e0b', fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(showPickup.deposit_paid)} ر.س</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.12)', border: '2px solid rgba(16, 185, 129, 0.4)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
                <span style={{ fontWeight: 800, fontSize: '15px', color: '#10b981' }}>المبلغ المطلوب الآن</span>
                <span style={{ fontWeight: 900, fontSize: '24px', color: '#10b981', fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(showPickup.balance_due)} ر.س</span>
              </div>

              {/* Payment Method */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted, #64748b)', marginBottom: '8px' }}>طريقة الدفع</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['cash','💵 نقداً'], ['card','💳 مدى / شبكة'], ['transfer','📱 تحويل']].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setPayMethod(id)}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        border: payMethod === id ? '2px solid var(--color-primary, #6366f1)' : '1px solid var(--border-subtle, #e2e8f0)',
                        background: payMethod === id ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-hover, #f8fafc)',
                        color: payMethod === id ? '#ffffff' : 'var(--text-muted, #64748b)'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-hover, #f8fafc)' }}>
              <button
                onClick={handleCompleteOrder}
                disabled={completing}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  borderRadius: '12px',
                  background: completing ? '#64748b' : '#10b981',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '15px',
                  cursor: completing ? 'not-allowed' : 'pointer',
                  border: 'none'
                }}
              >
                {completing ? 'جاري التسليم...' : '✓ تأكيد التسليم وإصدار الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELAYED DEPOSIT MODAL ═══════════════════════════════════════════════ */}
      {showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-subtle, #e2e8f0)', width: '420px', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover, #f8fafc)' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>تسجيل دفعة إضافية</h3>
              <button onClick={() => setShowPayment(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>المتبقي للطلب:</span>
                <span style={{ fontWeight: 900, color: '#f59e0b', fontSize: '18px', fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(showPayment.balance_due)} ر.س</span>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>طريقة الدفع</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {['cash', 'card', 'bank'].map(m => (
                    <button
                      key={m}
                      onClick={() => setPayMethod(m)}
                      style={{
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: payMethod === m ? '2px solid var(--color-primary, #6366f1)' : '1px solid var(--border-subtle, #e2e8f0)',
                        background: payMethod === m ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-hover, #f8fafc)',
                        color: payMethod === m ? '#fff' : 'var(--text-muted, #64748b)',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {m === 'cash' ? 'نقدي' : m === 'card' ? 'بطاقة' : 'تحويل'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>المبلغ المحصل (ر.س)</label>
                <input 
                  type="number" 
                  id="delayedDepositInput"
                  defaultValue={showPayment.balance_due}
                  max={showPayment.balance_due}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    background: 'var(--bg-hover, #f8fafc)',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 800,
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}
                />
              </div>

              <button
                onClick={async () => {
                  const amt = document.getElementById('delayedDepositInput').value;
                  if (!amt || amt <= 0 || amt > showPayment.balance_due) {
                    showToast?.({ type: 'error', message: 'يرجى إدخال مبلغ صحيح' });
                    return;
                  }
                  setCompleting(true);
                  try {
                    await window.api?.tailor?.addPayment?.({
                      order_id: showPayment.id,
                      amount_paid: parseFloat(amt),
                      payment_method: payMethod === 'cash' ? 'Cash' : 'Bank'
                    });
                    showToast?.({ type: 'success', message: 'تم تسجيل الدفعة بنجاح' });
                    setShowPayment(null);
                    fetchOrders();
                  } catch (e) {
                    showToast?.({ type: 'error', message: e.message });
                  } finally {
                    setCompleting(false);
                  }
                }}
                disabled={completing}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  borderRadius: '10px',
                  background: 'var(--color-primary, #6366f1)',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {completing ? 'جاري الحفظ...' : 'تأكيد تسجيل الدفعة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
