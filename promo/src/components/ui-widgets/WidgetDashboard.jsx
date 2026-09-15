import React from 'react';

export function WidgetDashboard() {
  return (
    <div className="w-[800px] h-[500px] bg-bg-surface/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border flex overflow-hidden text-right transform-style-3d" dir="rtl">
      
      {/* Sidebar - Floats up slightly */}
      <div className="w-64 bg-bg-base/80 backdrop-blur-md border-l border-border flex flex-col p-4 transform-style-3d tz-20 shadow-[10px_0_30px_rgba(0,0,0,0.05)]">
        <div className="font-black text-2xl text-brand mb-8 tz-10">Smart Touch</div>
        <div className="flex flex-col gap-2 transform-style-3d tz-10">
          <div className="bg-brand text-white px-4 py-2 rounded-lg font-bold shadow-md tz-10">لوحة القيادة</div>
          <div className="text-text-muted hover:bg-white px-4 py-2 rounded-lg cursor-pointer transition">المبيعات</div>
          <div className="text-text-muted hover:bg-white px-4 py-2 rounded-lg cursor-pointer transition">المخزون</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col gap-6 transform-style-3d">
        <div className="flex justify-between items-center transform-style-3d tz-10">
          <h2 className="text-2xl font-bold text-text-primary">نظرة عامة على الأداء</h2>
          <div className="bg-white shadow-sm px-4 py-2 rounded-lg text-sm text-text-muted font-en border border-border tz-20">
            Oct 12 - Oct 19, 2026
          </div>
        </div>

        {/* Stat Cards - Floating higher */}
        <div className="grid grid-cols-3 gap-4 transform-style-3d tz-40">
          <div className="bg-white border border-border p-4 rounded-xl shadow-lg transform-style-3d hover:tz-50 transition-transform">
            <div className="text-text-subtle text-sm mb-1 tz-10">إجمالي المبيعات</div>
            <div className="text-2xl font-black text-text-primary font-en tz-20">SAR 45,290</div>
            <div className="text-success text-xs mt-2 font-bold tz-10">+12.5%</div>
          </div>
          <div className="bg-white border border-border p-4 rounded-xl shadow-lg transform-style-3d hover:tz-50 transition-transform">
            <div className="text-text-subtle text-sm mb-1 tz-10">عدد الطلبات</div>
            <div className="text-2xl font-black text-text-primary font-en tz-20">1,204</div>
            <div className="text-success text-xs mt-2 font-bold tz-10">+5.2%</div>
          </div>
          <div className="bg-white border border-border p-4 rounded-xl shadow-lg transform-style-3d hover:tz-50 transition-transform">
            <div className="text-text-subtle text-sm mb-1 tz-10">العملاء الجدد</div>
            <div className="text-2xl font-black text-text-primary font-en tz-20">142</div>
            <div className="text-danger text-xs mt-2 font-bold tz-10">-2.1%</div>
          </div>
        </div>

        {/* Chart Area - Explodes outward */}
        <div className="flex-1 border border-border rounded-xl bg-white/50 backdrop-blur-md p-4 flex items-end gap-2 px-8 pt-12 relative overflow-hidden transform-style-3d tz-30 shadow-xl">
          <div className="absolute top-4 right-4 text-text-muted font-bold text-sm tz-10">المبيعات الأسبوعية</div>
          {/* Chart Bars float massively */}
          {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
            <div key={i} className="flex-1 bg-brand rounded-t-sm shadow-brand transform-style-3d tz-60 opacity-90" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
