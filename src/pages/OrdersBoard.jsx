import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MulamSubNav from '../components/mulam/MulamSubNav';
import { useToast } from '../components/ToastManager';
import { 
  Scissors, 
  Layers, 
  Sparkles, 
  Search, 
  Flame, 
  CheckCircle2, 
  Factory, 
  RefreshCw, 
  User, 
  Ruler, 
  Undo2, 
  Check, 
  Zap, 
  Clock, 
  Calendar, 
  MessageCircle, 
  PackageCheck, 
  AlertTriangle, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  X,
  Plus,
  Printer,
  Send,
  ChevronDown,
  ChevronUp,
  Tag,
  LayoutGrid,
  ListFilter,
  ArrowRight,
  TrendingUp,
  Barcode
} from 'lucide-react';
import TailorPrintModal from '../components/mulam/TailorPrintModal';
import TailorWhatsAppModal from '../components/mulam/TailorWhatsAppModal';
import GarmentLabelModal from '../components/mulam/GarmentLabelModal';
import HandoverSettlementModal from '../components/mulam/HandoverSettlementModal';
import WorkshopBarcodeStationModal from '../components/WorkshopBarcodeStationModal';

// ── Production Stages Configuration ──────────────────────────────────────────
const STAGES = [
  { id: 'cutting',   label: 'قص وتفصيل',  shortLabel: 'قص',      color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6' },
  { id: 'stitching', label: 'خياطة وتركيب', shortLabel: 'خياطة',   color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: '#8b5cf6' },
  { id: 'finishing', label: 'تشطيب وتطريز', shortLabel: 'تشطيب',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b' },
  { id: 'qc',        label: 'فحص الجودة',   shortLabel: 'فحص',     color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', border: '#06b6d4' },
  { id: 'ironing',   label: 'كوي وتجهيز',   shortLabel: 'كوي',     color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: '#ec4899' },
  { id: 'ready',     label: 'جاهز للتسليم', shortLabel: 'جاهز',    color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981' },
];

// ── Streamlined Workshop Stations (Consolidated Pipeline for Zero Clutter) ──
// Voice of 100 Mu'allams & 100 Business Owners: 4 core physical workstations
const STREAMLINED_STATIONS = [
  {
    id: 'station_cutting',
    label: 'قص وتفصيل',
    shortLabel: 'قص',
    stageIds: ['cutting'],
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: '#2563eb',
    icon: Scissors,
    desc: 'طاولة القصاص وتجهيز القماش',
    nextStageId: 'stitching',
    nextLabel: 'خياطة'
  },
  {
    id: 'station_stitching',
    label: 'خياطة وتركيب',
    shortLabel: 'خياطة',
    stageIds: ['stitching'],
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    border: '#7c3aed',
    icon: Layers,
    desc: 'ماكينات الخياطة وتجميع الأجزاء',
    nextStageId: 'finishing',
    nextLabel: 'تشطيب/كوي'
  },
  {
    id: 'station_finishing',
    label: 'تشطيب، كوي وفحص QC',
    shortLabel: 'تشطيب/كوي',
    stageIds: ['finishing', 'qc', 'ironing'],
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: '#d97706',
    icon: Sparkles,
    desc: 'تطريز الأزرار، الكوي بالبخار والتكييس',
    nextStageId: 'ready',
    nextLabel: 'جاهز للتسليم'
  },
  {
    id: 'station_ready',
    label: 'جاهز للتسليم',
    shortLabel: 'جاهز',
    stageIds: ['ready'],
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: '#059669',
    icon: CheckCircle2,
    desc: 'في انتظار استلام العميل والمخالصة المالية',
    nextStageId: null,
    nextLabel: null
  }
];

function StageIcon({ stage, size = 16, color = 'currentColor' }) {
  switch (stage) {
    case 'cutting': return <Scissors size={size} color={color} />;
    case 'stitching': return <Layers size={size} color={color} />;
    case 'finishing': return <Sparkles size={size} color={color} />;
    case 'qc': return <Search size={size} color={color} />;
    case 'ironing': return <Flame size={size} color={color} />;
    case 'ready': return <CheckCircle2 size={size} color={color} />;
    default: return <CheckCircle2 size={size} color={color} />;
  }
}

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

function getDaysRemaining(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function OrdersBoard() {
  const navigate = useNavigate();
  const { showToast } = useToast?.() ?? { showToast: (m) => console.log(m) };

  const [orders, setOrders] = useState([]);
  const [garmentMap, setGarmentMap] = useState({}); // orderId → garments[]
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null); // garment_id or 'batch-orderId'
  
  // Handover & Settlement Modal State (Fix for receipt printing bug)
  const [handoverOrder, setHandoverOrder] = useState(null);

  // Quick Payment Modal
  const [showPayment, setShowPayment] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [addingPayment, setAddingPayment] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, urgent, ready, overdue
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [pipelineMode, setPipelineMode] = useState('streamlined'); // 'streamlined' (4 core stations) | 'detailed' (6 micro-stages)

  // Expandable garments state (orderId -> boolean)
  const [expandedOrders, setExpandedOrders] = useState({});

  // Modals for Work Order, WhatsApp & Garment Labels
  const [printModalOrder, setPrintModalOrder] = useState(null);
  const [whatsAppModalOrder, setWhatsAppModalOrder] = useState(null);
  const [labelModalOrder, setLabelModalOrder] = useState(null);
  const [showBarcodeStation, setShowBarcodeStation] = useState(false);

  const [settings, setSettings] = useState({});

  useEffect(() => {
    window.api?.getSettings?.().then(s => { if (s) setSettings(s); });
  }, []);

  const buildPrintPayload = useCallback((order) => {
    const garments = garmentMap[order.id] || [];
    return {
      ...order,
      orderId: order.id,
      invoiceNumber: order.id,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone
      },
      deliveryDate: order.target_delivery_date,
      isUrgent: order.is_urgent,
      notes: order.notes,
      total: order.total_amount,
      paid: order.advance_payment || order.deposit_paid || order.paid_amount,
      balance: order.balance_due,
      items: garments.map(g => ({
        id: g.id,
        garment_type: g.garment_type,
        fabric_id: g.fabric_id,
        fabric_name: g.fabric_name,
        fabric_meters: g.fabric_meters,
        is_client_fabric: g.is_client_fabric,
        price: g.total_price,
        measurements: g.measurements || {},
        collar: g.collar,
        cuff: g.cuff,
        pocket: g.pocket,
        tailor_name: g.tailor_name,
        cutter_name: g.cutter_name,
        notes: g.notes
      }))
    };
  }, [garmentMap]);

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

  // ── Global Hotkeys for Workshop Board ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      if (e.key === 'F1') {
        e.preventDefault();
        document.getElementById('orders-search-input')?.focus();
      } else if (e.key === 'F2' && !isInput) {
        e.preventDefault();
        setPipelineMode(prev => prev === 'streamlined' ? 'detailed' : 'streamlined');
      } else if (e.key === 'F3' && !showBarcodeStation) {
        e.preventDefault();
        setShowBarcodeStation(true);
      } else if ((e.key === 'b' || e.key === 'B') && !isInput && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        setShowBarcodeStation(prev => !prev);
      } else if (e.key === 'F5' && !isInput) {
        e.preventDefault();
        fetchOrders();
      } else if (e.key === 'Escape') {
        setShowBarcodeStation(false);
        setPrintModalOrder(null);
        setWhatsAppModalOrder(null);
        setLabelModalOrder(null);
        setHandoverOrder(null);
        setShowPayment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchOrders, showBarcodeStation]);

  // ── Barcode Hands-Free Advance Order Handler ─────────────────────────────
  const handleBarcodeAdvanceOrder = useCallback(async (orderId, forcedStation = null) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: 'الطلب غير موجود' };
    const garments = garmentMap[orderId] || [];
    if (garments.length === 0) return { success: false, error: 'لا توجد قطع مسجلة لهذا الطلب' };

    let targetStage;
    if (forcedStation) {
      targetStage = forcedStation === 'station_cutting' ? 'cutting' 
                  : forcedStation === 'station_stitching' ? 'stitching' 
                  : forcedStation === 'station_finishing' ? 'ironing' 
                  : forcedStation === 'station_ready' ? 'ready' 
                  : forcedStation;
    } else {
      let minIdx = STAGES.length;
      for (const g of garments) {
        const idx = STAGE_INDEX[g.production_stage] ?? 0;
        if (idx < minIdx) minIdx = idx;
      }
      if (minIdx >= STAGES.length - 1) {
        return { 
          success: true, 
          isReady: true, 
          actionText: `الطلب #${orderId} جاهز للتسليم بالفعل (${fmt(order.balance_due || 0)} ر.س متبقي)` 
        };
      }
      targetStage = STAGES[Math.min(minIdx + 1, STAGES.length - 1)]?.id || 'ready';
    }

    try {
      await Promise.all(
        garments.map(async (g) => {
          if (g.production_stage === 'ready' || g.production_stage === 'delivered') return;
          await window.api?.tailor?.updateStage?.({ garment_id: g.id, stage: targetStage });
        })
      );

      setGarmentMap(prev => {
        const next = { ...prev };
        if (next[orderId]) {
          next[orderId] = next[orderId].map(g => {
            if (g.production_stage === 'ready' || g.production_stage === 'delivered') return g;
            return { ...g, production_stage: targetStage };
          });
        }
        return next;
      });

      const stageObj = STAGES.find(s => s.id === targetStage);
      const stageLabel = stageObj?.label || targetStage;
      const isReady = targetStage === 'ready';

      return {
        success: true,
        isReady,
        actionText: `تمت ترقية جميع أثواب الطلب #${orderId} إلى محطة: ${stageLabel}`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [orders, garmentMap]);

  // ── Barcode Hands-Free Advance Single Garment Handler ─────────────────────
  const handleBarcodeAdvanceGarment = useCallback(async (garmentId, currentStage) => {
    const curIdx = STAGE_INDEX[currentStage] ?? 0;
    if (curIdx >= STAGES.length - 1) {
      return { success: false, error: 'القطعة في المرحلة النهائية بالفعل' };
    }
    const nextStageObj = STAGES[curIdx + 1];
    const targetStage = nextStageObj.id;

    try {
      await window.api?.tailor?.updateStage?.({ garment_id: garmentId, stage: targetStage });

      setGarmentMap(prev => {
        const next = { ...prev };
        for (const orderId of Object.keys(next)) {
          next[orderId] = next[orderId].map(g =>
            g.id === garmentId ? { ...g, production_stage: targetStage } : g
          );
        }
        return next;
      });

      return {
        success: true,
        nextStageLabel: nextStageObj.shortLabel || nextStageObj.label
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

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
      showToast?.({ type: 'success', message: 'تم تحديث مرحلة القطعة بنجاح' });
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
            if (g.production_stage === 'ready' || g.production_stage === 'delivered') return g;
            const currentIdx = STAGE_INDEX[g.production_stage] ?? 0;
            const nextStage = STAGES[Math.min(currentIdx + 1, STAGES.length - 1)].id;
            return { ...g, production_stage: nextStage };
          });
        }
        return next;
      });

      showToast?.({ type: 'success', message: `تمت ترقية طلب #${orderId} للمرحلة التالية بنجاح` });
    } catch (err) {
      showToast?.({ type: 'error', message: 'خطأ في الترقية: ' + err.message });
    } finally {
      setAdvancing(null);
    }
  };

  // ── Advance order to a specific target stage / station ────────────────────
  const handleAdvanceToTargetStage = async (orderId, targetStage) => {
    const garments = garmentMap[orderId] || [];
    const nonReady = garments.filter(g => g.production_stage !== 'ready' && g.production_stage !== 'delivered');
    if (nonReady.length === 0) return;

    setAdvancing(`batch-${orderId}`);
    try {
      await Promise.all(
        nonReady.map(g => {
          return window.api?.tailor?.updateStage?.({ garment_id: g.id, stage: targetStage });
        })
      );

      // Optimistic update
      setGarmentMap(prev => {
        const next = { ...prev };
        if (next[orderId]) {
          next[orderId] = next[orderId].map(g => {
            if (g.production_stage === 'ready' || g.production_stage === 'delivered') return g;
            return { ...g, production_stage: targetStage };
          });
        }
        return next;
      });

      showToast?.({ type: 'success', message: `تمت ترقية طلب #${orderId} بنجاح` });
    } catch (err) {
      showToast?.({ type: 'error', message: 'خطأ في الترقية: ' + err.message });
    } finally {
      setAdvancing(null);
    }
  };

  // ── Get Station for an Order in Streamlined 4-Station Mode ────────────────
  const getOrderStationId = useCallback((orderId) => {
    const earliestStage = getOrderBoardStage(orderId);
    if (earliestStage === 'cutting') return 'station_cutting';
    if (earliestStage === 'stitching') return 'station_stitching';
    if (earliestStage === 'ready' || earliestStage === 'delivered') return 'station_ready';
    return 'station_finishing'; // 'finishing', 'qc', 'ironing'
  }, [getOrderBoardStage]);

  // ── Add Payment handler ───────────────────────────────────────────────────
  const handleAddPaymentConfirm = async () => {
    if (!showPayment) return;
    setAddingPayment(true);
    try {
      const balance = Number(showPayment.balance_due || 0);
      const res = await window.api?.addPayment?.({
        sale_id: showPayment.id,
        amount: balance,
        payment_method: payMethod
      });
      if (res && res.success === false) throw new Error(res?.error || 'فشل تسجيل الدفعة');

      showToast?.({ type: 'success', message: 'تم تسجيل الدفعة وإيداعها في الصندوق' });
      setShowPayment(null);
      fetchOrders();
    } catch (e) {
      showToast?.({ type: 'error', message: e.message });
    } finally {
      setAddingPayment(false);
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

  // ── Analytics & Metrics (Voice of the 100 Business Owners) ────────────────
  const pipelineMetrics = useMemo(() => {
    let totalGarments = 0;
    const stageGarments = { cutting: 0, stitching: 0, finishing: 0, qc: 0, ironing: 0, ready: 0 };
    let urgentOrders = 0;
    let overdueOrders = 0;
    let readyOrders = 0;
    let pendingBalance = 0;

    orders.forEach(o => {
      const gList = garmentMap[o.id] || [];
      totalGarments += gList.length;
      gList.forEach(g => {
        if (stageGarments[g.production_stage] !== undefined) {
          stageGarments[g.production_stage]++;
        }
      });
      if (o.is_urgent) urgentOrders++;
      if (isOverdue(o)) overdueOrders++;
      if (getOrderBoardStage(o.id) === 'ready') readyOrders++;
      pendingBalance += Number(o.balance_due || 0);
    });

    return {
      totalGarments,
      stageGarments,
      urgentOrders,
      overdueOrders,
      readyOrders,
      pendingBalance
    };
  }, [orders, garmentMap, getOrderBoardStage]);

  // ── Filtered Orders ───────────────────────────────────────────────────────
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

  // ── WhatsApp Notification to Customer ────────────────────────────────────
  const sendWhatsAppReady = (order) => {
    if (!order.customer_phone) {
      showToast?.({ type: 'error', message: 'لا يوجد رقم هاتف مسجل للعميل' });
      return;
    }
    const clean = order.customer_phone.replace(/\D/g, '');
    const intlPhone = clean.startsWith('0') ? '966' + clean.slice(1) : clean.startsWith('966') ? clean : '966' + clean;
    const balanceText = Number(order.balance_due) > 0 ? `المبلغ المتبقي عند الاستلام: ${fmt(order.balance_due)} ر.س.` : 'تم سداد الحساب بالكامل.';
    const msg = `مرحباً ${order.customer_name || 'عميلنا العزيز'}، ثيابكم للطلب رقم #${order.id} أصبحت جاهزة تماماً للاستلام من المشغل.\n${balanceText}\nأهلاً وسهلاً بكم في أي وقت.`;
    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  return (
    <div 
      dir="rtl" 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-app, #f8fafc)',
        color: 'var(--text-main, #0f172a)',
        fontFamily: "'Cairo', 'Tajawal', sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* ── Sub Navigation Rail ────────────────────────────────────────────── */}
      <MulamSubNav
        activeTab="board"
        counters={{ activeOrders: orders.length }}
      />

      {/* ── Workshop Command Ribbon & Real-Time Performance Analytics ────── */}
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          padding: '12px 20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Title & Live Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--color-primary, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Factory size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>مسار تصنيع الأثواب والمعمل</span>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  تحديث حي
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                {orders.length} طلب نشط • {pipelineMetrics.totalGarments} ثوب قيد التصنيع
              </div>
            </div>
          </div>

          {/* Real-time Workshop KPIs (Voice of 100 Business Owners & Mu'allams) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '11px',
                fontWeight: 800,
                color: '#2563eb'
              }}
            >
              <Scissors size={14} />
              <span>قص: {pipelineMetrics.stageGarments.cutting}</span>
            </div>

            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                fontSize: '11px',
                fontWeight: 800,
                color: '#7c3aed'
              }}
            >
              <Layers size={14} />
              <span>خياطة: {pipelineMetrics.stageGarments.stitching}</span>
            </div>

            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                fontSize: '11px',
                fontWeight: 800,
                color: '#0891b2'
              }}
            >
              <Sparkles size={14} />
              <span>تشطيب/كوي: {pipelineMetrics.stageGarments.finishing + pipelineMetrics.stageGarments.qc + pipelineMetrics.stageGarments.ironing}</span>
            </div>

            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '11px',
                fontWeight: 900,
                color: '#059669'
              }}
            >
              <CheckCircle2 size={14} />
              <span>جاهز للتسليم: {pipelineMetrics.stageGarments.ready}</span>
            </div>

            {pipelineMetrics.urgentOrders > 0 && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  fontSize: '11px',
                  fontWeight: 900,
                  color: '#d97706'
                }}
              >
                <Zap size={13} />
                <span>{pipelineMetrics.urgentOrders} مستعجل</span>
              </div>
            )}

            {pipelineMetrics.overdueOrders > 0 && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontSize: '11px',
                  fontWeight: 900,
                  color: '#dc2626'
                }}
              >
                <AlertTriangle size={13} />
                <span>{pipelineMetrics.overdueOrders} متأخر</span>
              </div>
            )}
          </div>

          {/* Quick Actions & Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowBarcodeStation(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                minHeight: '40px',
                padding: '0 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
              title="فتح محطة المسح الضوئي للمعمل بدون لمس الشاشة [F3]"
            >
              <Barcode size={16} />
              <span>محطة المسح بالباركود</span>
              <kbd style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}>F3</kbd>
            </button>
            <button
              onClick={() => navigate('/pos')}
              style={{
                background: 'var(--color-primary, #6366f1)',
                color: '#ffffff',
                border: 'none',
                minHeight: '40px',
                padding: '0 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} />
              <span>تفصيل طلب جديد</span>
            </button>
          </div>

        </div>

        {/* Filter & View Switcher Bar */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '340px' }}>
            <input
              id="orders-search-input"
              type="text"
              placeholder="ابحث باسم العميل، الجوال أو رقم الطلب... [F1]"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-hover, #f8fafc)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            {searchQuery ? (
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
                  color: '#94a3b8'
                }}
              >
                <X size={14} />
              </button>
            ) : (
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-hover, #f8fafc)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
            {[
              { id: 'all', label: `جميع الطلبات (${orders.length})` },
              { id: 'ready', label: `جاهز للتسليم (${pipelineMetrics.readyOrders})` },
              { id: 'urgent', label: `مستعجل (${pipelineMetrics.urgentOrders})` },
              { id: 'overdue', label: `متأخر (${pipelineMetrics.overdueOrders})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeFilter === f.id ? 'var(--color-primary, #6366f1)' : 'transparent',
                  color: activeFilter === f.id ? '#ffffff' : 'var(--text-muted, #64748b)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Pipeline Mode Toggle: 4 Stations vs 6 Stages (Voice of 100 Mu'allams & 100 Business Owners) */}
          <div style={{ display: 'flex', background: 'var(--bg-hover, #f8fafc)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
            <button
              type="button"
              onClick={() => setPipelineMode('streamlined')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: pipelineMode === 'streamlined' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: pipelineMode === 'streamlined' ? '#fff' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 800
              }}
              title="المسار المعملي السلس (4 محطات رئيسية بدون ازدحام)"
            >
              <Zap size={13} />
              <span>المسار السلس (4 محطات)</span>
            </button>
            <button
              type="button"
              onClick={() => setPipelineMode('detailed')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: pipelineMode === 'detailed' ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: pipelineMode === 'detailed' ? '#fff' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 800
              }}
              title="المسار التفصيلي الكامل (6 مراحل)"
            >
              <Layers size={13} />
              <span>المسار المفصل (6 مراحل)</span>
            </button>
          </div>

          {/* View Switcher (Kanban vs List) & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-hover, #f8fafc)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'kanban' ? 'var(--color-primary, #6366f1)' : 'transparent',
                  color: viewMode === 'kanban' ? '#fff' : 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 800
                }}
                title="عرض لوحة المراحل (Kanban)"
              >
                <LayoutGrid size={13} />
                <span>أعمدة المراحل</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--color-primary, #6366f1)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 800
                }}
                title="عرض قائمة الأولويات"
              >
                <ListFilter size={13} />
                <span>قائمة الأولويات</span>
              </button>
            </div>

            <button
              onClick={fetchOrders}
              style={{
                minHeight: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-muted, #64748b)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="تحديث البيانات لحظياً"
            >
              <RefreshCw size={13} />
              <span>تحديث</span>
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Pipeline Area ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
          جاري تحميل بيانات الورشة والمعمل...
        </div>
      ) : viewMode === 'kanban' ? (
        /* ══════════════════════════════════════════════════════════════════════
           VIEW 1: STREAMLINED KANBAN PIPELINE (Zero Clutter, High Ergonomics)
        ══════════════════════════════════════════════════════════════════════ */
        <div 
          style={{
            flex: 1,
            display: 'flex',
            gap: '14px',
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '16px 20px',
            alignItems: 'stretch'
          }}
        >
          {(pipelineMode === 'streamlined' ? STREAMLINED_STATIONS : STAGES).map((col) => {
            const isStreamlined = pipelineMode === 'streamlined';
            const stageOrders = isStreamlined
              ? filteredOrders.filter(o => col.stageIds.includes(getOrderBoardStage(o.id)))
              : filteredOrders.filter(o => getOrderBoardStage(o.id) === col.id);
            const IconComponent = isStreamlined ? col.icon : null;

            return (
              <div
                key={col.id}
                style={{
                  minWidth: isStreamlined ? '260px' : '310px',
                  maxWidth: isStreamlined ? 'none' : '320px',
                  flex: isStreamlined ? '1 1 0' : '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                }}
              >
                {/* Stage Header */}
                <div 
                  style={{
                    background: col.bg,
                    borderBottom: `2.5px solid ${col.border}`,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isStreamlined ? (
                      <IconComponent size={17} color={col.color} />
                    ) : (
                      <StageIcon stage={col.id} size={17} color={col.color} />
                    )}
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: col.color, lineHeight: 1.2 }}>
                        {col.label}
                      </div>
                      {isStreamlined && col.desc && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginTop: '2px' }}>
                          {col.desc}
                        </div>
                      )}
                    </div>
                  </div>
                  <span 
                    style={{
                      background: col.color,
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
                    }}
                  >
                    {stageOrders.length}
                  </span>
                </div>

                {/* Stage Orders Container */}
                <div 
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {stageOrders.length === 0 && (
                    <div 
                      style={{
                        textAlign: 'center',
                        padding: '36px 16px',
                        color: 'var(--text-muted, #64748b)',
                        border: '2px dashed var(--border-subtle, #e2e8f0)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      لا توجد أثواب في {isStreamlined ? 'محطة' : 'مرحلة'} {col.label}
                    </div>
                  )}

                  {stageOrders.map(order => {
                    const garments = garmentMap[order.id] || [];
                    const overdue = isOverdue(order);
                    const daysRemaining = getDaysRemaining(order.target_delivery_date);
                    const totalGarments = garments.length;
                    const readyGarments = garments.filter(g => g.production_stage === 'ready' || g.production_stage === 'delivered').length;
                    const progressPercent = totalGarments > 0 ? Math.round((readyGarments / totalGarments) * 100) : 0;
                    const allReady = totalGarments > 0 && readyGarments === totalGarments;
                    const isBatchAdvancing = advancing === `batch-${order.id}`;
                    const isExpanded = Boolean(expandedOrders[order.id]);

                    // Determine next stage for this order in detailed mode
                    const currentStageIdx = STAGES.findIndex(s => s.id === col.id);
                    const nextStageObj = currentStageIdx < STAGES.length - 1 ? STAGES[currentStageIdx + 1] : null;

                    return (
                      <div
                        key={order.id}
                        style={{
                          background: 'var(--bg-card, #ffffff)',
                          border: overdue ? '1.5px solid #ef4444' : order.is_urgent ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle, #e2e8f0)',
                          borderRight: overdue ? '4px solid #ef4444' : order.is_urgent ? '4px solid #f59e0b' : `4px solid ${col.color}`,
                          borderRadius: '12px',
                          padding: '12px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* 1. Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>
                              {order.customer_name}
                            </div>
                            {order.customer_phone && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }} dir="ltr">
                                {order.customer_phone}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                            <span 
                              style={{
                                fontSize: '11px',
                                fontWeight: 900,
                                color: 'var(--color-primary, #6366f1)',
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'rgba(99,102,241,0.08)',
                                padding: '2px 7px',
                                borderRadius: '5px'
                              }}
                            >
                              #{order.id}
                            </span>
                            {order.is_urgent && (
                              <span style={{ fontSize: '10px', fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Zap size={10} />
                                <span>مستعجل</span>
                              </span>
                            )}
                            {overdue && (
                              <span style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <AlertTriangle size={10} />
                                <span>متأخر</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Garments Summary Chip & Slim Progress Bar */}
                        <div 
                          style={{
                            background: 'var(--bg-hover, #f8fafc)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>
                              الأثواب: {totalGarments} قطعة ({garments.map(g => g.garment_type).slice(0, 2).join('، ')}{totalGarments > 2 ? '...' : ''})
                            </span>
                            <span style={{ color: allReady ? '#10b981' : '#f59e0b', fontWeight: 800 }}>
                              {progressPercent}%
                            </span>
                          </div>
                          {/* Mini Progress Track */}
                          <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div 
                              style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                background: allReady ? '#10b981' : 'var(--color-primary, #6366f1)',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>

                        {/* 3. Delivery Timing & Financial Balance */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            <span>{timeInStage(order.order_date)} في المعمل</span>
                          </span>

                          {daysRemaining !== null && (
                            <span 
                              style={{
                                fontWeight: 800,
                                color: overdue ? '#ef4444' : daysRemaining <= 1 ? '#f59e0b' : 'var(--text-muted, #64748b)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Calendar size={11} />
                              <span>{overdue ? 'فات الموعد' : daysRemaining === 0 ? 'اليوم' : `خلال ${daysRemaining} يوم`}</span>
                            </span>
                          )}
                        </div>

                        {Number(order.balance_due) > 0 && (
                          <div 
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'rgba(239, 68, 68, 0.06)',
                              border: '1px solid rgba(239, 68, 68, 0.18)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px'
                            }}
                          >
                            <span style={{ color: '#dc2626', fontWeight: 800 }}>
                              المتبقي: {fmt(order.balance_due)} ر.س
                            </span>
                            <button
                              type="button"
                              onClick={() => { setShowPayment(order); setPayMethod('cash'); }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#dc2626',
                                fontWeight: 900,
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              + سداد دفعة
                            </button>
                          </div>
                        )}

                        {/* 4. THE GOLDEN PATH: Smart Primary Action Button */}
                        {allReady || (isStreamlined && col.id === 'station_ready') ? (
                          /* Order is completely ready: Handover & Receipt Settlement Button */
                          <button
                            type="button"
                            onClick={() => setHandoverOrder(order)}
                            style={{
                              width: '100%',
                              minHeight: '42px',
                              borderRadius: '8px',
                              background: '#10b981',
                              color: '#ffffff',
                              fontWeight: 900,
                              fontSize: '13px',
                              cursor: 'pointer',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            <PackageCheck size={16} />
                            <span>تسليم للعميل وطباعة السند 🧾</span>
                          </button>
                        ) : isStreamlined && col.nextStageId ? (
                          /* Streamlined 4-Station: 1-Tap Advance to Next Station */
                          <button
                            type="button"
                            onClick={() => handleAdvanceToTargetStage(order.id, col.nextStageId)}
                            disabled={isBatchAdvancing}
                            style={{
                              width: '100%',
                              minHeight: '40px',
                              borderRadius: '8px',
                              background: 'var(--color-primary, #6366f1)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              cursor: isBatchAdvancing ? 'not-allowed' : 'pointer',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              opacity: isBatchAdvancing ? 0.7 : 1
                            }}
                          >
                            <ArrowRight size={14} />
                            <span>{isBatchAdvancing ? 'جاري الترقية...' : `ترقية إلى ${col.nextLabel} ⇦`}</span>
                          </button>
                        ) : !isStreamlined && nextStageObj ? (
                          /* Detailed 6-Stage: 1-Tap Advance to Next Micro-Stage */
                          <button
                            type="button"
                            onClick={() => handleBatchAdvance(order.id)}
                            disabled={isBatchAdvancing}
                            style={{
                              width: '100%',
                              minHeight: '40px',
                              borderRadius: '8px',
                              background: 'var(--color-primary, #6366f1)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '12px',
                              cursor: isBatchAdvancing ? 'not-allowed' : 'pointer',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              opacity: isBatchAdvancing ? 0.7 : 1
                            }}
                          >
                            <ArrowRight size={14} />
                            <span>{isBatchAdvancing ? 'جاري الترقية...' : `ترقية إلى ${nextStageObj.shortLabel} ⇦`}</span>
                          </button>
                        ) : null}

                        {/* 5. Utility Quick-Action Bar */}
                        <div 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                            paddingTop: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {/* Print Work Order A4 */}
                            <button
                              type="button"
                              onClick={() => setPrintModalOrder(buildPrintPayload(order))}
                              title="طباعة كرت العمل A4 للمعمل"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-hover, #f8fafc)',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                color: 'var(--text-muted, #64748b)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <Printer size={12} />
                              <span>كرت</span>
                            </button>

                            {/* WhatsApp with Tailor */}
                            <button
                              type="button"
                              onClick={() => setWhatsAppModalOrder(buildPrintPayload(order))}
                              title="مشاركة تفاصيل المقاسات مع الخياط عبر واتساب"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#10b981',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <Send size={12} />
                              <span>الخياط</span>
                            </button>

                            {/* Garment Thermal Labels */}
                            <button
                              type="button"
                              onClick={() => setLabelModalOrder(buildPrintPayload(order))}
                              title="طباعة ملصقات الباركود المقاومة للغسيل"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-hover, #f8fafc)',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                color: 'var(--text-muted, #64748b)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <Tag size={12} />
                              <span>ملصقات</span>
                            </button>

                            {/* Ready WhatsApp to Customer */}
                            {allReady && order.customer_phone && (
                              <button
                                type="button"
                                onClick={() => sendWhatsAppReady(order)}
                                title="إرسال إشعار جاهزية الثياب للعميل"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(37, 211, 102, 0.12)',
                                  border: '1px solid rgba(37, 211, 102, 0.4)',
                                  color: '#16a34a',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '11px',
                                  fontWeight: 800
                                }}
                              >
                                <MessageCircle size={12} />
                                <span>إشعار</span>
                              </button>
                            )}
                          </div>

                          {/* Expand Details Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleOrderExpand(order.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted, #64748b)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <span>{isExpanded ? 'طي' : 'الأثواب'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>

                        {/* 6. Expandable Garments Drawer (Only on demand) */}
                        {isExpanded && (
                          <div 
                            style={{
                              marginTop: '6px',
                              paddingTop: '8px',
                              borderTop: '1px dashed var(--border-subtle, #e2e8f0)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            {garments.map((g, idx) => {
                              const gStageIdx = STAGE_INDEX[g.production_stage] ?? 0;
                              const gNext = STAGES[Math.min(gStageIdx + 1, STAGES.length - 1)];
                              const gPrev = gStageIdx > 0 ? STAGES[gStageIdx - 1] : null;
                              const isGReady = g.production_stage === 'ready' || g.production_stage === 'delivered';

                              return (
                                <div
                                  key={g.id || idx}
                                  style={{
                                    background: 'var(--bg-hover, #f8fafc)',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    border: '1px solid var(--border-subtle, #e2e8f0)',
                                    fontSize: '11px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '4px' }}>
                                    <span>{g.garment_type || 'ثوب'}</span>
                                    <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{g.fabric_name || 'قماش عميل'}</span>
                                  </div>

                                  {(g.tailor_name || g.cutter_name) && (
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', fontSize: '10px' }}>
                                      {g.tailor_name && (
                                        <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <User size={10} />
                                          <span>{g.tailor_name}</span>
                                        </span>
                                      )}
                                      {g.cutter_name && (
                                        <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <Ruler size={10} />
                                          <span>{g.cutter_name}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {!isGReady ? (
                                      <>
                                        {gNext && (
                                          <button
                                            type="button"
                                            onClick={() => handleStageChange(g.id, gNext.id)}
                                            disabled={advancing === g.id}
                                            style={{
                                              flex: 2,
                                              minHeight: '30px',
                                              borderRadius: '5px',
                                              background: 'var(--color-primary, #6366f1)',
                                              color: '#fff',
                                              border: 'none',
                                              fontWeight: 800,
                                              fontSize: '11px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <span>{advancing === g.id ? '...' : `نقل إلى ${gNext.shortLabel} ⇦`}</span>
                                          </button>
                                        )}
                                        {gPrev && (
                                          <button
                                            type="button"
                                            onClick={() => handleStageChange(g.id, gPrev.id)}
                                            disabled={advancing === g.id}
                                            style={{
                                              flex: 1,
                                              minHeight: '30px',
                                              borderRadius: '5px',
                                              background: '#fff',
                                              border: '1px solid var(--border-subtle, #e2e8f0)',
                                              color: 'var(--text-muted, #64748b)',
                                              fontWeight: 700,
                                              fontSize: '10px',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '2px'
                                            }}
                                          >
                                            <Undo2 size={11} />
                                            <span>رجوع</span>
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <div style={{ color: '#10b981', fontWeight: 800, fontSize: '11px', textAlign: 'center', width: '100%' }}>
                                        ✓ القطعة جاهزة تماماً
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
           VIEW 2: PRIORITY LIST & WORKSHOP MATRIX VIEW
        ══════════════════════════════════════════════════════════════════════ */
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div 
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>
                  <th style={{ padding: '12px 16px' }}>رقم الطلب والعميل</th>
                  <th style={{ padding: '12px 16px' }}>الأثواب والأقمشة</th>
                  <th style={{ padding: '12px 16px' }}>المرحلة الحالية</th>
                  <th style={{ padding: '12px 16px' }}>نسبة الإنجاز</th>
                  <th style={{ padding: '12px 16px' }}>موعد التسليم</th>
                  <th style={{ padding: '12px 16px' }}>الحساب المالي</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>الإجراء الفوري</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #64748b)' }}>
                      لا توجد طلبات مطابقة لمعايير البحث الحالية
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => {
                    const garments = garmentMap[order.id] || [];
                    const currentStageId = getOrderBoardStage(order.id);
                    const stageObj = STAGES.find(s => s.id === currentStageId) || STAGES[0];
                    const overdue = isOverdue(order);
                    const readyCount = garments.filter(g => g.production_stage === 'ready' || g.production_stage === 'delivered').length;
                    const progress = garments.length > 0 ? Math.round((readyCount / garments.length) * 100) : 0;
                    const allReady = garments.length > 0 && readyCount === garments.length;
                    const nextStageIdx = STAGE_INDEX[currentStageId] + 1;
                    const nextStageObj = nextStageIdx < STAGES.length ? STAGES[nextStageIdx] : null;

                    return (
                      <tr 
                        key={order.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                          background: overdue ? 'rgba(239, 68, 68, 0.02)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 900, color: 'var(--color-primary, #6366f1)' }}>
                              #{order.id}
                            </span>
                            <span style={{ fontWeight: 800 }}>{order.customer_name}</span>
                            {order.is_urgent && (
                              <span style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>
                                مستعجل
                              </span>
                            )}
                          </div>
                          {order.customer_phone && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }} dir="ltr">
                              {order.customer_phone}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700 }}>{garments.length} قطع</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                            {garments.map(g => g.fabric_name || 'قماش عميل').slice(0, 2).join('، ')}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span 
                            style={{
                              background: stageObj.bg,
                              color: stageObj.color,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <StageIcon stage={stageObj.id} size={12} color={stageObj.color} />
                            <span>{stageObj.label}</span>
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '120px' }}>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: allReady ? '#10b981' : 'var(--color-primary, #6366f1)' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 800 }}>{progress}%</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: overdue ? '#ef4444' : 'inherit' }}>
                            {order.target_delivery_date ? new Date(order.target_delivery_date).toLocaleDateString('ar-SA') : 'غير محدد'}
                          </div>
                          {overdue && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 800 }}>متأخر عن الموعد!</span>}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div>إجمالي: {fmt(order.total_amount)} ر.س</div>
                          {Number(order.balance_due) > 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '11px' }}>
                              متبقي: {fmt(order.balance_due)} ر.س
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '11px' }}>
                              خالص بالكامل
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {allReady ? (
                            <button
                              type="button"
                              onClick={() => setHandoverOrder(order)}
                              style={{
                                minHeight: '38px',
                                padding: '0 14px',
                                borderRadius: '8px',
                                background: '#10b981',
                                color: '#fff',
                                fontWeight: 900,
                                fontSize: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <PackageCheck size={14} />
                              <span>تسليم وطباعة 🧾</span>
                            </button>
                          ) : nextStageObj ? (
                            <button
                              type="button"
                              onClick={() => handleBatchAdvance(order.id)}
                              disabled={advancing === `batch-${order.id}`}
                              style={{
                                minHeight: '36px',
                                padding: '0 12px',
                                borderRadius: '8px',
                                background: 'var(--color-primary, #6366f1)',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '11px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <ArrowRight size={13} />
                              <span>ترقية إلى {nextStageObj.shortLabel}</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Handover & Clearance Settlement Modal (Receipt Printing Bug Fix) ── */}
      <HandoverSettlementModal
        isOpen={Boolean(handoverOrder)}
        onClose={() => setHandoverOrder(null)}
        order={handoverOrder}
        garments={handoverOrder ? (garmentMap[handoverOrder.id] || []) : []}
        settings={settings}
        onCompleteSuccess={(completedOrderId) => {
          showToast?.({ type: 'success', message: `تم تسليم طلب #${completedOrderId} وطباعة السند بنجاح` });
          fetchOrders();
        }}
      />

      {/* ── Delayed Deposit Modal ────────────────────────────────────────── */}
      {showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-subtle, #e2e8f0)', width: '420px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover, #f8fafc)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>تسجيل دفعة للطلب #{showPayment.id}</h3>
              <button onClick={() => setShowPayment(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>المتبقي للطلب:</span>
                <span style={{ fontWeight: 900, color: '#ef4444', fontSize: '18px', fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(showPayment.balance_due)} ر.س</span>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, fontSize: '12px', color: 'var(--text-main, #0f172a)' }}>طريقة التحصيل</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'cash', label: 'نقداً', Icon: Banknote },
                    { id: 'card', label: 'مدى', Icon: CreditCard },
                    { id: 'bank', label: 'تحويل', Icon: Smartphone }
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPayMethod(id)}
                      style={{
                        minHeight: '42px',
                        borderRadius: '10px',
                        border: payMethod === id ? '2px solid var(--color-primary, #6366f1)' : '1px solid var(--border-subtle, #e2e8f0)',
                        background: payMethod === id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-hover, #f8fafc)',
                        color: payMethod === id ? 'var(--color-primary, #6366f1)' : 'var(--text-muted, #64748b)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        fontSize: '12px'
                      }}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddPaymentConfirm}
                disabled={addingPayment}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '10px',
                  background: 'var(--color-primary, #6366f1)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '13px',
                  border: 'none',
                  cursor: addingPayment ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {addingPayment ? 'جاري التسجيل...' : 'تأكيد إيداع الدفعة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Work Order Print Modal (A4 Cut Sheet) ────────────────────────── */}
      {printModalOrder && (
        <TailorPrintModal
          isOpen={Boolean(printModalOrder)}
          onClose={() => setPrintModalOrder(null)}
          order={printModalOrder}
          settings={settings}
        />
      )}

      {/* ── WhatsApp Share Modal with Tailor ─────────────────────────────── */}
      {whatsAppModalOrder && (
        <TailorWhatsAppModal
          isOpen={Boolean(whatsAppModalOrder)}
          onClose={() => setWhatsAppModalOrder(null)}
          order={whatsAppModalOrder}
          settings={settings}
        />
      )}

      {/* ── Garment Thermal Barcode Labels Modal ─────────────────────────── */}
      {labelModalOrder && (
        <GarmentLabelModal
          isOpen={Boolean(labelModalOrder)}
          onClose={() => setLabelModalOrder(null)}
          order={labelModalOrder}
          garments={labelModalOrder.items || []}
          settings={settings}
        />
      )}

      {/* ── Hands-Free Barcode Scanner Station Modal ──────────────────────── */}
      <WorkshopBarcodeStationModal
        isOpen={showBarcodeStation}
        onClose={() => setShowBarcodeStation(false)}
        orders={orders}
        garmentMap={garmentMap}
        onAdvanceOrder={handleBarcodeAdvanceOrder}
        onAdvanceGarment={handleBarcodeAdvanceGarment}
        onOpenHandover={(order) => setHandoverOrder(order)}
        showToast={showToast}
      />

    </div>
  );
}
