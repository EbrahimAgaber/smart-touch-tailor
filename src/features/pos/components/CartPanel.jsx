import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShoppingCart, Trash2, UserPlus, X, FileDown, Pause, CreditCard, Zap, Edit3, Check, MessageSquare, Tag, RotateCcw } from 'lucide-react';
import Numpad from '../../../components/Numpad';

const fmt = (n) => Number(n || 0).toFixed(2);

// ── Inline qty editor ──────────────────────────────────────────────────────────
function QtyCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => { const v = parseFloat(draft); if (!isNaN(v) && v > 0) onCommit(v); setEditing(false); };
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false); }}
      className="w-[60px] px-1.5 py-1 rounded-lg border-2 border-primary outline-none text-[13px] font-black text-center bg-indigo-50 text-indigo-700 font-tajawal" />
  );
  return (
    <button onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="min-w-[34px] px-2 py-1 rounded-lg border-2 border-dashed border-subtle bg-app text-[13px] font-black text-main cursor-pointer font-tajawal hover:border-primary hover:bg-hover transition-all">
      {value}
    </button>
  );
}

// ── Inline price editor ────────────────────────────────────────────────────────
function PriceCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fmt(value));
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => { const v = parseFloat(draft); if (!isNaN(v) && v >= 0) onCommit(v); setEditing(false); };
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false); }}
      className="w-[75px] px-1.5 py-1 rounded-lg border-2 border-emerald-500 outline-none text-[12px] font-black text-center bg-emerald-50 text-emerald-800 font-tajawal" />
  );
  return (
    <button title="انقر لتعديل السعر" onClick={() => { setDraft(fmt(value)); setEditing(true); }}
      className="bg-transparent border-none cursor-pointer text-[13px] font-black text-main font-tajawal flex items-center justify-center gap-1 hover:text-primary group mx-auto">
      {fmt(value)}<Edit3 size={12} className="text-muted group-hover:text-primary shrink-0" />
    </button>
  );
}

// ── Undo Toast ─────────────────────────────────────────────────────────────────
function UndoToast({ itemName, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="pos-undo-toast">
      <span>تم حذف «{itemName}»</span>
      <button className="pos-undo-toast__btn" onClick={onUndo}>تراجع</button>
      <button onClick={onDismiss} className="text-slate-400 hover:text-white transition-colors"><X size={14}/></button>
    </div>
  );
}

