import { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import JsBarcode from 'jsbarcode';
import { 
  ShoppingBag, Plus, Search, Trash2, CheckCircle2, 
  Truck, Archive, ArrowLeftRight, Save, X, Calendar,
  Eye, Printer, AlertTriangle, Tag
} from 'lucide-react';
import { useToast } from '../components/ToastManager';

export default function Purchases() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(null); // track which PO is being received
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingPO, setReceivingPO] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveQtys, setReceiveQtys] = useState({}); // { product_id: qty }
  
  // Create Order State
  const [showAddModal, setShowAddModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [vatIncluded, setVatIncluded] = useState(true); // 3-B

  // Detail Modal State (2-A)
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [note, setNote] = useState('');

  // Feature 4: Label Printing State
  const [settings, setSettings] = useState({});
  const [labelConfig, setLabelConfig] = useState({
    showBusinessName: true, showProductName: true, showPrice: true, showBarcode: true,
    fieldsOrder: ['business', 'name', 'price', 'barcode'], size: '50x30'
  });

  // FIX BUG 5: Add search state that actually filters the product list
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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
          try { setLabelConfig(JSON.parse(sets.label_config)); } catch(e){}
        }
      }
    } catch (e) {
      console.error('Failed to load purchases data:', e);
      toast('تعذّر تحميل بيانات المشتريات: ' + e.message, 'error');
    }
    setLoading(false);
  };

  // FIX BUG 5: Memoized filtered products based on search input
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
    const bizName = settings.business_name_ar || 'نظام البصمة الذكية';
    const [w, h] = labelConfig.size.split('x');

    // Build the HTML for all labels
    let allLabelsHtml = '';
    detailItems.forEach(it => {
      // Find original product to get Barcode (purchase items might not store barcode currently)
      const p = products.find(prod => prod.ID === it.product_id) || {};
      const actualQty = it.is_bulk ? it.quantity * (it.bulk_unit_size || 1) : it.quantity;
      // Option: print one label per actual unit, or just 1 label per line item?
      // Usually, cashiers print tags for the newly arrived stock, so we loop over actualQty
      // But if it's too much, we limit it. Let's ask via prompt or default to actualQty (max 500)
      const printCount = Math.min(parseInt(actualQty), 500);

      const canvas = document.createElement('canvas');
      let barcodeDataUrl = '';
      try {
        JsBarcode(canvas, String(p.Barcode || p.ID || it.product_id), {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          width: 2,
          height: 40
        });
        barcodeDataUrl = canvas.toDataURL("image/png");
      } catch (e) {
        console.warn("Barcode generation failed", e);
      }

      const fields = {
        business: `<div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">${bizName}</div>`,
        name: `<div style="font-size: 10px; font-weight: bold; margin-bottom: 2px; height: 12px; overflow: hidden;">${it.product_name}</div>`,
        price: `<div style="font-size: 16px; font-weight: 900; margin: 2px 0;">SAR ${(p.Price || 0).toFixed(2)}</div>`,
        barcode: `<div style="text-align: center;">
                    ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" style="max-width: 100%; height: 28px; margin-top: 2px;" />` : ''}
                    <div style="font-size: 8px; letter-spacing: 2px; margin-top: 2px;">${p.Barcode || p.ID || it.product_id}</div>
                  </div>`
      };

      const orderedFields = labelConfig.fieldsOrder.filter(f => {
        if (f === 'business') return labelConfig.showBusinessName;
        if (f === 'name')     return labelConfig.showProductName;
        if (f === 'price')    return labelConfig.showPrice;
        if (f === 'barcode')  return labelConfig.showBarcode;
        return false;
      }).map(f => fields[f]).join('');

      for (let i = 0; i < printCount; i++) {
        allLabelsHtml += `<div class="label-page">${orderedFields}</div>`;
      }
    });

    const html = `
      <html>
      <head>
        <style>
          @page { size: ${w}mm ${h}mm; margin: 0; }
          body { font-family: sans-serif; text-align: center; margin: 0; padding: 0; background: white; }
          .label-page {
            width: ${w}mm; height: ${h}mm; 
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            padding: 2px; box-sizing: border-box; overflow: hidden; page-break-after: always;
          }
        </style>
      </head>
      <body>
        ${allLabelsHtml}
      </body>
      </html>
    `;
    if (window.api?.printHTML) {
      window.api.printHTML(html);
    } else {
      const win = window.open('', '_blank', `width=${parseInt(w)*3},height=${parseInt(h)*3}`);
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
      }
    }
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
        costManuallySet: false, // 1-A stale tracking
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
      // 1-A: mark cost as manually set when user edits it
      if (key === 'unit_cost') updated.costManuallySet = true;
      return updated;
    }));
  };

  // FIX BUG 6: Total calculation now matches how the backend stores it.
  // The backend stores unit_cost per single unit (not inflated by bulk_size).
  // Display total = qty * unit_cost for individual units,
  //               = qty * (unit_cost * bulk_size) for bulk (since qty is number of boxes/cartons)
  const calculateTotal = () => cart.reduce((acc, c) => {
    const unitCost = parseFloat(c.unit_cost) || 0;
    const qty = parseFloat(c.quantity) || 0;
    if (c.is_bulk) {
      return acc + (qty * unitCost * (c.bulk_size || 1));
    }
    return acc + (qty * unitCost);
  }, 0);

  // 1-A: VAT breakdown totals
  const netTotal = calculateTotal();
  const vatAmount = vatIncluded ? parseFloat((netTotal * 0.15).toFixed(2)) : 0;
  const grossTotal = parseFloat((netTotal + vatAmount).toFixed(2));

  const handleSubmitOrder = async () => {
    if (!selectedSupplier) return toast('يرجى اختيار المورد', 'warn');
    if (cart.length === 0)  return toast('يرجى إضافة منتج واحد على الأقل', 'warn');
    const invalidItems = cart.filter(c => !c.quantity || c.quantity <= 0 || !c.unit_cost || c.unit_cost <= 0);
    if (invalidItems.length > 0) return toast('يرجى التأكد من إدخال الكمية والتكلفة لجميع المنتجات', 'warn');
    // 1-A: warn if stale costs
    const staleCosts = cart.filter(c => !c.costManuallySet && c.originalCost > 0);
    if (staleCosts.length > 0) {
      const ok = confirm(`تنبيه: ${staleCosts.length} منتج يحتوي على سعر مبدئي (آخر تكلفة مسجلة) ولم يتم تحديثه من الفاتورة. هل تريد المتابعة؟`);
      if (!ok) return;
    }
    try {
        await window.api.createPurchaseOrder({
            supplier_id: parseInt(selectedSupplier),
            total_amount: netTotal,
            vat_included: vatIncluded, // 3-B
            items: cart.map(c => ({
              product_id: c.product_id,
              quantity: parseFloat(c.quantity),
              unit_cost: parseFloat(c.unit_cost),
              is_bulk: c.is_bulk,
            })),
            note
        });
        setShowAddModal(false); setCart([]); setSelectedSupplier('');
        setNote(''); setProductSearch(''); setVatIncluded(true);
        fetchData();
    } catch (e) { toast('خطأ في حفظ الطلب: ' + e.message, 'error'); }
  };

  const handleOpenReceive = async (order) => {
    setReceivingPO(order);
    setReceiving(order.id);
    try {
      const items = await window.api.getPurchaseItems(order.id);
      setReceiveItems(items || []);
      const initialQtys = {};
      items.forEach(it => {
        // Default to receiving the remaining balance
        initialQtys[it.product_id] = Math.max(0, it.quantity - (it.received_quantity || 0));
      });
      setReceiveQtys(initialQtys);
      setShowReceiveModal(true);
    } catch (e) { toast('خطأ في تحميل الأصناف: ' + e.message, 'error'); }
    setReceiving(null);
  };

  const handleConfirmReceive = async () => {
    const payload = Object.entries(receiveQtys).map(([pid, qty]) => ({
      product_id: parseInt(pid),
      received_qty: parseFloat(qty) || 0
    })).filter(x => x.received_qty > 0);

    if (payload.length === 0) return toast('يرجى تحديد الكميات المستلمة', 'warn');

    setReceiving(receivingPO.id);
    try {
      await window.api.receivePurchaseOrder(receivingPO.id, payload);
      setShowReceiveModal(false);
      setReceivingPO(null);
      await fetchData();
    } catch (e) {
      toast('خطأ في الاستلام: ' + e.message, 'error');
    }
    setReceiving(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setCart([]);
    setSelectedSupplier('');
    setNote('');
    setProductSearch('');
  };

  return (
    <AppLayout title="إدارة المشتريات والتوريد">
      <div style={{ display:'flex', flexDirection:'column', gap:'24px', flex:1, minHeight:0 }}>
        
        {/* Header Actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'20px 24px', borderRadius:'20px', border:'1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontWeight:'900', fontSize:'18px', color:'#1e293b' }}>سجل التوريدات</h2>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginTop:'2px' }}>تتبع طلبيات الشراء واستلام المخزون من الموردين</p>
          </div>
          <button onClick={() => setShowAddModal(true)} style={primaryBtn}>
            <Plus size={18} /> إنشاء طلب توريد جديد
          </button>
        </div>

        {/* Orders Table */}
        <div style={{ background:'white', borderRadius:'24px', border:'1px solid #f1f5f9', overflowY:'auto', flex:1, minHeight:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
            <thead style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
               <tr>
                 <th style={thStyle}>رقم الطلب</th>
                 <th style={thStyle}>المورد</th>
                 <th style={thStyle}>الإجمالي (SAR)</th>
                 <th style={thStyle}>الحالة</th>
                 <th style={thStyle}>التاريخ</th>
                 <th style={thStyle}>الإجراءات</th>
               </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                  <td style={tdStyle}><span style={{ fontWeight:'800', color:'#3b82f6' }}>#PO-{o.id}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <Truck size={14} color="#94a3b8"/> {o.supplier_name}
                    </div>
                  </td>
                  <td style={tdStyle}><span style={{ fontWeight:'900' }}>{parseFloat(o.total_amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</span></td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:'800',
                      background: o.status === 'received' ? '#ecfdf5' : (o.status === 'partial' ? '#eff6ff' : '#fff7ed'),
                      color: o.status === 'received' ? '#10b981' : (o.status === 'partial' ? '#3b82f6' : '#f59e0b'),
                      display:'inline-flex', alignItems:'center', gap:'4px'
                    }}>
                      {o.status === 'received' ? <CheckCircle2 size={12}/> : <div style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}}/>}
                      {o.status === 'received' ? 'تم الاستلام' : (o.status === 'partial' ? 'استلام جزئي' : 'قيد الانتظار')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize:'12px', color:'#64748b' }}>
                      {new Date(o.created_at).toLocaleDateString('ar-SA')}
                    </div>
                  </td>
                  <td style={tdStyle}>
                     {o.status !== 'received' ? (
                       <div style={{ display:'flex', gap:'8px' }}>
                         <button onClick={() => handleOpenReceive(o)} disabled={receiving === o.id}
                           style={{ ...receiveBtn, opacity: receiving === o.id ? 0.6 : 1 }}>
                           <Archive size={14}/> {receiving === o.id ? 'جاري...' : 'استلام'}
                         </button>
                         <button onClick={() => handleViewDetail(o)} style={{ ...receiveBtn, background:'#f5f3ff', color:'#7c3aed' }}>
                           <Eye size={14}/> تفاصيل
                         </button>
                       </div>
                     ) : (
                       <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                         <span style={{ color:'#94a3b8', fontSize:'12px', fontWeight:'700' }}>
                           مكتمل ({o.received_at ? new Date(o.received_at).toLocaleDateString('ar-SA') : '—'})
                         </span>
                         <button onClick={() => handleViewDetail(o)} style={{ ...receiveBtn, background:'#f5f3ff', color:'#7c3aed' }}>
                           <Eye size={14}/> تفاصيل
                         </button>
                       </div>
                      )}
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
           {orders.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>
              <ShoppingBag size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>لا توجد طلبيات شراء حتى الآن</div>
            </div>
          )}
          {loading && (
            <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>جاري التحميل...</div>
          )}
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {showAddModal && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
              <h2 style={{ fontWeight:'900', fontSize:'22px' }}>طلب توريد جديد</h2>
              <button onClick={handleCloseModal} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24} /></button>
            </div>

            <div style={{ display:'flex', gap:'24px', height:'600px' }}>
              {/* Product Selection List */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'12px' }}>
                <div style={{ position:'relative' }}>
                  <Search size={16} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
                  {/* FIX BUG 5: Wire up value and onChange so search actually works */}
                  <input 
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="ابحث عن منتج بالاسم أو الباركود..."
                    style={{ ...inputStyle, paddingRight:'38px' }}
                  />
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'4px', display:'flex', flexDirection:'column', gap:'8px' }}>
                   {filteredProducts.length === 0 && (
                     <div style={{ textAlign:'center', padding:'30px', color:'#94a3b8', fontSize:'13px' }}>
                       {productSearch ? `لا نتائج لـ "${productSearch}"` : 'لا توجد منتجات'}
                     </div>
                   )}
                   {filteredProducts.map(p => (
                     <div key={p.ID} onClick={() => addToCart(p)} style={productCard}>
                        <div>
                          <div style={{ fontWeight:'800', fontSize:'14px' }}>{p.Name}</div>
                          <div style={{ fontSize:'11px', color:'#64748b' }}>
                            المخزون: {p.Stock} • آخر تكلفة: SAR {(p.Cost || 0).toFixed(2)}
                          </div>
                        </div>
                        <Plus size={16} color="#3b82f6" />
                     </div>
                   ))}
                </div>
              </div>

              {/* Order Cart */}
              <div style={{ flex:1.5, background:'#f8fafc', borderRadius:'20px', padding:'20px', display:'flex', flexDirection:'column' }}>
                <div style={{ marginBottom:'20px' }}>
                    <label style={labelStyle}>المورد المستهدف *</label>
                    <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={inputStyle}>
                      <option value="">اختر مورد...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px' }}>
                   {cart.length === 0 && (
                     <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8', fontSize:'13px' }}>
                       انقر على منتج لإضافته للطلب
                     </div>
                   )}
                   {cart.map(item => (
                     <div key={item.product_id} style={cartItem}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:'800', fontSize:'13px' }}>{item.name}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
                            <input 
                              type="number" 
                              value={item.quantity} 
                              min="0.1"
                              step="1"
                              onChange={e => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value) || 0)} 
                              style={qtyInput} 
                            />
                            <span style={{ fontSize:'12px', fontWeight:'700', color:'#64748b' }}>
                              {item.is_bulk ? item.bulk_name : 'وحدة'}
                            </span>
                            {item.bulk_size > 1 && (
                              <button onClick={() => updateCartItem(item.product_id, 'is_bulk', !item.is_bulk)} style={bulkToggle(item.is_bulk)}>
                                  <ArrowLeftRight size={12} /> {item.is_bulk ? `آحاد (×${item.bulk_size})` : 'بالة/كرتون'}
                              </button>
                            )}
                          </div>
                          {item.is_bulk && (
                            <div style={{ fontSize:'10px', color:'#3b82f6', marginTop:'4px', fontWeight:'700' }}>
                              = {(item.quantity * item.bulk_size).toFixed(0)} وحدة مفردة
                            </div>
                          )}
                        </div>
                         <div style={{ textAlign:'left', minWidth:'120px' }}>
                             <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'700', marginBottom:'4px', display:'flex', alignItems:'center', gap:'4px' }}>
                               تكلفة {item.is_bulk ? item.bulk_name : 'الوحدة المفردة'} (SAR)
                               {!item.costManuallySet && item.originalCost > 0 && (
                                 <span title="سعر مبدئي — يرجى التأكد من الفاتورة" style={{ background:'#fef9c3', color:'#854d0e', padding:'1px 5px', borderRadius:'4px', fontSize:'9px', fontWeight:'800', cursor:'help' }}>⚠ مبدئي</span>
                               )}
                             </div>
                             <input 
                               type="number" 
                               value={item.unit_cost} 
                               min="0"
                               step="0.01"
                               onChange={e => updateCartItem(item.product_id, 'unit_cost', parseFloat(e.target.value) || 0)} 
                               style={{ ...priceInput, border: !item.costManuallySet && item.originalCost > 0 ? '1px solid #fbbf24' : '1px solid #cbd5e1' }} 
                             />
                             <div style={{ fontSize:'10px', color:'#64748b', marginTop:'4px', fontWeight:'700' }}>
                               {item.is_bulk
                                 ? `${item.quantity} × ${item.bulk_size} وحدة × SAR ${item.unit_cost} = SAR ${(item.quantity * item.unit_cost * item.bulk_size).toFixed(2)}`
                                 : `${item.quantity} × SAR ${item.unit_cost} = SAR ${(item.quantity * item.unit_cost).toFixed(2)}`}
                             </div>
                             <button onClick={() => removeFromCart(item.product_id)} style={{ border:'none', background:'none', color:'#ef4444', cursor:'pointer', display:'block', marginTop:'8px' }}>
                               <Trash2 size={14}/>
                             </button>
                         </div>
                     </div>
                   ))}
                </div>

                <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:'20px', marginTop:'10px' }}>
                    <textarea 
                      placeholder="ملاحظات الطلب..." 
                      value={note} 
                      onChange={e => setNote(e.target.value)} 
                      style={{ ...inputStyle, minHeight:'60px', marginBottom:'16px', resize:'vertical' }} 
                    />
                     {/* 3-B: VAT checkbox */}
                     <label style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', cursor:'pointer', background:'#f8fafc', padding:'10px 14px', borderRadius:'12px' }}>
                       <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} style={{ width:'18px', height:'18px' }} />
                       <span style={{ fontSize:'13px', fontWeight:'700', color:'#475569' }}>الفاتورة شاملة ضريبة القيمة المضافة (15%)</span>
                     </label>

                     {/* 1-A: VAT breakdown */}
                     <div style={{ background:'#f8fafc', borderRadius:'14px', padding:'14px', marginBottom:'16px', display:'flex', flexDirection:'column', gap:'8px' }}>
                       <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#64748b' }}>
                         <span>صافي التوريد (قبل الضريبة)</span>
                         <span style={{ fontWeight:'700' }}>SAR {netTotal.toFixed(2)}</span>
                       </div>
                       {vatIncluded && (
                         <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#f59e0b' }}>
                           <span>ضريبة القيمة المضافة (15%)</span>
                           <span style={{ fontWeight:'700' }}>SAR {vatAmount.toFixed(2)}</span>
                         </div>
                       )}
                       <div style={{ display:'flex', justifyContent:'space-between', fontSize:'16px', fontWeight:'900', color:'#1e293b', borderTop:'1px solid #e2e8f0', paddingTop:'8px' }}>
                         <span>الإجمالي الكلي</span>
                         <span>SAR {grossTotal.toFixed(2)}</span>
                       </div>
                     </div>
                    <button onClick={handleSubmitOrder} disabled={!selectedSupplier || cart.length === 0} style={{ ...primaryBtnFull, opacity: (!selectedSupplier || cart.length === 0) ? 0.5 : 1 }}>
                        <Save size={18} /> حفظ طلب الشراء
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
       {/* 2-A: PO DETAIL MODAL */}
       {detailOrder && (
         <div style={overlay}>
           <div style={{ ...modal, maxWidth:'680px' }}>
             <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
               <div>
                 <h2 style={{ fontWeight:'900', fontSize:'20px' }}>تفاصيل طلب #PO-{detailOrder.id}</h2>
                 <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'4px' }}>المورد: {detailOrder.supplier_name} • {new Date(detailOrder.created_at).toLocaleDateString('ar-SA')}</div>
               </div>
               <button onClick={() => setDetailOrder(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24}/></button>
             </div>
             {loadingDetail ? <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>جاري التحميل...</div> : (
               <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                 <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                   {['المنتج','الكمية','التكلفة/وحدة','نوع','الإجمالي'].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'right', fontWeight:'800', fontSize:'12px', color:'#94a3b8' }}>{h}</th>)}
                 </tr></thead>
                 <tbody>
                   {detailItems.map((it, i) => (
                     <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                       <td style={{ padding:'12px 14px', fontWeight:'700' }}>{it.product_name}</td>
                       <td style={{ padding:'12px 14px' }}>{it.quantity} {it.is_bulk ? (it.bulk_unit_name||'كرتون') : (it.unit||'وحدة')}</td>
                       <td style={{ padding:'12px 14px' }}>SAR {parseFloat(it.unit_cost).toFixed(2)}</td>
                       <td style={{ padding:'12px 14px' }}><span style={{ background: it.is_bulk ? '#eff6ff':'#f1f5f9', color: it.is_bulk ? '#3b82f6':'#64748b', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700' }}>{it.is_bulk ? `بالة ×${it.bulk_unit_size||1}` : 'وحدة'}</span></td>
                       <td style={{ padding:'12px 14px', fontWeight:'800' }}>SAR {(it.quantity*it.unit_cost*(it.is_bulk?(it.bulk_unit_size||1):1)).toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
              <div style={{ marginTop:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'16px', borderTop:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', color:'#64748b' }}>الحالة: <strong style={{ color: detailOrder.status==='received' ? '#10b981':'#f59e0b' }}>{detailOrder.status==='received' ? 'مستلم':'قيد الانتظار'}</strong></span>
                  {detailOrder.status === 'received' && (
                    <button onClick={printLabelsForPO} style={{ background:'#fef3c7', color:'#d97706', border:'none', padding:'6px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                      <Tag size={14} /> طباعة ملصقات الأسعار ({detailItems.reduce((acc, it) => acc + (it.is_bulk ? it.quantity * (it.bulk_unit_size||1) : it.quantity), 0)})
                    </button>
                  )}
                </div>
                <span style={{ fontWeight:'900', fontSize:'18px' }}>الإجمالي: SAR {parseFloat(detailOrder.total_amount||0).toFixed(2)}</span>
              </div>
           </div>
         </div>
       )}

        {/* PARTIAL RECEIVE MODAL */}
        {showReceiveModal && (
          <div style={overlay}>
            <div style={{ ...modal, maxWidth:'750px' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
                 <div>
                   <h2 style={{ fontWeight:'900', fontSize:'22px' }}>استلام كميات #PO-{receivingPO.id}</h2>
                   <p style={{ fontSize:'13px', color:'#64748b' }}>حدد الكميات التي وصلت فعلياً للمستودع لتحديث المخزون</p>
                 </div>
                 <button onClick={() => setShowReceiveModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={24}/></button>
               </div>

               <div style={{ maxHeight:'450px', overflowY:'auto', marginBottom:'24px' }}>
                 <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'right' }}>
                   <thead style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, zIndex:10 }}>
                     <tr>
                       {['المنتج','المطلوب','المستلم سابقاً','الاستلام الحالي'].map(h => <th key={h} style={{ padding:'12px 16px', fontSize:'12px', fontWeight:'800', color:'#64748b' }}>{h}</th>)}
                     </tr>
                   </thead>
                   <tbody>
                     {receiveItems.map(it => {
                       const remaining = it.quantity - (it.received_quantity || 0);
                       return (
                         <tr key={it.product_id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                           <td style={{ padding:'14px 16px', fontWeight:'700' }}>{it.product_name}</td>
                           <td style={{ padding:'14px 16px', fontWeight:'700', color:'#64748b' }}>{it.quantity} {it.is_bulk ? (it.bulk_unit_name||'كرتون') : (it.unit||'وحدة')}</td>
                           <td style={{ padding:'14px 16px', color:'#10b981', fontWeight:'800' }}>{it.received_quantity || 0}</td>
                           <td style={{ padding:'14px 16px' }}>
                             <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                               <input 
                                 type="number"
                                 value={receiveQtys[it.product_id] || 0}
                                 onChange={e => setReceiveQtys({ ...receiveQtys, [it.product_id]: parseFloat(e.target.value) || 0 })}
                                 style={{ ...qtyInput, width:'80px', border:'2px solid #3b82f6' }}
                                 max={remaining}
                                 min={0}
                               />
                               {remaining > 0 && (
                                 <button 
                                   onClick={() => setReceiveQtys({ ...receiveQtys, [it.product_id]: remaining })}
                                   style={{ background:'#eff6ff', color:'#3b82f6', border:'none', padding:'4px 8px', borderRadius:'6px', fontSize:'10px', fontWeight:'800', cursor:'pointer' }}
                                 >كل المتبقي</button>
                               )}
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>

               <div style={{ display:'flex', gap:'12px' }}>
                 <button onClick={() => setShowReceiveModal(false)} style={{ flex:1, padding:'14px', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>إلغاء</button>
                 <button onClick={handleConfirmReceive} style={{ flex:2, padding:'14px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', borderRadius:'14px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', fontFamily:'inherit' }}>
                    <Archive size={18}/> تأكيد استلام الكميات المحددة
                 </button>
               </div>
            </div>
          </div>
        )}
    </AppLayout>
  );
}

// Styles
const thStyle = { padding:'16px 20px', fontSize:'12px', color:'#94a3b8', fontWeight:'700' };
const tdStyle = { padding:'16px 20px', fontSize:'14px' };
const primaryBtn = { background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', border:'none', padding:'12px 24px', borderRadius:'14px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontSize:'14px', fontFamily:'inherit' };
const primaryBtnFull = { ...primaryBtn, width:'100%', justifyContent:'center', padding:'16px' };
const receiveBtn = { padding:'6px 12px', background:'#eff6ff', color:'#3b82f6', border:'none', borderRadius:'10px', fontWeight:'700', fontSize:'12px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'6px', fontFamily:'inherit' };
const overlay = { position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modal   = { background:'white', borderRadius:'32px', padding:'32px', maxWidth:'1000px', width:'95%', boxShadow:'0 25px 50px rgba(0,0,0,0.1)', direction:'rtl', maxHeight:'90vh', overflowY:'auto' };
const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1px solid #e2e8f0', fontSize:'14px', outline:'none', fontFamily:'inherit', background:'white', boxSizing:'border-box' };
const labelStyle = { display:'block', fontSize:'12px', fontWeight:'800', color:'#64748b', marginBottom:'8px' };
const productCard = { padding:'12px 16px', background:'white', border:'1px solid #f1f5f9', borderRadius:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', transition:'all 0.2s' };
const cartItem = { padding:'16px', background:'white', borderRadius:'14px', border:'1px solid #e2e8f0', display:'flex', gap:'16px', alignItems:'flex-start' };
const qtyInput = { width:'60px', padding:'6px', borderRadius:'8px', border:'1px solid #cbd5e1', textAlign:'center', fontWeight:'800', fontFamily:'inherit' };
const priceInput = { width:'100px', padding:'6px', borderRadius:'8px', border:'1px solid #cbd5e1', textAlign:'left', fontWeight:'800', fontFamily:'inherit' };
const bulkToggle = (isActive) => ({ 
  padding:'4px 8px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'800', 
  background: isActive ? '#3b82f6' : '#e2e8f0', color: isActive ? 'white' : '#64748b',
  display:'flex', alignItems:'center', gap:'4px', transition:'all 0.2s', fontFamily:'inherit'
});

