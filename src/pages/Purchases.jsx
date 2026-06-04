import { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import {
  ShoppingBag, Plus, Search, Trash2, CheckCircle2,
  Truck, Archive, ArrowLeftRight, Save, X,
  Eye, Tag, Package, ShoppingCart, ChevronLeft
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
  const [vatIncluded, setVatIncluded] = useState(true);
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
      const actualQty = it.is_bulk ? it.quantity * (it.bulk_unit_size || 1) : it.quantity;
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
        is_bulk: false,
        bulk_size: product.BulkUnitSize || 1,
        bulk_name: product.BulkUnitName || 'كرتون'
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
    return acc + (c.is_bulk ? qty * unitCost * (c.bulk_size || 1) : qty * unitCost);
  }, 0);

  const netTotal = calculateTotal();
  const vatAmount = vatIncluded ? parseFloat((netTotal * 0.15).toFixed(2)) : 0;
  const grossTotal = parseFloat((netTotal + vatAmount).toFixed(2));
  const paid = parseFloat(paidAmount) || 0;
  const remaining = Math.max(0, grossTotal - paid);

  const handleSubmitOrder = async () => {
    if (!selectedSupplier) return toast('يرجى اختيار المورد', 'warn');
    if (cart.length === 0) return toast('يرجى إضافة منتج واحد على الأقل', 'warn');
    const invalidItems = cart.filter(c => !c.quantity || c.quantity <= 0 || !c.unit_cost || c.unit_cost <= 0);
    if (invalidItems.length > 0) return toast('يرجى التأكد من إدخال الكمية والتكلفة لجميع المنتجات', 'warn');
    const staleCosts = cart.filter(c => !c.costManuallySet && c.originalCost > 0);
    if (staleCosts.length > 0) {
      const ok = confirm(`تنبيه: ${staleCosts.length} منتج يحتوي على سعر مبدئي ولم يتم تحديثه من الفاتورة. هل تريد المتابعة؟`);
      if (!ok) return;
    }
    try {
      await window.api.createPurchaseOrder({
        supplier_id: parseInt(selectedSupplier),
        total_amount: netTotal,
        vat_included: vatIncluded,
        paid_amount: paid,
        payment_status: paid >= grossTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        items: cart.map(c => ({
          product_id: c.product_id,
          quantity: parseFloat(c.quantity),
          unit_cost: parseFloat(c.unit_cost),
          is_bulk: c.is_bulk,
        })),
        note
      });
      setShowAddModal(false); setCart([]); setSelectedSupplier('');
      setNote(''); setProductSearch(''); setVatIncluded(true); setPaidAmount('');
      fetchData();
      toast('تم حفظ طلب الشراء بنجاح', 'success');
    } catch (e) { toast('خطأ في حفظ الطلب: ' + e.message, 'error'); }
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
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .po-remove-btn { opacity: 0; transition: opacity 0.15s; }
        .po-cart-row:hover .po-remove-btn { opacity: 1; }
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
                        {o.status !== 'received' && (
                          <button onClick={() => handleOpenReceive(o)} disabled={receiving === o.id} style={s.actionBtn('#eff6ff', '#3b82f6')}>
                            <Archive size={13} /> {receiving === o.id ? 'جاري...' : 'استلام'}
                          </button>
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
          CREATE ORDER MODAL — 3-panel redesign
      ═══════════════════════════════════════════════════ */}
      {showAddModal && (
        <div style={s.overlay}>
          <div style={s.modalShell}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #e8edf2', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', borderRadius: '12px', padding: '8px', display: 'flex' }}>
                  <ShoppingCart size={18} color="white" />
                </div>
                <div>
                  <h2 style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>طلب توريد جديد</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{cart.length === 0 ? 'اختر منتجات من القائمة' : `${cart.length} ${cart.length === 1 ? 'منتج' : 'منتجات'} في الطلب`}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '10px', padding: '8px', display: 'flex', lineHeight: 1 }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 3 columns */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* ── COL 1: Product Browser ── */}
              <div style={{ width: '280px', flexShrink: 0, borderLeft: '1px solid #e8edf2', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e8edf2' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      placeholder="بحث بالاسم أو الباركود..."
                      style={{ ...s.input, paddingRight: '36px', fontSize: '13px', padding: '10px 36px 10px 12px' }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                  {filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {productSearch ? `لا نتائج لـ "${productSearch}"` : 'لا توجد منتجات'}
                    </div>
                  )}
                  {filteredProducts.map(p => {
                    const inCart = cart.find(c => c.product_id === p.ID);
                    return (
                      <div key={p.ID} className="po-product-row" onClick={() => addToCart(p)}
                        style={{ padding: '10px 12px', background: inCart ? '#eff6ff' : 'var(--bg-card)', border: `1px solid ${inCart ? '#bfdbfe' : '#e8edf2'}`, borderRadius: '12px', marginBottom: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.Name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            مخزون: {p.Stock} · SAR {(p.Cost || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="po-add-btn" style={{ background: inCart ? '#3b82f6' : '#dbeafe', borderRadius: '8px', padding: '4px', display: 'flex', opacity: inCart ? 1 : 0.6, transform: inCart ? 'scale(1)' : 'scale(0.9)', transition: 'all 0.15s', flexShrink: 0, marginRight: '8px' }}>
                          {inCart
                            ? <span style={{ fontSize: '10px', fontWeight: '800', color: 'white', padding: '0 4px' }}>×{inCart.quantity}</span>
                            : <Plus size={14} color="#3b82f6" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── COL 2: Cart Items ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Cart header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', flexShrink: 0 }}>
                  <Package size={15} color="#64748b" />
                  <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-muted)' }}>أصناف الطلب</span>
                  {cart.length > 0 && (
                    <span style={{ background: '#3b82f6', color: 'white', fontSize: '11px', fontWeight: '800', borderRadius: '20px', padding: '1px 8px', marginRight: 'auto' }}>{cart.length}</span>
                  )}
                </div>

                {/* Cart items list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cart.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px', padding: '40px' }}>
                      <div style={{ background: '#f1f5f9', borderRadius: '50%', padding: '20px', display: 'flex' }}>
                        <ShoppingCart size={32} color="#cbd5e1" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>الطلب فارغ</div>
                        <div style={{ fontSize: '12px' }}>اختر منتجات من القائمة على اليسار لإضافتها</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                        <ChevronLeft size={14} /> اضغط على أي منتج لإضافته
                      </div>
                    </div>
                  )}

                  {cart.map(item => {
                    const lineTotal = item.is_bulk
                      ? item.quantity * item.unit_cost * (item.bulk_size || 1)
                      : item.quantity * item.unit_cost;
                    return (
                      <div key={item.product_id} className="po-cart-row"
                        style={{ background: 'var(--bg-card)', border: '1px solid #e8edf2', borderRadius: '16px', padding: '16px', position: 'relative' }}>
                        {/* Row top: name + remove */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-main)' }}>{item.name}</div>
                          <button className="po-remove-btn" onClick={() => removeFromCart(item.product_id)}
                            style={{ background: '#fef2f2', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '4px 8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }}>
                            <Trash2 size={12} /> حذف
                          </button>
                        </div>

                        {/* Row controls */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                          {/* Quantity */}
                          <div>
                            <label style={s.fieldLabel}>الكمية ({item.is_bulk ? item.bulk_name : 'وحدة'})</label>
                            <input
                              type="number" value={item.quantity} min="0.1" step="1"
                              onChange={e => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value) || 0)}
                              style={s.numInput}
                            />
                            {item.is_bulk && (
                              <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px', fontWeight: '700' }}>
                                = {(item.quantity * item.bulk_size).toFixed(0)} وحدة مفردة
                              </div>
                            )}
                          </div>

                          {/* Unit cost */}
                          <div>
                            <label style={s.fieldLabel}>
                              تكلفة {item.is_bulk ? item.bulk_name : 'الوحدة'} (SAR)
                              {!item.costManuallySet && item.originalCost > 0 && (
                                <span title="سعر مبدئي" style={{ background: '#fef9c3', color: '#854d0e', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '800', marginRight: '4px' }}>⚠ مبدئي</span>
                              )}
                            </label>
                            <input
                              type="number" value={item.unit_cost} min="0" step="0.01"
                              onChange={e => updateCartItem(item.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                              style={{ ...s.numInput, borderColor: !item.costManuallySet && item.originalCost > 0 ? '#fbbf24' : '#e2e8f0' }}
                            />
                          </div>

                          {/* Line total + bulk toggle */}
                          <div>
                            <label style={s.fieldLabel}>إجمالي الصنف</label>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '9px 12px', fontWeight: '800', fontSize: '14px', color: '#1e293b', fontFamily: 'monospace' }}>
                              {lineTotal.toFixed(2)}
                            </div>
                            {item.bulk_size > 1 && (
                              <button onClick={() => updateCartItem(item.product_id, 'is_bulk', !item.is_bulk)}
                                style={{ marginTop: '6px', padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '800', background: item.is_bulk ? '#3b82f6' : '#e2e8f0', color: item.is_bulk ? 'white' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                                <ArrowLeftRight size={10} /> {item.is_bulk ? `آحاد (×${item.bulk_size})` : 'بالة/كرتون'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── COL 3: Order Summary ── */}
              <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid #e8edf2', display: 'flex', flexDirection: 'column', background: '#fafbfc' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8edf2', background: 'var(--bg-card)' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-muted)' }}>ملخص الطلب</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Supplier */}
                  <div>
                    <label style={s.fieldLabel}>المورد المستهدف *</label>
                    <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={s.input}>
                      <option value="">اختر مورداً...</option>
                      {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={s.fieldLabel}>ملاحظات</label>
                    <textarea
                      placeholder="ملاحظات اختيارية..."
                      value={note} onChange={e => setNote(e.target.value)}
                      style={{ ...s.input, minHeight: '70px', resize: 'vertical', fontSize: '13px' }}
                    />
                  </div>

                  {/* VAT toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'var(--bg-card)', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e8edf2' }}>
                    <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>شاملة ضريبة القيمة المضافة (15%)</span>
                  </label>

                  {/* Totals breakdown */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid #e8edf2', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>صافي التوريد</span>
                      <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>SAR {netTotal.toFixed(2)}</span>
                    </div>
                    {vatIncluded && (
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#f59e0b' }}>ضريبة 15%</span>
                        <span style={{ fontWeight: '700', color: '#f59e0b', fontFamily: 'monospace' }}>SAR {vatAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', background: '#f8fafc', borderTop: '2px solid #e8edf2' }}>
                      <span style={{ fontWeight: '800', fontSize: '15px' }}>الإجمالي الكلي</span>
                      <span style={{ fontWeight: '900', fontSize: '16px', fontFamily: 'monospace', color: '#1e293b' }}>SAR {grossTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid #e8edf2', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={s.fieldLabel}>المبلغ المدفوع (SAR)</label>
                      <input
                        type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                        placeholder="0.00" style={{ ...s.input, fontFamily: 'monospace', fontWeight: '700' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 12px', borderRadius: '10px', background: remaining > 0 ? '#fef2f2' : '#ecfdf5' }}>
                      <span style={{ fontWeight: '700', color: remaining > 0 ? '#ef4444' : '#10b981' }}>
                        {remaining > 0 ? 'المبلغ المتبقي' : 'مسدد بالكامل ✓'}
                      </span>
                      {remaining > 0 && (
                        <span style={{ fontWeight: '800', color: '#ef4444', fontFamily: 'monospace' }}>SAR {remaining.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div style={{ padding: '16px', borderTop: '1px solid #e8edf2', background: 'var(--bg-card)', flexShrink: 0 }}>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={!selectedSupplier || cart.length === 0}
                    style={{ ...s.primaryBtn, width: '100%', justifyContent: 'center', padding: '14px', opacity: (!selectedSupplier || cart.length === 0) ? 0.45 : 1, cursor: (!selectedSupplier || cart.length === 0) ? 'not-allowed' : 'pointer' }}>
                    <Save size={16} /> حفظ طلب الشراء
                  </button>
                  {cart.length === 0 && (
                    <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>أضف منتجاً واحداً على الأقل</div>
                  )}
                </div>
              </div>

            </div>{/* end 3-col body */}
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
                  {detailItems.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px', fontWeight: '700' }}>{it.product_name}</td>
                      <td style={{ padding: '14px' }}>{it.quantity} {it.is_bulk ? (it.bulk_unit_name || 'كرتون') : (it.unit || 'وحدة')}</td>
                      <td style={{ padding: '14px', fontFamily: 'monospace' }}>SAR {parseFloat(it.unit_cost).toFixed(2)}</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ background: it.is_bulk ? '#eff6ff' : '#f1f5f9', color: it.is_bulk ? '#3b82f6' : '#64748b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                          {it.is_bulk ? `بالة ×${it.bulk_unit_size || 1}` : 'وحدة'}
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: '800', fontFamily: 'monospace' }}>
                        SAR {(it.quantity * it.unit_cost * (it.is_bulk ? (it.bulk_unit_size || 1) : 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  الحالة: <strong style={{ color: detailOrder.status === 'received' ? '#10b981' : '#f59e0b' }}>
                    {detailOrder.status === 'received' ? 'مستلم' : 'قيد الانتظار'}
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
};
