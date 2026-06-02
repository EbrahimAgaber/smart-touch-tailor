import React, { useState, useEffect } from 'react';
import { X, Check, Calculator, Info } from 'lucide-react';

const PriceOverrideModal = ({ 
  item, 
  onClose, 
  onConfirm,
  vatRate = 0.15 
}) => {
  const [val, setVal] = useState(String(item.Price));
  const [isInclusive, setIsInclusive] = useState(true);

  const num = parseFloat(val) || 0;
  const originalPrice = item.Price;
  const savedAmount = Math.max(0, originalPrice - num);
  
  // VAT Logic: If inclusive, price = subtotal * (1 + vatRate)
  const subtotal = isInclusive ? num / (1 + vatRate) : num;
  const vatAmount = isInclusive ? num - subtotal : num * vatRate;
  const finalTotal = isInclusive ? num : num + vatAmount;

  const handleKey = (k) => {
    if (k === 'C') setVal('0');
    else if (k === '⌫') setVal(v => v.length > 1 ? v.slice(0, -1) : '0');
    else if (k === '.') {
      if (!val.includes('.')) setVal(v => v + '.');
    } else {
      setVal(v => (v === '0' ? k : v + k));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-1 ring-slate-200" dir="rtl">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-500/20 p-2 text-indigo-400">
                <Calculator size={20} />
              </div>
              <h3 className="font-black text-lg">سعر التفاوض</h3>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">تعديل سعر {item.Name}</div>
            <div className="text-4xl font-black text-indigo-400 tabular-nums">
              SAR {num.toFixed(2)}
            </div>
          </div>
        </div>

        {/* VAT Toggle & Summary */}
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
             <button 
               onClick={() => setIsInclusive(true)}
               className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${isInclusive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
             >
               شامل الضريبة
             </button>
             <button 
               onClick={() => setIsInclusive(false)}
               className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all ${!isInclusive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
             >
               غير شامل
             </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 p-4">
              <div className="text-[10px] font-bold text-slate-400 mb-1">الصافي</div>
              <div className="text-sm font-black text-slate-700">SAR {subtotal.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 p-4">
              <div className="text-[10px] font-bold text-slate-400 mb-1">الضريبة ({(vatRate*100).toFixed(0)}%)</div>
              <div className="text-sm font-black text-slate-700">SAR {vatAmount.toFixed(2)}</div>
            </div>
          </div>

          {savedAmount > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2 text-emerald-600">
               <Info size={14} />
               <span className="text-xs font-black italic">تم توفير SAR {savedAmount.toFixed(2)} للعميل</span>
            </div>
          )}

          {/* Numpad Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'].map(k => (
              <button
                key={k}
                onClick={() => handleKey(String(k))}
                className="flex h-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-95"
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => handleKey('C')}
              className="col-span-1 flex h-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 font-black shadow-sm ring-1 ring-red-100 transition-all hover:bg-red-100"
            >
              C
            </button>
            <button
              onClick={() => onConfirm(isInclusive ? num : finalTotal)}
              className="col-span-2 flex h-14 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Check size={20} className="ml-2" /> تأكيد السعر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceOverrideModal;