// ── Cart Item Row ──────────────────────────────────────────────────────────────
function CartRow({ item, idx, onRemove, onUpdateQty, onUpdatePrice, onUpdateNote, onSetDiscount, onOpenNumpad }) {
  const [showNote, setShowNote] = useState(false);
  const [showDisc, setShowDisc] = useState(false);
  const [discType, setDiscType] = useState('pct');
  const [discVal, setDiscVal] = useState('');

  const commitDisc = () => {
    if (discVal && onSetDiscount) onSetDiscount(item.variant, discType, discVal);
    setShowDisc(false);
  };

  return (
    <React.Fragment>
      <tr className="border-b border-subtle hover:bg-hover/50 transition-colors group">
        <td className="py-2 px-2 text-center text-muted font-bold text-[11px] max-sm:hidden">{idx + 1}</td>
        <td className="py-2 px-2 max-w-[110px]">
          <p className="m-0 text-[13px] font-black text-main whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-primary transition-colors">{item.Name}</p>
          {item.Note && <p className="m-0 text-[10px] text-amber-500 font-bold">📝 {item.Note}</p>}
          {/* Quick actions row */}
          <div className="flex gap-1 mt-0.5">
            <button onClick={() => setShowNote(v => !v)}
              className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-colors ${showNote ? 'bg-amber-100 text-amber-600' : 'text-muted hover:text-amber-500'}`}>
              <MessageSquare size={9} className="inline ml-0.5"/>ملاحظة
            </button>
            <button onClick={() => setShowDisc(v => !v)}
              className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-colors ${showDisc ? 'bg-emerald-100 text-emerald-600' : 'text-muted hover:text-emerald-500'}`}>
              <Tag size={9} className="inline ml-0.5"/>خصم
            </button>
          </div>
        </td>
        <td className="py-2 px-2 text-center">
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => onUpdateQty(idx, item.Qty - 1)}
              className="h-7 w-7 rounded-md border-2 border-subtle bg-white font-black text-sm text-slate-500 flex items-center justify-center hover:border-slate-300 hover:bg-slate-50 active:scale-95 transition-all">−</button>
            <QtyCell value={item.Qty} onCommit={v => onUpdateQty(idx, v)} />
            <button onClick={() => onUpdateQty(idx, item.Qty + 1)}
              className="h-7 w-7 rounded-md border-2 border-primary/20 bg-indigo-50 font-black text-sm text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-95">+</button>
          </div>
        </td>
        <td className="py-2 px-2 text-center max-sm:hidden"><PriceCell value={item.Price} onCommit={v => onUpdatePrice(idx, v)} /></td>
        <td className="py-2 px-2 text-center font-black text-[13px] text-primary bg-indigo-50/30 group-hover:bg-indigo-50/80 transition-colors">{fmt(item.Price * item.Qty)}</td>
        <td className="py-2 px-2 text-center">
          <button onClick={() => onRemove(idx)}
            className="p-1.5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors sm:opacity-0 sm:group-hover:opacity-100 opacity-100 scale-90 group-hover:scale-100">
            <X size={14} strokeWidth={2.5}/>
          </button>
        </td>
      </tr>
      {/* Inline note */}
      {showNote && (
        <tr><td colSpan={6} className="px-3 pb-2">
          <div className="flex gap-2">
            <input value={item.Note || ''} onChange={e => onUpdateNote(idx, e.target.value)}
              placeholder="ملاحظة على هذا الصنف..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[12px] font-bold outline-none focus:border-amber-400 text-amber-800 placeholder:text-amber-300 font-tajawal" />
            <button onClick={() => setShowNote(false)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-black hover:bg-amber-600 transition-colors"><Check size={12}/></button>
          </div>
        </td></tr>
      )}
      {/* Inline discount */}
      {showDisc && (
        <tr><td colSpan={6} className="px-3 pb-2">
          <div className="flex gap-2 items-center">
            <select value={discType} onChange={e => setDiscType(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-black text-emerald-700 outline-none cursor-pointer">
              <option value="pct">% نسبة</option>
              <option value="fixed">ثابت</option>
            </select>
            <input type="number" value={discVal} onChange={e => setDiscVal(e.target.value)}
              placeholder="0" className="w-20 px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] font-black text-center outline-none focus:border-emerald-400 font-tajawal"/>
            <button onClick={commitDisc} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-black hover:bg-emerald-600 transition-colors"><Check size={12}/></button>
            <button onClick={() => setShowDisc(false)} className="px-2 py-1.5 rounded-lg bg-hover text-muted text-[11px] hover:bg-subtle transition-colors"><X size={12}/></button>
          </div>
        </td></tr>
      )}
    </React.Fragment>
  );
}

// ── CartPanel ─────────────────────────────────────────────────────────────────
const CartPanel = ({
  order, removeItem, updateQuantity, updatePrice, clearCart,
  selectedCustomer, setSelectedCustomer, customers, setShowQuickCust,
  subtotal, tax, finalTotal, vatRate,
  discountType, setDiscountType, discountVal, setDiscountVal,
  redeemPoints, setRedeemPoints, pointsDiscount,
  settings, setShowPayment, holdCurrentOrder, printQuotation,
  isShiftOpen, quickPayCash, quickPayCard,
  ecoMode, setEcoMode, onShareWhatsApp,
  finalizeSale,
  // NEW: store actions
  updateItemNote, setItemDiscount, restoreFromUndo, undoStack,
  orderNote, setOrderNote,
  isMobileDrawer, onCloseDrawer
}) => {
  const [custSearch, setCustSearch] = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadValue, setNumpadValue] = useState('');
  const [numpadTargetIdx, setNumpadTargetIdx] = useState(null);
  const [showOrderNote, setShowOrderNote] = useState(false);
  const [undoToast, setUndoToast] = useState(null); // { itemName }

  const custRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (custRef.current && !custRef.current.contains(e.target)) setShowCustDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Watch undoStack — show toast when new item added
  const prevUndoLen = useRef(0);
  useEffect(() => {
    if ((undoStack || []).length > prevUndoLen.current && (undoStack || []).length > 0) {
      setUndoToast({ itemName: undoStack[0]?.item?.Name || 'الصنف' });
    }
    prevUndoLen.current = (undoStack || []).length;
  }, [undoStack]);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(custSearch.toLowerCase()) || (c.phone && c.phone.includes(custSearch))
  );

  const totalDiscount = (() => {
    if (discountType === 'pct')   return subtotal * (parseFloat(discountVal) || 0) / 100;
    if (discountType === 'fixed') return parseFloat(discountVal) || 0;
    if (discountType === 'final') { const f = parseFloat(discountVal); return isNaN(f) ? 0 : Math.max(0, subtotal + tax - f); }
    return 0;
  })();

  const pointsAmt   = redeemPoints ? (pointsDiscount || 0) : 0;
  const hasDiscount = totalDiscount > 0 || pointsAmt > 0;
  const itemCount   = order.reduce((s, i) => s + i.Qty, 0);

  const confirmNumpad = () => {
    if (numpadTargetIdx !== null) updateQuantity(numpadTargetIdx, parseFloat(numpadValue) || 1);
    setShowNumpad(false);
  };

  const handleUndo = () => {
    restoreFromUndo?.();
    setUndoToast(null);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-subtle text-main overflow-hidden font-tajawal relative z-40">

      {/* ── HEADER ── */}
      <div className="p-4 border-b border-subtle shrink-0 bg-card/80 backdrop-blur-md relative z-20 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-primary shadow-inner">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="m-0 text-base font-black text-main leading-tight">سلة الطلب</h2>
              {itemCount > 0 && <p className="m-0 text-xs font-bold text-muted">{itemCount} صنف</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {order.length > 0 && (
              <>
                <button onClick={() => setShowOrderNote(v => !v)} title="ملاحظة الطلب"
                  className={`p-2 rounded-xl transition-colors ${showOrderNote ? 'bg-amber-100 text-amber-600' : 'bg-hover text-muted hover:text-amber-500'}`}>
                  <MessageSquare size={15}/>
                </button>
                <button onClick={clearCart} title="إفراغ السلة"
                  className="p-2.5 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors group">
                  <Trash2 size={16} className="group-hover:scale-110 transition-transform"/>
                </button>
              </>
            )}
            {/* NEW: Mobile close button inside the panel if needed */}
            {isMobileDrawer && (
              <button onClick={onCloseDrawer} className="p-2.5 rounded-xl bg-hover text-muted sm:hidden">
                <X size={18}/>
              </button>
            )}
          </div>
        </div>

        {/* Order note */}
        {showOrderNote && (
          <div className="mb-3 animate-slide-in-top">
            <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
              placeholder="ملاحظة على الطلب كاملاً..." rows={2}
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-amber-50 text-[12px] font-bold outline-none focus:border-amber-400 resize-none text-amber-800 placeholder:text-amber-300 font-tajawal"/>
          </div>
        )}

        {/* Customer selector */}
        <div ref={custRef} className="relative z-50">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <p className="m-0 text-sm font-black text-main">{selectedCustomer.name}</p>
                  {selectedCustomer.loyalty_points > 0 && (
                    <p className="m-0 text-[10px] font-bold text-primary">{selectedCustomer.loyalty_points} نقطة ولاء</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-1.5 rounded-lg text-muted hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                <X size={18}/>
              </button>
            </div>
          ) : (
            <>
              <div className="relative group">
                <input value={custSearch} onChange={e => { setCustSearch(e.target.value); setShowCustDrop(true); }}
                  onFocus={() => setShowCustDrop(true)} placeholder="بحث عن عميل..."
                  className="w-full py-3 pr-10 pl-4 rounded-xl border-2 border-subtle bg-hover text-[13px] font-bold outline-none text-main placeholder:text-muted/60 focus:border-primary focus:bg-card focus:shadow-glass-hover transition-all"/>
                <UserPlus size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary pointer-events-none"/>
              </div>
              {showCustDrop && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 bg-card rounded-xl shadow-premium border border-subtle max-h-48 overflow-y-auto animate-slide-in-top">
                  {filteredCustomers.length > 0
                    ? filteredCustomers.map(c => (
                        <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustSearch(''); setShowCustDrop(false); }}
                          className="p-3 flex items-center gap-3 border-b border-subtle hover:bg-hover cursor-pointer transition-colors">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-600 text-xs">{c.name.charAt(0)}</div>
                          <div>
                            <p className="m-0 text-[13px] font-black text-main">{c.name}</p>
                            <p className="m-0 text-[10px] text-muted">{c.phone}</p>
                          </div>
                        </div>
                      ))
                    : (
                        <button onClick={() => { setShowQuickCust(true); setShowCustDrop(false); }}
                          className="w-full p-4 bg-transparent border-none text-primary font-black cursor-pointer hover:bg-indigo-50 text-sm">
                          + إضافة عميل جديد
                        </button>
                      )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── ORDER TABLE ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide">
        {order.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted p-10 opacity-70">
            <div className="h-24 w-24 rounded-full bg-hover flex items-center justify-center mb-4 animate-scale-in">
              <ShoppingCart size={40} className="text-slate-300"/>
            </div>
            <p className="font-black text-sm text-main m-0">السلة فارغة</p>
            <p className="font-bold text-xs mt-1">انقر على منتج للإضافة</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px] font-tajawal relative z-10">
            <thead className="sticky top-0 z-20 backdrop-blur-md bg-card/90 shadow-sm border-b border-subtle">
              <tr>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-center max-sm:hidden">#</th>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-right">الصنف</th>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-center">الكمية</th>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-center max-sm:hidden">السعر</th>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-center">الإجمالي</th>
                <th className="py-3 px-2 text-[10px] font-black text-muted tracking-wider text-center"></th>
              </tr>
            </thead>
            <tbody>
              {order.map((item, idx) => (
                <CartRow key={`${item.variant}-${idx}`}
                  item={item} idx={idx}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                  onUpdatePrice={updatePrice}
                  onUpdateNote={updateItemNote}
                  onSetDiscount={setItemDiscount}
                  onOpenNumpad={(i, qty) => { setNumpadTargetIdx(i); setNumpadValue(String(qty)); setShowNumpad(true); }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FINANCIAL SUMMARY ── */}
      <div className="border-t border-subtle p-4 bg-app shrink-0 relative z-30 shadow-[0_-8px_20px_rgba(0,0,0,0.02)]">
        <div className="bg-card rounded-2xl border-2 border-subtle p-4 mb-3 shadow-sm hover:border-primary/30 transition-colors">
          <div className="flex justify-between text-xs text-muted font-black mb-2">
            <span>المجموع الفرعي</span><span className="text-main">{fmt(subtotal)} ر.س</span>
          </div>
          <div className="flex justify-between text-xs text-muted font-black mb-2">
            <span>الضريبة ({((vatRate || 0.15) * 100).toFixed(0)}%)</span><span className="text-main">{fmt(tax)} ر.س</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between text-xs font-black mb-2 text-emerald-500 bg-emerald-50 p-1.5 rounded-lg -mx-1.5 px-1.5">
              <span>الخصم</span><span>− {fmt(totalDiscount + pointsAmt)} ر.س</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-black text-main pt-3 mt-1 border-t-2 border-dashed border-subtle animate-total-update">
            <span>الإجمالي</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600">SAR {fmt(finalTotal)}</span>
          </div>
        </div>

        {/* Quick-pay */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={quickPayCash} disabled={order.length===0}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200 font-black text-xs hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">
            <Zap size={16}/> نقد سريع
          </button>
          <button onClick={quickPayCard} disabled={order.length===0}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-50 text-indigo-700 border-2 border-indigo-200 font-black text-xs hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">
            <CreditCard size={16}/> بطاقة سريع
          </button>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={holdCurrentOrder}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-hover text-muted border border-subtle font-black text-xs hover:bg-card hover:border-muted hover:text-main transition-all active:scale-95">
            <Pause size={16}/> تعليق
          </button>
          <button onClick={printQuotation}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-black text-xs hover:bg-amber-100 transition-all active:scale-95">
            <FileDown size={16}/> عرض سعر
          </button>
        </div>

        <button onClick={() => setShowPayment(true)} disabled={order.length===0}
          className={`w-full p-4 rounded-2xl border-none font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-md active:scale-[0.98] ${
            order.length > 0
              ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5'
              : 'bg-subtle text-muted cursor-not-allowed shadow-none'}`}>
          <CreditCard size={22}/> متابعة الدفع (F2)
        </button>

        {order.length > 0 && (
          <p className="mt-3 text-center text-xs font-black text-muted">{itemCount} قطعة · {order.length} صنف</p>
        )}
      </div>

      {showNumpad && (
        <Numpad value={numpadValue} onChange={setNumpadValue} onConfirm={confirmNumpad} onClose={() => setShowNumpad(false)} />
      )}

      {undoToast && (
        <UndoToast
          itemName={undoToast.itemName}
          onUndo={handleUndo}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
};

export default CartPanel;
