import React from 'react';

export function WidgetZATCA() {
  return (
    <div className="w-[600px] h-[500px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden text-right relative transform-style-3d" dir="rtl">
      
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-success/20 to-transparent tz-10" />

      {/* Header */}
      <div className="p-8 pb-4 relative z-10 flex justify-between items-start transform-style-3d tz-20">
        <div className="transform-style-3d tz-10">
          <h2 className="text-3xl font-black text-text-primary mb-2">فاتورة ضريبية مبسطة</h2>
          <div className="text-text-muted font-en">Invoice #INV-2026-0042</div>
        </div>
        <div className="bg-success text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg transform-style-3d tz-40">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          معتمدة من ZATCA
        </div>
      </div>

      {/* Invoice Details */}
      <div className="px-8 py-4 flex-1 relative z-10 transform-style-3d tz-10">
        <div className="flex gap-8 mb-6 border-b border-border pb-6 transform-style-3d tz-20">
          <div>
            <div className="text-text-subtle text-sm mb-1">تاريخ الإصدار</div>
            <div className="font-bold font-en text-text-primary">2026-10-12 14:32:00</div>
          </div>
          <div>
            <div className="text-text-subtle text-sm mb-1">الرقم الضريبي</div>
            <div className="font-bold font-en text-text-primary">300000000000003</div>
          </div>
        </div>

        <div className="bg-bg-base/80 backdrop-blur-md rounded-xl p-4 border border-border flex items-center justify-between shadow-sm transform-style-3d tz-30">
          <div className="flex gap-4 items-center transform-style-3d tz-10">
            {/* Fake QR Code */}
            <div className="w-20 h-20 bg-white border border-border rounded-lg p-1 grid grid-cols-4 grid-rows-4 gap-0.5 shadow-md transform-style-3d tz-40 hover:tz-50 transition-transform cursor-pointer">
              {[...Array(16)].map((_, i) => (
                <div key={i} className={`bg-text-primary ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'}`} />
              ))}
            </div>
            <div>
              <div className="font-bold text-lg mb-1">رمز الاستجابة السريعة</div>
              <div className="text-sm text-text-muted">متوافق مع المرحلة الثانية</div>
            </div>
          </div>
          <div className="text-left transform-style-3d tz-20">
            <div className="text-text-subtle text-sm mb-1">الإجمالي الشامل</div>
            <div className="font-black text-2xl text-brand font-en">SAR 1,450.00</div>
          </div>
        </div>
      </div>

      {/* Decorative Validation Lines */}
      <div className="h-2 w-full bg-gradient-to-r from-success via-brand to-success opacity-80 tz-50 relative bottom-0" />
    </div>
  );
}
