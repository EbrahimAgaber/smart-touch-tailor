import React, { useLayoutEffect } from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

export function Scene1_ColdOpen() {
  const containerRef = useScrollTimeline(() => {
    gsap.to('.hero-text', {
      y: -100,
      opacity: 0,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  });

  useLayoutEffect(() => {
    // Initial entrance animation
    gsap.fromTo('.hero-text > *', 
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
    );
  }, []);

  return (
    <section ref={containerRef} className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden pt-32 pb-24">
      
      <div className="z-10 text-center max-w-4xl px-4 flex flex-col items-center hero-text">
        <div className="inline-flex items-center gap-2 border border-brand/20 bg-white text-brand px-5 py-2 rounded-full text-sm font-bold tracking-widest mb-10 shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>نظام البيع الأسرع في المملكة</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-text-primary leading-[1.2]">
          من الفاتورة إلى التقرير<br/>
          <span className="text-gradient">في أقل من ثانية</span>
        </h1>
        
        <p className="mt-8 text-xl text-text-muted max-w-2xl mx-auto font-en">
          Smart Touch POS — The most advanced point of sale system in Saudi Arabia.
        </p>

        <div className="mt-12 flex gap-4 justify-center">
          <button className="bg-brand text-white px-8 py-3 rounded-xl font-bold shadow-brand hover:bg-brand-dark transition-colors">
            ابدأ تجربتك المجانية
          </button>
        </div>

        {/* Hero Image */}
        <div className="mt-20 w-full max-w-5xl relative">
          <div className="absolute inset-0 bg-brand blur-3xl opacity-20 transform translate-y-10 scale-95 rounded-full" />
          <img 
            src="/assets/promo_hero_3d_1785537735295.jpg" 
            alt="Smart Touch POS Hero" 
            className="relative w-full rounded-2xl shadow-lg border border-border"
          />
        </div>
      </div>
      
    </section>
  );
}