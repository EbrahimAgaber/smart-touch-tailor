import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLicenseStore } from '../store/useLicenseStore';
import { CreditCard, Pause, ChefHat, Trash2, Edit3, X, Save, MessageSquare, Headphones, LayoutGrid, Table, Scissors, Ruler, Factory, ArrowRight } from 'lucide-react';
import QRCode from '../utils/qr-gen';
import TabularView from '../features/pos/components/TabularView';
import { playPaymentChime } from '../utils/audioFeedback';

// ── Category → Emoji mapping ───────────────────────────────────
const CATEGORY_ICONS = {
  'مشروبات':'🥤','شاي':'🍵','قهوة':'☕','عصير':'🍹',
  'وجبات':'🍽️','برغر':'🍔','بيتزا':'🍕','دجاج':'🍗','سمك':'🐟','بيض':'🥚',
  'حلويات':'🍰','كيك':'🎂','تمر':'🌴','بسكويت':'🍪',
  'خضار':'🥬','فاكهة':'🍎','لحوم':'🥩','ألبان':'🥛',
  'مخبوزات':'🥖','عيش':'🍞','بقالة':'🛒','سوبرماركت':'🏪',
  'ملابس':'👕','أحذية':'👟','إكسسوار':'💍',
  'أدوية':'💊','صيدلية':'🏥','مستلزمات طبية':'🩺',
  'إلكترونيات':'📱','كمبيوتر':'💻','كاميرا':'📷',
  'صالون':'✂️','سبا':'💆','خدمات':'🛎️',
  'عام':'📦', 'أخرى':'📦',
};

const getCategoryIcon = (cat, businessType) => {
  if (cat) {
    const lower = cat.toLowerCase();
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return icon;
    }
  }
  
  switch (businessType) {
    case 'restaurant': return '☕';
    case 'grocery': return '🛒';
    case 'pharmacy': return '💊';
    case 'clothing': return '👕';
    case 'electronics': return '📱';
    case 'salon': return '✂️';
    case 'services': return '🛎️';
    case 'retail': return '🛍️';
    default: return '📦';
  }
};

// ── Payment types ───────────────────────────────────────────────
const PAY_TYPES = (t) => [
  { value:'Cash',   label: t('pos.pay_types.cash') },
  { value:'Card',   label: t('pos.pay_types.card') },
  { value:'STC',    label: t('pos.pay_types.stc') },
  { value:'Credit', label: t('pos.pay_types.credit') },
];

// ── Order types ─────────────────────────────────────────────────
const ORDER_TYPES = (t) => [
  { value:'counter',  label: t('pos.order_types.counter') },
  { value:'service',  label: t('pos.order_types.service') },
  { value:'dineIn',   label: t('pos.order_types.dine_in') },
  { value:'takeaway', label: t('pos.order_types.takeaway') },
  { value:'delivery', label: t('pos.order_types.delivery') },
];

// ── FIX: Normalize a phone number to international format for wa.me ──
// Strips non-digits, then converts Saudi leading-zero format (05xxxxxxxx)
// to international format (966xxxxxxxxx). Falls back gracefully for
// numbers that already start with a country code.
const normalizeWhatsAppPhone = (raw = '') => {
  let digits = raw.replace(/\D/g, '');
  
  // Handle 00 prefix (e.g. 00966...)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Saudi domestic: 05xxxxxxxx -> 9665xxxxxxxx
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } 
  // Saudi domestic short: 5xxxxxxxx -> 9665xxxxxxxx
  else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  }
  // Saudi international with zero: 96605xxxxxxxx -> 9665xxxxxxxx
  else if (digits.startsWith('96605') && digits.length === 13) {
    digits = '966' + digits.slice(4);
  }
  return digits;
};

