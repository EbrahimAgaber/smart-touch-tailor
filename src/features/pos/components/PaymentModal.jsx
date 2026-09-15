import { memo, useEffect, useState } from 'react';
import { Trash2, Tag, CheckCircle, Printer, X, Plus, CreditCard, Wallet, Smartphone, ReceiptText, Zap, Building2, QrCode, Landmark } from 'lucide-react';
import InlineNumpad from './InlineNumpad';
// FIX 1: Import QRCode utility for Phase 2 TLV QR generation
import QRCode from '../../../utils/qr-gen';

const PAY_TYPES = [
  { value: 'Cash',         label: '\u0646\u0642\u062f',           icon: Wallet,    color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { value: 'Card',         label: '\u0628\u0637\u0627\u0642\u0629',          icon: CreditCard, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { value: 'STC',          label: 'STC Pay',        icon: Smartphone, color: 'text-purple-500', bg: 'bg-purple-50' },
  { value: 'Mada',         label: '\u0645\u062f\u0649',            icon: CreditCard, color: 'text-teal-500',   bg: 'bg-teal-50' },
  { value: 'Credit',       label: 'آجل',            icon: ReceiptText, color: 'text-slate-500', bg: 'bg-slate-50' },
  { value: 'StoreCredit',  label: 'رصيد متجر',      icon: Zap,         color: 'text-orange-500', bg: 'bg-orange-50' },
  { value: 'BankTransfer', label: 'تحويل بنكي',     icon: Landmark,  color: 'text-blue-500',   bg: 'bg-blue-50' },
  { value: 'QR',           label: 'QR',             icon: QrCode,    color: 'text-rose-500',   bg: 'bg-rose-50' },
];

const RECEIPT_TYPES = [
  { value: 'thermal', label: '\u{1F5A8}\uFE0F \u062d\u0631\u0627\u0631\u064a\u0629' },
  { value: 'whatsapp', label: '\u{1F4AC} \u0648\u0627\u062a\u0633\u0627\u0628' },
  { value: 'sms', label: '\u{1F4F1} SMS' },
  { value: 'none', label: '\u{1F6AB} \u0628\u062f\u0648\u0646' },
];

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

// ── QR Payment Panel (FIX 1: Real Phase 2 TLV QR) ─────────────────────────────
function QRPanel({ amount, onConfirm, settings }) {
  const [confirmed, setConfirmed] = useState(false);
  const [qrSvg, setQrSvg] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadQR() {
      setQrLoading(true);
      try {
        const bizAr = settings?.business_name_ar || '\u0628\u0627\u0626\u0639';
        const vatNum = settings?.vat_number || '';
        const timestamp = new Date().toISOString();
        const vatRate = parseFloat(settings?.vat_rate || '0.15');
        const vatAmt = (amount * vatRate / (1 + vatRate)).toFixed(2);

        let tlvBase64 = null;

        // Try Phase 2 9-tag TLV first (requires provisioned device)
        try {
          const device = await window.api.getZatcaDevice();
          if (device && device.production_csid) {
            tlvBase64 = await window.api.getZatcaTLV9?.({
              seller: bizAr,
              vatNo: vatNum,
              timestamp,
              total: amount.toFixed(2),
              vatAmt,
            });
          }
        } catch (_) {}

        // Phase 1 fallback if device not yet provisioned or getZatcaTLV9 not available
        if (!tlvBase64) {
          console.warn('[QRPanel] Falling back to Phase 1 5-tag TLV (device not provisioned)');
          tlvBase64 = await window.api.getZatcaTLV?.({
            seller: bizAr,
            vatNo: vatNum,
            timestamp,
            total: amount.toFixed(2),
            vatAmt,
          });
        }

        if (!cancelled && tlvBase64) {
          const svg = QRCode.generateSVG(tlvBase64, 3);
          setQrSvg(`data:image/svg+xml;base64,${btoa(svg)}`);
        }
      } catch (err) {
        console.error('[QRPanel] QR generation failed:', err);
      }
      if (!cancelled) setQrLoading(false);
    }
    loadQR();
    return () => { cancelled = true; };
  }, [amount, settings?.vat_number, settings?.business_name_ar]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-card rounded-2xl border border-subtle">
      <p className="text-xs font-black text-muted uppercase tracking-widest">\u0627\u0645\u0633\u062d \u0631\u0645\u0632 QR \u0627\u0644\u0636\u0631\u064a\u0628\u064a</p>
      <div className="w-[160px] h-[160px] bg-white rounded-xl border-4 border-primary/20 flex items-center justify-center shadow-inner overflow-hidden">
        {qrLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] font-bold text-muted">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</span>
          </div>
        ) : qrSvg ? (
          <img src={qrSvg} alt="ZATCA QR" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center">
            <QrCode size={80} className="text-primary mx-auto mb-2" />
            <span className="text-xs font-black text-primary">{amount.toFixed(2)} \u0631.\u0633</span>
          </div>
        )}
      </div>
      {!confirmed ? (
        <button onClick={() => { setConfirmed(true); onConfirm?.(); }}
          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-600 transition-all active:scale-95 shadow-md shadow-emerald-500/20">
          \u2713 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645
        </button>
      ) : (
        <div className="flex items-center gap-2 text-emerald-500 font-black text-sm">
          <CheckCircle size={20}/> \u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639
        </div>
      )}
    </div>
  );
}

