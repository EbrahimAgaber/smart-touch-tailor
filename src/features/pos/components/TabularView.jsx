import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '../../../store/useCartStore';
import {
  Trash2, Save, X, Pause, Printer, FileText,
  UserPlus, ScrollText, Tag, Zap, CreditCard,
  Star, ChevronDown, Building2, Check
} from 'lucide-react';

// ── Payment types — mirrors Pos.jsx PAY_TYPES exactly ────────────────────────
const PAY_TYPES = [
  { value: 'Cash',   label: 'نقد'         },
  { value: 'Card',   label: 'بطاقة'        },
  { value: 'STC',    label: 'STC Pay'      },
  { value: 'Credit', label: 'آجل'          },
];

export default function TabularView({
  menu = [],
  settings = {},
  onOpenPayment,          // opens the full PaymentModal (grid-view path)
  onHoldOrder,
  onPrint,
  onReset,
  onQuote,
  customers = [],
  selectedCustomer = null,
  setSelectedCustomer,
  setShowQuickCust,       // ← opens the QuickAddCustomer modal that lives in Pos.jsx
  onItemSelect,
  onFinalizeQuickly,      // finalizeSaleQuickly(shouldPrint, forceWidth)
}) {
  const {
    order, addItem, removeItem, updateQuantity, updatePrice, updateItemField,
    subtotal, tax, total, clearCart,
  } = useCartStore();

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [showResults, setShowResults] = useState(false);
  const [custSearch, setCustSearch]   = useState('');
  const [showCustList, setShowCustList] = useState(false);
  const [payMethod, setPayMethod]     = useState('Cash');
  const [showPayDrop, setShowPayDrop] = useState(false);

  // ── Invoice / B2B ───────────────────────────────────────────────────────────
  const [invoiceType, setInvoiceType]     = useState('simplified'); // 'simplified' | 'standard'
  const [customerTaxId, setCustomerTaxId] = useState('');

  // ── Discount ────────────────────────────────────────────────────────────────
  const [showDiscPanel, setShowDiscPanel] = useState(false);
  const [discountType, setDiscountType]   = useState('none'); // none | pct | fixed | final
  const [discountVal, setDiscountVal]     = useState('');
  const [redeemPoints, setRedeemPoints]   = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const searchRef     = useRef(null);
  const resultsRef    = useRef(null);
  const entryInputRef = useRef(null);
  const custRef       = useRef(null);
  const payRef        = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const vatRate       = parseFloat(settings.vat_rate || '0.15');
  const isRestaurant  = settings.business_type === 'restaurant';

  // Points discount — same cap logic as Pos.jsx openPayment()
  const pointsDiscount = (() => {
    if (!selectedCustomer) return 0;
    const available = selectedCustomer.loyalty_points || 0;
    const maxByHalf = Math.floor((total * 0.5) / 0.1);
    const redeemable = Math.min(available, maxByHalf);
    return Math.round(redeemable * 10) / 100;
  })();

  const manualDiscount = (() => {
    if (discountType === 'pct')   return total * (parseFloat(discountVal) || 0) / 100;
    if (discountType === 'fixed') return Math.min(parseFloat(discountVal) || 0, total);
    if (discountType === 'final') {
      const f = parseFloat(discountVal);
      return isNaN(f) ? 0 : Math.max(0, total - f);
    }
    return 0;
  })();

  const loyaltyDiscount = redeemPoints ? pointsDiscount : 0;
  const netTotal        = Math.max(0, total - manualDiscount - loyaltyDiscount);
  const hasDiscount     = manualDiscount > 0 || loyaltyDiscount > 0;

  // Estimated points the customer will earn on this purchase (1 pt per SAR)
  const pointsToEarn = selectedCustomer ? Math.floor(netTotal) : 0;

  // ── Auto-switch to standard invoice when customer has tax_id ────────────────
  useEffect(() => {
    if (selectedCustomer?.tax_id) {
      setCustomerTaxId(selectedCustomer.tax_id);
      setInvoiceType('standard');
    } else {
      setCustomerTaxId('');
      setInvoiceType('simplified');
    }
    setRedeemPoints(false);
  }, [selectedCustomer]);

  // ── Hotkeys ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (['F1','F2','F3','F4','F5'].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'F1': entryInputRef.current?.focus(); break;
        case 'F2': if (order.length > 0) onFinalizeQuickly?.(true);  break;
        case 'F3': if (order.length > 0) onHoldOrder?.();            break;
        case 'F4':
          if (order.length > 0 && window.confirm('هل تريد حذف جميع الأصناف في السلة؟')) onReset?.();
          break;
        case 'F5': if (order.length > 0) onFinalizeQuickly?.(false); break;
        case 'Escape':
          setShowResults(false);
          setShowCustList(false);
          setShowPayDrop(false);
          break;
        case 'n':
          if (e.ctrlKey) { e.preventDefault(); onReset?.(); }
          break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [order, onFinalizeQuickly, onHoldOrder, onReset]);

  // ── Close dropdowns on outside click ────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (searchRef.current  && !searchRef.current.contains(e.target)  &&
          resultsRef.current && !resultsRef.current.contains(e.target)) setShowResults(false);
      if (custRef.current && !custRef.current.contains(e.target))       setShowCustList(false);
      if (payRef.current  && !payRef.current.contains(e.target))        setShowPayDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Item search / barcode ────────────────────────────────────────────────────
  const filteredItems = menu.filter(m =>
    m.Name.toLowerCase().includes(search.toLowerCase()) ||
    (m.Barcode && m.Barcode.includes(search))
  ).slice(0, 10);

  const handleSelectItem = useCallback((item) => {
    if (onItemSelect) onItemSelect(item);
    else              addItem(item);
    setSearch('');
    setShowResults(false);
    setTimeout(() => entryInputRef.current?.focus(), 10);
  }, [onItemSelect, addItem]);

  const handleBarcodeSubmit = (e) => {
    if (e.key !== 'Enter' || !search) return;
    const exact = menu.find(i => i.Barcode === search);
    if (exact)                        handleSelectItem(exact);
    else if (filteredItems.length === 1) handleSelectItem(filteredItems[0]);
  };

  // ── Quick pay — same as CartPanel.quickPayCash / quickPayCard ───────────────
  const handleQuickPay = (type) => {
    if (order.length === 0) return;
    setPayMethod(type);
    onFinalizeQuickly?.(false);   // save without print; parent uses payMethod via openPayment flow
  };

  // ── Finalize via full Payment Modal (passes context upward) ─────────────────
  const handleOpenPayment = () => {
    if (order.length === 0) return;
    onOpenPayment?.();
  };

  return (
    <div style={s.container}>

      {/* ══════════════════════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════════════════════ */}
      <div style={s.topBar}>
        <div style={s.topGroup}>

          {/* Warehouse */}
          <div style={s.topItem}>
            <label style={s.topLabel}>المستودع:</label>
            <select style={s.topSelect}><option>الرئيسي</option></select>
          </div>

          {/* ── Customer picker — same pattern as Pos.jsx grid customer widget ── */}
          <div style={s.topItem}>
            <label style={s.topLabel}>العميل:</label>
            <div style={{ position:'relative', display:'flex', gap:'4px' }} ref={custRef}>
              {selectedCustomer ? (
                /* ── Selected state ── */
                <div style={s.custSelectedBox}>
                  <div style={s.custAvatar}>{selectedCustomer.name.charAt(0)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={s.custName}>{selectedCustomer.name}</div>
                    {(selectedCustomer.loyalty_points || 0) > 0 && (
                      <div style={s.custPoints}>
                        <Star size={9} style={{ color:'#f59e0b' }}/> {selectedCustomer.loyalty_points} نقطة
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setCustSearch(''); }} style={s.iconBtn}>
                    <X size={13}/>
                  </button>
                </div>
              ) : (
                /* ── Search state ── */
                <div style={{ position:'relative' }}>
                  <input
                    style={{ ...s.topInput, width:'160px' }}
                    placeholder="بحث عن عميل..."
                    value={custSearch}
                    onChange={(e) => { setCustSearch(e.target.value); setShowCustList(true); }}
                    onFocus={() => setShowCustList(true)}
                  />
                  {showCustList && (
                    <div style={s.dropdown}>
                      {customers
                        .filter(c => !custSearch || c.name.includes(custSearch) || c.phone?.includes(custSearch))
                        .map(c => (
                          <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustSearch(''); setShowCustList(false); }} style={s.dropItem}>
                            <div>
                              <div style={{ fontWeight:'700', fontSize:'12px' }}>{c.name}</div>
                              <div style={{ fontSize:'10px', color:'#64748b' }}>{c.phone}</div>
                              {(c.loyalty_points || 0) > 0 && (
                                <div style={{ fontSize:'10px', color:'#6366f1' }}>⭐ {c.loyalty_points} نقطة</div>
                              )}
                            </div>
                          </div>
                        ))}
                      {/* Add new customer — triggers the SAME modal as in the grid view */}
                      <button onClick={() => { setShowCustList(false); setShowQuickCust(true); }} style={s.addCustBtn}>
                        <UserPlus size={12}/> إضافة عميل جديد
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!selectedCustomer && (
                <button onClick={() => setShowQuickCust(true)} style={s.iconBtn} title="إضافة عميل">
                  <UserPlus size={14}/>
                </button>
              )}
            </div>
          </div>

          {/* ── Invoice type — B2C / B2B ── */}
          <div style={s.topItem}>
            <label style={s.topLabel}>نوع الفاتورة:</label>
            <div style={s.toggleGroup}>
              <button
                onClick={() => setInvoiceType('simplified')}
                style={{ ...s.toggleBtn, ...(invoiceType === 'simplified' ? s.toggleActive : {}) }}>
                مبسطة (B2C)
              </button>
              <button
                onClick={() => setInvoiceType('standard')}
                style={{ ...s.toggleBtn, ...(invoiceType === 'standard' ? s.toggleActiveB2B : {}) }}>
                <Building2 size={11}/> كاملة (B2B)
              </button>
            </div>
          </div>

          {/* B2B: customer tax ID input */}
          {invoiceType === 'standard' && (
            <div style={s.topItem}>
              <label style={s.topLabel}>الرقم الضريبي للعميل:</label>
              <input
                style={{ ...s.topInput, width:'140px', borderColor: customerTaxId ? '#10b981' : '#f59e0b' }}
                placeholder="3xxxxxxxxxxxxxxxxx"
                value={customerTaxId}
                onChange={e => setCustomerTaxId(e.target.value)}
              />
              {!selectedCustomer && (
                <span style={{ fontSize:'10px', color:'#f59e0b', fontWeight:'700' }}>⚠ يجب اختيار عميل</span>
              )}
            </div>
          )}

          {/* ── Payment method ── */}
          <div style={s.topItem}>
            <label style={s.topLabel}>طريقة الدفع:</label>
            <div style={{ position:'relative' }} ref={payRef}>
              <button onClick={() => setShowPayDrop(v => !v)} style={s.payBtn}>
                {PAY_TYPES.find(p => p.value === payMethod)?.label || 'نقد'}
                <ChevronDown size={11}/>
              </button>
              {showPayDrop && (
                <div style={{ ...s.dropdown, width:'130px', left:'auto', right:0 }}>
                  {PAY_TYPES.map(p => (
                    <div key={p.value}
                      onClick={() => { setPayMethod(p.value); setShowPayDrop(false); }}
                      style={{ ...s.dropItem, background: payMethod === p.value ? '#eff6ff' : 'transparent', color: payMethod === p.value ? '#1e40af' : '#1e293b', fontWeight: payMethod === p.value ? '900' : '700' }}>
                      {p.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right: invoice number */}
        <div style={s.topGroup}>
          <div style={s.topItem}>
            <label style={s.topLabel}>رقم الفاتورة:</label>
            <input style={{ ...s.topInput, color:'#ef4444', fontWeight:'900', width:'80px' }} value="AUTO" readOnly />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ITEMS TABLE
      ══════════════════════════════════════════════════════════ */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead style={s.thead}>
            <tr>
              <th style={{ ...s.th, width:'36px' }}>#</th>
              <th style={{ ...s.th, width:'170px' }}>رقم الصنف / الباركود</th>
              <th style={s.th}>اسم الصنف</th>
              <th style={{ ...s.th, width:'70px' }}>الوحدة</th>
              <th style={{ ...s.th, width:'75px' }}>الكمية</th>
              <th style={{ ...s.th, width:'110px' }}>سعر الوحدة</th>
              <th style={{ ...s.th, width:'110px' }}>المجموع (غ.ض)</th>
              <th style={{ ...s.th, width:'95px' }}>الضريبة</th>
              <th style={{ ...s.th, width:'130px' }}>شامل الضريبة</th>
              <th style={{ ...s.th, width:'36px' }}></th>
            </tr>
          </thead>
          <tbody>

            {/* ── Entry / search row ── */}
            <tr style={s.entryRow}>
              <td style={s.td}><span style={{ color:'#3b82f6', fontWeight:'900', fontSize:'16px', padding:'0 8px' }}>*</span></td>
              <td style={{ ...s.td, position:'relative' }} colSpan="2">
                <div ref={searchRef} style={{ position:'relative' }}>
                  <input
                    ref={entryInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="امسح الباركود أو ابحث عن صنف... (F1)"
                    style={s.entryInput}
                    autoFocus
                  />
                  {showResults && search.length > 0 && (
                    <div style={s.searchDropdown} ref={resultsRef}>
                      {filteredItems.length === 0 ? (
                        <div style={{ padding:'10px', textAlign:'center', color:'#94a3b8', fontSize:'12px' }}>لا توجد نتائج</div>
                      ) : filteredItems.map(item => (
                        <div key={item.ID} onClick={() => handleSelectItem(item)} style={s.searchItem}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={s.itemIcon}>{item.Category?.charAt(0) || '📦'}</div>
                            <div>
                              <div style={{ fontWeight:'700', fontSize:'12px' }}>{item.Name}</div>
                              <div style={{ fontSize:'10px', color:'#64748b' }}>{item.Barcode}</div>
                            </div>
                          </div>
                          <div style={{ fontWeight:'800', color:'#1e40af', fontSize:'12px' }}>{item.Price?.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              {['—','1','0.00','0.00','0.00','0.00'].map((v, i) => (
                <td key={i} style={s.td}><input style={s.roInput} value={v} readOnly /></td>
              ))}
              <td style={s.td}></td>
            </tr>

            {/* ── Cart rows ── */}
            {order.map((item, idx) => {
              const itemTotal = item.Price * item.Qty;
              const itemTax   = itemTotal * vatRate / (1 + vatRate);
              const itemSub   = itemTotal - itemTax;
              return (
                <tr key={`${item.ID}-${idx}`} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...s.td, textAlign:'center', color:'#94a3b8', fontSize:'11px' }}>{idx + 1}</td>
                  <td style={s.td}>
                    <input value={item.Barcode || ''} onChange={e => updateItemField(idx,'Barcode',e.target.value)} style={s.cellInput} />
                  </td>
                  <td style={s.td}>
                    <input value={item.Name} onChange={e => updateItemField(idx,'Name',e.target.value)} style={{ ...s.cellInput, textAlign:'right', fontWeight:'700' }} />
                  </td>
                  <td style={s.td}>
                    <input value={item.Unit || 'حبة'} onChange={e => updateItemField(idx,'Unit',e.target.value)} style={s.cellInput} />
                  </td>
                  <td style={s.td}>
                    <input type="number" min="0" value={item.Qty}
                      onChange={e => updateQuantity(idx, parseFloat(e.target.value) || 0)}
                      onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v) || v <= 0) updateQuantity(idx, 1); }}
                      onFocus={e => e.target.select()}
                      style={{ ...s.cellInput, background:'#fffbea' }} />
                  </td>
                  <td style={s.td}>
                    <input type="number" min="0" value={item.Price}
                      onChange={e => updatePrice(idx, parseFloat(e.target.value) || 0)}
                      onBlur={e => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 0) updatePrice(idx, 0); }}
                      onFocus={e => e.target.select()}
                      style={{ ...s.cellInput, background:'#f0f9ff' }} />
                  </td>
                  <td style={{ ...s.td, textAlign:'center', background:'#f8fafc', fontSize:'12px' }}>{itemSub.toFixed(2)}</td>
                  <td style={{ ...s.td, textAlign:'center', background:'#f8fafc', fontSize:'12px', color:'#64748b' }}>{itemTax.toFixed(2)}</td>
                  <td style={{ ...s.td, textAlign:'center', fontWeight:'900', color:'#1e40af', background:'#eff6ff', fontSize:'12px' }}>{itemTotal.toFixed(2)}</td>
                  <td style={s.td}>
                    <button onClick={() => removeItem(idx)} style={s.deleteBtn}><Trash2 size={13}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════
          BOTTOM: ACTIONS + DISCOUNT PANEL + SUMMARY
      ══════════════════════════════════════════════════════════ */}
      <div style={s.bottom}>

        {/* ── Action buttons ── */}
        <div style={s.actionsGrid}>
          <button onClick={() => order.length > 0 && onFinalizeQuickly?.(true)}        style={{ ...s.actionBtn, background:'#1e40af' }}><Save size={18}/><span style={s.btnLabel}>حفظ وطباعة (F2)</span></button>
          <button onClick={() => order.length > 0 && onFinalizeQuickly?.(true, 'A4')} style={{ ...s.actionBtn, background:'#0f172a' }}><Printer size={18}/><span style={s.btnLabel}>طباعة A4</span></button>
          <button onClick={() => onHoldOrder?.()}                                       style={{ ...s.actionBtn, background:'#059669' }}><Pause size={18}/><span style={s.btnLabel}>تعليق (F3)</span></button>
          <button onClick={() => order.length > 0 && window.confirm('مسح الفاتورة؟') && onReset?.()} style={{ ...s.actionBtn, background:'#dc2626' }}><Trash2 size={18}/><span style={s.btnLabel}>حذف (F4)</span></button>
          <button onClick={() => order.length > 0 && onFinalizeQuickly?.(false)}       style={{ ...s.actionBtn, background:'#475569' }}><FileText size={18}/><span style={s.btnLabel}>حفظ بدون طباعة (F5)</span></button>
          <button onClick={() => onReset?.()}                                           style={{ ...s.actionBtn, background:'#334155' }}><FileText size={18}/><span style={s.btnLabel}>جديد (Ctrl+N)</span></button>
          <button onClick={() => onQuote?.()}                                           style={{ ...s.actionBtn, background:'#7c3aed' }}><ScrollText size={18}/><span style={s.btnLabel}>عرض سعر</span></button>
          {/* Quick pay — same logic as CartPanel */}
          <button onClick={() => handleQuickPay('Cash')}  disabled={!order.length} style={{ ...s.actionBtn, background: order.length ? '#10b981' : '#94a3b8' }}><Zap size={18}/><span style={s.btnLabel}>نقد سريع</span></button>
          <button onClick={() => handleQuickPay('Card')}  disabled={!order.length} style={{ ...s.actionBtn, background: order.length ? '#6366f1' : '#94a3b8' }}><CreditCard size={18}/><span style={s.btnLabel}>بطاقة سريع</span></button>
          {/* Discount toggle */}
          <button onClick={() => setShowDiscPanel(v => !v)} style={{ ...s.actionBtn, background: showDiscPanel ? '#d97706' : '#78716c' }}><Tag size={18}/><span style={s.btnLabel}>{showDiscPanel ? 'إغلاق الخصم' : 'خصم / نقاط'}</span></button>
          {/* Full payment modal */}
          <button onClick={handleOpenPayment} disabled={!order.length} style={{ ...s.actionBtn, background: order.length ? '#2563eb' : '#94a3b8', gridColumn:'span 2' }}><CreditCard size={18}/><span style={s.btnLabel}>الدفع الكامل (تفاصيل)</span></button>
        </div>

        {/* ── Right column: discount panel + summary ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', minWidth:'310px', flex:'0 0 310px' }}>

          {/* Discount / Loyalty panel */}
          {showDiscPanel && (
            <div style={s.discPanel}>
              <div style={s.discTitle}><Tag size={12}/> الخصم ونقاط الولاء</div>

              {/* Discount type + value */}
              <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
                <select
                  value={discountType}
                  onChange={e => { setDiscountType(e.target.value); setDiscountVal(''); }}
                  style={s.discSelect}>
                  <option value="none">بدون خصم</option>
                  <option value="pct">نسبة %</option>
                  <option value="fixed">مبلغ ثابت</option>
                  <option value="final">سعر نهائي</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    value={discountVal}
                    onChange={e => setDiscountVal(e.target.value)}
                    placeholder={discountType === 'pct' ? '0 – 100' : '0.00'}
                    style={s.discInput}
                  />
                )}
                {discountType !== 'none' && discountVal && (
                  <button onClick={() => { setDiscountType('none'); setDiscountVal(''); }} style={s.clearBtn}><X size={12}/></button>
                )}
              </div>

              {/* Loyalty points redemption — same condition as Pos.jsx payment modal */}
              {selectedCustomer && (selectedCustomer.loyalty_points || 0) > 0 && pointsDiscount > 0 && (
                <div style={s.loyaltyRow}>
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={e => setRedeemPoints(e.target.checked)}
                    style={{ cursor:'pointer', accentColor:'#10b981', width:'16px', height:'16px' }}
                  />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'11px', fontWeight:'900', color:'#065f46' }}>
                      استبدال {selectedCustomer.loyalty_points} نقطة
                    </div>
                    <div style={{ fontSize:'10px', color:'#059669' }}>
                      خصم {pointsDiscount.toFixed(2)} ر.س (حد 50% من الفاتورة)
                    </div>
                  </div>
                  {redeemPoints && (
                    <span style={s.pointsBadge}>− {pointsDiscount.toFixed(2)} ر.س</span>
                  )}
                </div>
              )}

              {/* No customer selected warning */}
              {!selectedCustomer && (
                <div style={{ fontSize:'10px', color:'#94a3b8', fontStyle:'italic', marginTop:'4px' }}>
                  اختر عميلاً لعرض نقاط الولاء
                </div>
              )}
            </div>
          )}

          {/* Summary box */}
          <div style={s.summary}>
            <div style={s.summRow}>
              <span style={s.summLabel}>الإجمالي:</span>
              <span style={s.summVal}>{total.toFixed(2)}</span>
            </div>
            <div style={s.summRow}>
              <span style={s.summLabel}>الضريبة ({(vatRate * 100).toFixed(0)}%):</span>
              <span style={s.summVal}>{tax.toFixed(2)}</span>
            </div>

            {hasDiscount && (
              <div style={{ ...s.summRow, background:'#d1fae5', borderRadius:'4px', padding:'3px 8px', margin:'0 -8px' }}>
                <span style={{ ...s.summLabel, color:'#065f46', fontSize:'12px' }}>الخصم:</span>
                <span style={{ ...s.summVal, color:'#10b981', fontSize:'15px' }}>
                  − {(manualDiscount + loyaltyDiscount).toFixed(2)}
                </span>
              </div>
            )}

            <div style={{ ...s.summRow, borderTop:'1px solid #94a3b8', paddingTop:'8px', marginTop:'6px' }}>
              <span style={{ ...s.summLabel, fontSize:'17px', color:'#ef4444' }}>الصافي:</span>
              <span style={{ ...s.summVal, fontSize:'26px', color:'#ef4444', fontWeight:'900' }}>
                {netTotal.toFixed(2)}
              </span>
            </div>

            {/* Payment method indicator */}
            <div style={{ marginTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'10px', color:'#64748b', fontWeight:'700' }}>طريقة الدفع:</span>
              <span style={s.payBadge}>
                {PAY_TYPES.find(p => p.value === payMethod)?.label || 'نقد'}
              </span>
            </div>

            {/* Invoice type indicator */}
            <div style={{ marginTop:'4px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'10px', color:'#64748b', fontWeight:'700' }}>نوع الفاتورة:</span>
              <span style={{ ...s.payBadge, background: invoiceType === 'standard' ? '#fef3c7' : '#eff6ff', color: invoiceType === 'standard' ? '#92400e' : '#1e40af', borderColor: invoiceType === 'standard' ? '#fde68a' : '#bfdbfe' }}>
                {invoiceType === 'standard' ? '🏢 B2B ضريبية كاملة' : '🧾 مبسطة B2C'}
              </span>
            </div>

            {/* Loyalty points to be earned */}
            {selectedCustomer && pointsToEarn > 0 && (
              <div style={{ marginTop:'6px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fffbeb', borderRadius:'4px', padding:'4px 8px' }}>
                <span style={{ fontSize:'10px', color:'#78350f', fontWeight:'700' }}>نقاط مكتسبة:</span>
                <span style={{ fontSize:'11px', fontWeight:'900', color:'#d97706', display:'flex', alignItems:'center', gap:'3px' }}>
                  <Star size={10}/> +{pointsToEarn} نقطة
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES — all inline, no class dependencies
// ══════════════════════════════════════════════════════════════════
const s = {
  container: {
    height:'100%', display:'flex', flexDirection:'column',
    background:'#f1f5f9', direction:'rtl',
    fontFamily:"'Segoe UI','Tajawal',sans-serif",
    padding:'8px', gap:'8px', overflow:'hidden',
  },
  topBar: {
    background:'#e2e8f0', padding:'8px 14px', borderRadius:'6px',
    display:'flex', justifyContent:'space-between', alignItems:'center',
    border:'1px solid #cbd5e1', flexWrap:'wrap', gap:'8px',
  },
  topGroup: { display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' },
  topItem:  { display:'flex', alignItems:'center', gap:'6px' },
  topLabel: { fontSize:'11px', fontWeight:'800', color:'#334155', whiteSpace:'nowrap' },
  topSelect: { padding:'4px 6px', borderRadius:'4px', border:'1px solid #94a3b8', fontSize:'11px', background:'#fff', cursor:'pointer' },
  topInput:  { padding:'4px 8px', borderRadius:'4px', border:'1px solid #94a3b8', fontSize:'11px', background:'#fff', width:'130px' },

  // Customer selected box
  custSelectedBox: {
    display:'flex', alignItems:'center', gap:'6px',
    background:'#eff6ff', border:'1px solid #bfdbfe',
    padding:'3px 8px', borderRadius:'4px', maxWidth:'210px',
  },
  custAvatar: {
    width:'22px', height:'22px', borderRadius:'50%',
    background:'linear-gradient(135deg,#3b82f6,#2563eb)',
    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:'900', fontSize:'11px', flexShrink:0,
  },
  custName:   { fontSize:'11px', fontWeight:'800', color:'#1d4ed8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'120px' },
  custPoints: { fontSize:'9px', color:'#6366f1', fontWeight:'700', display:'flex', alignItems:'center', gap:'2px' },

  iconBtn: {
    padding:'3px', background:'#fff', border:'1px solid #cbd5e1',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    borderRadius:'3px', color:'#64748b',
  },

  // Dropdown
  dropdown: {
    position:'absolute', top:'100%', right:0, left:0,
    background:'#fff', border:'1px solid #cbd5e1', zIndex:200,
    boxShadow:'0 8px 20px rgba(0,0,0,0.1)', maxHeight:'200px', overflowY:'auto',
    borderRadius:'4px', marginTop:'2px',
  },
  dropItem: {
    padding:'8px 10px', borderBottom:'1px solid #f1f5f9',
    cursor:'pointer', fontSize:'12px', color:'#1e293b',
  },
  addCustBtn: {
    width:'100%', padding:'8px 10px', background:'#f8fafc', border:'none',
    borderTop:'1px solid #e2e8f0', cursor:'pointer', fontWeight:'800',
    fontSize:'11px', color:'#3b82f6', display:'flex', alignItems:'center', gap:'4px',
    justifyContent:'center',
  },

  // Invoice type toggle
  toggleGroup: { display:'flex', background:'#e2e8f0', borderRadius:'4px', padding:'2px', gap:'2px' },
  toggleBtn: {
    padding:'3px 8px', border:'none', borderRadius:'3px', cursor:'pointer',
    fontSize:'10px', fontWeight:'700', background:'transparent', color:'#64748b',
    display:'flex', alignItems:'center', gap:'3px',
  },
  toggleActive:    { background:'#fff', color:'#1e40af', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },
  toggleActiveB2B: { background:'#fef3c7', color:'#92400e', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },

  // Pay method dropdown button
  payBtn: {
    padding:'4px 10px', borderRadius:'4px', border:'1px solid #94a3b8',
    background:'#fff', cursor:'pointer', fontSize:'11px', fontWeight:'700',
    display:'flex', alignItems:'center', gap:'4px', color:'#1e293b',
  },

  // Table
  tableWrapper: { flex:1, background:'#fff', border:'1px solid #cbd5e1', overflow:'auto', borderRadius:'4px' },
  table:  { width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'860px' },
  thead:  { position:'sticky', top:0, zIndex:10 },
  th: {
    padding:'9px 7px', background:'#1e40af', color:'#fff',
    border:'1px solid #1d4ed8', fontWeight:'700', textAlign:'center',
  },
  td:     { padding:'0', border:'1px solid #e2e8f0', color:'#1e293b' },
  entryRow: { background:'#eff6ff' },

  entryInput: {
    width:'100%', padding:'9px 10px', border:'none',
    fontSize:'12px', outline:'none', background:'transparent', textAlign:'right',
  },
  searchDropdown: {
    position:'absolute', top:'100%', left:0, right:0,
    background:'#fff', border:'1px solid #3b82f6', zIndex:100,
    boxShadow:'0 4px 12px rgba(0,0,0,0.1)', borderRadius:'4px',
  },
  searchItem: {
    padding:'8px 10px', borderBottom:'1px solid #f1f5f9',
    cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
  },
  itemIcon: {
    width:'22px', height:'22px', background:'#f1f5f9',
    display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'3px',
    fontSize:'12px',
  },
  cellInput: {
    width:'100%', padding:'7px 7px', border:'none',
    textAlign:'center', fontSize:'12px', outline:'none',
    background:'transparent', fontFamily:'inherit',
  },
  roInput: {
    width:'100%', padding:'7px 7px', border:'none',
    textAlign:'center', fontSize:'11px', outline:'none',
    background:'transparent', color:'#94a3b8', fontFamily:'inherit',
  },
  deleteBtn: {
    background:'transparent', border:'none', color:'#ef4444',
    cursor:'pointer', width:'100%', height:'100%',
    display:'flex', alignItems:'center', justifyContent:'center', padding:'6px',
  },

  // Bottom
  bottom: {
    display:'flex', gap:'10px', alignItems:'flex-start', flexWrap:'wrap',
  },
  actionsGrid: {
    flex:1, display:'grid',
    gridTemplateColumns:'repeat(auto-fill, minmax(110px,1fr))', gap:'6px',
  },
  actionBtn: {
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap:'5px', color:'#fff', border:'none', borderRadius:'6px', padding:'10px 6px',
    cursor:'pointer', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', transition:'opacity 0.15s',
    opacity:1,
  },
  btnLabel: { fontSize:'10px', fontWeight:'800', textAlign:'center', lineHeight:1.2 },

  // Discount panel
  discPanel: {
    background:'#fffbeb', border:'1px solid #fde68a',
    borderRadius:'6px', padding:'10px 12px',
  },
  discTitle: {
    fontSize:'11px', fontWeight:'900', color:'#78350f',
    marginBottom:'8px', display:'flex', alignItems:'center', gap:'5px',
  },
  discSelect: {
    padding:'5px 7px', borderRadius:'4px', border:'1px solid #d97706',
    fontSize:'11px', fontWeight:'700', cursor:'pointer', background:'#fff',
  },
  discInput: {
    flex:1, padding:'5px 8px', borderRadius:'4px', border:'1px solid #d97706',
    fontSize:'12px', fontWeight:'700', outline:'none', minWidth:0,
  },
  clearBtn: {
    padding:'5px', background:'#fff', border:'1px solid #d97706',
    borderRadius:'4px', cursor:'pointer', color:'#d97706',
    display:'flex', alignItems:'center',
  },
  loyaltyRow: {
    display:'flex', alignItems:'center', gap:'8px',
    background:'#ecfdf5', border:'1px solid #a7f3d0',
    borderRadius:'4px', padding:'7px 9px', marginTop:'6px',
  },
  pointsBadge: {
    fontSize:'11px', fontWeight:'900', color:'#10b981',
    background:'#d1fae5', padding:'2px 8px', borderRadius:'10px',
    flexShrink:0,
  },

  // Summary
  summary: {
    background:'#e2e8f0', padding:'12px', borderRadius:'6px',
    border:'1px solid #cbd5e1',
  },
  summRow:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' },
  summLabel: { fontSize:'13px', fontWeight:'800', color:'#334155' },
  summVal:   { fontSize:'18px', fontWeight:'800', color:'#1e293b' },
  payBadge: {
    fontSize:'10px', fontWeight:'900', color:'#1e40af',
    background:'#eff6ff', padding:'2px 9px', borderRadius:'10px',
    border:'1px solid #bfdbfe',
  },
};
