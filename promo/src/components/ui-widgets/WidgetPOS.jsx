import React from 'react';

export function WidgetPOS() {
  const products = [
    { name: "قهوة مختصة", price: "SAR 18.00", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { name: "كابتشينو", price: "SAR 15.00", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { name: "لاتيه", price: "SAR 16.00", color: "bg-green-100 text-green-700 border-green-200" },
    { name: "إسبريسو", price: "SAR 12.00", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { name: "كرواسون زبدة", price: "SAR 10.00", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    { name: "كيك شوكولاتة", price: "SAR 22.00", color: "bg-red-100 text-red-700 border-red-200" },
  ];

  return (
    <div className="w-[800px] h-[500px] bg-bg-base/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border flex overflow-hidden text-right transform-style-3d" dir="rtl">
      
      {/* Product Grid - Depressed slightly */}
      <div className="flex-1 p-6 flex flex-col gap-4 transform-style-3d">
        <div className="flex gap-2 mb-2 transform-style-3d tz-20">
          <div className="bg-brand text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">الكل</div>
          <div className="bg-white border border-border text-text-muted px-4 py-2 rounded-full text-sm shadow-sm tz-10">مشروبات ساخنة</div>
          <div className="bg-white border border-border text-text-muted px-4 py-2 rounded-full text-sm shadow-sm tz-10">مخبوزات</div>
        </div>

        <div className="grid grid-cols-3 gap-3 transform-style-3d tz-10">
          {products.map((p, i) => (
            <div key={i} className={`p-4 rounded-xl border flex flex-col justify-between h-32 shadow-lg transform-style-3d tz-30 hover:tz-50 transition-transform cursor-pointer ${p.color}`}>
              <div className="font-bold text-lg tz-10">{p.name}</div>
              <div className="font-en font-bold text-sm opacity-80 tz-20">{p.price}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar - Popped out massively */}
      <div className="w-[280px] bg-white/95 backdrop-blur-2xl border-r border-border flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.1)] transform-style-3d tz-50">
        <div className="p-4 border-b border-border bg-bg-base/50 font-bold text-lg tz-10">الطلب الحالي #1042</div>
        
        <div className="flex-1 overflow-hidden p-4 flex flex-col gap-3 transform-style-3d tz-20">
          <div className="flex justify-between items-center text-sm bg-bg-surface p-2 rounded-lg shadow-sm transform-style-3d tz-10">
            <div className="font-bold">2x كابتشينو</div>
            <div className="font-en font-bold text-brand">SAR 30.00</div>
          </div>
          <div className="flex justify-between items-center text-sm bg-bg-surface p-2 rounded-lg shadow-sm transform-style-3d tz-10">
            <div className="font-bold">1x كيك شوكولاتة</div>
            <div className="font-en font-bold text-brand">SAR 22.00</div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-bg-base/50 transform-style-3d tz-30">
          <div className="flex justify-between items-center mb-2 text-text-muted text-sm tz-10">
            <span>الضريبة (15%)</span>
            <span className="font-en">SAR 7.80</span>
          </div>
          <div className="flex justify-between items-center mb-4 text-xl font-black text-text-primary tz-10">
            <span>الإجمالي</span>
            <span className="font-en">SAR 59.80</span>
          </div>
          <button className="w-full bg-brand text-white font-bold text-lg py-3 rounded-xl shadow-[0_10px_20px_rgba(61,82,213,0.3)] hover:bg-brand-dark transition-colors transform-style-3d tz-40">
            دفع (الدفع السريع)
          </button>
        </div>
      </div>

    </div>
  );
}