// ── Bank Transfer Panel ────────────────────────────────────────────────────────
function BankPanel({ settings }) {
  const [ref, setRef] = useState('');
  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-2xl border border-subtle">
      <p className="text-xs font-black text-muted uppercase tracking-widest">\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0646\u0643\u064a</p>
      <div className="space-y-2 text-sm">
        {settings?.bank_name && (
          <div className="flex justify-between"><span className="text-muted font-bold">\u0627\u0644\u0628\u0646\u0643</span><span className="font-black text-main">{settings.bank_name}</span></div>
        )}
        {settings?.bank_beneficiary && (
          <div className="flex justify-between"><span className="text-muted font-bold">\u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f</span><span className="font-black text-main">{settings.bank_beneficiary}</span></div>
        )}
        {settings?.bank_iban && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted font-bold">\u0627\u0644\u0622\u064a\u0628\u0627\u0646</span>
            <span className="font-black text-primary font-mono text-xs bg-indigo-50 px-2 py-1 rounded-lg">{settings.bank_iban}</span>
          </div>
        )}
      </div>
      <div className="mt-2">
        <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639</label>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="\u0623\u062f\u062e\u0644 \u0631\u0642\u0645 \u0645\u0631\u062c\u0639 \u0627\u0644\u062a\u062d\u0648\u064a\u0644"
          className="w-full px-3 py-2 rounded-xl border-2 border-subtle bg-hover outline-none focus:border-primary text-sm font-bold font-tajawal"/>
      </div>
    </div>
  );
}

