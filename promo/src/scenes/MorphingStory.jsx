import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, CheckCircle2, Shield, Search, Plus, CreditCard } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function MorphingStory() {
  const [step, setStep] = useState(0);
  const containerRef = useRef(null);

  // Bind scroll progress to the step state
  useEffect(() => {
    if (!containerRef.current) return;
    
    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => {
        // 5 steps (0 to 4)
        const progress = self.progress;
        let nextStep = 0;
        if (progress > 0.15) nextStep = 1; // POS
        if (progress > 0.40) nextStep = 2; // ZATCA
        if (progress > 0.65) nextStep = 3; // Sales History
        if (progress > 0.85) nextStep = 4; // Analytics Graph
        
        setStep(nextStep);
      }
    });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[600vh] relative bg-bg-base" dir="rtl">
      
      <div className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden bg-bg-base perspective-2000">
        
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 vibrant-mesh opacity-20 pointer-events-none" />

        {/* Narrative Text */}
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-50 text-center max-w-2xl px-4">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="text0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-3xl font-black text-text-primary">لوحة القيادة</h2>
                <p className="text-text-muted mt-2">انقر لإنشاء فاتورة جديدة بلمحة بصر.</p>
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="text1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-3xl font-black text-text-primary">نقاط البيع السريعة</h2>
                <p className="text-text-muted mt-2">اختر المنتج وقم بالدفع في ثوانٍ.</p>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="text2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-3xl font-black text-success">موافقة ZATCA الفورية</h2>
                <p className="text-text-muted mt-2">تم تشفير وتوقيع الفاتورة تلقائياً حسب متطلبات المرحلة الثانية.</p>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="text3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-3xl font-black text-text-primary">سجل المبيعات</h2>
                <p className="text-text-muted mt-2">تم تسجيل الفاتورة بنجاح في السجلات لحظياً.</p>
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="text4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-3xl font-black text-brand">نمو الأعمال</h2>
                <p className="text-text-muted mt-2">تابع أداء مبيعاتك لحظة بلحظة.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Morphing UI Window */}
        <motion.div 
          layout 
          className="relative w-[900px] h-[600px] bg-white rounded-3xl shadow-2xl border border-border overflow-hidden transform-style-3d"
          animate={{
            rotateX: step === 2 ? 5 : step === 4 ? 10 : 0,
            rotateY: step === 1 ? -5 : step === 3 ? 5 : 0,
            scale: step === 2 ? 1.05 : 1,
            boxShadow: step === 2 ? '0 30px 60px rgba(13,175,122,0.3)' : '0 20px 40px rgba(0,0,0,0.1)'
          }}
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
        >
          {/* Global Header Layout (Always present, but morphs) */}
          <motion.div layoutId="header" className="h-16 border-b border-border bg-bg-surface flex items-center justify-between px-6 z-20 relative">
            <motion.div layoutId="brand" className="font-black text-xl text-brand">SmartTouch</motion.div>
            <motion.div layoutId="header-actions" className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-border" />
              <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold">ST</div>
            </motion.div>
          </motion.div>

          {/* Dynamic Content Body */}
          <div className="relative w-full h-[calc(100%-4rem)] flex">
            
            {/* Sidebar (Expands/Collapses based on step) */}
            <motion.div 
              layoutId="sidebar" 
              className="bg-bg-surface border-l border-border h-full flex flex-col p-4"
              animate={{ width: step === 1 || step === 2 ? 80 : 250 }}
            >
              <motion.div layout className="flex flex-col gap-2">
                <div className={`p-3 rounded-xl flex items-center gap-3 ${step === 0 || step === 4 ? 'bg-brand text-white' : 'text-text-muted'}`}>
                  <TrendingUp size={20} />
                  {step !== 1 && step !== 2 && <span className="font-bold">لوحة القيادة</span>}
                </div>
                <div className={`p-3 rounded-xl flex items-center gap-3 ${step === 1 || step === 2 ? 'bg-brand text-white' : 'text-text-muted'}`}>
                  <Plus size={20} />
                  {step !== 1 && step !== 2 && <span className="font-bold">نقطة البيع</span>}
                </div>
                <div className={`p-3 rounded-xl flex items-center gap-3 ${step === 3 ? 'bg-brand text-white' : 'text-text-muted'}`}>
                  <Search size={20} />
                  {step !== 1 && step !== 2 && <span className="font-bold">سجل المبيعات</span>}
                </div>
              </motion.div>
            </motion.div>

            {/* Main Area */}
            <div className="flex-1 relative bg-bg-base overflow-hidden p-6">
              <AnimatePresence mode="wait">
                
                {/* STEP 0: Dashboard */}
                {step === 0 && (
                  <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold">نظرة عامة على الأداء</h3>
                      <button className="bg-brand text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-brand relative overflow-hidden group">
                        <Plus size={18} />
                        فاتورة جديدة
                        
                        {/* Simulated Cursor clicking New Invoice */}
                        <motion.div 
                          initial={{ x: -200, y: 100, opacity: 0 }}
                          animate={{ x: 0, y: 0, opacity: 1, scale: [1, 0.8, 1] }}
                          transition={{ delay: 1, duration: 1.5, times: [0, 0.8, 1] }}
                          className="absolute right-2 top-2 z-50 text-white"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                        </motion.div>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-border shadow-sm"><div className="text-sm text-text-muted">المبيعات</div><div className="text-xl font-bold font-en mt-1">SAR 4,500</div></div>
                      <div className="bg-white p-4 rounded-xl border border-border shadow-sm"><div className="text-sm text-text-muted">الطلبات</div><div className="text-xl font-bold font-en mt-1">142</div></div>
                      <div className="bg-white p-4 rounded-xl border border-border shadow-sm"><div className="text-sm text-text-muted">العملاء</div><div className="text-xl font-bold font-en mt-1">84</div></div>
                    </div>
                    <div className="flex-1 bg-white border border-border rounded-xl p-4 flex items-end gap-2">
                       {[30, 50, 40, 70, 60, 80, 50].map((h, i) => <div key={i} className="flex-1 bg-border rounded-t" style={{ height: `${h}%` }} />)}
                    </div>
                  </motion.div>
                )}

                {/* STEP 1: POS */}
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex gap-4">
                    {/* Products */}
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white border border-border rounded-xl p-3 flex flex-col justify-between relative cursor-pointer group hover:border-brand hover:shadow-md transition">
                          <div className="w-full h-20 bg-bg-surface rounded-lg mb-2 flex items-center justify-center text-3xl">☕</div>
                          <div className="font-bold">منتج {i}</div>
                          <div className="text-brand font-en font-bold">SAR 15.00</div>
                          
                          {/* Cursor selects product 2 */}
                          {i === 2 && (
                             <motion.div 
                               initial={{ x: -100, y: 150, opacity: 0 }}
                               animate={{ x: 20, y: 20, opacity: 1, scale: [1, 0.8, 1] }}
                               transition={{ delay: 0.5, duration: 1, times: [0, 0.8, 1] }}
                               className="absolute right-0 bottom-0 z-50 text-brand"
                             >
                               <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                             </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Cart */}
                    <motion.div layoutId="cart" className="w-64 bg-white border border-border rounded-xl shadow-sm flex flex-col">
                      <div className="p-3 border-b border-border font-bold">الطلب الحالي</div>
                      <div className="flex-1 p-3 flex flex-col gap-2">
                        {/* Selected product drops in */}
                        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.2 }} className="flex justify-between items-center text-sm bg-brand/10 p-2 rounded text-brand font-bold">
                          <span>1x منتج 2</span>
                          <span>SAR 15.00</span>
                        </motion.div>
                      </div>
                      <div className="p-3 border-t border-border">
                        <div className="flex justify-between font-bold text-lg mb-3"><span>الإجمالي</span><span>SAR 15.00</span></div>
                        
                        <button className="w-full bg-brand text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 relative">
                          <CreditCard size={18} /> دفع
                          {/* Cursor clicks Pay */}
                          <motion.div 
                               initial={{ x: -100, y: -50, opacity: 0 }}
                               animate={{ x: 0, y: 0, opacity: 1, scale: [1, 0.8, 1] }}
                               transition={{ delay: 1.8, duration: 0.8, times: [0, 0.8, 1] }}
                               className="absolute right-1/2 top-1 z-50 text-white"
                             >
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                             </motion.div>
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {/* STEP 2: ZATCA Compliance */}
                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex items-center justify-center">
                     <div className="bg-white border-2 border-success p-8 rounded-2xl shadow-[0_20px_50px_rgba(13,175,122,0.2)] text-center max-w-sm w-full flex flex-col items-center">
                       <motion.div 
                         initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                         className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mb-4"
                       >
                         <CheckCircle2 size={40} />
                       </motion.div>
                       <h3 className="text-2xl font-black text-text-primary mb-2">فاتورة معتمدة</h3>
                       <p className="text-text-muted mb-6">تم توقيع الفاتورة وإرسالها لهيئة الزكاة والضريبة والجمارك بنجاح.</p>
                       <div className="w-full bg-bg-surface p-3 rounded-lg border border-border flex justify-between items-center">
                         <span className="text-sm font-bold text-text-muted">ZATCA Status</span>
                         <span className="bg-success text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Shield size={12}/> Cleared</span>
                       </div>
                     </div>
                  </motion.div>
                )}

                {/* STEP 3: Sales History */}
                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border font-bold text-lg flex justify-between">
                      سجل المبيعات
                      <div className="bg-bg-surface px-3 py-1 rounded-full text-sm font-en">Oct 24, 2026</div>
                    </div>
                    <div className="flex-1 p-0">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-bg-surface text-text-muted">
                          <tr><th className="p-3">رقم الفاتورة</th><th className="p-3">الوقت</th><th className="p-3">الإجمالي</th><th className="p-3">ZATCA</th></tr>
                        </thead>
                        <tbody>
                          {/* New Invoice Row Slides In */}
                          <motion.tr initial={{ backgroundColor: '#eaf0fb', x: -50, opacity: 0 }} animate={{ backgroundColor: '#ffffff', x: 0, opacity: 1 }} transition={{ duration: 1 }} className="border-b border-border">
                            <td className="p-3 font-bold text-brand font-en">INV-1042</td>
                            <td className="p-3 text-text-muted font-en">14:32:00</td>
                            <td className="p-3 font-bold font-en">SAR 15.00</td>
                            <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded font-bold text-xs">معتمدة</span></td>
                          </motion.tr>
                          <tr className="border-b border-border">
                            <td className="p-3 font-bold font-en">INV-1041</td>
                            <td className="p-3 text-text-muted font-en">14:15:22</td>
                            <td className="p-3 font-bold font-en">SAR 85.00</td>
                            <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded font-bold text-xs">معتمدة</span></td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 font-bold font-en">INV-1040</td>
                            <td className="p-3 text-text-muted font-en">13:40:10</td>
                            <td className="p-3 font-bold font-en">SAR 120.50</td>
                            <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded font-bold text-xs">معتمدة</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: Analytics Graph */}
                {step === 4 && (
                  <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold">المبيعات الإجمالية</h3>
                      <div className="text-3xl font-black text-brand font-en">SAR 14,250</div>
                    </div>
                    
                    <div className="flex-1 bg-white border border-border rounded-xl p-6 flex items-end gap-4 relative overflow-hidden shadow-inner">
                      {/* Graph lines growing */}
                      {[20, 35, 25, 60, 45, 80, 100].map((h, i) => (
                        <div key={i} className="flex-1 group relative h-full flex items-end">
                          <motion.div 
                            initial={{ height: 0 }} 
                            animate={{ height: `${h}%` }} 
                            transition={{ duration: 1, delay: i * 0.1, type: "spring" }}
                            className={`w-full rounded-t-lg ${i === 6 ? 'bg-success shadow-[0_0_20px_rgba(13,175,122,0.5)]' : 'bg-brand opacity-80'}`} 
                          />
                          {i === 6 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -10 }} transition={{ delay: 1.5 }} className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-text-primary text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                              اليوم (نمو ممتاز!)
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
