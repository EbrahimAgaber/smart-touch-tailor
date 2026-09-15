import { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import {
  ShoppingBag, Plus, Search, Trash2, CheckCircle2,
  Truck, Archive, ArrowLeftRight, Save, X,
  Eye, Tag, Package, ShoppingCart, ChevronLeft, RotateCcw
} from 'lucide-react';
import { useToast } from '../components/ToastManager';
import { printLabelBatch } from '../utils/LabelPrintEngine.js';

export default function Purchases() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingPO, setReceivingPO] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveQtys, setReceiveQtys] = useState({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [addVat, setAddVat] = useState(true);
  const [paidAmount, setPaidAmount] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState({});
  const [labelConfig, setLabelConfig] = useState({
    showBusinessName: true, showProductName: true, showPrice: true, showBarcode: true,
    fieldsOrder: ['business', 'name', 'price', 'barcode'], size: '50x30'
  });
  const [productSearch, setProductSearch] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnItems, setReturnItems] = useState([]); // [{ product_id, product_name, orderedQty, unit_name, pieces_per_unit, unit_cost, returnQty }]
  const [returnMode, setReturnMode] = useState('full'); // 'full' | 'partial'
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, p, o, sets] = await Promise.all([
        window.api.getSuppliers(),
        window.api.getMenu(),
        window.api.getPurchaseOrders(),
        window.api.getSettings(),
      ]);
      setSuppliers(s || []);
      setProducts(p || []);
      setOrders(o || []);
      if (sets) {
        setSettings(sets);
        if (sets.label_config) {
          try { setLabelConfig(JSON.parse(sets.label_config)); } catch (e) { }
        }
      }
    } catch (e) {
      toast('تعذّر تحميل بيانات المشتريات: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const handleEditOrder = async (order) => {
    try {
      const items = await window.api.getPurchaseItems(order.id);
      setEditingOrderId(order.id);
      setSelectedSupplier(order.supplier_id || '');
      setNote(order.note || '');
      setAddVat(order.vat_included !== 0);
      setPaidAmount(order.paid_amount || '');
      setCart(items.map(it => ({
        product_id: it.product_id,
        name: it.product_name,
        quantity: it.quantity,
        unit_name: it.unit_name || 'وحدة',
        pieces_per_unit: it.pieces_per_unit || 1,
        unit_cost: it.unit_cost,
        is_bulk: it.is_bulk === 1,
        costManuallySet: true,
        originalCost: it.unit_cost
      })));
      setShowAddModal(true);
    } catch(e) {
      toast('تعذر تحميل تفاصيل الطلب: ' + e.message, 'error');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('هل أنت متأكد من حذف طلب الشراء؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await window.api.deletePurchaseOrder(orderId);
      toast('تم حذف طلب الشراء بنجاح', 'success');
      fetchData();
    } catch (e) {
      toast('حدث خطأ أثناء الحذف: ' + e.message, 'error');
    }
  };

  const handleOpenReturnModal = async (order) => {
    try {
      const items = await window.api.getPurchaseItems(order.id);
      setReturnOrder(order);
      setReturnMode('full');
      setReturnItems(items.map(it => {
        const ppu = it.pieces_per_unit || 1;
        return {
          product_id: it.product_id,
          product_name: it.product_name,
          orderedQty: it.quantity,
          unit_name: it.unit_name || 'وحدة',
          pieces_per_unit: ppu,
          unit_cost: it.unit_cost,
          returnQty: it.quantity,
        };
      }));
      setShowReturnModal(true);
    } catch (e) {
      toast('تعذر تحميل تفاصيل الطلب: ' + e.message, 'error');
    }
  };

  const handleConfirmFullReturn = async () => {
    if (!window.confirm('هل أنت متأكد من إرجاع الطلب بالكامل؟ سيتم خصم المخزون وإنشاء قيد محاسبي عكسي.')) return;
    setSubmittingReturn(true);
    try {
      await window.api.returnPurchaseOrder(returnOrder.id);
      toast('تم إرجاع الطلب بالكامل بنجاح', 'success');
      setShowReturnModal(false);
      fetchData();
      if (detailOrder && detailOrder.id === returnOrder.id) setDetailOrder(null);
    } catch (e) {
      toast('حدث خطأ أثناء الإرجاع: ' + e.message, 'error');
    } finally { setSubmittingReturn(false); }
  };

  const handleConfirmPartialReturn = async () => {
    const payload = returnItems
      .filter(it => parseFloat(it.returnQty) > 0)
      .map(it => ({ product_id: it.product_id, return_qty: parseFloat(it.returnQty) }));
    if (payload.length === 0) return toast('يرجى تحديد الكمية المرتجعة لمنتج واحد على الأقل', 'warn');
    if (!window.confirm(`إرجاع جزئي: ${payload.length} صنف. سيتم خصم المخزون وإنشاء قيد محاسبي عكسي. متابعة؟`)) return;
    setSubmittingReturn(true);
    try {
      const res = await window.api.partialReturnPurchaseOrder(returnOrder.id, payload);
      toast(`تم الإرجاع الجزئي بنجاح (${res.status === 'returned' ? 'مرتجع كامل' : 'مرتجع جزئي'})`, 'success');
      setShowReturnModal(false);
      fetchData();
      if (detailOrder && detailOrder.id === returnOrder.id) setDetailOrder(null);
    } catch (e) {
      toast('حدث خطأ أثناء الإرجاع الجزئي: ' + e.message, 'error');
    } finally { setSubmittingReturn(false); }
  };


  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.Name.toLowerCase().includes(q) ||
      (p.Barcode && p.Barcode.includes(q)) ||
      (p.Category && p.Category.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const handleViewDetail = async (order) => {
    setDetailOrder(order);
    setLoadingDetail(true);
    try {
      const items = await window.api.getPurchaseItems(order.id);
      setDetailItems(items || []);
    } catch (e) { setDetailItems([]); }
    setLoadingDetail(false);
  };

  const printLabelsForPO = () => {
    if (detailItems.length === 0) return;
    const batchPayload = detailItems.map(it => {
      const p = products.find(prod => prod.ID === it.product_id) || { ID: it.product_id, Name: it.product_name, Price: 0 };
      const actualQty = it.is_bulk ? it.quantity * (it.bulk_unit_size || 1) : (it.quantity * (it.pieces_per_unit || 1));
      return { product: p, copies: Math.min(parseInt(actualQty) || 1, 500) };
    });
    printLabelBatch(batchPayload, settings, labelConfig.size, 1, labelConfig)
      .then(() => toast('تم إرسال الملصقات للطباعة', 'success'))
      .catch(e => toast('فشل طباعة الملصقات: ' + e.message, 'error'));
  };

  const addToCart = (product) => {
    const existing = cart.find(c => c.product_id === product.ID);
    if (existing) {
      setCart(cart.map(c => c.product_id === product.ID ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        product_id: product.ID,
        name: product.Name,
        quantity: 1,
        unit_cost: product.Cost || 0,
        costManuallySet: false,
        originalCost: product.Cost || 0,
        unit_name: 'حبة',
        pieces_per_unit: 1
      }]);
    }
  };

  const removeFromCart = (pid) => setCart(cart.filter(c => c.product_id !== pid));

  const updateCartItem = (pid, key, val) => {
    setCart(cart.map(c => {
      if (c.product_id !== pid) return c;
      const updated = { ...c, [key]: val };
      if (key === 'unit_cost') updated.costManuallySet = true;
      return updated;
    }));
  };

  const calculateTotal = () => cart.reduce((acc, c) => {
    const unitCost = parseFloat(c.unit_cost) || 0;
    const qty = parseFloat(c.quantity) || 0;
    return acc + (qty * unitCost);
  }, 0);

  const netTotal = calculateTotal();
  const vatAmount = addVat ? parseFloat((netTotal * 0.15).toFixed(2)) : 0;
  const grossTotal = parseFloat((netTotal + vatAmount).toFixed(2));
  const paid = parseFloat(paidAmount) || 0;
  const remaining = Math.max(0, grossTotal - paid);

  const handleSubmitOrder = async () => {
    if (!selectedSupplier) return toast('يرجى اختيار المورد', 'warn');
    if (cart.length === 0) return toast('يرجى إضافة منتج واحد على الأقل', 'warn');
    const invalidItems = cart.filter(c => !c.quantity || c.quantity <= 0 || !c.unit_cost || c.unit_cost < 0 || !c.pieces_per_unit || c.pieces_per_unit <= 0);
    if (invalidItems.length > 0) return toast('يرجى التأكد من إدخال الكمية والتكلفة وعدد القطع لجميع المنتجات', 'warn');
    const staleCosts = cart.filter(c => !c.costManuallySet && c.originalCost > 0);
    if (staleCosts.length > 0) {
      const ok = confirm(`تنبيه: ${staleCosts.length} منتج يحتوي على سعر مبدئي ولم يتم تحديثه من الفاتورة. هل تريد المتابعة؟`);
      if (!ok) return;
    }
    const data = {
      supplier_id: parseInt(selectedSupplier),
      total_amount: grossTotal,
      vat_included: addVat ? 1 : 0,
      paid_amount: paid,
      payment_status: paid >= grossTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      note,
      items: cart.map(c => ({
        product_id: c.product_id,
        quantity: parseFloat(c.quantity), // Sent as requested by user (e.g., 12)
        unit_cost: parseFloat(c.unit_cost), // Sent as requested by user
        is_bulk: false,
        unit_name: c.unit_name || 'وحدة',
        pieces_per_unit: parseFloat(c.pieces_per_unit) || 1
      }))
    };

    try {
      if (editingOrderId) {
        await window.api.updatePurchaseOrder(editingOrderId, data);
        toast('تم تعديل طلب الشراء بنجاح', 'success');
      } else {
        await window.api.createPurchaseOrder(data);
        toast('تم إنشاء طلب الشراء بنجاح', 'success');
      }
      setShowAddModal(false); 
      setEditingOrderId(null);
      setCart([]); 
      setSelectedSupplier('');
      setPaidAmount('');
      setNote('');
      fetchData();
    } catch (e) {
      toast('حدث خطأ: ' + e.message, 'error');
    }
  };

  const handleOpenReceive = async (order) => {
    setReceivingPO(order);
    setReceiving(order.id);
    try {
      const items = await window.api.getPurchaseItems(order.id);
      setReceiveItems(items || []);
      const initialQtys = {};
      items.forEach(it => { initialQtys[it.product_id] = Math.max(0, it.quantity - (it.received_quantity || 0)); });
      setReceiveQtys(initialQtys);
      setShowReceiveModal(true);
    } catch (e) { toast('خطأ في تحميل الأصناف: ' + e.message, 'error'); }
    setReceiving(null);
  };

  const handleConfirmReceive = async () => {
    const payload = Object.entries(receiveQtys)
      .map(([pid, qty]) => ({ product_id: parseInt(pid), received_qty: parseFloat(qty) || 0 }))
      .filter(x => x.received_qty > 0);
    if (payload.length === 0) return toast('يرجى تحديد الكميات المستلمة', 'warn');
    setReceiving(receivingPO.id);
    try {
      await window.api.receivePurchaseOrder(receivingPO.id, payload);
      setShowReceiveModal(false);
      setReceivingPO(null);
      await fetchData();
    } catch (e) { toast('خطأ في الاستلام: ' + e.message, 'error'); }
    setReceiving(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false); setCart([]); setSelectedSupplier('');
    setNote(''); setProductSearch(''); setPaidAmount('');
  };

  return (
    <AppLayout title="إدارة المشتريات والتوريد">
      <style>{`
        .po-product-row:hover { background: #eff6ff !important; border-color: #bfdbfe !important; }
        .po-product-row:hover .po-add-btn { opacity: 1 !important; transform: scale(1) !important; }
        .po-cart-row { animation: slideIn 0.2s ease; }
        .po-cart-row:hover { background: #f0f9ff !important; }
        .po-cart-row td input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .po-table-row:hover { background: #f8fafc !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '20px 28px', borderRadius: '20px', border: '1px solid #e8edf2' }}>
          <div>
            <h2 style={{ fontWeight: '800', fontSize: '17px', color: 'var(--text-main)', margin: 0 }}>سجل التوريدات</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', margin: 0 }}>تتبع طلبيات الشراء واستلام المخزون من الموردين</p>
          </div>
          <button onClick={() => setShowAddModal(true)} style={s.primaryBtn}>
            <Plus size={17} /> إنشاء طلب توريد
          </button>
        </div>

        {/* Orders Table */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid #e8edf2', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['رقم الطلب', 'المورد', 'الإجمالي', 'الحالة', 'التاريخ', 'الإجراءات'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const statusMap = {
                  received: { bg: '#ecfdf5', color: '#10b981', label: 'تم الاستلام', icon: <CheckCircle2 size={12} /> },
                  partial: { bg: '#eff6ff', color: '#3b82f6', label: 'استلام جزئي', icon: <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> },
                  pending: { bg: '#fff7ed', color: '#f59e0b', label: 'قيد الانتظار', icon: <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> },
                  returned: { bg: '#fef2f2', color: '#ef4444', label: 'مرتجع كامل', icon: <X size={12} /> },
                  partial_return: { bg: '#fdf4ff', color: '#9333ea', label: 'مرتجع جزئي', icon: <RotateCcw size={12} /> },
                };
                const st = statusMap[o.status] || statusMap.pending;
                return (
                  <tr key={o.id} className="po-table-row" style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={s.td}><span style={{ fontWeight: '800', color: '#3b82f6', fontFamily: 'monospace' }}>#PO-{o.id}</span></td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Truck size={13} color="#94a3b8" /> {o.supplier_name}
                      </div>
                    </td>
                    <td style={s.td}><span style={{ fontWeight: '800', fontFamily: 'monospace' }}>SAR {parseFloat(o.total_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</span></td>
                    <td style={s.td}>
                      <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td style={s.td}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('ar-SA')}</span></td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(o.status === 'received' || o.status === 'partial_return') && (
                          <button onClick={() => handleOpenReturnModal(o)} style={s.actionBtn('#fef2f2', '#ef4444')}>
                            <RotateCcw size={13} /> إرجاع
                          </button>
                        )}
                        {o.status !== 'received' && o.status !== 'returned' && o.status !== 'partial_return' && (
                          <>
                            <button onClick={() => handleOpenReceive(o)} disabled={receiving === o.id} style={s.actionBtn('#eff6ff', '#3b82f6')}>
                              <Archive size={13} /> {receiving === o.id ? 'جاري...' : 'استلام'}
                            </button>
                            <button onClick={() => handleEditOrder(o)} style={s.actionBtn('#fffbeb', '#d97706')}>
                              تعديل
                            </button>
                            <button onClick={() => handleDeleteOrder(o.id)} style={s.actionBtn('#fef2f2', '#ef4444')}>
                              حذف
                            </button>
                          </>
                        )}
                        <button onClick={() => handleViewDetail(o)} style={s.actionBtn('#f5f3ff', '#7c3aed')}>
                          <Eye size={13} /> تفاصيل
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '70px', color: 'var(--text-muted)' }}>
              <ShoppingBag size={44} style={{ opacity: 0.2, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <div style={{ fontWeight: '700', fontSize: '15px' }}>لا توجد طلبيات شراء حتى الآن</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>ابدأ بإنشاء طلب توريد جديد</div>
            </div>
          )}
          {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري التحميل...</div>}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          CREATE ORDER MODAL — Invoice-style redesign
      ═══════════════════════════════════════════════════ */}
      {showAddModal && (
        <div style={s.overlay}>
          <div style={{ ...s.modalShell, maxWidth: '1100px', height: '95vh' }}>

            {/* ── INVOICE HEADER ── */}
            <div style={{ padding: '24px 32px 20px', borderBottom: '2px solid #e2e8f0', flexShrink: 0, background: 'var(--bg-card)' }}>
              {/* Top row: Title + Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: '14px', padding: '10px', display: 'flex' }}>
                    <ShoppingCart size={20} color="white" />
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a' }}>
                      {editingOrderId ? `تعديل فاتورة توريد #PO-${editingOrderId}` : 'فاتورة توريد جديدة'}
                    </h2>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>
                      {cart.length === 0 ? 'اختر منتجات من القائمة لإضافتها للفاتورة' : `${cart.length} صنف في الفاتورة`}
                    </p>
                  </div>
                </div>
                <button onClick={handleCloseModal} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '10px', padding: '8px', display: 'flex', lineHeight: 1 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Supplier & Notes — invoice-style info fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>المورد:</span>
                  <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
                    style={{ ...s.input, background: 'white', padding: '8px 12px', fontSize: '13px', borderColor: !selectedSupplier ? '#fbbf24' : '#e2e8f0' }}>
                    <option value="">— اختر المورد —</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>ملاحظات:</span>
                  <input placeholder="رقم فاتورة، مرجع..." value={note} onChange={e => setNote(e.target.value)}
                    style={{ ...s.input, background: 'white', padding: '8px 12px', fontSize: '13px' }} />
                </div>
              </div>
            </div>

            {/* ── BODY: Product browser + Invoice Table ── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* COL 1: Product Browser (right side in RTL) */}
              <div style={{ width: '260px', flexShrink: 0, borderLeft: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e8edf2' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                      placeholder="بحث بالاسم أو الباركود..."
                      style={{ ...s.input, paddingRight: '32px', fontSize: '12px', padding: '9px 32px 9px 10px', background: 'white' }} />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '12px' }}>
                      {productSearch ? `لا نتائج لـ "${productSearch}"` : 'لا توجد منتجات'}
                    </div>
                  )}
                  {filteredProducts.map(p => {
                    const inCart = cart.find(c => c.product_id === p.ID);
                    return (
                      <div key={p.ID} className="po-product-row" onClick={() => addToCart(p)}
                        style={{ padding: '8px 10px', background: inCart ? '#eff6ff' : 'white', border: `1px solid ${inCart ? '#bfdbfe' : '#e8edf2'}`, borderRadius: '10px', marginBottom: '5px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '12px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.Name}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                            مخزون: {p.Stock} · {(p.Cost || 0).toFixed(2)} ر.س
                          </div>
                        </div>
                        <div className="po-add-btn" style={{ background: inCart ? '#3b82f6' : '#dbeafe', borderRadius: '6px', padding: '3px', display: 'flex', opacity: inCart ? 1 : 0.5, transform: inCart ? 'scale(1)' : 'scale(0.85)', transition: 'all 0.15s', flexShrink: 0, marginRight: '6px' }}>
                          {inCart
                            ? <span style={{ fontSize: '9px', fontWeight: '800', color: 'white', padding: '0 4px' }}>×{inCart.quantity}</span>
                            : <Plus size={12} color="#3b82f6" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COL 2: Invoice Table */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'white' }}>

                {/* Invoice Table */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: 'white' }}>
                        <th style={s.invoiceTh}>م</th>
                        <th style={{ ...s.invoiceTh, textAlign: 'right', minWidth: '160px' }}>البيان</th>
                        <th style={s.invoiceTh}>الكمية</th>
                        <th style={{ ...s.invoiceTh, minWidth: '90px' }}>الوحدة</th>
                        <th style={s.invoiceTh}>محتوى الوحدة (قطع)</th>
                        <th style={s.invoiceTh}>السعر (للوحدة)</th>
                        {addVat && <th style={s.invoiceTh}>الضريبة (15%)</th>}
                        <th style={s.invoiceTh}>{addVat ? 'الإجمالي' : 'الصافي'}</th>
                        <th style={{ ...s.invoiceTh, width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                            <ShoppingCart size={36} color="#e2e8f0" style={{ display: 'block', margin: '0 auto 12px' }} />
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>لا توجد أصناف</div>
                            <div style={{ fontSize: '12px' }}>اضغط على منتج من القائمة لإضافته للفاتورة</div>
                          </td>
                        </tr>
                      )}
                      {cart.map((item, idx) => {
                        const lineSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
                        const lineVat = addVat ? lineSubtotal * 0.15 : 0;
                        const lineTotal = lineSubtotal + lineVat;
                        const piecesCount = (parseFloat(item.quantity) || 0) * (parseFloat(item.pieces_per_unit) || 1);
                        const costPerPiece = (parseFloat(item.unit_cost) || 0) / (parseFloat(item.pieces_per_unit) || 1);
                        const isDefaultCost = !item.costManuallySet && item.originalCost > 0;
                        return (
                          <tr key={item.product_id} className="po-cart-row"
                            style={{ borderBottom: '1px solid #e8edf2', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                            {/* Row # */}
                            <td style={s.invoiceTd}>
                              <span style={{ fontWeight: '800', color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</span>
                            </td>
                            {/* Description */}
                            <td style={{ ...s.invoiceTd, textAlign: 'right' }}>
                              <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{item.name}</div>
                              {parseFloat(item.pieces_per_unit) > 1 && (
                                <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '2px' }}>
                                  ← {piecesCount.toFixed(0)} قطعة × {costPerPiece.toFixed(2)} ر.س
                                </div>
                              )}
                            </td>
                            {/* Quantity */}
                            <td style={s.invoiceTd}>
                              <input type="number" value={item.quantity} min="0.1" step="any"
                                onChange={e => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value) || 0)}
                                style={s.invoiceInput} />
                            </td>
                            {/* Unit */}
                            <td style={s.invoiceTd}>
                              <input list={`units-${item.product_id}`} value={item.unit_name}
                                placeholder="حبة"
                                onChange={e => {
                                  const val = e.target.value;
                                  updateCartItem(item.product_id, 'unit_name', val);
                                  const presets = { 'درزن': 12, 'حبة': 1, 'قطعة': 1, 'زوج': 2 };
                                  if (presets[val]) updateCartItem(item.product_id, 'pieces_per_unit', presets[val]);
                                }}
                                style={{ ...s.invoiceInput, textAlign: 'right', fontFamily: 'inherit' }} />
                              <datalist id={`units-${item.product_id}`}>
                                <option value="حبة" />
                                <option value="علبة" />
                                <option value="كرتون" />
                                <option value="درزن" />
                                <option value="زوج" />
                                <option value="كيلو" />
                                <option value="لتر" />
                                <option value="متر" />
                                <option value="ربطة" />
                                <option value="كيس" />
                              </datalist>
                            </td>
                            {/* Pieces per unit */}
                            <td style={s.invoiceTd}>
                              <input type="number" value={item.pieces_per_unit} min="1" step="1"
                                onChange={e => updateCartItem(item.product_id, 'pieces_per_unit', parseFloat(e.target.value) || 1)}
                                style={s.invoiceInput} />
                            </td>
                            {/* Price */}
                            <td style={s.invoiceTd}>
                              <div style={{ position: 'relative' }}>
                                <input type="number" value={item.unit_cost} min="0" step="0.01"
                                  onChange={e => updateCartItem(item.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                  style={{ ...s.invoiceInput, borderColor: isDefaultCost ? '#fbbf24' : '#e2e8f0', background: isDefaultCost ? '#fffbeb' : 'white' }} />
                                {isDefaultCost && (
                                  <span style={{ position: 'absolute', top: '-6px', left: '-4px', background: '#fbbf24', color: '#78350f', fontSize: '8px', fontWeight: '900', borderRadius: '4px', padding: '1px 4px', lineHeight: 1 }}>مبدئي</span>
                                )}
                              </div>
                            </td>
                            {/* VAT Column */}
                            {addVat && (
                              <td style={{ ...s.invoiceTd, fontWeight: '700', color: '#d97706', fontSize: '12px', background: '#fffbeb' }}>
                                {lineVat.toFixed(2)}
                              </td>
                            )}
                            {/* Amount */}
                            <td style={{ ...s.invoiceTd, fontWeight: '800', fontFamily: 'monospace', fontSize: '14px', color: '#0f172a', background: addVat ? '#f8fafc' : 'transparent' }}>
                              {lineTotal.toFixed(2)}
                            </td>
                            {/* Delete */}
                            <td style={s.invoiceTd}>
                              <button className="po-remove-btn" onClick={() => removeFromCart(item.product_id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '6px', display: 'flex', opacity: 0.4, transition: 'opacity 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Invoice Footer Summary ── */}
                <div style={{ borderTop: '2px solid #1e293b', background: '#f8fafc', flexShrink: 0 }}>
                  {/* Summary Table — like a real invoice */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 24px', gap: '24px' }}>

                    {/* Left side: Payment info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, maxWidth: '340px' }}>
                      {/* VAT Toggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                        <input type="checkbox" checked={addVat} onChange={e => setAddVat(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>إضافة ضريبة القيمة المضافة (15%)</span>
                      </label>
                      {/* Paid Amount */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>المبلغ المدفوع:</span>
                        <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                          placeholder="0.00" style={{ ...s.invoiceInput, flex: 1, fontWeight: '700' }} />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>ر.س</span>
                      </div>
                      {/* Payment status badge */}
                      {paid > 0 && (
                        <div style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', textAlign: 'center',
                          background: remaining === 0 ? '#ecfdf5' : '#fef2f2', color: remaining === 0 ? '#059669' : '#dc2626' }}>
                          {remaining === 0 ? '✓ مسدد بالكامل (نقدي)' : `آجل — متبقي: ${remaining.toFixed(2)} ر.س`}
                        </div>
                      )}
                    </div>

                    {/* Right side: Financial summary table */}
                    <div style={{ minWidth: '280px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>الإجمالي</td>
                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800', fontFamily: 'monospace', color: '#1e293b' }}>
                              {netTotal.toFixed(2)}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '700', color: addVat ? '#d97706' : '#94a3b8' }}>
                              ضريبة القيمة المضافة (15%)
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800', fontFamily: 'monospace', color: addVat ? '#d97706' : '#94a3b8' }}>
                              {addVat ? vatAmount.toFixed(2) : '—'}
                            </td>
                          </tr>
                          <tr style={{ background: '#1e293b' }}>
                            <td style={{ padding: '10px 12px', fontWeight: '900', color: 'white', fontSize: '14px' }}>الإجمالي شامل الضريبة</td>
                            <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', fontFamily: 'monospace', color: 'white', fontSize: '16px' }}>
                              {grossTotal.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: '600' }}>ر.س</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Save button row */}
                  <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-start', gap: '12px' }}>
                    <button onClick={handleSubmitOrder}
                      disabled={!selectedSupplier || cart.length === 0}
                      style={{ ...s.primaryBtn, padding: '12px 32px', fontSize: '15px',
                        opacity: (!selectedSupplier || cart.length === 0) ? 0.45 : 1,
                        cursor: (!selectedSupplier || cart.length === 0) ? 'not-allowed' : 'pointer' }}>
                      <Save size={17} /> حفظ فاتورة التوريد
                    </button>
                    <button onClick={handleCloseModal}
                      style={{ padding: '12px 24px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                      إلغاء
                    </button>
                    {!selectedSupplier && cart.length > 0 && (
                      <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', alignSelf: 'center' }}>⚠ يرجى اختيار المورد أولاً</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>{/* end modalShell */}
        </div>
      )}
      
      {/* PO DETAIL MODAL */}
      {detailOrder && (
        <div style={s.overlay}>
          <div style={{ ...s.detailModal }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>تفاصيل طلب #PO-{detailOrder.id}</h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>المورد: {detailOrder.supplier_name} · {new Date(detailOrder.created_at).toLocaleDateString('ar-SA')}</div>
              </div>
              <button onClick={() => setDetailOrder(null)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '10px', padding: '8px', display: 'flex' }}><X size={18} /></button>
            </div>
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري التحميل...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['المنتج', 'الكمية', 'التكلفة/وحدة', 'نوع', 'الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', fontSize: '12px', color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((it, i) => {
                    const pieces = it.pieces_per_unit || 1;
                    const displayQty = it.quantity;
                    const displayUnitCost = it.unit_cost;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px', fontWeight: '700' }}>
                          {it.product_name}
                          {pieces > 1 && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>إجمالي القطع: {it.quantity * pieces} قطعة ({pieces} قطع/{it.unit_name})</div>}
                        </td>
                        <td style={{ padding: '14px' }}>
                          {displayQty} {it.unit_name || (it.is_bulk ? (it.bulk_unit_name || 'كرتون') : (it.unit || 'وحدة'))}
                        </td>
                        <td style={{ padding: '14px', fontFamily: 'monospace' }}>SAR {displayUnitCost.toFixed(2)}</td>
                        <td style={{ padding: '14px' }}>
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                            {it.unit_name || 'وحدة'}
                          </span>
                        </td>
                        <td style={{ padding: '14px', fontWeight: '800', fontFamily: 'monospace' }}>
                          SAR {(it.quantity * it.unit_cost).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  الحالة: <strong style={{ color: detailOrder.status === 'received' ? '#10b981' : (detailOrder.status === 'returned' ? '#ef4444' : '#f59e0b') }}>
                    {detailOrder.status === 'received' ? 'مستلم' : (detailOrder.status === 'returned' ? 'مرتجع' : 'قيد الانتظار')}
                  </strong>
                </span>
                {detailOrder.status === 'received' && (
                  <button onClick={printLabelsForPO} style={{ background: '#fef3c7', color: '#d97706', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={13} /> طباعة ملصقات ({detailItems.reduce((a, it) => a + (it.is_bulk ? it.quantity * (it.bulk_unit_size || 1) : it.quantity), 0)})
                  </button>
                )}
              </div>
              <span style={{ fontWeight: '900', fontSize: '18px', fontFamily: 'monospace' }}>SAR {parseFloat(detailOrder.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE MODAL */}
      {showReceiveModal && (
        <div style={s.overlay}>
          <div style={{ ...s.detailModal, maxWidth: '750px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>استلام كميات #PO-{receivingPO.id}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>حدد الكميات التي وصلت فعلياً لتحديث المخزون</p>
              </div>
              <button onClick={() => setShowReceiveModal(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '10px', padding: '8px', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ maxHeight: '450px', overflowY: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {['المنتج', 'المطلوب', 'المستلم سابقاً', 'الاستلام الحالي'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map(it => {
                    const remaining = it.quantity - (it.received_quantity || 0);
                    return (
                      <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '700' }}>{it.product_name}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: '700' }}>{it.quantity} {it.is_bulk ? (it.bulk_unit_name || 'كرتون') : 'وحدة'}</td>
                        <td style={{ padding: '12px 14px', color: '#10b981', fontWeight: '800' }}>{it.received_quantity || 0}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              value={receiveQtys[it.product_id] || 0}
                              onChange={e => setReceiveQtys({ ...receiveQtys, [it.product_id]: parseFloat(e.target.value) || 0 })}
                              style={{ ...s.numInput, width: '80px', border: '2px solid #3b82f6' }}
                              max={remaining} min={0}
                            />
                            {remaining > 0 && (
                              <button onClick={() => setReceiveQtys({ ...receiveQtys, [it.product_id]: remaining })}
                                style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                الكل ({remaining})
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowReceiveModal(false)} style={{ flex: 1, padding: '13px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
              <button onClick={handleConfirmReceive} style={{ flex: 2, padding: '13px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}>
                <Archive size={16} /> تأكيد استلام الكميات المحددة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          RETURN MODAL — Full or Partial
      ═══════════════════════════════════════ */}
      {showReturnModal && returnOrder && (
        <div style={s.overlay}>
          <div style={{ ...s.detailModal, maxWidth: '800px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius: '12px', padding: '8px', display: 'flex' }}>
                    <RotateCcw size={18} color="white" />
                  </div>
                  <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>
                    إرجاع طلب #PO-{returnOrder.id}
                  </h2>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, paddingRight: '50px' }}>
                  المورد: {returnOrder.supplier_name} · اختر نوع الإرجاع
                </p>
              </div>
              <button onClick={() => setShowReturnModal(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', background: '#f8fafc', padding: '6px', borderRadius: '14px' }}>
              <button
                onClick={() => setReturnMode('full')}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '800', fontSize: '14px', fontFamily: 'inherit', transition: 'all .2s',
                  background: returnMode === 'full' ? '#ef4444' : 'transparent',
                  color: returnMode === 'full' ? 'white' : '#64748b',
                  boxShadow: returnMode === 'full' ? '0 4px 12px rgba(239,68,68,0.35)' : 'none',
                }}
              >
                <X size={15} style={{ verticalAlign: 'middle', marginLeft: '6px' }} />
                إرجاع كامل
              </button>
              <button
                onClick={() => {
                  setReturnMode('partial');
                  setReturnItems(ri => ri.map(it => ({ ...it, returnQty: 0 })));
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '800', fontSize: '14px', fontFamily: 'inherit', transition: 'all .2s',
                  background: returnMode === 'partial' ? '#9333ea' : 'transparent',
                  color: returnMode === 'partial' ? 'white' : '#64748b',
                  boxShadow: returnMode === 'partial' ? '0 4px 12px rgba(147,51,234,0.35)' : 'none',
                }}
              >
                <RotateCcw size={15} style={{ verticalAlign: 'middle', marginLeft: '6px' }} />
                إرجاع جزئي
              </button>
            </div>

            {/* Full Return Summary */}
            {returnMode === 'full' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontWeight: '800', color: '#dc2626', fontSize: '15px', marginBottom: '12px' }}>
                  ⚠️ سيتم إرجاع جميع الأصناف التالية
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #fecaca' }}>
                      {['المنتج', 'الكمية المطلوبة', 'الوحدة', 'التكلفة / وحدة'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#dc2626', fontSize: '12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map(it => (
                      <tr key={it.product_id} style={{ borderBottom: '1px solid #fee2e2' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '700' }}>{it.product_name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '800' }}>{it.orderedQty}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{it.unit_name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>SAR {it.unit_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '14px', fontWeight: '800', color: '#dc2626', fontSize: '14px', textAlign: 'left' }}>
                  الإجمالي المرتجع: SAR {returnItems.reduce((a, it) => a + (it.orderedQty * it.unit_cost), 0).toFixed(2)}
                </div>
              </div>
            )}

            {/* Partial Return Table */}
            {returnMode === 'partial' && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: '14px', padding: '14px 16px', marginBottom: '14px', fontSize: '13px', color: '#7e22ce', fontWeight: '700' }}>
                  أدخل الكمية المرتجعة لكل صنف. اتركها صفراً للأصناف التي لن تُرجعها.
                </div>
                <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        {['المنتج', 'تم الطلب', 'الوحدة', 'الكمية المرتجعة', 'الإجمالي المرتجع'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', fontSize: '12px', color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((it, idx) => (
                        <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9', background: parseFloat(it.returnQty) > 0 ? '#fdf4ff' : 'transparent', transition: 'background .15s' }}>
                          <td style={{ padding: '12px', fontWeight: '700' }}>{it.product_name}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '800', color: '#64748b' }}>{it.orderedQty}</td>
                          <td style={{ padding: '12px', color: '#94a3b8', fontSize: '12px' }}>{it.unit_name}</td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                min="0"
                                max={it.orderedQty}
                                value={it.returnQty}
                                onChange={e => {
                                  const val = Math.min(parseFloat(e.target.value) || 0, it.orderedQty);
                                  setReturnItems(ri => ri.map((r, i) => i === idx ? { ...r, returnQty: val } : r));
                                }}
                                style={{ ...s.numInput, width: '80px', border: `2px solid ${parseFloat(it.returnQty) > 0 ? '#9333ea' : '#e2e8f0'}` }}
                              />
                              <button
                                onClick={() => setReturnItems(ri => ri.map((r, i) => i === idx ? { ...r, returnQty: it.orderedQty } : r))}
                                style={{ background: '#fdf4ff', color: '#9333ea', border: '1px solid #e9d5ff', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                              >
                                الكل
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '800', color: parseFloat(it.returnQty) > 0 ? '#9333ea' : '#94a3b8' }}>
                            SAR {(parseFloat(it.returnQty) * it.unit_cost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '14px', padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {returnItems.filter(it => parseFloat(it.returnQty) > 0).length} صنف محدد للإرجاع
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '17px', fontFamily: 'monospace', color: '#9333ea' }}>
                    الإجمالي المرتجع: SAR {returnItems.reduce((a, it) => a + (parseFloat(it.returnQty) * it.unit_cost), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowReturnModal(false)}
                style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                إلغاء
              </button>
              <button
                onClick={returnMode === 'full' ? handleConfirmFullReturn : handleConfirmPartialReturn}
                disabled={submittingReturn}
                style={{
                  flex: 2, padding: '14px', border: 'none', borderRadius: '12px',
                  fontWeight: '800', cursor: submittingReturn ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontFamily: 'inherit', fontSize: '15px',
                  background: submittingReturn ? '#94a3b8' : (returnMode === 'full' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#9333ea,#7c3aed)'),
                  color: 'white',
                  boxShadow: submittingReturn ? 'none' : `0 4px 14px ${returnMode === 'full' ? 'rgba(239,68,68,0.4)' : 'rgba(147,51,234,0.4)'}`,
                }}
              >
                <RotateCcw size={17} />
                {submittingReturn ? 'جاري الإرجاع...' : (returnMode === 'full' ? 'تأكيد الإرجاع الكامل' : 'تأكيد الإرجاع الجزئي')}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}

// ─── Style tokens ───────────────────────────────────────────────────────────
const s = {
  th: { padding: '14px 20px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', background: 'var(--bg-card)' },
  td: { padding: '14px 20px', fontSize: '13px', color: 'var(--text-main)' },
  primaryBtn: {
    background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', border: 'none',
    padding: '11px 22px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontFamily: 'inherit'
  },
  actionBtn: (bg, color) => ({
    padding: '6px 12px', background: bg, color, border: 'none', borderRadius: '8px',
    fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '5px', fontFamily: 'inherit'
  }),
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modalShell: {
    background: 'var(--bg-card)', borderRadius: '24px', width: '95vw', maxWidth: '1100px',
    height: '90vh', boxShadow: '0 32px 64px rgba(0,0,0,0.15)', direction: 'rtl',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  detailModal: {
    background: 'var(--bg-card)', borderRadius: '24px', padding: '28px', maxWidth: '680px',
    width: '95%', boxShadow: '0 25px 50px rgba(0,0,0,0.12)', direction: 'rtl',
    maxHeight: '90vh', overflowY: 'auto'
  },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'var(--bg-card)',
    boxSizing: 'border-box', color: 'var(--text-main)'
  },
  numInput: {
    width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', outline: 'none',
    background: 'var(--bg-card)', boxSizing: 'border-box', textAlign: 'center'
  },
  fieldLabel: {
    display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
    marginBottom: '6px', letterSpacing: '0.3px'
  },
  invoiceTh: {
    padding: '10px 12px', fontSize: '12px', fontWeight: '800', textAlign: 'center',
    whiteSpace: 'nowrap', letterSpacing: '0.3px'
  },
  invoiceTd: {
    padding: '8px 10px', fontSize: '13px', textAlign: 'center', verticalAlign: 'middle'
  },
  invoiceInput: {
    width: '100%', padding: '7px 8px', borderRadius: '6px', border: '1px solid #e2e8f0',
    fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', outline: 'none',
    background: 'white', boxSizing: 'border-box', textAlign: 'center', color: '#1e293b',
    minWidth: '60px'
  },
};