const PaymentModal = memo(function PaymentModal({
  finalTotal, payments, setPayments, remaining, changeAmt, canFinalize,
  discountType, setDiscountType, discountVal, setDiscountVal,
  invoiceType, setInvoiceType, isSplit, setIsSplit,
  redeemPoints, setRedeemPoints, pointsDiscount,
  selectedCustomer, vatRate, onFinalize, onFinalizeQuick, onClose,
  settings,
}) {
  const [activePaymentIdx, setActivePaymentIdx] = useState(0);
  const [receiptType, setReceiptType] = useState('thermal');

  useEffect(() => {
    document.body.dataset.modalOpen = '1';
    return () => delete document.body.dataset.modalOpen;
  }, []);

  useEffect(() => {
    if (activePaymentIdx >= payments.length) setActivePaymentIdx(Math.max(0, payments.length - 1));
  }, [payments.length, activePaymentIdx]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && canFinalize) { e.preventDefault(); onFinalize(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [canFinalize, onFinalize]);

  const updatePayment = (i, field, val) => {
    const next = [...payments]; next[i] = { ...next[i], [field]: val }; setPayments(next);
  };
  const setExactAmount = () => {
    const others = payments.slice(1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const n = [...payments]; n[0] = { ...n[0], amount: Math.max(0, finalTotal - others).toFixed(2) }; setPayments(n);
  };
  const addQuickAmount = (v) => {
    const n = [...payments];
    n[activePaymentIdx] = { ...n[activePaymentIdx], amount: ((parseFloat(n[activePaymentIdx].amount) || 0) + v).toFixed(2) };
    setPayments(n);
  };

  const activeType = payments[activePaymentIdx]?.type;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md font-tajawal animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card w-full max-w-4xl rounded-2xl overflow-hidden shadow-lg flex flex-col max-h-[90vh] border border-subtle"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <header className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-hover flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-main tracking-tighter">{finalTotal.toFixed(2)}</span>
                <span className="text-sm font-black text-primary">\u0631.\u0633</span>
              </div>
            </div>
            <div className="h-12 w-px bg-subtle"/>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                {remaining > 0 ? '\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u062a\u0628\u0642\u064a' : '\u0627\u0644\u0628\u0627\u0642\u064a \u0644\u0644\u0639\u0645\u064a\u0644'}
              </span>
              <div className={`flex items-baseline gap-2 transition-colors duration-300 ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                <span className="text-4xl font-black tracking-tighter">
                  {remaining > 0 ? remaining.toFixed(2) : changeAmt.toFixed(2)}
                </span>
                <span className="text-sm font-black">\u0631.\u0633</span>
              </div>
              {changeAmt > 0 && selectedCustomer && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input type="checkbox" id="addChangeToCredit" className="accent-primary w-4 h-4" />
                  حفظ الباقي كرصيد متجر للعميل
                </label>
              )}
            </div>
          </div>
          <button onClick={onClose} className="h-12 w-12 rounded-2xl bg-hover text-muted flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all hover:scale-105 active:scale-95">
            <X size={24}/>
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0 bg-app">

          {/* Left: config + methods (7 cols) */}
          <div className="col-span-7 p-6 overflow-y-auto space-y-5 border-l border-subtle">

            {/* Invoice type + split */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">\u0646\u0648\u0639 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</label>
                <div className="relative">
                  <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}
                    className="w-full h-12 rounded-2xl bg-card border-2 border-subtle focus:border-primary px-4 text-sm font-black text-main outline-none appearance-none cursor-pointer">
                    <option value="simplified">\u0636\u0631\u064a\u0628\u064a\u0629 \u0645\u0628\u0633\u0637\u0629</option>
                    <option value="tax">\u0636\u0631\u064a\u0628\u064a\u0629 \u0643\u0627\u0645\u0644\u0629</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">\u0646\u0648\u0639 \u0627\u0644\u0625\u064a\u0635\u0627\u0644</label>
                <select value={receiptType} onChange={e => setReceiptType(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-card border-2 border-subtle focus:border-primary px-4 text-sm font-black text-main outline-none cursor-pointer">
                  {RECEIPT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {/* Split toggle */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">\u062a\u0642\u0633\u064a\u0645 \u0627\u0644\u062f\u0641\u0639</label>
              <div className="flex gap-2 p-1 bg-hover rounded-2xl border border-subtle">
                <button onClick={() => { setIsSplit(!isSplit); if (isSplit) setPayments([{ type: 'Cash', amount: '' }]); }}
                  className={`flex-1 h-10 rounded-xl font-black text-xs transition-all duration-300 ${isSplit ? 'bg-white shadow-sm text-primary ring-1 ring-primary/20' : 'text-muted hover:text-main'}`}>
                  {isSplit ? '\u{1F500} \u0645\u0641\u0639\u0651\u0644' : '\u{1F500} \u062a\u0642\u0633\u064a\u0645'}
                </button>
                {isSplit && [2, 3].map(n => (
                  <button key={n}
                    onClick={() => setPayments(Array(n).fill(null).map(() => ({ type: 'Cash', amount: (finalTotal / n).toFixed(2) })))}
                    className="w-12 h-10 rounded-xl bg-primary text-white font-black text-xs shadow-md shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95">
                    1/{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method rows */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"/>\u0637\u0631\u0642 \u0627\u0644\u062f\u0641\u0639
              </label>
              {payments.map((p, i) => (
                <div key={i} onClick={() => setActivePaymentIdx(i)}
                  className={`p-4 rounded-3xl transition-all duration-300 border-2 cursor-pointer relative overflow-hidden ${activePaymentIdx===i ? 'bg-card border-primary shadow-glass' : 'bg-card/50 border-subtle hover:border-primary/30 hover:bg-card'}`}>
                  {activePaymentIdx===i && <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-r-full"/>}

                  {/* Scrollable type row */}
                  <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                    {PAY_TYPES.filter(t => t.value !== 'StoreCredit' || (selectedCustomer?.store_credit > 0)).map(t => {
                      const Icon = t.icon;
                      const sel  = p.type === t.value;
                      return (
                        <button key={t.value} onClick={e => { e.stopPropagation(); updatePayment(i, 'type', t.value); }}
                          className={`flex-shrink-0 h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-black transition-all duration-300 ${sel ? `bg-white shadow-md ${t.color} scale-105 z-10 ring-1` : 'bg-hover text-muted hover:text-main hover:bg-white/50'}`}>
                          <Icon size={14} className={sel ? 'animate-bounce' : ''} style={{animationDuration:'2s'}}/>
                          <span>{t.value === 'StoreCredit' ? `رصيد (${selectedCustomer?.store_credit})` : t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* QR/Bank special panels */}
                  {p.type === 'QR' ? (
                    // FIX 1: Pass settings so QRPanel can fetch Phase 2 TLV
                    <QRPanel amount={finalTotal} onConfirm={() => updatePayment(i, 'amount', finalTotal.toFixed(2))} settings={settings} />
                  ) : p.type === 'BankTransfer' ? (
                    <BankPanel settings={settings} />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input type="number" autoFocus={activePaymentIdx===i} value={p.amount}
                          onChange={e => updatePayment(i, 'amount', e.target.value)} placeholder="0.00"
                          className="w-full h-14 rounded-2xl bg-hover border-2 border-transparent px-5 text-2xl font-black text-main focus:border-primary focus:bg-card outline-none transition-all text-center placeholder:text-muted/30"/>
                        {p.amount && <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-primary">\u0631.\u0633</span>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); if (payments.length > 1) setPayments(payments.filter((_, idx) => idx !== i)); }}
                        disabled={payments.length===1}
                        className="h-14 w-14 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-20">
                        <Trash2 size={20}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => { setPayments([...payments, { type: 'Cash', amount: '' }]); setActivePaymentIdx(payments.length); }}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-subtle text-muted font-black text-xs hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group">
                <Plus size={16} className="group-hover:scale-125 transition-transform"/> \u0625\u0636\u0627\u0641\u0629 \u0637\u0631\u064a\u0642\u0629 \u062f\u0641\u0639 \u0623\u062e\u0631\u0649
              </button>
            </div>

            {/* Discount */}
            <div className="p-5 rounded-3xl bg-card border border-subtle hover:border-primary/30 transition-all shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center"><Tag size={16} className="text-primary"/></div>
                <span className="text-xs font-black text-main uppercase tracking-widest">\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u062e\u0635\u0645</span>
              </div>
              <div className="flex gap-3">
                <input type="number" value={discountVal} onChange={e => setDiscountVal(e.target.value)} placeholder="0.00"
                  className="flex-1 h-12 rounded-2xl bg-hover border-2 border-transparent focus:border-primary px-4 text-lg font-black text-main outline-none focus:bg-card"/>
                <select value={discountType} onChange={e => setDiscountType(e.target.value)}
                  className="w-28 h-12 rounded-2xl bg-hover border-2 border-transparent focus:border-primary px-3 text-sm font-black text-main outline-none cursor-pointer">
                  <option value="none">\u0628\u062f\u0648\u0646</option>
                  <option value="fixed">\u062b\u0627\u0628\u062a</option>
                  <option value="pct">\u0646\u0633\u0628\u0629 %</option>
                  <option value="final">\u0633\u0639\u0631 \u0646\u0647\u0627\u0626\u064a</option>
                </select>
              </div>
              {selectedCustomer && (selectedCustomer.loyalty_points || 0) > 0 && pointsDiscount > 0 && (
                <div className="mt-3 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between hover:bg-emerald-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} className="h-5 w-5 rounded-lg accent-emerald-500 cursor-pointer"/>
                    <div>
                      <p className="text-xs font-black text-emerald-800">\u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0648\u0644\u0627\u0621 ({selectedCustomer.loyalty_points} \u0646\u0642\u0637\u0629)</p>
                      <p className="text-[10px] font-bold text-emerald-600">\u0633\u064a\u062a\u0645 \u062e\u0635\u0645 {pointsDiscount.toFixed(2)} \u0631.\u0633</p>
                    </div>
                  </div>
                  {redeemPoints && <span className="text-sm font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">\u2212 {pointsDiscount.toFixed(2)} \u0631.\u0633</span>}
                </div>
              )}
            </div>
          </div>

          {/* Right: numpad (5 cols) */}
          <div className="col-span-5 bg-hover p-5 flex flex-col gap-5 overflow-y-auto">
            {activeType !== 'QR' && activeType !== 'BankTransfer' && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest px-1">\u0644\u0648\u062d\u0629 \u0627\u0644\u0623\u0631\u0642\u0627\u0645</span>
                  <div className="bg-card p-2 rounded-3xl shadow-sm border border-subtle">
                    <InlineNumpad docked={true} value={String(payments[activePaymentIdx]?.amount || '')}
                      onChange={v => updatePayment(activePaymentIdx, 'amount', v)} mode="amount"/>
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest px-1">\u0645\u0628\u0627\u0644\u063a \u0633\u0631\u064a\u0639\u0629</span>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map(v => (
                      <button key={v} onClick={() => addQuickAmount(v)}
                        className="h-11 rounded-xl bg-card border border-subtle text-base font-black text-main hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95 hover:shadow-md">
                        {v}
                      </button>
                    ))}
                    <button onClick={setExactAmount}
                      className="col-span-3 h-12 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white font-black text-sm shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98]">
                      \u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0645\u0628\u0644\u063a \u0628\u0627\u0644\u0643\u0627\u0645\u0644
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Status indicator */}
            <div className={`mt-auto p-5 rounded-3xl border-2 flex items-center justify-between transition-all duration-500 flex-shrink-0 ${remaining<=0 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/30 hover:scale-[1.02]' : 'bg-card border-rose-100 text-rose-500 shadow-sm'}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-90 flex items-center gap-1.5">
                  {remaining > 0 ? <><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"/> \u0645\u062a\u0628\u0642\u064a \u0644\u0644\u062f\u0641\u0639</> : '\u2713 \u0627\u0643\u062a\u0645\u0644 \u0627\u0644\u062f\u0641\u0639'}
                </p>
                <p className="text-3xl font-black tabular-nums tracking-tighter">
                  {remaining > 0 ? remaining.toFixed(2) : changeAmt.toFixed(2)} <small className="text-xs font-bold">\u0631.\u0633</small>
                </p>
              </div>
              {remaining <= 0 && <CheckCircle size={40} strokeWidth={2.5} className="animate-scale-in text-white drop-shadow-md"/>}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="px-8 py-5 bg-card border-t border-subtle flex items-center gap-4 flex-shrink-0">
          <button onClick={onClose} className="px-8 h-14 rounded-2xl bg-hover text-muted font-black text-sm hover:bg-subtle transition-all active:scale-95">\u0625\u0644\u063a\u0627\u0621</button>
          <button onClick={onFinalizeQuick} disabled={!canFinalize}
            className={`px-8 h-14 rounded-2xl font-black text-sm transition-all duration-300 flex items-center gap-3 active:scale-95 disabled:opacity-40 ${canFinalize ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-hover text-muted border border-transparent'}`}>
            <Zap size={20} className={canFinalize ? 'text-emerald-500' : ''}/> \u0625\u0646\u0647\u0627\u0621 \u0628\u062f\u0648\u0646 \u0637\u0628\u0627\u0639\u0629
          </button>
          <button onClick={onFinalize} disabled={!canFinalize}
            className={`flex-1 h-14 rounded-2xl font-black text-lg transition-all duration-300 flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-40 ${canFinalize ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-0.5' : 'bg-subtle text-muted'}`}>
            <Printer size={24} strokeWidth={2.5}/> \u062a\u0623\u0643\u064a\u062f \u0648\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629
          </button>
        </footer>
      </div>
    </div>
  );
});

export default PaymentModal;
