import React, { useState } from 'react';
export function Scene6_Bilingual() {
  const [isRTL, setIsRTL] = useState(false);
  return (
    <section className="w-full min-h-screen flex items-center justify-center overflow-hidden py-32">
      <div className="max-w-6xl w-full flex flex-col items-center p-8">
        <div className="mb-12 text-center">
          <h2 dir="rtl" className="text-4xl md:text-6xl font-bold font-ui text-text-primary mb-4">صُمم للسعودية. مبني بلا حدود.</h2>
          <h2 className="text-2xl md:text-4xl font-bold text-text-muted">Made for Saudi. Built without limits.</h2>
        </div>
        <div className="relative w-full max-w-4xl h-[400px] rounded-2xl shadow-2xl p-8 flex flex-col transition-all duration-700 ease-in-out" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
            <h3 className="text-2xl font-bold">{isRTL ? 'نقطة البيع الذكية' : 'Smart Touch POS'}</h3>
            <button onClick={() => setIsRTL(!isRTL)} className="px-4 py-2 rounded font-semibold transition-colors" style={{ background: 'var(--brand-bg)', color: 'var(--brand)', border: '1px solid rgba(61,82,213,0.2)' }}>
              {isRTL ? 'Switch to English' : 'التبديل للعربية'}
            </button>
          </div>
          <div className="flex gap-8 h-full">
            <div className="w-2/3 rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="h-8 w-1/3 rounded mb-4" style={{ background: 'var(--bg-2)' }}></div>
              <div className="h-4 w-full rounded mb-2" style={{ background: 'var(--bg-2)' }}></div>
              <div className="h-4 w-2/3 rounded" style={{ background: 'var(--bg-2)' }}></div>
            </div>
            <div className="w-1/3 rounded-xl p-4 flex flex-col justify-end" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between text-xl mb-4" style={{ fontFamily: 'var(--font-en)', color: 'var(--brand)' }}>
                <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                <span>SAR 420.00</span>
              </div>
              <button className="w-full py-4 rounded font-bold text-xl text-white" style={{ background: 'var(--green)' }}>{isRTL ? 'دفع' : 'Pay'}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}