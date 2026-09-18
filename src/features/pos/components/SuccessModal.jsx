import React, { memo, useEffect, useState } from 'react';
import { 
  Share2, Trash2, Printer, CheckCircle, X, 
  FileText, ArrowRight, ShoppingBag, Zap, MessageSquare
} from 'lucide-react';
import { openWhatsApp } from '../../../utils/whatsapp';

const SuccessModal = memo(function SuccessModal({
  lastInvoice,
  printReceipt,
  onClose,
}) {
  const [countdown, setCountdown] = useState(8);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [zatcaReady, setZatcaReady] = useState(true); // default true — don't block on slow IPC

  useEffect(() => {
    window.api?.getZatcaDevice?.().then(device => {
      setZatcaReady(!!(device?.production_csid && device?.production_cert_pem));
    }).catch(() => setZatcaReady(true)); // fail open
  }, []);

  useEffect(() => {
    document.body.dataset.modalOpen = '1';
    return () => delete document.body.dataset.modalOpen;
  }, []);

  useEffect(() => {
    if (countdown <= 0) { onClose(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onClose]);

  const shareWhatsApp = () => {
    if (!lastInvoice) return;
    const txt = `🧾 فاتورة: ${lastInvoice.invoice}\n` +
      `💰 الإجمالي: SAR ${(lastInvoice.total || 0).toFixed(2)}\n` +
      `✅ تم الدفع بنجاح`;
    openWhatsApp('', txt);
    if (window.api?.recordWhatsAppShare) {
      window.api.recordWhatsAppShare({ 
        customerId: lastInvoice.customer_id || null, 
        invoiceId: lastInvoice.invoice 
      });
    }
  };

  const handleVoid = async () => {
    if (!lastInvoice?.invoice) return;
    try {
      const res = await window.api?.voidSale?.({ 
        invoiceId: lastInvoice.invoice, 
        reason: 'إلغاء فوري من شاشة النجاح' 
      });
      if (res?.success) {
        setShowVoidConfirm(false);
        onClose();
      } else {
        alert('تعذّر إلغاء الفاتورة: ' + (res?.error || 'خطأ غير معروف'));
      }
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  };

  const progress = ((8 - countdown) / 8) * 100;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/70 backdrop-blur-xl p-4 animate-in fade-in duration-300 font-tajawal">
      <div className="relative w-full max-w-md overflow-hidden rounded-[48px] bg-card shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500">
        {/* Animated Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-app">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000 linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-8 left-8 h-10 w-10 rounded-2xl bg-app text-muted flex items-center justify-center hover:bg-subtle hover:text-main transition-all z-10"
        >
          <X size={20} />
        </button>

        <div className="p-10 pt-16 text-center">
          {/* Hero Success State */}
          <div className="relative mx-auto mb-10 h-32 w-32">
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20 opacity-75" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-2xl shadow-emerald-500/40">
              <CheckCircle size={64} strokeWidth={2.5} className="animate-in zoom-in-50 duration-700" />
            </div>
          </div>

          <h2 className="text-4xl font-black text-main mb-2 tracking-tighter italic">تمت العملية!</h2>
          <p className="text-muted font-bold mb-10 tracking-widest uppercase text-xs">
            رقم الفاتورة <span className="text-indigo-600 font-black">#{lastInvoice?.invoice}</span>
          </p>

          {/* Financial Summary Card */}
          <div className="mb-10 rounded-[32px] bg-app p-8 text-right ring-1 ring-subtle shadow-inner">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-subtle">
              <span className="text-xs font-black text-muted uppercase tracking-widest">المجموع النهائي</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-main tabular-nums tracking-tighter">
                  {lastInvoice?.total?.toFixed(2)}
                </span>
                <span className="text-xs font-black text-muted">ر.س</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {(lastInvoice?.change || 0) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-muted">الباقي للعميل</span>
                  <span className="font-black text-emerald-600 tabular-nums">SAR {lastInvoice.change.toFixed(2)}</span>
                </div>
              )}
              {lastInvoice?.discount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-muted">إجمالي الخصم</span>
                  <span className="font-black text-indigo-500 tabular-nums">SAR {lastInvoice.discount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Print Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {!zatcaReady && (
              <div className="col-span-2 rounded-xl bg-amber-50 border-2 border-amber-400 p-3 mb-1">
                <p className="text-amber-800 font-black text-xs text-center">
                  ⚠️ تنبيه: لم يكتمل تفعيل ZATCA — رمز QR في الإيصال قد لا يكون صحيحاً
                </p>
              </div>
            )}
             <button 
               onClick={() => printReceipt?.('thermal')}
               className="group flex flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-subtle bg-card p-6 transition-all hover:border-indigo-500 hover:bg-indigo-50 active:scale-95"
             >
               <div className="h-12 w-12 rounded-2xl bg-app flex items-center justify-center text-muted group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                 <Printer size={24} />
               </div>
               <span className="text-xs font-black text-muted group-hover:text-indigo-600">طباعة حرارية</span>
             </button>
             
             <button 
               onClick={() => printReceipt?.('a4')}
               className="group flex flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-subtle bg-card p-6 transition-all hover:border-indigo-500 hover:bg-indigo-50 active:scale-95"
             >
               <div className="h-12 w-12 rounded-2xl bg-app flex items-center justify-center text-muted group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                 <FileText size={24} />
               </div>
               <span className="text-xs font-black text-muted group-hover:text-indigo-600">فاتورة A4</span>
             </button>
          </div>

          {/* Main CTA */}
          <button 
            onClick={onClose}
            className="group relative mb-10 flex w-full items-center justify-between rounded-[32px] bg-slate-900 p-6 text-white shadow-2xl shadow-slate-900/30 transition-all hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 overflow-hidden"
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
                <ShoppingBag size={24} className="animate-bounce" />
              </div>
              <div className="text-right">
                <span className="block text-xl font-black italic leading-none">طلب جديد</span>
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">العودة للرئيسية</span>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-4 text-white font-black">
               <div className="h-10 w-10 rounded-full border-2 border-white/20 flex items-center justify-center text-xs">
                 {countdown}
               </div>
               <ArrowRight size={28} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Secondary Actions */}
          <div className="flex items-center justify-between border-t border-subtle pt-8 px-2">
            <button 
              onClick={shareWhatsApp}
              className="flex items-center gap-3 font-black text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-widest">مشاركة واتساب</span>
            </button>

            {!showVoidConfirm ? (
              <button 
                onClick={() => setShowVoidConfirm(true)}
                className="flex items-center gap-3 font-black text-muted hover:text-rose-500 transition-colors"
              >
                <div className="h-10 w-10 rounded-2xl bg-app flex items-center justify-center group-hover:bg-rose-50 transition-colors">
                  <Printer size={20} className="hidden" /> {/* Spacer */}
                  <Trash2 size={20} />
                </div>
                <span className="text-[10px] uppercase tracking-widest">إلغاء فورياً</span>
              </button>
            ) : (
              <div className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-300">
                 <span className="text-xs font-black text-rose-500">متأكد؟</span>
                 <div className="flex gap-2">
                   <button onClick={handleVoid} className="h-10 px-4 rounded-xl bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-500/20 active:scale-95">نعم</button>
                   <button onClick={() => setShowVoidConfirm(false)} className="h-10 px-4 rounded-xl bg-slate-100 text-slate-600 text-xs font-black active:scale-95">لا</button>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SuccessModal;