export default function Pos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuthStore();
  const { order, addItem, removeItem, updateQuantity, clearCart,
          subtotal, tax, total, setCustomerInfo, fetchPromotions, promoDiscount, appliedPromos,
          selectedCustomer, setSelectedCustomer, lastClearedCart, restoreClearedCart } = useCartStore();

  const [settings, setSettings]       = useState({});
  const [menu, setMenu]               = useState([]);
  const [activeCategory, setActiveCategory] = useState('__all__');
  const [search, setSearch]           = useState('');
  const [table, setTable] = useState(location.state?.tableName ? { id: location.state.tableId, name: location.state.tableName } : null);
  const isRestaurant = settings?.business_type === 'restaurant';
  const [customers, setCustomers]     = useState([]);
  const [custSearch, setCustSearch]   = useState('');
  const [showCustResults, setShowCustResults] = useState(false);
  const [showQuickCust, setShowQuickCust] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ name:'', phone:'', tax_id:'' });

  // POS flow modals
  const [showPayment, setShowPayment]   = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [showVoid, setShowVoid]         = useState(false);
  const [showMods, setShowMods]         = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [showSerial, setShowSerial]     = useState(false);
  const [showQuoteConfirm, setShowQuoteConfirm] = useState(false);
  const [lastQuote, setLastQuote]       = useState(null);
  const [serialInput, setSerialInput]   = useState('');
  const [modTarget, setModTarget]       = useState(null);
  const [selectedMods, setSelectedMods] = useState([]);
  const [readyCount, setReadyCount]     = useState(0);
  const [lastInvoice, setLastInvoice]   = useState(null);
  const [voidReason, setVoidReason]     = useState('');
  const [isShiftOpen, setIsShiftOpen]   = useState(true); // 1-F: Shift check
  const [stockOutItems, setStockOutItems] = useState([]); // 4-B: Stock-out tracking

  // Order config
  const [orderType, setOrderType]     = useState('counter');
  const [orderNote, setOrderNote]     = useState('');
  const [itemNotes, setItemNotes]     = useState({}); // idx → note
  const [editNoteIdx, setEditNoteIdx] = useState(null);

  // Payment
  const [payments, setPayments]         = useState([{ type:'Cash', amount:'' }]);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('none'); // 'none' | 'pct' | 'fixed'
  const [discountVal, setDiscountVal]   = useState('');
  const [invoiceType, setInvoiceType]   = useState('simplified'); // 'simplified' (B2C) | 'standard' (B2B)
  const [customerTaxId, setCustomerTaxId] = useState('');

  // Feature 5 & 6: Payment UX
  const [showAgreedOverride, setShowAgreedOverride] = useState(false);
  const [agreedTotalInput, setAgreedTotalInput]     = useState('');

  // Barcode
  const [barcode, setBarcode]       = useState('');
  const barcodeRef                  = useRef(null);
  const lastKeyTime                 = useRef(0);

  // Hold orders
  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeld, setShowHeld]     = useState(false);
  const pendingTailorOrderIdRef     = useRef(null);
  const pendingAlterationTicketIdRef = useRef(null);

  // WhatsApp Modal
  const [showWAModal, setShowWAModal] = useState(false);
  const [waPhone, setWAPhone]         = useState('');
  const [waMsg, setWAMsg]             = useState('');

  // View Mode Persisted
  const [viewMode, setViewMode]       = useState(() => localStorage.getItem('pos_view_mode') || 'grid');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg]       = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };
  
  useEffect(() => {
    localStorage.setItem('pos_view_mode', viewMode);
  }, [viewMode]);

  // ── Load data ──────────────────────────────────────────────────
  useEffect(() => {
    fetchPromotions();
    
    const api = window.api;
    if (api) {
      if (api.getMenu) api.getMenu().then(setMenu).catch(() => setMenu([]));
      if (api.getSettings) api.getSettings().then(setSettings).catch(() => {});
      if (api.getCustomers) api.getCustomers().then(setCustomers).catch(() => {});
      // 1-F: Check shift
      if (api.getOpenShift) api.getOpenShift().then(s => setIsShiftOpen(!!s)).catch(() => setIsShiftOpen(false));
    }
    
    const fetchHeld = () => {
      if (api && api.getHeldOrders) {
        api.getHeldOrders().then(data => {
          setHeldOrders(data || []);
          const ready = (data || []).filter(o => o.kds_status === 'ready').length;
          setReadyCount(ready);
        }).catch(() => {});
      }
    };

    fetchHeld();
    const interval = setInterval(fetchHeld, 15000); // 15s poll
    return () => clearInterval(interval);
  }, []);

  // ── Router Handoff Listener (Tailor POS, Alterations, Held Orders) ──
  useEffect(() => {
    if (!location.state) return;

    if (location.state?.tableId && window.api?.getTables) {
      window.api.getTables().then(all => {
        const t = (all || []).find(x => x.id === location.state.tableId);
        if (t) setTable(t);
      }).catch(() => {});
    }

    // Auto-resume a held order sent from the Services page
    if (location.state?.resumeHeld) {
      const held = location.state.resumeHeld;
      clearCart();
      for (const item of (held.items || [])) {
        addItem(item, item.Mods || []);
      }
      
      setOrderType('service');
      setOrderNote(held.note || held.label || '');
      
      if (!held.items || held.items.length === 0) {
        addItem({
          ID: 'service_' + (held.id || Date.now()),
          id: 'service_' + (held.id || Date.now()),
          Name: `تذكرة: ${held.label || 'صيانة عامة'}`,
          Price: parseFloat(held.final_price) || 0,
          Category: 'صيانة / خدمة',
          Barcode: held.id ? `TKT-${held.id}` : ''
        });
      }

      window.api?.deleteHeldOrder?.(held.id);
      navigate(location.pathname, { replace: true, state: {} });
    }

    // Mulam Tailor POS Handoff
    if (location.state?.tailorHandoff) {
      const th = location.state.tailorHandoff;
      if (th.orderId) {
        pendingTailorOrderIdRef.current = th.orderId;
      }
      clearCart();
      for (const item of (th.cartItems || [])) {
        addItem({
          ID: item.ID || item.id || `tailor_${Date.now()}_${Math.random()}`,
          id: item.ID || item.id || `tailor_${Date.now()}_${Math.random()}`,
          Name: item.Name || item.name || 'تفصيل ثوب',
          Price: parseFloat(item.Price || item.price || 0),
          Qty: item.Qty || item.qty || 1,
          Category: item.Category || 'خياطة',
          IsService: true
        }, []);
      }
      if (th.customer) setSelectedCustomer(th.customer);
      setOrderType('tailor');
      setOrderNote(th.orderNote || '');
      
      // Auto-open payment modal after items settle
      setTimeout(() => {
        if (th.depositSuggested > 0) {
          setPayments([{ type: 'Cash', amount: th.depositSuggested.toString() }]);
        }
        setShowPayment(true);
      }, 300);
      navigate(location.pathname, { replace: true, state: { tailor_order_id: th.orderId } });
    }

    // Alteration Handoff
    if (location.state?.alterationHandoff) {
      const ah = location.state.alterationHandoff;
      if (ah.ticketId) {
        pendingAlterationTicketIdRef.current = ah.ticketId;
      }
      clearCart();
      for (const item of (ah.cartItems || [])) {
        addItem({
          ID: item.ID || item.id || `alt_${Date.now()}_${Math.random()}`,
          id: item.ID || item.id || `alt_${Date.now()}_${Math.random()}`,
          Name: item.Name || item.name || 'تعديل ملابس',
          Price: parseFloat(item.Price || item.price || 0),
          Qty: item.Qty || item.qty || 1,
          Category: item.Category || 'تعديل',
          IsService: true
        }, []);
      }
      if (ah.customer) setSelectedCustomer(ah.customer);
      setOrderType('alteration');
      setOrderNote(ah.orderNote || '');
      setTimeout(() => setShowPayment(true), 300);
      navigate(location.pathname, { replace: true, state: { alteration_ticket_id: ah.ticketId } });
    }
  }, [location.state]);

  // ── Keyboard shortcuts are declared below to prevent initialization issues

  // ── Barcode detection (Enter key based for hardware scanners) ──
  const handleBarcodeChange = (e) => {
    const val = e.target.value;
    setBarcode(val);
    setSearch(val);
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter' && barcode) {
      if (!isShiftOpen) {
        alert(t('pos.alerts.shift_required'));
        return;
      }
      const item = menu.find(m => m.Barcode === barcode) || menu.find(m => m.Name.toLowerCase() === barcode.toLowerCase());
      if (item) { handleItemClick(item); }
      setBarcode(''); 
      setSearch('');
    }
  };

  // ── Derived ──────────────────────────────────────────────────────
  const vatRate   = parseFloat(settings.vat_rate || '0.15');
  const categories = ['__all__', ...Array.from(new Set(menu.map(m => m.Category || 'عام')))];

  const filteredRaw = menu.filter(m => {
    const catMatch = activeCategory === '__all__' || (m.Category || 'عام') === activeCategory;
    const searchMatch = !search || m.Name.toLowerCase().includes(search.toLowerCase())
                        || (m.Barcode && m.Barcode.includes(search));
    return catMatch && searchMatch;
  });

  const filtered = [];
  const groupMap = {};
  filteredRaw.forEach(item => {
    if (item.Name.includes('-')) {
      const baseName = item.Name.split('-')[0].trim();
      if (!groupMap[baseName]) {
        groupMap[baseName] = { ...item, ID: 'group_'+baseName, isVariantGroup: true, Name: baseName, variants: [] };
        filtered.push(groupMap[baseName]);
      }
      groupMap[baseName].variants.push({ ...item, Name: item.Name.replace(baseName+'-', '').trim() });
    } else {
      filtered.push(item);
    }
  });

  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i].isVariantGroup && filtered[i].variants.length === 1) {
      filtered[i] = filtered[i].variants[0];
    }
  }

  const manualDiscount = discountType === 'pct'
    ? (total * (parseFloat(discountVal) || 0) / 100)
    : discountType === 'fixed'
      ? Math.min(parseFloat(discountVal) || 0, total)
      : 0;
  const loyaltyDiscount = redeemPoints ? pointsDiscount : 0;
  const totalDiscount   = manualDiscount + loyaltyDiscount + (promoDiscount || 0);

  // Feature 6: Agreed total override — cashier enters inclusive-VAT agreed price
  const agreedOverrideVal = showAgreedOverride && parseFloat(agreedTotalInput) > 0
    ? Math.max(0, parseFloat(agreedTotalInput))
    : null;
  const finalTotal = agreedOverrideVal !== null
    ? agreedOverrideVal
    : Math.max(0, total - manualDiscount - loyaltyDiscount - (promoDiscount || 0));
  // Effective discount shown on receipt = original total minus final agreed amount
  const effectiveDiscount = agreedOverrideVal !== null
    ? Math.max(0, total - agreedOverrideVal)
    : totalDiscount;

  const paidAmount  = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining   = Math.max(0, finalTotal - paidAmount);
  const change      = Math.max(0, paidAmount - finalTotal);
  const hasCredit = payments.some(p => p.type === 'Credit');
  const isPartialAllowed = !!selectedCustomer;
  const canFinalize = finalTotal >= 0 && (remaining <= 0.005 || isPartialAllowed) && (order.length > 0) && !(hasCredit && !selectedCustomer);

  // ── Modifiers ───────────────────────────────────────────────────
  const handleItemClick = (item) => {
    if (!isShiftOpen) {
      alert(t('pos.alerts.shift_required'));
      return;
    }
    if (item.isVariantGroup) {
      setModTarget(item);
      setShowVariants(true);
      return;
    }
    if (item.Metadata?.requires_serial) {
      setModTarget(item);
      setSerialInput('');
      setShowSerial(true);
      return;
    }
    if (item.Modifiers && item.Modifiers.length > 0) {
      setModTarget(item);
      setSelectedMods([]);
      setShowMods(true);
    } else {
      addItem(item);
    }
  };

  const selectVariant = (variantItem) => {
    setShowVariants(false);
    handleItemClick(variantItem);
  };

  const confirmSerial = (e) => {
    e?.preventDefault();
    if (!serialInput.trim()) return alert(t('pos.alerts.serial_required'));
    addItem(modTarget, [], `SN: ${serialInput.trim()}`);
    setShowSerial(false);
    setModTarget(null);
    setSerialInput('');
  };

  const confirmMods = () => {
    const itemWithMods = { 
      ...modTarget, 
      Price: modTarget.Price + selectedMods.reduce((s, m) => s + (m.price || 0), 0),
      Mods: selectedMods 
    };
    addItem(itemWithMods, selectedMods);
    setShowMods(false);
    setModTarget(null);
  };

  // ── Actions ────────────────────────────────────────────────────
  const openPayment = () => {
    // Feature 5: Pre-fill with the current total so cashier doesn't need to type
    setPayments([{ type:'Cash', amount: total.toFixed(2) }]);
    setDiscountType('none');
    setDiscountVal('');
    setRedeemPoints(false);

    // FIX: Compute pointsDiscount using integer math to avoid floating-point
    // drift. Cap redemption at 50% of the current total so a customer cannot
    // zero out a purchase entirely with points.
    if (selectedCustomer) {
      const availablePoints = selectedCustomer.loyalty_points || 0;
      const maxByHalfTotal  = Math.floor((total * 0.5) / 0.1); // max points allowed (50% cap)
      const redeemablePoints = Math.min(availablePoints, maxByHalfTotal);
      // Use integer multiplication then divide — avoids 0.1 float imprecision
      const discountSAR = Math.round(redeemablePoints * 10) / 100; // points × 0.10 SAR
      setPointsDiscount(discountSAR);
    } else {
      setPointsDiscount(0);
    }

    if (selectedCustomer?.tax_id) {
      setCustomerTaxId(selectedCustomer.tax_id);
      setInvoiceType('standard');
    } else {
      setInvoiceType('simplified');
    }
    // Feature 6: reset agreed override on each new payment session
    setShowAgreedOverride(false);
    setAgreedTotalInput('');
    setShowPayment(true);
  };

  const finalizedStaffId = useAuthStore.getState().currentUser?.id || null;

  const finalizeSale = async () => {
    if (!canFinalize || isProcessing) return;
    setIsProcessing(true);

    // 1-F: Prevent sales if shift is not open
    if (!isShiftOpen) {
      alert(t('pos.alerts.shift_required'));
      setIsProcessing(false);
      navigate('/shift?action=open');
      return;
    }

    const api = window.api;
    if (!api || !api.saveSale) {
      alert("Error: Electron API missing.");
      setIsProcessing(false);
      return;
    }
    const prefix = settings.invoice_prefix || 'INV-';
    const invoiceNum = prefix + Date.now();

    // FIX: Calculate the exact integer points being redeemed here, so the
    // same value is passed to saveSale (for atomic DB write) and stored on
    // the invoice for potential void-reversal later.
    const redeemedPts = (redeemPoints && selectedCustomer)
      ? Math.round(loyaltyDiscount * 100) / 10   // SAR → integer points: (SAR / 0.1) = SAR * 10
      : 0;
    // Floor to nearest whole point to guard any residual float
    const redeemedPtsInt = Math.floor(redeemedPts);

    const sale = {
      invoice: invoiceNum,
      date: new Date().toISOString(),
      items: order.map(i => ({ ...i })),
      subtotal: finalTotal / (1 + vatRate),
      tax: finalTotal * vatRate / (1 + vatRate),
      total: finalTotal,
      discount: effectiveDiscount,
      discount_type: agreedOverrideVal !== null ? 'agreed_total' : (discountType !== 'none' ? discountType : null),
      payment: payments.filter(p => parseFloat(p.amount) > 0).map(p => p.type).join('+') || 'Cash',
      paid: paidAmount,
      change,
      paymentDetails: payments.filter(p => parseFloat(p.amount) > 0),
      customer_id: selectedCustomer?.id || null,
      staff_id: finalizedStaffId,
      order_type: orderType,
      note: orderNote,
      loyalty_points_redeemed: redeemedPtsInt,
      // Store agreed total flag for receipt rendering
      is_agreed_total: agreedOverrideVal !== null,
      add_change_to_store_credit: document.getElementById('addChangeToCredit')?.checked || false
    };

    try {
      const res = await api.saveSale(sale);
      
      if (res && res.success === false) {
        if (res.code === 'INSUFFICIENT_STOCK') {
          setStockOutItems(res.payload || []);
          setShowPayment(false);
          alert(`${t('pos.alerts.insufficient_stock')}\n${(res.payload || []).map(p => `• ${p.productName}`).join('\n')}`);
        } else {
          alert(`${t('pos.alerts.sale_error')} ` + (res.error || res.message || t('pos.alerts.unknown_error')));
        }
        setIsProcessing(false);
        return;
      }

      // FIX: Points are now deducted atomically inside saveSale on the backend.
      // The separate redeemLoyaltyPoints call has been removed to eliminate the
      // race-condition window and to ensure void can restore the exact points.

      if (table) {
        await api.updateTable({ id: table.id, status: 'available', current_order_id: null, name: table.name, zone: '', capacity: 0 });
        setTable(null);
      }

      // Mulam Pipeline Post-Sale Updates
      const activeTailorId = pendingTailorOrderIdRef.current || location.state?.tailor_order_id;
      if (activeTailorId) {
        const tStatus = paidAmount >= finalTotal ? 'confirmed' : 'pending';
        await api.tailor?.updateOrderStatus?.({
          order_id: activeTailorId,
          sale_invoice_id: res.invoice || invoiceNum,
          status: tStatus,
          paid_amount: paidAmount
        }).catch(console.error);
        
        pendingTailorOrderIdRef.current = null;
        window.history.replaceState({}, document.title);
      }
      
      const activeAltId = pendingAlterationTicketIdRef.current || location.state?.alteration_ticket_id;
      if (activeAltId) {
        await api.tailor?.updateAlterationStatus?.({
          ticket_id: activeAltId,
          status: 'delivered'
        }).catch(console.error);
        
        pendingAlterationTicketIdRef.current = null;
        window.history.replaceState({}, document.title);
      }

      setLastInvoice({ 
        ...sale, 
        invoice: res.invoice || invoiceNum, 
        saleId: res.saleId,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
        customer_id: selectedCustomer?.id,
        // FIX: persist invoiceType so receipt renders correct label
        invoiceType,
        customerTaxId,
      });
      setShowPayment(false);
      setShowSuccess(true);
      clearCart();
      setSelectedCustomer(null);
      setRedeemPoints(false);
      setDiscountVal('');
      setDiscountType('none');

      // Re-fetch customers so the loyalty points update in the search list
      api.getCustomers().then(setCustomers).catch(() => {});
      setOrderNote('');
      setItemNotes({});
      setStockOutItems([]);
      api.getHeldOrders?.().then(setHeldOrders).catch(() => {});
    } catch (err) {
      alert(`${t('pos.alerts.network_error')} ` + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeSaleQuickly = async (shouldPrint, forceWidth) => {
    if (order.length === 0 || isProcessing) return;
    setIsProcessing(true);

    if (!isShiftOpen) {
      alert(t('pos.alerts.shift_required'));
      setIsProcessing(false);
      navigate('/shift?action=open');
      return;
    }

    const api = window.api;
    if (!api || !api.saveSale) {
      alert("Error: Electron API missing.");
      setIsProcessing(false);
      return;
    }

    const prefix = settings.invoice_prefix || 'INV-';
    const invoiceNum = prefix + Date.now();
    const saleTotal = finalTotal;

    const sale = {
      invoice: invoiceNum,
      date: new Date().toISOString(),
      items: order.map(i => ({ ...i })),
      subtotal: saleTotal / (1 + vatRate),
      tax: saleTotal * vatRate / (1 + vatRate),
      total: saleTotal,
      discount: effectiveDiscount,
      discount_type: discountType !== 'none' ? discountType : null,
      payment: 'Cash',
      paid: saleTotal,
      change: 0,
      paymentDetails: [{ type: 'Cash', amount: saleTotal.toFixed(2) }],
      customer_id: selectedCustomer?.id || null,
      staff_id: finalizedStaffId,
      order_type: orderType,
      note: orderNote,
      loyalty_points_redeemed: 0,
      is_agreed_total: false
    };

    try {
      const res = await api.saveSale(sale);
      
      if (res && res.success === false) {
        if (res.code === 'INSUFFICIENT_STOCK') {
          setStockOutItems(res.payload || []);
          alert(`${t('pos.alerts.insufficient_stock')}\n${(res.payload || []).map(p => `• ${p.productName}`).join('\n')}`);
        } else {
          alert(`${t('pos.alerts.sale_error')} ` + (res.error || res.message || t('pos.alerts.unknown_error')));
        }
        return;
      }

      if (table) {
        await api.updateTable({ id: table.id, status: 'available', current_order_id: null, name: table.name, zone: '', capacity: 0 });
        setTable(null);
      }

      // Mulam Pipeline Post-Sale Updates
      const activeTailorId = pendingTailorOrderIdRef.current || location.state?.tailor_order_id;
      if (activeTailorId) {
        await api.tailor?.updateOrderStatus?.({
          order_id: activeTailorId,
          sale_invoice_id: res.invoice || invoiceNum,
          status: 'confirmed',
          paid_amount: saleTotal
        }).catch(console.error);
        
        pendingTailorOrderIdRef.current = null;
        window.history.replaceState({}, document.title);
      }
      
      const activeAltId = pendingAlterationTicketIdRef.current || location.state?.alteration_ticket_id;
      if (activeAltId) {
        await api.tailor?.updateAlterationStatus?.({
          ticket_id: activeAltId,
          status: 'delivered'
        }).catch(console.error);
        
        pendingAlterationTicketIdRef.current = null;
        window.history.replaceState({}, document.title);
      }

      const invoiceData = { 
        ...sale, 
        invoice: res.invoice || invoiceNum, 
        saleId: res.saleId,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
        customer_id: selectedCustomer?.id,
        invoiceType,
        customerTaxId,
      };

      setLastInvoice(invoiceData);
      clearCart();
      setSelectedCustomer(null);
      setRedeemPoints(false);
      setDiscountVal('');
      setDiscountType('none');

      api.getCustomers().then(setCustomers).catch(() => {});
      setOrderNote('');
      setItemNotes({});
      setStockOutItems([]);
      api.getHeldOrders?.().then(setHeldOrders).catch(() => {});

      if (shouldPrint) {
        await printReceiptData(invoiceData, forceWidth);
      } else {
        showToast(t('pos.alerts.invoice_saved'));
      }
      playPaymentChime();
    } catch (err) {
      alert(`${t('pos.alerts.network_error')} ` + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidSale = async () => {
    if (!lastInvoice?.invoice) return;
    await window.api?.voidSale?.({ invoiceId: lastInvoice.invoice, reason: voidReason || t('pos.void.default_reason') });
    setShowVoid(false);
    setVoidReason('');
    setShowSuccess(false);
    alert(t('pos.alerts.void_success'));
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      if (e.key === 'F1') {
        e.preventDefault();
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      } else if (e.key === 'F2' && viewMode === 'grid') {
        e.preventDefault();
        if (order.length > 0) openPayment();
      } else if (e.key === 'F4' && !isInput) {
        e.preventDefault();
        if (order.length > 0) holdCurrentOrder(false);
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (!showPayment && order.length > 0) {
          setPayments([{ type: 'Cash', amount: finalTotal.toFixed(2) }]);
          setShowPayment(true);
        } else if (showPayment) {
          setPayments([{ type: 'Cash', amount: finalTotal.toFixed(2) }]);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (!showPayment && order.length > 0) {
          setPayments([{ type: 'Card', amount: finalTotal.toFixed(2) }]);
          setShowPayment(true);
        } else if (showPayment) {
          setPayments([{ type: 'Card', amount: finalTotal.toFixed(2) }]);
        }
      } else if (e.key === 'F10' || (e.key === 'Enter' && showPayment)) {
        if (showPayment && canFinalize) {
          e.preventDefault();
          finalizeSale();
        }
      } else if (e.key === 'Escape') {
        setShowPayment(false);
        setShowSuccess(false);
        setShowHeld(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [order, showPayment, canFinalize, finalizeSale, viewMode, finalTotal, openPayment, holdCurrentOrder]);

  const holdCurrentOrder = async (isKds = false) => {
    if (order.length === 0) return;
    try {
      const label = table ? `${t('pos.hold.table')} ${table.name}` : (orderNote || `${t('pos.hold.order')} ${new Date().toLocaleTimeString('ar-SA')}`);
      const res = await window.api?.holdOrder?.({ 
        items: order, 
        customer_id: selectedCustomer?.id, 
        order_type: table ? 'dineIn' : orderType, 
        note: orderNote,
        label: label,
        table_id: table?.id,
        kds_status: isKds ? 'pending' : 'none'
      });

      if (table) {
        await window.api?.updateTable?.({ 
          id: table.id, 
          status: 'occupied', 
          current_order_id: res.id,
          name: table.name,
          zone: '', capacity: 0
        });
      }

      clearCart();
      setSelectedCustomer(null);
      setOrderNote('');
      setTable(null);
      const held = await window.api?.getHeldOrders?.();
      setHeldOrders(held || []);
      alert(isKds ? t('pos.alerts.sent_to_kitchen') : t('pos.alerts.order_held'));
    } catch (e) {
      alert(t('pos.alerts.hold_failed') + e.message);
    }
  };

  const resetOrder = () => {
    clearCart();
    setSelectedCustomer(null);
    setTable(null);
    setOrderNote('');
    setSearch('');
    setBarcode('');
  };

  const saveAsQuote = async () => {
    if (order.length === 0) return;
    try {
      const label = orderNote || `${t('pos.quote.label')} ${new Date().toLocaleTimeString('ar-SA')}`;
      const res = await window.api?.holdOrder?.({ 
        items: order, 
        customer_id: selectedCustomer?.id, 
        order_type: 'quote', 
        note: orderNote,
        label: label,
      });

      setLastQuote({
        id: res.id,
        items: order,
        customerName: selectedCustomer?.name,
        total: total,
        date: new Date().toISOString()
      });

      clearCart();
      setSelectedCustomer(null);
      setOrderNote('');
      setTable(null);
      setShowQuoteConfirm(true);
    } catch (e) {
      alert(t('pos.alerts.quote_save_failed') + e.message);
    }
  };

  const printQuote = async () => {
    if (!lastQuote) return;
    const bizAr = settings.business_name_ar || 'البصمة الذكية';
    const logo  = settings.business_logo || '';
    const vatNo = settings.vat_number || '---';
    const phone = settings.phone || '';
    
    // National Address
    const naBuilding = settings.national_address_building || '';
    const naStreet   = settings.national_address_street || '';
    const naDistrict = settings.national_address_district || '';
    const naPostal   = settings.national_address_postal || '';
    const naCity     = settings.national_address_city || '';
    const fullNatAddr = `${naBuilding} ${naStreet}, ${naDistrict}, ${naCity} ${naPostal}`;

    // Bank
    const bankIban = settings.bank_iban || '';
    const bankName = settings.bank_name || '';
    const bankBen  = settings.bank_beneficiary || '';

    const items = lastQuote.items || [];
    const gr    = parseFloat(lastQuote.total);
    const vatRateVal = parseFloat(settings.vat_rate || '0.15');
    const vatAmt = gr * vatRateVal / (1 + vatRateVal);
    const net    = gr - vatAmt;
    
    const html = `<html dir="rtl"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 0; }
      body { 
        font-family: 'Tajawal', sans-serif; 
        color: #1e293b; 
        margin: 0; 
        padding: 40px; 
        line-height: 1.5; 
        background: #fff;
        -webkit-print-color-adjust: exact;
      }
      
      /* Header Section */
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
      .watermark { font-size: 42px; font-weight: 900; color: #cbd5e1; letter-spacing: 1px; margin: 0; text-transform: uppercase; opacity: 0.6; }
      .biz-details { text-align: left; font-size: 13px; color: #334155; line-height: 1.8; }
      .logo-img { max-height: 60px; margin-bottom: 8px; }
      
      .quote-meta { margin-top: -10px; }
      .quote-id { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px; }
      .quote-date { font-size: 19px; font-weight: 700; color: #334155; margin-top: 10px; }
      
      .blue-divider { height: 4px; background: #2563eb; width: 100%; margin: 25px 0 35px 0; border-radius: 2px; }
      
      /* Information Boxes */
      .info-container { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 45px; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0; overflow: hidden; background: #fff; min-height: 160px; }
      .card-header { font-size: 16px; font-weight: 800; color: #1e40af; padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #eff6ff; }
      .card-body { padding: 15px 20px; font-size: 14px; font-weight: 700; color: #334155; }
      .card-body div { margin-bottom: 10px; display: flex; align-items: flex-start; gap: 6px; }
      .card-body .bullet { color: #1e40af; font-size: 18px; line-height: 14px; }

      /* Items Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
      th { padding: 14px 10px; text-align: right; font-size: 15px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; }
      td { padding: 16px 10px; border-bottom: 1px solid #f1f5f9; font-size: 15px; font-weight: 700; color: #1e293b; }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      
      /* Totals & Bank Section */
      .bottom-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; align-items: start; }
      
      .bank-card { border: 2px solid #10b981; border-radius: 16px; padding: 25px; background: #fff; position: relative; }
      .bank-label { color: #059669; font-weight: 900; font-size: 17px; margin-bottom: 15px; display: block; }
      .bank-row { font-size: 15px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
      .bank-row span { color: #059669; }
      
      .totals-area { text-align: left; padding-left: 20px; }
      .sub-total-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 16px; font-weight: 800; color: #475569; }
      .grand-total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; border-top: 4px solid #2563eb; padding-top: 15px; color: #1e3a8a; }
      .grand-total-label { font-size: 24px; font-weight: 900; }
      .grand-total-value { font-size: 24px; font-weight: 900; }
      
      .copyright { text-align: center; font-size: 13px; color: #64748b; margin-top: 100px; padding-top: 25px; border-top: 1px solid #f1f5f9; font-weight: 700; }
    </style></head><body>
      
      <div class="header">
        <div>
          <h1 class="watermark">QUOTATION</h1>
        </div>
        <div class="biz-details">
          ${logo ? `<img src="${logo}" class="logo-img"/><br>` : ''}
          <b>الرقم الضريبي:</b> ${vatNo}<br>
          <b>العنوان الوطني:</b> ${fullNatAddr}<br>
          <b>هاتف:</b> ${phone}
        </div>
      </div>

      <div class="quote-meta">
        <h2 class="quote-id">عرض سعر #QT-${Date.now().toString().slice(-8)}</h2>
        <div class="quote-date">التاريخ: ${new Date(lastQuote.date).toLocaleDateString('ar-SA')} هـ</div>
      </div>

      <div class="blue-divider"></div>

      <div class="info-container">
        <div class="card">
          <div class="card-header">تفاصيل العرض (Terms)</div>
          <div class="card-body">
            <div><span class="bullet">•</span> هذا العرض صالح لمدة 7 أيام عمل.</div>
            <div><span class="bullet">•</span> الأسعار تشمل ضريبة القيمة المضافة ${Math.round(vatRateVal * 100)}%.</div>
            <div><span class="bullet">•</span> التوصيل: من مقر المنشأة.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">العميل (Customer)</div>
          <div class="card-body">
            <div><b>الاسم:</b> ${lastQuote.customerName || 'عميل نقدي'}</div>
            ${lastQuote.customerPhone ? `<div><b>الهاتف:</b> ${lastQuote.customerPhone}</div>` : ''}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 50%;">الصنف</th>
            <th class="text-center">الكمية</th>
            <th class="text-center">السعر</th>
            <th class="text-left">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.Name}</td>
              <td class="text-center">${i.Qty}</td>
              <td class="text-center">${parseFloat(i.Price).toFixed(2)}</td>
              <td class="text-left">${(parseFloat(i.Price) * parseFloat(i.Qty)).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="bottom-layout">
        <div class="totals-area">
          <div class="sub-total-row">
            <span>المجموع الفرعي</span>
            <span>SAR ${net.toFixed(2)}</span>
          </div>
          <div class="sub-total-row">
            <span>الضريبة (${Math.round(vatRateVal * 100)}%)</span>
            <span>SAR ${vatAmt.toFixed(2)}</span>
          </div>
          <div class="grand-total-row">
            <span class="grand-total-label">الإجمالي</span>
            <span class="grand-total-value">SAR ${gr.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="bank-card">
          <span class="bank-label">معلومات التحويل البنكي:</span>
          <div class="bank-row"><span>البنك:</span> ${bankName}</div>
          <div class="bank-row"><span>المستفيد:</span> ${bankBen}</div>
          <div class="bank-row"><span>الآيبان:</span> <span style="font-family: monospace; letter-spacing: 0.5px; color: #1e293b;">${bankIban}</span></div>
        </div>
      </div>

      <div class="copyright">
        تم إنشاء هذا العرض آلياً. جميع الحقوق محفوظة لـ ${bizAr}.
      </div>

    </body></html>`;
    if (window.api?.printHTML) {
      await window.api.printHTML(html);
    } else {
      const win = window.open('', '_blank', 'width=1100,height=1300');
      if(win){ win.document.write(html); win.document.close(); setTimeout(()=>win.print(),800); }
    }
  };

  const resumeHeldOrder = (held) => {
    if (order.length > 0 && !window.confirm(t('pos.hold.resume_confirm'))) return;
    clearCart();
    for (const item of held.items) {
      addItem(item, item.Mods || []);
    }
    if (held.order_type) setOrderType(held.order_type);
    window.api?.deleteHeldOrder?.(held.id);
    setHeldOrders(prev => prev.filter(h => h.id !== held.id));
    setShowHeld(false);
  };

  const printReceiptData = async (invoiceObj, forceWidth) => {
    if (!invoiceObj) return;
    const needsWatermark = useLicenseStore.getState().needsWatermark();
    const bizAr  = settings.business_name_ar || 'نظام البصمة الذكية';
    const bizEn  = settings.business_name_en || '';
    const logo   = settings.business_logo || '';
    const footer = settings.receipt_footer || 'شكراً لزيارتكم';
    const vatNum = settings.vat_number || '---';
    const addr   = settings.address || '';
    const width  = forceWidth || settings.receipt_width || '80';
    const items  = invoiceObj.items || [];
    const gr     = parseFloat(invoiceObj.total);
    const vatAmt = gr * vatRate / (1 + vatRate);
    const net    = gr - vatAmt;

    const qrData = await window.api?.getZatcaTLV?.({
      invoice: invoiceObj.invoice,
      seller: bizAr,
      vatNo: settings.vat_number || settings.tax_number || '',
      timestamp: invoiceObj.timestamp || invoiceObj.date
        ? new Date(invoiceObj.timestamp || invoiceObj.date).toISOString()
        : new Date().toISOString(),
      total: gr.toFixed(2),
      vatAmt: (invoiceObj.tax_amount
        ? parseFloat(invoiceObj.tax_amount)
        : vatAmt
      ).toFixed(2),
    });

    const qrWarning = !qrData
      ? `<div style="color:#dc2626;font-weight:900;font-size:12px;text-align:center;margin:6px 0;border:2px dashed #dc2626;padding:6px;border-radius:6px;">⚠ تحذير: رمز QR غير متاح — يرجى إتمام تفعيل ZATCA</div>`
      : '';

    // Generate QR as a server-side PNG via the Node.js qrcode package.
    // The IPC handler decodes the Base64 TLV to raw bytes before encoding,
    // so the QR payload contains the correct BER-TLV binary — not ASCII chars.
    // A PNG data URL always renders and prints correctly in Electron's print window.
    const qrUrl = qrData ? (await window.api?.generateQR?.(qrData)) || '' : '';

    const pageSize = width === 'A4' ? '210mm' : `${width}mm`;

    let html = '';

    if (width === 'A4') {
      // Premium A4 ZATCA Tax Invoice Layout
      const isB2B = !!(invoiceObj.customerTaxId || invoiceObj.customer_tax_id);
      const invoiceTitle = isB2B ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة";
      const invoiceTitleEn = isB2B ? "Tax Invoice" : "Simplified Tax Invoice";

      // Seller National Address Info
      const s_naShort = settings.national_address_short || '—';
      const s_naBuilding = settings.national_address_building || '';
      const s_naStreet = settings.national_address_street || '';
      const s_naSecondary = settings.national_address_secondary || '';
      const s_naDistrict = settings.national_address_district || '';
      const s_naPostal = settings.national_address_postal || '';
      const s_naCity = settings.national_address_city || '';
      const s_naCountry = settings.national_address_country || 'المملكة العربية السعودية';

      // Buyer Info (checks both invoiceObj fields and fallback selectedCustomer store state)
      const b_name = invoiceObj.customerName || selectedCustomer?.name || 'عميل نقدي';
      const b_phone = invoiceObj.customerPhone || selectedCustomer?.phone || '—';
      const b_taxId = invoiceObj.customerTaxId || selectedCustomer?.tax_id || '—';
      const b_address = invoiceObj.customerAddress || selectedCustomer?.address || '—';
      const b_naBuilding = invoiceObj.customer_na_building || selectedCustomer?.na_building || '';
      const b_naStreet = invoiceObj.customer_na_street || selectedCustomer?.na_street || '';
      const b_naDistrict = invoiceObj.customer_na_district || selectedCustomer?.na_district || '';
      const b_naPostal = invoiceObj.customer_na_postal || selectedCustomer?.na_postal || '';
      const b_naCity = invoiceObj.customer_na_city || selectedCustomer?.na_city || '';

      const bankName = settings.bank_name || '';
      const bankBen = settings.bank_beneficiary || '';
      const bankIban = settings.bank_iban || '';

      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 15mm; }
          body {
              font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #1e293b;
              font-size: 13.5px;
              line-height: 1.5;
          }
          .invoice-box {
              max-width: 100%;
              margin: 0 auto;
          }
          .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
          }
          .header-title-box {
              text-align: right;
              vertical-align: top;
          }
          .header-logo-box {
              text-align: left;
              vertical-align: top;
          }
          .invoice-title {
              font-size: 26px;
              font-weight: 900;
              color: #1e3a8a;
              margin: 0 0 5px 0;
          }
          .invoice-subtitle {
              font-size: 14px;
              color: #64748b;
              font-weight: 700;
              margin: 0;
          }
          .meta-line {
              margin-top: 12px;
              font-size: 13px;
              color: #334155;
          }
          .meta-line span {
              font-weight: bold;
              color: #0f172a;
          }
          .logo-img {
              max-height: 80px;
              max-width: 200px;
              object-fit: contain;
          }
          .divider {
              height: 3px;
              background: linear-gradient(to left, #1e3a8a, #3b82f6);
              margin: 15px 0 25px 0;
              border-radius: 2px;
          }
          .cards-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
          }
          .info-card {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              overflow: hidden;
              background: #f8fafc;
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .info-card-header {
              background: #eff6ff;
              color: #1e40af;
              font-weight: 800;
              font-size: 14.5px;
              padding: 10px 15px;
              border-bottom: 1px solid #bfdbfe;
          }
          .info-card-body {
              padding: 15px;
              font-size: 12.5px;
              color: #334155;
          }
          .info-row {
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
          }
          .info-row:last-child {
              margin-bottom: 0;
          }
          .info-label {
              font-weight: 700;
              color: #64748b;
          }
          .info-val {
              font-weight: bold;
              color: #0f172a;
              text-align: left;
          }
          .na-box {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              padding: 10px;
              margin-top: 10px;
              font-size: 11px;
              color: #1e40af;
          }
          .na-box-title {
              font-weight: bold;
              margin-bottom: 6px;
              border-bottom: 1px dashed #bfdbfe;
              padding-bottom: 4px;
          }
          .na-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 5px;
              text-align: center;
          }
          .na-cell {
              background: #fff;
              padding: 4px;
              border-radius: 4px;
              border: 1px solid #dbeafe;
          }
          .na-cell-lbl {
              font-size: 9px;
              color: #64748b;
          }
          .na-cell-val {
              font-weight: bold;
              color: #1e40af;
          }
          .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
          }
          .items-table th {
              background: #1e3a8a;
              color: #fff;
              font-weight: bold;
              font-size: 12.5px;
              padding: 10px 8px;
              border: 1px solid #1e3a8a;
              text-align: center;
          }
          .items-table td {
              padding: 10px 8px;
              border: 1px solid #e2e8f0;
              font-size: 12.5px;
              text-align: center;
          }
          .items-table tr:nth-child(even) {
              background: #f8fafc;
          }
          .col-align-right {
              text-align: right !important;
          }
          .bottom-grid {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 30px;
              margin-top: 15px;
              align-items: start;
          }
          .bank-card {
              border: 2px solid #10b981;
              border-radius: 12px;
              padding: 15px;
              background: #f0fdf4;
          }
          .bank-title {
              color: #047857;
              font-weight: 800;
              font-size: 14.5px;
              margin-bottom: 12px;
              border-bottom: 1px solid #a7f3d0;
              padding-bottom: 6px;
          }
          .bank-detail-row {
              margin-bottom: 6px;
              font-size: 12.5px;
          }
          .bank-detail-row span {
              font-weight: bold;
              color: #047857;
          }
          .totals-card {
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              overflow: hidden;
              background: #fff;
          }
          .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 15px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 13px;
          }
          .totals-row:last-child {
              border-bottom: none;
          }
          .totals-bold {
              font-weight: 900;
              font-size: 16px;
              background: #eff6ff;
              color: #1e3a8a;
              border-top: 2px solid #3b82f6;
          }
          .qr-section {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-top: 15px;
              padding: 10px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              background: #fafafa;
          }
          .qr-img {
              width: 90px;
              height: 90px;
          }
          .qr-text {
              font-size: 11px;
              color: #64748b;
              line-height: 1.4;
          }
          .footer {
              text-align: center;
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              font-size: 12px;
              color: #64748b;
          }
      </style></head>
      <body>
          ${needsWatermark ? `
          <div style="text-align: center; border: 3px dashed #ef4444; background: #fef2f2; color: #b91c1c; padding: 12px; border-radius: 10px; margin-bottom: 20px; font-weight: 800; font-size: 14px;">
              ⚠️ نسخة تجريبية — غير صالحة للاستخدام التجاري الرسمي<br>
              <span style="font-size: 11px;">Trial Version — Not Valid for Official Commercial Use</span>
          </div>
          ` : ''}
          <div class="invoice-box">
              <table class="header-table">
                  <tr>
                      <td class="header-title-box">
                          <h1 class="invoice-title">${invoiceTitle}</h1>
                          <p class="invoice-subtitle">${invoiceTitleEn}</p>
                          <div class="meta-line">
                              رقم الفاتورة (Invoice No): <span>${invoiceObj.invoice}</span><br>
                              تاريخ الإصدار (Issue Date): <span dir="ltr">${new Date(invoiceObj.date).toLocaleString('ar-SA')}</span>
                          </div>
                      </td>
                      <td class="header-logo-box">
                          ${logo ? `<img src="${logo}" class="logo-img">` : ''}
                      </td>
                  </tr>
              </table>

              <div class="divider"></div>

              <div class="cards-grid">
                  <!-- Seller Card -->
                  <div class="info-card">
                      <div class="info-card-header">بيانات المورد (Seller Details)</div>
                      <div class="info-card-body">
                          <div class="info-row"><span class="info-label">اسم المنشأة:</span><span class="info-val">${bizAr}</span></div>
                          ${bizEn ? `<div class="info-row"><span class="info-label">Name:</span><span class="info-val">${bizEn}</span></div>` : ''}
                          <div class="info-row"><span class="info-label">الرقم الضريبي:</span><span class="info-val">${vatNum}</span></div>
                          <div class="info-row"><span class="info-label">العنوان:</span><span class="info-val">${addr || '—'}</span></div>
                          
                          <!-- National Address Box -->
                          <div class="na-box">
                              <div class="na-box-title">العنوان الوطني المختصر: ${s_naShort}</div>
                              <div class="na-grid">
                                  <div class="na-cell"><div class="na-cell-lbl">المبنى</div><div class="na-cell-val">${s_naBuilding || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الشارع</div><div class="na-cell-val" style="font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s_naStreet}">${s_naStreet || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الحي</div><div class="na-cell-val">${s_naDistrict || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">المدينة</div><div class="na-cell-val">${s_naCity || '—'}</div></div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <!-- Buyer Card -->
                  <div class="info-card">
                      <div class="info-card-header">بيانات العميل (Buyer Details)</div>
                      <div class="info-card-body">
                          <div class="info-row"><span class="info-label">اسم العميل:</span><span class="info-val">${b_name}</span></div>
                          <div class="info-row"><span class="info-label">رقم الهاتف:</span><span class="info-val">${b_phone}</span></div>
                          <div class="info-row"><span class="info-label">الرقم الضريبي للعميل:</span><span class="info-val">${b_taxId}</span></div>
                          <div class="info-row"><span class="info-label">العنوان الكامل:</span><span class="info-val">${b_address}</span></div>

                          <!-- National Address Box -->
                          <div class="na-box">
                              <div class="na-box-title">العنوان الوطني للعميل</div>
                              <div class="na-grid">
                                  <div class="na-cell"><div class="na-cell-lbl">المبنى</div><div class="na-cell-val">${b_naBuilding || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الشارع</div><div class="na-cell-val" style="font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b_naStreet}">${b_naStreet || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">الحي</div><div class="na-cell-val">${b_naDistrict || '—'}</div></div>
                                  <div class="na-cell"><div class="na-cell-lbl">المدينة</div><div class="na-cell-val">${b_naCity || '—'}</div></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                  <thead>
                      <tr>
                          <th style="width: 5%;">#</th>
                          <th class="col-align-right" style="width: 35%;">الصنف (Item Description)</th>
                          <th style="width: 10%;">سعر الوحدة<br><small>(Unit Ex VAT)</small></th>
                          <th style="width: 8%;">الضريبة للوحدة<br><small>(Unit Tax)</small></th>
                          <th style="width: 8%;">الكمية<br><small>(Qty)</small></th>
                          <th style="width: 10%;">المجموع<br><small>(Subtotal Ex VAT)</small></th>
                          <th style="width: 8%;">النسبة<br><small>(VAT Rate)</small></th>
                          <th style="width: 8%;">الضريبة<br><small>(VAT Amount)</small></th>
                          <th style="width: 10%;">الإجمالي شامل الضريبة<br><small>(Total Inc VAT)</small></th>
                      </tr>
                  </thead>
                  <tbody>
                      ${items.map((i, index) => {
                          const itemTotal = i.Price * i.Qty;
                          const itemTax = itemTotal * vatRate / (1 + vatRate);
                          const itemSub = itemTotal - itemTax;
                          const unitCost = i.Price / (1 + vatRate);
                          const unitTax = i.Price - unitCost;
                          return `
                              <tr>
                                  <td>${index + 1}</td>
                                  <td class="col-align-right" style="font-weight: 500;">${i.Name}</td>
                                  <td>${unitCost.toFixed(2)}</td>
                                  <td>${unitTax.toFixed(2)}</td>
                                  <td style="font-weight: bold;">${i.Qty}</td>
                                  <td>${itemSub.toFixed(2)}</td>
                                  <td>${(vatRate * 100).toFixed(0)}%</td>
                                  <td>${itemTax.toFixed(2)}</td>
                                  <td style="font-weight: bold; color: #1e3a8a;">${itemTotal.toFixed(2)}</td>
                              </tr>
                          `;
                      }).join('')}
                  </tbody>
              </table>

              <!-- Bottom Layout -->
              <div class="bottom-grid">
                  <!-- Bank Details -->
                  <div>
                      ${(bankName || bankIban) ? `
                      <div class="bank-card">
                          <div class="bank-title">معلومات التحويل البنكي (Bank Details)</div>
                          <div class="bank-detail-row"><span>البنك (Bank):</span> ${bankName}</div>
                          <div class="bank-detail-row"><span>المستفيد (Beneficiary):</span> ${bankBen}</div>
                          <div class="bank-detail-row"><span>الآيبان (IBAN):</span> <span style="font-family: monospace; letter-spacing: 0.5px; font-weight: bold;">${bankIban}</span></div>
                      </div>
                      ` : ''}
                      
                      <div class="qr-section">
                          ${qrWarning}
                          <img src="${qrUrl}" class="qr-img">
                          <div class="qr-text">
                              <strong>فاتورة ضريبية معتمدة للزكاة والدخل</strong><br>
                              تخضع لنظام الفوترة الإلكترونية بالمملكة العربية السعودية.<br>
                              المورد: ${bizAr}<br>
                              الرقم الضريبي: ${vatNum}
                          </div>
                      </div>
                  </div>

                  <!-- Totals -->
                  <div class="totals-card">
                      <div class="totals-row">
                          <span>المجموع الفرعي (غير شامل الضريبة)</span>
                          <strong>SAR ${net.toFixed(2)}</strong>
                      </div>
                      ${invoiceObj.discount > 0 ? `
                      <div class="totals-row" style="color: #ef4444;">
                          <span>إجمالي الخصم (Total Discount)</span>
                          <strong>- SAR ${parseFloat(invoiceObj.discount).toFixed(2)}</strong>
                      </div>
                      ` : ''}
                      <div class="totals-row">
                          <span>ضريبة القيمة المضافة (${(vatRate * 100).toFixed(0)}%)</span>
                          <strong>SAR ${vatAmt.toFixed(2)}</strong>
                      </div>
                      <div class="totals-row totals-bold">
                          <span>الإجمالي شامل الضريبة (Total)</span>
                          <span>SAR ${gr.toFixed(2)}</span>
                      </div>
                      <div class="totals-row">
                          <span>طريقة الدفع (Payment Method)</span>
                          <strong>${invoiceObj.payment}</strong>
                      </div>
                      <div class="totals-row">
                          <span>المبلغ المدفوع (Paid)</span>
                          <strong>SAR ${parseFloat(invoiceObj.paid).toFixed(2)}</strong>
                      </div>
                      ${invoiceObj.change > 0 ? `
                      <div class="totals-row">
                          <span>الباقي (Change)</span>
                          <strong>SAR ${parseFloat(invoiceObj.change).toFixed(2)}</strong>
                      </div>
                      ` : ''}
                  </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                  <p style="margin: 0; font-weight: bold;">${footer}</p>
                  <p style="margin: 5px 0 0 0; font-size: 10px;">نظام البصمة الذكية الفني للفوترة الإلكترونية • Developed by البصمة الذكية</p>
              </div>
          </div>
      </body></html>`;
    } else {
      // Original Thermal Layout (Exactly as is)
      html = `<html dir="rtl"><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          @page { 
              margin: 0 !important; 
              size: ${width === 'A4' ? 'A4' : '80mm auto'}; 
          }
          html, body {
              width: ${pageSize};
              margin: 0;
              padding: 0;
              background: #fff;
          }
          body { 
              font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              font-size: ${width === "80" ? "13px" : "11px"}; 
              color: #000;
          }
          .receipt-container {
              width: ${width === 'A4' ? '100%' : '80mm'};
              margin: 0 auto;
              padding-top: 0;
              padding-bottom: 5mm;
              padding-left: ${width === 'A4' ? '10mm' : '10mm'};
              padding-right: ${width === 'A4' ? '10mm' : '6mm'};
              box-sizing: border-box;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .info-line { display: flex; justify-content: space-between; margin: 3px 0; gap: 5px; color: #000; font-weight: 500; }
          .flex-table { width: 100%; margin-top: 10px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 0; }
          .flex-th { display: flex; border-bottom: 1px solid #000; padding-bottom: 6px; font-weight: bold; font-size: 12px; width: 100%; color: #000; }
          .flex-tr { display: flex; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 11px; align-items: center; width: 100%; color: #000; }
          .flex-tr:last-child { border-bottom: none; }
          .col-name { flex: 2; text-align: right; padding-left: 4px; }
          .col-qty { flex: 0.8; text-align: center; }
          .col-price { flex: 1.2; text-align: center; }
          .col-total { flex: 1.2; text-align: left; padding-left: 2px; }
          .totals { margin-top: 10px; border-top: 1.5px solid #000; padding-top: 6px; width: 100%; }
          .total-bold { font-weight: bold; font-size: 14px; border-top: 1.5px solid #000; margin-top: 6px; padding-top: 6px; color: #000; }
          .qr-box { margin: 15px auto; text-align: center; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; }
          .footer { text-align: center; margin-top: 15px; font-size: 11.5px; line-height: 1.4; color: #000; }
      </style></head><body>
          <div class="receipt-container">
              ${needsWatermark ? `
              <div style="text-align: center; border: 2px dashed #000; padding: 8px; margin: 10px 0; font-weight: 800; font-size: 12px; color: #000;">
                  *** نسخة تجريبية (TRIAL) ***<br>
                  غير صالحة للاستخدام التجاري
              </div>
              ` : ''}
              <div class="header">
              ${logo ? `<img src="${logo}" style="max-height:60px; max-width:150px; margin-bottom:5px;">` : ''}
              <h2 style="margin:0; font-size:18px; font-weight: 800;">${bizAr}</h2>
              ${addr ? `<p style="margin:4px 0; font-weight: 500;">${addr}</p>` : ''}
              <p style="margin:2px 0; font-weight: 500;">الرقم الضريبي: <strong>${vatNum}</strong></p>
          </div>

          <div style="text-align:center; font-weight:800; font-size: 14px; border-top:2px dashed #000; border-bottom:2px dashed #000; padding:6px 0; margin-bottom:10px; color: #000;">
              ${invoiceObj.invoiceType === 'standard' ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}
          </div>

          <div class="info-line"><span>رقم الفاتورة:</span><span>${invoiceObj.invoice}</span></div>
          <div class="info-line"><span>التاريخ:</span><span dir="ltr">${new Date(invoiceObj.date).toLocaleString('ar-SA')}</span></div>
          ${invoiceObj.customerName ? `<div class="info-line"><span>العميل:</span><span>${invoiceObj.customerName}</span></div>` : ''}
          ${invoiceObj.customerTaxId ? `<div class="info-line"><span>رقم الضريبة للعميل:</span><span>${invoiceObj.customerTaxId}</span></div>` : ''}

          <div class="flex-table">
              <div class="flex-th">
                  <div class="col-name">الصنف</div>
                  <div class="col-qty">العدد</div>
                  <div class="col-price">السعر</div>
                  <div class="col-total">الإجمالي</div>
              </div>
              ${items.map(i => `
                  <div class="flex-tr">
                      <div class="col-name" style="font-weight: 500;">${i.Name}</div>
                      <div class="col-qty" style="font-weight: bold;">${i.Qty}</div>
                      <div class="col-price">${i.Price.toFixed(2)}</div>
                      <div class="col-total" style="font-weight: bold;">${(i.Price * i.Qty).toFixed(2)}</div>
                  </div>
              `).join('')}
          </div>

          <div class="totals">
              <div class="info-line"><span>المجموع الفرعي:</span><span>${net.toFixed(2)} SAR</span></div>
              ${invoiceObj.discount > 0 ? `<div class="info-line"><span>الخصم:</span><span>${parseFloat(invoiceObj.discount).toFixed(2)} SAR</span></div>` : ''}
              <div class="info-line"><span>الضريبة (${(vatRate * 100).toFixed(0)}%):</span><span>${vatAmt.toFixed(2)} SAR</span></div>
              <div class="info-line total-bold">
                  <span>الإجمالي:</span>
                  <span>${gr.toFixed(2)} SAR</span>
              </div>
              <div class="info-line"><span>المدفوع:</span><span>${parseFloat(invoiceObj.paid).toFixed(2)} SAR</span></div>
              ${invoiceObj.change > 0 ? `<div class="info-line"><span>الباقي:</span><span>${parseFloat(invoiceObj.change).toFixed(2)} SAR</span></div>` : ''}
          </div>

          <div class="qr-box">
              ${qrWarning}
              <img src="${qrUrl}" style="width:100%; height:100%;">
          </div>

          <div class="footer">
              <p style="margin:0; font-weight: 700;">${footer}</p>
              <div style="margin-top:15px; font-size:10px; color:#000; border-top:1px dashed #000; padding-top:8px;">
                  Developed by البصمة الذكية<br>
                  ea.gaber10@gmail.com
              </div>
          </div>
          
          <div style="height: 35px;"></div>
          </div>
      </body></html>`;
    }

    // Use the printHTML IPC handler (hidden Electron BrowserWindow with webSecurity:false)
    // so that data:image/png QR code URLs render correctly without CSP blocking.
    // window.open() + document.write() causes broken images in Electron print windows.

    // [FIX-4] B2B synchronous print gate — block raw printing of un-cleared B2B invoices.
    // A B2B (Standard) invoice must be cleared by ZATCA (zatca_clearance_status === 'cleared')
    // before it is allowed to leave the printer. We poll the backend (populated by the
    // background ZATCA reporter/clearance poller) for a bounded time; if clearance does not
    // arrive in time we refuse to print rather than emit a non-compliant raw invoice.
    const isB2BInvoice = invoiceObj.invoiceType === 'standard' || !!(invoiceObj.customerTaxId || invoiceObj.customer_tax_id);
    if (isB2BInvoice) {
      if (!invoiceObj.saleId) {
        alert('تعذر تأكيد مخالصة ZATCA لهذه الفاتورة B2B (معرف البيع غير متوفر) — لا يمكن الطباعة.');
        return;
      }
      let cleared = false;
      let attempts = 0;
      const maxAttempts = 20; // ~30s @ 1.5s interval
      showToast(t('pos.alerts.waiting_zatca_clearance') || 'بانتظار تأكيد المخالصة من ZATCA...');
      while (!cleared && attempts < maxAttempts) {
        try {
          const statusRes = await window.api?.getClearanceStatus?.(invoiceObj.saleId);
          if (statusRes?.status === 'cleared') { cleared = true; break; }
        } catch (_) { /* keep polling */ }
        attempts++;
        await new Promise(r => setTimeout(r, 1500));
      }
      if (!cleared) {
        alert('لا يمكن طباعة فاتورة B2B قبل تأكيد المخالصة (Clearance) من ZATCA. حاول مرة أخرى بعد قليل من قائمة المبيعات.');
        return;
      }
    }

    if (window.api?.printHTML) {
      await window.api.printHTML(html);
    } else {
      // Fallback for browser dev mode (no Electron API)
      const win = window.open('', '_blank', `width=${width === 'A4' ? 900 : 450},height=${width === 'A4' ? 1100 : 650}`);
      if (win) {
        win.document.write(html);
        win.document.close();
        win.onload = () => { setTimeout(() => { win.print(); win.close(); }, 500); };
      }
    }
  };

  const printReceipt = async () => {
    if (!lastInvoice) return;
    await printReceiptData(lastInvoice);
  };

  // FIX: shareViaWhatsApp — now builds a real receipt message and opens the WA modal
  const shareViaWhatsApp = () => {
    if (!lastInvoice) return;

    // Build a concise Arabic receipt summary for WhatsApp
    const bizName = settings.business_name_ar || 'البصمة الذكية';
    const bizContact = settings.whatsapp || settings.phone || '';
    const lines = (lastInvoice.items || []).map(i => `• ${i.Name} × ${i.Qty} — SAR ${(i.Price * i.Qty).toFixed(2)}`).join('\n');
    const template = settings.whatsapp_template || '';
    const msg = [
      template ? template + '\n' : '',
      `🧾 *فاتورة من ${bizName}*`,
      `رقم الفاتورة: ${lastInvoice.invoice}`,
      `التاريخ: ${new Date(lastInvoice.date).toLocaleDateString('ar-SA')}`,
      bizContact ? `للتواصل مع المنشأة: ${bizContact}` : '',
      '',
      lines,
      '',
      `الإجمالي: *SAR ${parseFloat(lastInvoice.total).toFixed(2)}*`,
      lastInvoice.discount > 0 ? `الخصم: SAR ${parseFloat(lastInvoice.discount).toFixed(2)}` : '',
      '',
      '✨ شكراً لتسوقكم معنا!',
    ].filter(l => l !== '').join('\n');

    setWAMsg(msg);
    // Pre-fill phone ONLY from customer record, no business phone fallback
    const prefilledPhone = lastInvoice.customerPhone || '';
    setWAPhone(prefilledPhone);
    setShowWAModal(true);
  };

  const performWAShare = async (rawPhone, msg) => {
    const phone = normalizeWhatsAppPhone(rawPhone);
    if (!phone || phone.length < 10) {
      alert(t('pos.alerts.invalid_phone'));
      return;
    }

    // Open WhatsApp
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Record in backend (async, don't block window.open)
    if (window.api?.recordWhatsAppShare) {
      window.api.recordWhatsAppShare({ 
        customerId: lastInvoice?.customer_id || null, 
        invoiceId: lastInvoice?.invoice 
      }).catch(err => console.error("Failed to record share:", err));
    }
    
    setShowWAModal(false);
  };


  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ display:'flex', height:'100vh', padding:'14px', gap:'14px', background:'#eef2f6', overflow:'hidden' }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside style={{ width:'240px', background:'white', borderRadius:'20px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        {/* Brand */}
        <div style={{ padding:'18px 16px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            {settings.business_logo
              ? <img src={settings.business_logo} alt="logo" style={{ width:'42px', height:'42px', borderRadius:'10px', objectFit:'contain', border:'1px solid #e2e8f0' }} />
              : <div style={{ width:'42px', height:'42px', background:'linear-gradient(135deg,#3b82f6,#60a5fa)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'20px' }}>🏪</div>
            }
            <div>
              <div style={{ fontWeight:'800', fontSize:'13px', color:'#0f172a' }}>{settings.business_name_ar || 'البصمة الذكية'}</div>
              <div style={{ color:'#94a3b8', fontSize:'11px' }}>نظام البصمة الذكية</div>
            </div>
          </div>

          {/* Order type selector */}
          <select value={orderType} onChange={e => setOrderType(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'12px', fontFamily:'inherit', background:'#f8fafc', marginBottom:'8px' }}>
            {ORDER_TYPES(t).filter(type => isRestaurant || type.value !== 'dineIn').map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* Search (Only in Grid Mode to prevent focus conflict) */}
        {viewMode === 'grid' && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #f1f5f9' }}>
            <input ref={barcodeRef} autoFocus value={barcode} onChange={handleBarcodeChange} onKeyDown={handleBarcodeKeyDown}
              placeholder={`${t('pos.grid.search_placeholder')} [F1]`}
              style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'2px solid #3b82f6', background:'#f0f7ff', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
          </div>
        )}

        {/* Categories (Only in Grid Mode) */}
        {viewMode === 'grid' && (
          <div style={{ padding:'10px 12px', flex:1, overflowY:'auto' }}>
            <p style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', fontWeight:'700' }}>{t('pos.categories.all')}</p>
            {categories.map(c => (
              <div key={c} onClick={() => setActiveCategory(c)}
                style={{ padding:'9px 12px', borderRadius:'10px', cursor:'pointer', fontWeight:'600', fontSize:'12px', marginBottom:'3px', transition:'all 0.15s',
                  background: activeCategory===c ? '#3b82f6' : 'transparent',
                  color: activeCategory===c ? 'white' : '#64748b' }}>
                {c === '__all__' ? `🗂️ ${t('pos.categories.all')}` : `${getCategoryIcon(c, settings?.business_type)} ${c}`}
              </div>
            ))}
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ padding:'12px', borderTop:'1px solid #f1f5f9', display:'flex', flexDirection:'column', gap:'6px' }}>
          <button onClick={() => setShowHeld(true)}
            style={{ padding:'9px', background: heldOrders.length > 0 ? '#fef3c7' : '#f8fafc', border:`1px solid ${heldOrders.length > 0 ? '#fcd34d' : '#e2e8f0'}`, borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit', color: heldOrders.length > 0 ? '#d97706' : '#64748b', display:'flex', justifyContent:'space-between', position:'relative' }}>
            ⏸️ {t('pos.sidebar.held_orders')}
            <div style={{ display:'flex', gap:'4px' }}>
              {isRestaurant && readyCount > 0 && <span style={{ background:'#ef4444', color:'white', borderRadius:'99px', padding:'2px 7px', fontSize:'10px', animation:'pulse 2s infinite' }}>{readyCount} {t('pos.sidebar.ready')}</span>}
              {heldOrders.length > 0 && <span style={{ background:'#f59e0b', color:'white', borderRadius:'99px', padding:'2px 7px', fontSize:'10px' }}>{heldOrders.length}</span>}
            </div>
          </button>
          {String(role || '').toLowerCase() === 'admin' && (
            <button onClick={() => navigate('/dashboard')}
              style={{ padding:'9px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit', color:'#64748b' }}>
              📊 {t('pos.sidebar.dashboard')}
            </button>
          )}
          <button onClick={() => navigate('/shift?action=close')}
            style={{ padding:'9px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'12px', fontFamily:'inherit', color:'#ef4444' }}>
            🔒 {t('pos.sidebar.close_shift')}
          </button>
          
          <div style={{ marginTop:'10px', padding:'12px', background:'#f0f9ff', borderRadius:'14px', border:'1px solid #bae6fd' }}>
            <div style={{ fontSize:'11px', fontWeight:'800', color:'#0369a1', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
              <Headphones size={14}/> {t('pos.sidebar.tech_support')}
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => window.api.openExternal('https://wa.me/966533174895')} style={{ flex:1, padding:'6px', background:'#10b981', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'10px', fontWeight:'700' }}>{t('pos.sidebar.whatsapp')}</button>
              <button onClick={() => window.api.openExternal('mailto:ea.gaber10@gmail.com')} style={{ flex:1, padding:'6px', background:'#3b82f6', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'10px', fontWeight:'700' }}>{t('pos.sidebar.email')}</button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── PRODUCT GRID ─────────────────────────────────────────── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'0 4px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#0f172a' }}>
              {viewMode === 'grid' ? t('pos.header.products') : t('pos.header.quick_entry')}
            </h2>
            
            {/* View Mode Toggle */}
            <div style={{ display:'flex', background:'#e2e8f0', borderRadius:'10px', padding:'3px' }}>
              <button onClick={() => setViewMode('grid')}
                style={{ border:'none', padding:'6px 12px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:'700', transition:'all 0.2s',
                  background: viewMode === 'grid' ? 'white' : 'transparent',
                  color: viewMode === 'grid' ? '#3b82f6' : '#64748b',
                  boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>
                <LayoutGrid size={14} /> {t('pos.header.grid')}
              </button>
              <button onClick={() => setViewMode('tabular')}
                style={{ border:'none', padding:'6px 12px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:'700', transition:'all 0.2s',
                  background: viewMode === 'tabular' ? 'white' : 'transparent',
                  color: viewMode === 'tabular' ? '#3b82f6' : '#64748b',
                  boxShadow: viewMode === 'tabular' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>
                <Table size={14} /> {t('pos.header.tabular')}
              </button>
            </div>

            {/* Quick Tailor Switcher - Mulam Ergonomics */}
            {(orderType === 'tailor' || settings?.business_type === 'tailor' || pendingTailorOrderIdRef.current) && (
              <div style={{ display:'flex', gap:'6px', background:'#f1f5f9', padding:'3px', borderRadius:'10px', border:'1px solid #cbd5e1' }}>
                <button
                  onClick={() => navigate('/tailor-pos')}
                  style={{
                    border: 'none',
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 3px rgba(16,185,129,0.3)'
                  }}
                  title="العودة لشاشة تفصيل ثوب جديد"
                >
                  <Scissors size={13} />
                  <span>تفصيل جديد</span>
                </button>

                <button
                  onClick={() => navigate('/measurements')}
                  style={{
                    border: 'none',
                    background: '#ffffff',
                    color: '#334155',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="الانتقال إلى دفتر قياسات العملاء"
                >
                  <Ruler size={13} />
                  <span>المقاسات</span>
                </button>

                <button
                  onClick={() => navigate('/orders-board')}
                  style={{
                    border: 'none',
                    background: '#ffffff',
                    color: '#334155',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="لوحة متابعة مراحل خياطة الثياب"
                >
                  <Factory size={13} />
                  <span>المعمل</span>
                </button>
              </div>
            )}
          </div>
          <div style={{ background:'white', padding:'5px 12px', borderRadius:'99px', fontSize:'12px', fontWeight:'600', color:'#64748b', boxShadow:'0 1px 2px rgba(0,0,0,0.05)' }}>
            {new Date().toLocaleString('ar-SA', { timeZone:'Asia/Riyadh', hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>

        {viewMode === 'grid' ? (
          <>
            {filtered.length === 0 ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:'16px' }}>
                <div style={{ fontSize:'56px', opacity:.4 }}>📦</div>
                <div style={{ fontSize:'16px', fontWeight:'700' }}>
                  {search ? `${t('pos.grid.no_results')} "${search}"` : t('pos.grid.no_products')}
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'12px', overflowY:'auto', padding:'4px 4px 16px', flex:1 }}>
                {filtered.map(item => (
                  <div key={item.ID} onClick={() => handleItemClick(item)}
                    style={{ background:'white', borderRadius:'16px', padding:'14px', cursor:'pointer', transition:'all 0.18s', border: !item.IsService && item.Stock <= 0 ? '1px solid #fecaca' : '1px solid #f1f5f9', boxShadow:'0 1px 2px rgba(0,0,0,0.04)', opacity: !item.IsService && item.Stock <= 0 ? .6 : 1 }}
                    onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'}
                    onMouseLeave={e => e.currentTarget.style.transform='none'}>
                    <div style={{ width:'100%', height:'90px', borderRadius:'12px', background:'linear-gradient(135deg,#f8fafc,#eff6ff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'38px', marginBottom:'10px' }}>
                      {item.Image ? <img src={item.Image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'12px' }} /> : getCategoryIcon(item.Category, settings?.business_type)}
                    </div>
                    <div style={{ fontWeight:'700', fontSize:'13px', marginBottom:'4px', color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.Name}</div>
                    <div style={{ fontWeight:'800', color:'#3b82f6', fontSize:'14px' }}>SAR {parseFloat(item.Price||0).toFixed(2)}</div>
                    {!item.IsService && (
                      <div style={{ fontSize:'10px', marginTop:'4px', color: item.Stock <= 5 ? '#ef4444' : '#94a3b8', fontWeight:'600' }}>
                        {item.Stock <= 0 ? t('pos.grid.out_of_stock') : item.Stock <= 5 ? `⚠️ ${item.Stock} ${t('pos.grid.remaining')}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <TabularView 
            menu={menu} 
            settings={settings} 
            onOpenPayment={openPayment}
            onHoldOrder={holdCurrentOrder}
            onPrint={printReceipt}
            onReset={resetOrder}
            onQuote={saveAsQuote}
            customers={customers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            setShowQuickCust={setShowQuickCust}
            onFinalizeQuickly={finalizeSaleQuickly}
          />
        )}
      </main>

      {/* ── ORDER PANEL ───────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <section style={{ width:'380px', background:'white', borderRadius:'20px', boxShadow:'0 4px 20px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
          {/* Header */}
          <div style={{ padding:'18px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div>
                <h3 style={{ fontSize:'16px', fontWeight:'800' }}>{t('pos.order.current_order')}</h3>
                {isRestaurant && table && (
                  <div style={{ fontSize:'12px', color:'#3b82f6', fontWeight:'700', marginTop:'2px' }}>📍 {t('pos.order.table')}: {table.name}</div>
                )}
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                {lastClearedCart && lastClearedCart.length > 0 && (
                  <button onClick={restoreClearedCart} className="btn btn-secondary" style={{ fontSize:'11px', padding:'6px 10px', background:'#f8fafc', color:'#3b82f6', border:'1px solid #bfdbfe' }}>↩ {t('pos.order.undo')}</button>
                )}
                {/* FIX: Removed duplicate hold button — hold is in the action buttons below */}
                {order.length > 0 && <button onClick={clearCart} className="btn btn-danger" style={{ fontSize:'11px', padding:'6px 10px' }}>🗑️ {t('pos.order.clear_all')}</button>}
              </div>
            </div>

            {/* Customer Selection Widget */}
            <div style={{ position:'relative' }}>
              {selectedCustomer ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#eff6ff', padding:'10px 14px', borderRadius:'14px', border:'1px solid #bfdbfe' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#3b82f6', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'800' }}>{selectedCustomer.name.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'800', color:'#1d4ed8' }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize:'10px', color:'#3b82f6' }}>{selectedCustomer.loyalty_points || 0} {t('pos.order.points')} • {selectedCustomer.tier === 'gold' ? '🏆 ' + t('pos.tiers.gold') : selectedCustomer.tier === 'silver' ? '🥈 ' + t('pos.tiers.silver') : '🥉 ' + t('pos.tiers.bronze')}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:'18px' }}>×</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:'8px' }}>
                  <div style={{ flex:1, position:'relative' }}>
                    <input 
                      value={custSearch} 
                      onChange={e => { setCustSearch(e.target.value); setShowCustResults(true); }}
                      onFocus={() => setShowCustResults(true)}
                      placeholder={t('pos.order.search_customer')}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'12px', outline:'none', background:'white' }}
                    />
                    {showCustResults && (custSearch || customers.length > 0) && (
                      <div style={{ position:'absolute', top:'110%', left:0, right:0, background:'white', borderRadius:'14px', boxShadow:'0 10px 30px rgba(0,0,0,0.1)', zIndex:100, maxHeight:'200px', overflowY:'auto', border:'1px solid #f1f5f9' }}>
                        {customers.filter(c => !custSearch || c.name.includes(custSearch) || c.phone?.includes(custSearch)).map(c => (
                          <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustSearch(''); setShowCustResults(false); }}
                            style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f8fafc', transition:'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <div style={{ fontWeight:'700', fontSize:'13px' }}>{c.name}</div>
                            <div style={{ fontSize:'11px', color:'#94a3b8' }}>{c.phone || t('pos.order.no_phone')}</div>
                          </div>
                        ))}
                        {custSearch && !customers.some(c => c.name.includes(custSearch)) && (
                          <div style={{ padding:'12px', textAlign:'center', color:'#94a3b8', fontSize:'12px' }}>{t('pos.order.no_results')}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowQuickCust(true)} style={{ padding:'10px', background:'#f1f5f9', border:'none', borderRadius:'12px', cursor:'pointer', color:'#64748b' }}>👤+</button>
                </div>
              )}
              {showCustResults && <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => setShowCustResults(false)}></div>}
            </div>
          </div>

          {/* Items */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {order.length === 0 ? (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:'10px', padding:'32px' }}>
                <span style={{ fontSize:'44px', opacity:.4 }}>🛒</span>
                <p style={{ fontWeight:'600', fontSize:'13px' }}>{t('pos.order.empty_cart')}</p>
              </div>
            ) : order.map((item, idx) => {
              const isStockOut = stockOutItems.some(s => s.id === item.ID);
              return (
              <div key={idx} style={{ padding:'12px 16px', borderBottom:'1px solid #f8fafc', background: isStockOut ? '#fff1f2' : 'transparent' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'700', fontSize:'13px', color: isStockOut ? '#e11d48' : '#0f172a' }}>
                      {item.Name}
                      {isStockOut && <span style={{ fontSize:'10px', display:'block', fontWeight:'800' }}>⚠️ {t('pos.order.insufficient_stock')}</span>}
                    </div>
                    <div style={{ color:'#94a3b8', fontSize:'11px', marginTop:'2px' }}>SAR {item.Price.toFixed(2)}</div>
                    {item.Mods && item.Mods.length > 0 && (
                      <div style={{ fontSize:'10px', color:'#3b82f6' }}>+ {item.Mods.map(m=>m.name).join(', ')}</div>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', background:'#f8fafc', borderRadius:'99px', padding:'3px' }}>
                    <button onClick={() => updateQuantity(idx, item.Qty + 1)} style={qtyBtn}>+</button>
                    <span style={{ minWidth:'24px', textAlign:'center', fontWeight:'800', fontSize:'13px' }}>{item.Qty}</span>
            <button onClick={() => updateQuantity(idx, item.Qty - 1)} style={qtyBtn}>−</button>
                  </div>
                  <div style={{ fontWeight:'800', fontSize:'14px', minWidth:'52px', textAlign:'left', color:'#0f172a' }}>{(item.Price * item.Qty).toFixed(2)}</div>
                  <button onClick={() => removeItem(idx)} style={{ background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'18px' }}>×</button>
                </div>
              </div>
              );
          })}
          </div>

          {/* Totals */}
          <div style={{ padding:'14px 18px', background:'white', borderTop:'1px solid #e2e8f0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', color:'#64748b', fontSize:'13px' }}><span>{t('pos.order.subtotal_ex_tax')}</span><span>SAR {subtotal.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px', color:'#64748b', fontSize:'13px' }}><span>{t('pos.order.vat')} ({(vatRate*100).toFixed(0)}%)</span><span>SAR {tax.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'800', fontSize:'20px', color:'#3b82f6' }}><span>{t('pos.order.total')}</span><span>SAR {total.toFixed(2)}</span></div>
          </div>

          {/* Action buttons */}
          <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ display:'grid', gridTemplateColumns: isRestaurant ? '1fr 1fr' : '1fr 1fr', gap:'10px' }}>
              {isRestaurant ? (
                <button onClick={() => holdCurrentOrder(true)} disabled={order.length===0}
                  style={{ ...holdBtnStyle, background:'#f59e0b', color:'white', border:'none' }}>
                  <ChefHat size={18} /> {t('pos.actions.to_kitchen')}
                </button>
              ) : (
                <button onClick={saveAsQuote} disabled={order.length===0}
                  style={{ ...holdBtnStyle, background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0' }}>
                  💼 {t('pos.actions.as_quote')}
                </button>
              )}
              <button onClick={() => holdCurrentOrder(false)} disabled={order.length===0}
                style={holdBtnStyle}>
                <Pause size={18} />
                <span>{isRestaurant ? t('pos.actions.hold') : t('pos.actions.hold_order')}</span>
                <kbd style={{ background:'#e2e8f0', padding:'1px 4px', borderRadius:'3px', fontSize:'9px', fontFamily:'monospace', marginRight:'4px' }}>F4</kbd>
              </button>
            </div>
            <button className="btn btn-primary" style={{ padding:'16px', fontSize:'16px', fontWeight:'900', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}
              disabled={order.length === 0} onClick={openPayment}>
              <span>{t('pos.actions.checkout')} 💳</span>
              <kbd style={{ background:'rgba(255,255,255,0.25)', padding:'1px 6px', borderRadius:'4px', fontSize:'11px', fontFamily:'monospace' }}>F2</kbd>
            </button>
          </div>
        </section>
      )}

      {/* ── PAYMENT MODAL ─────────────────────────────────────────── */}
      {showPayment && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setShowPayment(false)}>
          <div style={modal} dir="rtl">
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontWeight:'800', fontSize:'17px' }}>{t('pos.payment.title')}</h3>
              <span style={{ fontWeight:'900', fontSize:'18px', color:'#3b82f6' }}>SAR {finalTotal.toFixed(2)}</span>
            </div>
            <div style={{ padding:'20px', maxHeight:'70vh', overflowY:'auto' }}>

              {/* Invoice Type Toggle */}
              <div style={{ marginBottom:'16px', padding:'14px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#475569', marginBottom:'10px' }}>📄 {t('pos.payment.invoice_type')}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <button onClick={() => setInvoiceType('simplified')}
                    style={{ ...toggleBtn(invoiceType==='simplified'), display:'flex', flexDirection:'column', height:'auto', padding:'10px' }}>
                    <span style={{ fontSize:'14px' }}>{t('pos.payment.simplified')}</span>
                    <span style={{ fontSize:'10px', opacity:.7 }}>{t('pos.payment.b2c')}</span>
                  </button>
                  <button onClick={() => setInvoiceType('standard')}
                    style={{ ...toggleBtn(invoiceType==='standard'), display:'flex', flexDirection:'column', height:'auto', padding:'10px' }}>
                    <span style={{ fontSize:'14px' }}>{t('pos.payment.standard')}</span>
                    <span style={{ fontSize:'10px', opacity:.7 }}>{t('pos.payment.b2b')}</span>
                  </button>
                </div>
                {invoiceType === 'standard' && (
                  <div style={{ marginTop:'12px' }}>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', display:'block', marginBottom:'6px' }}>{t('pos.payment.customer_tax_info')}</label>
                    <input 
                      style={{ width:'100%', padding:'10px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'13px', outline:'none' }}
                      value={customerTaxId}
                      onChange={e => setCustomerTaxId(e.target.value)}
                      placeholder={t('pos.payment.tax_id_placeholder')}
                    />
                    {!selectedCustomer && <p style={{ color:'#ef4444', fontSize:'10px', marginTop:'4px' }}>⚠️ {t('pos.payment.tax_customer_required')}</p>}
                  </div>
                )}
              </div>

              {/* Loyalty Points */}
              {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
                <div style={{ marginBottom:'16px', padding:'14px', background:'#fdf4ff', borderRadius:'14px', border:'1px solid #f5d0fe', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'800', color:'#a21caf', display:'flex', alignItems:'center', gap:'6px' }}>
                      🌟 {t('pos.payment.loyalty_points_available')}: {selectedCustomer.loyalty_points}
                    </div>
                    <div style={{ fontSize:'11px', color:'#c026d3', marginTop:'2px' }}>
                      {t('pos.payment.equals_discount', { amount: pointsDiscount.toFixed(2) })}
                      {selectedCustomer.loyalty_points * 0.1 > pointsDiscount
                        ? ` (${t('pos.payment.capped_at_50')})`
                        : ''}
                    </div>
                  </div>
                  <label style={{ display:'flex', alignItems:'center', cursor:'pointer' }}>
                    <div style={{ position:'relative', width:'44px', height:'24px', background: redeemPoints ? '#d946ef' : '#e2e8f0', borderRadius:'12px', transition:'all 0.3s' }}>
                      <div style={{ position:'absolute', top:'2px', left: redeemPoints ? '2px' : '22px', width:'20px', height:'20px', background:'white', borderRadius:'50%', transition:'all 0.3s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                    <input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} style={{ display:'none' }} />
                  </label>
                </div>
              )}

              {/* Discount Section */}
              <div style={{ marginBottom:'12px', padding:'14px', background:'#f8fafc', borderRadius:'14px', border:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#475569', marginBottom:'10px' }}>🏷️ {t('pos.payment.discount')}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                  {[['none', t('pos.payment.no_discount')],['pct', t('pos.payment.pct_discount')],['fixed', t('pos.payment.fixed_discount')]].map(([v,l]) => (
                    <button key={v} onClick={() => { setDiscountType(v); setDiscountVal(''); setShowAgreedOverride(false); }}
                      style={{ padding:'8px', borderRadius:'10px', border: discountType===v ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: discountType===v ? '#eff6ff' : 'white', color: discountType===v ? '#1d4ed8' : '#64748b', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {discountType !== 'none' && (
                  <input type="number" value={discountVal} onChange={e => setDiscountVal(e.target.value)}
                    placeholder={discountType==='pct' ? t('pos.payment.discount_pct_placeholder') : t('pos.payment.discount_fixed_placeholder')} min="0"
                    style={{ width:'100%', padding:'10px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                )}
              </div>

              {/* Feature 6: Agreed Total Override */}
              <div style={{ marginBottom:'12px', padding:'14px', background: showAgreedOverride ? '#fffbeb' : '#f8fafc', borderRadius:'14px', border: showAgreedOverride ? '1px solid #fcd34d' : '1px solid #f1f5f9', transition:'all 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: showAgreedOverride ? '10px' : '0' }}>
                  <div style={{ fontSize:'13px', fontWeight:'700', color: showAgreedOverride ? '#92400e' : '#475569' }}>✏️ {t('pos.payment.agreed_total')}</div>
                  <button onClick={() => { setShowAgreedOverride(!showAgreedOverride); setAgreedTotalInput(''); setDiscountType('none'); }}
                    style={{ padding:'4px 12px', borderRadius:'8px', border:'none', background: showAgreedOverride ? '#fde68a' : '#e2e8f0', color: showAgreedOverride ? '#92400e' : '#64748b', fontWeight:'700', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
                    {showAgreedOverride ? t('pos.payment.cancel_edit') : t('pos.payment.edit')}
                  </button>
                </div>
                {showAgreedOverride && (
                  <div>
                    <input type="number" value={agreedTotalInput} onChange={e => { setAgreedTotalInput(e.target.value); setPayments([{ type: payments[0]?.type || 'Cash', amount: e.target.value }]); }}
                      placeholder={t('pos.payment.agreed_placeholder', { example: (total * 0.8).toFixed(0), orig: total.toFixed(2) })} min="0"
                      autoFocus
                      style={{ width:'100%', padding:'10px', borderRadius:'10px', border:'2px solid #fbbf24', fontSize:'15px', fontWeight:'700', fontFamily:'inherit', outline:'none', boxSizing:'border-box', marginBottom:'8px' }} />
                    {agreedOverrideVal !== null && (
                      <div style={{ fontSize:'11px', color:'#92400e', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                        <span>{t('pos.payment.tax')}: <strong>SAR {(agreedOverrideVal * vatRate / (1 + vatRate)).toFixed(2)}</strong></span>
                        <span>{t('pos.payment.net')}: <strong>SAR {(agreedOverrideVal / (1 + vatRate)).toFixed(2)}</strong></span>
                        <span style={{ color:'#dc2626' }}>{t('pos.payment.actual_discount')}: <strong>SAR {(total - agreedOverrideVal).toFixed(2)}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment methods */}
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', marginBottom:'6px', display:'flex', justifyContent:'space-between' }}>
                <span>{t('pos.payment.method_and_amount')}</span>
                <button onClick={() => setPayments([{ type: payments[0]?.type || 'Cash', amount: finalTotal.toFixed(2) }])}
                  style={{ background:'#eff6ff', color:'#2563eb', border:'none', borderRadius:'6px', padding:'2px 8px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                  ⟳ {t('pos.payment.sync_amount')}
                </button>
              </div>

              {/* Quick Method Hotkey Buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                <button
                  type="button"
                  onClick={() => setPayments([{ type: 'Cash', amount: finalTotal.toFixed(2) }])}
                  style={{
                    padding:'8px 12px',
                    borderRadius:'10px',
                    border: payments[0]?.type === 'Cash' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: payments[0]?.type === 'Cash' ? '#ecfdf5' : '#ffffff',
                    color: payments[0]?.type === 'Cash' ? '#047857' : '#334155',
                    fontWeight:'800',
                    fontSize:'12px',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:'6px'
                  }}
                >
                  <span>💵 نقداً (Cash)</span>
                  <kbd style={{ background: payments[0]?.type === 'Cash' ? '#10b981' : '#e2e8f0', color: payments[0]?.type === 'Cash' ? '#fff' : '#64748b', padding:'0 5px', borderRadius:'4px', fontSize:'9px', fontFamily:'monospace' }}>F8</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setPayments([{ type: 'Card', amount: finalTotal.toFixed(2) }])}
                  style={{
                    padding:'8px 12px',
                    borderRadius:'10px',
                    border: payments[0]?.type === 'Card' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    background: payments[0]?.type === 'Card' ? '#eff6ff' : '#ffffff',
                    color: payments[0]?.type === 'Card' ? '#1d4ed8' : '#334155',
                    fontWeight:'800',
                    fontSize:'12px',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    gap:'6px'
                  }}
                >
                  <span>💳 شبكة (Card)</span>
                  <kbd style={{ background: payments[0]?.type === 'Card' ? '#3b82f6' : '#e2e8f0', color: payments[0]?.type === 'Card' ? '#fff' : '#64748b', padding:'0 5px', borderRadius:'4px', fontSize:'9px', fontFamily:'monospace' }}>F9</kbd>
                </button>
              </div>
              {/* Credit warning: block finalization if Credit is selected but no customer */}
              {payments.some(p => p.type === 'Credit') && !selectedCustomer && (
                <div style={{ marginBottom:'12px', padding:'12px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'12px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'20px' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight:'800', color:'#dc2626', fontSize:'13px' }}>يجب اختيار عميل للبيع الآجل</div>
                    <div style={{ fontSize:'11px', color:'#b91c1c', marginTop:'2px' }}>لا يمكن تسجيل دين بدون تحديد عميل. اختر عميلاً أو غيّر طريقة الدفع.</div>
                  </div>
                </div>
              )}
              {payments.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'8px', background:'#f8fafc', borderRadius:'12px', padding:'10px', marginBottom:'8px' }}>
                  <select value={p.type} onChange={e => { const n=[...payments]; n[i].type=e.target.value; setPayments(n); }}
                    style={{ border:'none', borderRadius:'8px', padding:'9px', fontWeight:'600', fontFamily:'inherit', background:'white', fontSize:'13px' }}>
                    {PAY_TYPES(t).map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                  <input type="number" value={p.amount} placeholder={t('pos.payment.amount')}
                    onChange={e => { const n=[...payments]; n[i].amount=e.target.value; setPayments(n); }}
                    style={{ border:'none', borderRadius:'8px', padding:'9px', fontWeight:'700', fontFamily:'inherit', background:'white', fontSize:'16px', outline:'none', textAlign:'center' }} />
                </div>
              ))}
              {/* Feature 5: Full numpad for touch-screen cashiers */}
              <div style={{ background:'#f1f5f9', padding:'12px', borderRadius:'16px', marginBottom:'12px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' }}>
                  {[1,2,3,4,5,6,7,8,9,'.',0].map(n => (
                    <button key={n} onClick={() => {
                      const current = String(payments[0].amount);
                      if (n === '.' && current.includes('.')) return;
                      const next = current === '0' ? String(n) : current + n;
                      const p = [...payments]; p[0].amount = next; setPayments(p);
                    }} style={numpadBtn}>{n}</button>
                  ))}
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => {
                      const current = String(payments[0].amount);
                      const next = current.slice(0, -1);
                      const p = [...payments]; p[0].amount = next; setPayments(p);
                    }} style={{ ...numpadBtn, flex:1, background:'#f1f5f9', color:'#64748b' }}>⌫</button>
                    <button onClick={() => { const p=[...payments]; p[0].amount=''; setPayments(p); }}
                      style={{ ...numpadBtn, flex:1, background:'#fee2e2', color:'#ef4444' }}>C</button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'8px' }}>
                  <button onClick={() => {
                    const p = [...payments];
                    p[0].amount = String(Math.ceil(parseFloat(p[0].amount || 0) / 10) * 10 || 10);
                    setPayments(p);
                  }} style={quickAmtBtn}>جبر للمضاعف</button>
                  <button onClick={() => {
                    const p = [...payments];
                    p[0].amount = finalTotal.toFixed(2);
                    setPayments(p);
                  }} style={{ ...quickAmtBtn, background:'#dbeafe', color:'#2563eb', fontWeight:'800' }}>المبلغ الدقيق</button>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'12px' }}>
                {[10, 50, 100, 200, 500].map(amt => (
                  <button key={amt} onClick={() => { const p=[...payments]; p[0].amount=String(amt); setPayments(p); }}
                    style={pillBtn}>
                    {amt}
                  </button>
                ))}
              </div>

              {/* Balance */}
              <div style={{ padding:'12px', background: remaining > 0.005 ? '#fef2f2' : '#ecfdf5', borderRadius:'12px', display:'flex', justifyContent:'space-between', fontWeight:'700', fontSize:'15px', color: remaining > 0.005 ? '#ef4444' : '#10b981' }}>
                <span>{remaining > 0.005 ? t('pos.payment.remaining') : t('pos.payment.change')}</span>
                <span>SAR {remaining > 0.005 ? remaining.toFixed(2) : change.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ padding:'14px 22px', borderTop:'1px solid #f1f5f9', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowPayment(false)} className="btn btn-secondary">{t('pos.actions.cancel')}</button>
              <button onClick={finalizeSale} disabled={!canFinalize} className="btn btn-primary"
                style={{ opacity: canFinalize ? 1 : .5, display:'flex', alignItems:'center', gap:'8px' }}>
                <span>{t('pos.actions.confirm_pay')}</span>
                <kbd style={{ background:'rgba(255,255,255,0.25)', padding:'1px 6px', borderRadius:'4px', fontSize:'11px', fontFamily:'monospace' }}>F10 / ↵</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ─────────────────────────────────────────── */}
      {showSuccess && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'380px', textAlign:'center', padding:'36px' }} dir="rtl">
            {/* Success icon */}
            <div style={{ width:'80px', height:'80px', background:'linear-gradient(135deg,#ecfdf5,#d1fae5)', color:'#10b981', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', margin:'0 auto 20px', boxShadow:'0 8px 24px rgba(16,185,129,0.2)' }}>✓</div>
            <h3 style={{ fontSize:'22px', fontWeight:'900', marginBottom:'6px', color:'#0f172a' }}>{t('pos.success.sale_success')}</h3>
            <p style={{ color:'#94a3b8', marginBottom:'28px', fontSize:'13px' }}>{t('pos.success.invoice')}: <strong style={{ color:'#3b82f6' }}>{lastInvoice?.invoice}</strong></p>

            {/* PRIMARY: Print */}
            <button onClick={() => { printReceipt(); setShowSuccess(false); }} style={{ width:'100%', padding:'15px', marginBottom:'10px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'900', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', fontSize:'15px', fontFamily:'inherit', boxShadow:'0 6px 16px rgba(37,99,235,0.3)' }}>🖨️ {t('pos.success.print_thermal')}</button>

            {/* A4 Tax Invoice Print */}
            <button onClick={() => { printReceiptData(lastInvoice, 'A4'); setShowSuccess(false); }} style={{ width:'100%', padding:'15px', marginBottom:'10px', background:'linear-gradient(135deg,#0f172a,#1e293b)', color:'white', border:'none', borderRadius:'14px', fontWeight:'900', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', fontSize:'15px', fontFamily:'inherit', boxShadow:'0 6px 16px rgba(15,23,42,0.3)' }}>📄 {t('pos.success.print_a4')}</button>

            {/* SECONDARY: WhatsApp */}
            <button onClick={shareViaWhatsApp} style={{ width:'100%', padding:'13px', marginBottom:'10px', background:'#f0fdf4', color:'#059669', border:'2px solid #a7f3d0', borderRadius:'14px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontSize:'14px', fontFamily:'inherit' }}>💬 {t('pos.success.send_whatsapp')}</button>

            {/* TAILOR MULTI-ORDER WORKFLOW SHORTCUT */}
            {(orderType === 'tailor' || settings?.business_type === 'tailor' || lastInvoice?.order_type === 'tailor' || pendingTailorOrderIdRef.current) && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '10px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => { setShowSuccess(false); navigate('/tailor-pos'); }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
                  }}
                >
                  <Scissors size={16} />
                  <span>تسجيل طلب تفصيل جديد (العميل التالي)</span>
                </button>
                <button
                  onClick={() => { setShowSuccess(false); navigate('/measurements'); }}
                  style={{
                    width: '100%',
                    padding: '9px',
                    background: '#ffffff',
                    color: '#065f46',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontFamily: 'inherit'
                  }}
                >
                  <Ruler size={14} />
                  <span>الانتقال لدفتر المقاسات</span>
                </button>
              </div>
            )}

            {/* TERTIARY: Void + Continue */}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setShowVoid(true)} style={{ flex:1, padding:'11px', background:'#fff1f2', color:'#e11d48', border:'1px solid #fecdd3', borderRadius:'12px', fontWeight:'700', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}>↩ {t('pos.success.void_invoice')}</button>
              <button onClick={() => setShowSuccess(false)} style={{ flex:2, padding:'11px', background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0', borderRadius:'12px', fontWeight:'700', cursor:'pointer', fontSize:'13px', fontFamily:'inherit' }}>➕ {t('pos.success.new_order')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODIFIERS MODAL ─────────────────────────────────────── */}
      {showMods && modTarget && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'400px' }} dir="rtl">
            <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
              <h3 style={{ fontWeight:'900', fontSize:'18px' }}>{t('pos.mods.title')} {modTarget.Name}</h3>
            </div>
            <div style={{ padding:'20px', maxHeight:'50vh', overflowY:'auto' }}>
              {(modTarget.Modifiers || []).map(m => (
                <label key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px', borderRadius:'12px', border: selectedMods.find(x=>x.id===m.id) ? '2px solid #3b82f6' : '1px solid #f1f5f9', background: selectedMods.find(x=>x.id===m.id) ? '#eff6ff' : 'white', cursor:'pointer', marginBottom:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <input type="checkbox" 
                      checked={!!selectedMods.find(x=>x.id===m.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedMods([...selectedMods, m]);
                        else setSelectedMods(selectedMods.filter(x=>x.id!==m.id));
                      }} style={{ width:18, height:18 }} />
                    <span style={{ fontWeight:'700', color:'#1e293b' }}>{m.name}</span>
                  </div>
                  {m.price > 0 && <span style={{ color:'#3b82f6', fontWeight:'800', fontSize:'13px' }}>+ SAR {m.price.toFixed(2)}</span>}
                </label>
              ))}
            </div>
            <div style={{ padding:'16px 20px', borderTop:'1px solid #f1f5f9', display:'flex', gap:'10px' }}>
               <button onClick={() => setShowMods(false)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>{t('pos.actions.cancel')}</button>
               <button onClick={confirmMods} style={{ flex:2, padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'12px', fontWeight:'800', cursor:'pointer' }}>{t('pos.mods.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIANTS MODAL ─────────────────────────────────────── */}
      {showVariants && modTarget && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setShowVariants(false)}>
          <div style={{ ...modal, maxWidth:'450px' }} dir="rtl">
            <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:'900', fontSize:'18px' }}>{t('pos.variants.title')} {modTarget.Name}</h3>
              <button onClick={() => setShowVariants(false)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            <div style={{ padding:'20px', maxHeight:'60vh', overflowY:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {(modTarget.variants || []).map(v => (
                <button key={v.ID} onClick={() => selectVariant(v)}
                  style={{ padding:'16px', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                  <div style={{ fontWeight:'800', color:'#0f172a', fontSize:'14px' }}>{v.Name}</div>
                  <div style={{ color:'#3b82f6', fontWeight:'700', fontSize:'13px' }}>SAR {parseFloat(v.Price||0).toFixed(2)}</div>
                  <div style={{ fontSize:'10px', color:v.Stock>0?'#10b981':'#ef4444' }}>{v.Stock>0 ? `${t('pos.variants.stock')}: ${v.Stock}` : t('pos.variants.out_of_stock')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SERIAL INPUT MODAL ─────────────────────────────────── */}
      {showSerial && modTarget && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'380px' }} dir="rtl">
            <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
              <h3 style={{ fontWeight:'900', fontSize:'17px' }}>{t('pos.serial.title')}</h3>
              <p style={{ fontSize:'12px', color:'#64748b', marginTop:'4px' }}>{t('pos.serial.product')}: {modTarget.Name}</p>
            </div>
            <form onSubmit={confirmSerial} style={{ padding:'20px' }}>
              <input autoFocus value={serialInput} onChange={e => setSerialInput(e.target.value)}
                placeholder={t('pos.serial.placeholder')}
                style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'2px solid #3b82f6', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box', marginBottom:'20px' }} />
              <div style={{ display:'flex', gap:'10px' }}>
                 <button type="button" onClick={() => setShowSerial(false)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>{t('pos.actions.cancel')}</button>
                 <button type="submit" style={{ flex:2, padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'12px', fontWeight:'800', cursor:'pointer' }}>{t('pos.serial.confirm')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HELD ORDERS MODAL ─────────────────────────────────────── */}
      {showHeld && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setShowHeld(false)}>
          <div style={{ ...modal, maxWidth:'480px' }} dir="rtl">
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontWeight:'800', fontSize:'17px' }}>⏸️ {t('pos.held.title')}</h3>
              <button onClick={() => setShowHeld(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:'20px' }}>×</button>
            </div>
            <div style={{ padding:'20px', maxHeight:'60vh', overflowY:'auto' }}>
              {heldOrders.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>{t('pos.held.no_orders')}</div>
              ) : heldOrders.map(h => (
                <div key={h.id} style={{ border:'1px solid #f1f5f9', borderRadius:'14px', padding:'14px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:'700', fontSize:'14px' }}>{h.label}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>{(h.items||[]).length} أصناف</div>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => resumeHeldOrder(h)}
                        style={{ padding:'8px 16px', background:'#3b82f6', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'700', fontSize:'13px', fontFamily:'inherit' }}>
                        ▶ {t('pos.held.resume')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ADD CUSTOMER MODAL ───────────────────────── */}
      {showQuickCust && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'380px' }} dir="rtl">
            <div style={{ padding:'20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
              <h3 style={{ fontWeight:'900', fontSize:'17px' }}>{t('pos.customer.quick_add_title')}</h3>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <input value={quickCustForm.name} onChange={e => setQuickCustForm({...quickCustForm, name:e.target.value})} 
                placeholder={t('pos.customer.name_placeholder')} style={modalInput} />
              <input value={quickCustForm.phone} onChange={e => setQuickCustForm({...quickCustForm, phone:e.target.value})} 
                placeholder={t('pos.customer.phone_placeholder')} style={modalInput} />
              <input value={quickCustForm.tax_id} onChange={e => setQuickCustForm({...quickCustForm, tax_id:e.target.value})} 
                placeholder={t('pos.customer.tax_id_placeholder')} style={modalInput} />
              <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
                <button onClick={() => setShowQuickCust(false)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>{t('pos.actions.cancel')}</button>
                <button 
                  onClick={async () => {
                    if (!quickCustForm.name) return alert(t('pos.customer.name_required'));
                    try {
                      const res = await window.api.addCustomer(quickCustForm);
                      const all = await window.api.getCustomers();
                      setCustomers(all);
                      const newCust = all.find(c => c.id === res.id);
                      if (newCust) setSelectedCustomer(newCust);
                      setShowQuickCust(false);
                      setQuickCustForm({ name:'', phone:'', tax_id:'' });
                    } catch(e) { alert(e.message); }
                  }}
                  style={{ flex:2, padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'12px', fontWeight:'800', cursor:'pointer' }}>
                  {t('pos.customer.save_and_select')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP PHONE PROMPT MODAL ───────────────────────── */}
      {showWAModal && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'380px' }} dir="rtl">
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#94a3b8', marginBottom:'6px', fontWeight:'700' }}>{t('pos.whatsapp.phone_label')}</label>
                <input autoFocus value={waPhone} onChange={e => setWAPhone(e.target.value)} 
                  placeholder="966512345678" style={modalInput} />
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={() => setShowWAModal(false)} style={{ flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer' }}>{t('pos.actions.cancel')}</button>
                <button onClick={() => performWAShare(waPhone, waMsg)} 
                  style={{ flex:2, padding:'12px', background:'#10b981', color:'white', border:'none', borderRadius:'12px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <span>🚀 {t('pos.whatsapp.send')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUOTE CONFIRMATION MODAL ─────────────────────── */}
      {showQuoteConfirm && lastQuote && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth:'400px', textAlign:'center', padding:'32px' }} dir="rtl">
            <div style={{ fontSize:'42px', marginBottom:'16px' }}>💼</div>
            <h3 style={{ fontWeight:'900', fontSize:'20px', marginBottom:'8px' }}>{t('pos.quote.success_title')}</h3>
            <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'24px' }}>{t('pos.quote.success_desc')}</p>
            
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <button onClick={printQuote} style={{ padding:'14px', background:'#3b82f6', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>🖨️ {t('pos.quote.print')}</button>
              <button onClick={() => {
                setShowQuoteConfirm(false);
                navigate('/pos', { state: { resumeHeld: lastQuote } });
              }} style={{ padding:'14px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:'14px', fontWeight:'800', cursor:'pointer' }}>🛒 {t('pos.quote.continue')}</button>
              <button onClick={() => setShowQuoteConfirm(false)} style={{ padding:'12px', background:'#f8fafc', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:'14px', fontWeight:'700', cursor:'pointer' }}>{t('pos.actions.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── TRANSIENT PREMIUM TOAST ─────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          fontWeight: '800',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxSizing: 'border-box'
        }} dir="rtl">
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}

const modalInput = { width:'100%', padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' };

const qtyBtn = { width:'26px', height:'26px', borderRadius:'50%', border:'none', background:'white', cursor:'pointer', fontWeight:'800', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 2px rgba(0,0,0,0.08)' };
const toggleBtn = (active) => ({ padding:'12px', borderRadius:'12px', border: active ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: active ? '#eff6ff' : 'white', color: active ? '#1d4ed8' : '#64748b', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' });
const overlay = { position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modal   = { background:'white', borderRadius:'20px', boxShadow:'0 20px 40px rgba(0,0,0,0.12)', width:'95%', maxWidth:'560px', overflow:'hidden' };
const holdBtnStyle = { padding:'12px', borderRadius:'12px', border:'1px solid #e2e8f0', background:'#f8fafc', color:'#64748b', cursor:'pointer', fontWeight:'700', fontSize:'13px', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' };

const numpadBtn = { padding:'12px', background:'white', border:'1px solid #e2e8f0', borderRadius:'12px', fontWeight:'800', fontSize:'18px', cursor:'pointer', fontFamily:'inherit', color:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.1s' };
const quickAmtBtn = { padding:'10px', background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', color:'#64748b' };
const pillBtn = { padding:'8px', background:'white', border:'1px solid #e2e8f0', borderRadius:'10px', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit', color:'#374151' };

