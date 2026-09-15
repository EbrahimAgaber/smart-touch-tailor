import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { WidgetDashboard } from '../components/ui-widgets/WidgetDashboard';
import { WidgetPOS } from '../components/ui-widgets/WidgetPOS';
import { WidgetZATCA } from '../components/ui-widgets/WidgetZATCA';

gsap.registerPlugin(ScrollTrigger);

export function SceneFeatures() {
  const containerRef = useRef();
  const pinnedRef = useRef();

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Create a master timeline tied to the scroll of the 800vh container
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: pinnedRef.current,
        anticipatePin: 1,
      }
    });

    // 1. Initial State
    // All texts are hidden and positioned below.
    // All widgets are stacked in the center, pushed far back in Z space, rotated away.
    gsap.set('.cinematic-text', { opacity: 0, y: 50, scale: 0.9 });
    
    gsap.set('.widget-pos', { z: -3000, rotationX: 45, rotationY: -45, opacity: 0 });
    gsap.set('.widget-dashboard', { z: -3000, rotationX: -30, rotationY: 60, opacity: 0 });
    gsap.set('.widget-zatca', { z: -3000, rotationX: 20, rotationY: -20, opacity: 0 });

    // Scene 1: POS Flies In
    tl.to('.widget-pos', { z: 0, rotationX: 10, rotationY: -15, opacity: 1, duration: 2 }, 0)
      .to('.text-pos', { opacity: 1, y: 0, scale: 1, duration: 1 }, 1)
      
      // Scene 1 Exit / Scene 2 Enter (Dashboard)
      .to('.widget-pos', { z: 1500, rotationX: -10, rotationY: 30, opacity: 0, duration: 2 }, 3)
      .to('.text-pos', { opacity: 0, y: -50, scale: 1.1, duration: 1 }, 3)
      
      .to('.widget-dashboard', { z: 0, rotationX: 5, rotationY: 15, opacity: 1, duration: 2 }, 3.5)
      .to('.text-dashboard', { opacity: 1, y: 0, scale: 1, duration: 1 }, 4.5)

      // Scene 2 Exit / Scene 3 Enter (ZATCA)
      .to('.widget-dashboard', { z: 1500, rotationX: 20, rotationY: -30, opacity: 0, duration: 2 }, 6.5)
      .to('.text-dashboard', { opacity: 0, y: -50, scale: 1.1, duration: 1 }, 6.5)

      .to('.widget-zatca', { z: 0, rotationX: 15, rotationY: -10, opacity: 1, duration: 2 }, 7)
      .to('.text-zatca', { opacity: 1, y: 0, scale: 1, duration: 1 }, 8)

      // Final Hold
      .to('.widget-zatca', { rotationX: 5, rotationY: 0, z: 200, duration: 2 }, 10);

  }, []);

  return (
    <section ref={containerRef} className="relative w-full h-[600vh]">
      
      {/* Pinned Container */}
      <div ref={pinnedRef} className="w-full h-screen overflow-hidden relative flex items-center justify-center bg-black vibrant-mesh perspective-2000">
        
        {/* Dynamic Glowing Environment overlay to add contrast */}
        <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />

        {/* --- TEXT LAYERS (Absolute positioning) --- */}
        <div className="absolute inset-0 flex items-center justify-start p-12 md:p-24 z-20 pointer-events-none">
          <div className="cinematic-text text-pos max-w-lg">
             <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-brand/50 bg-black/50 text-white backdrop-blur-md">
              واجهة بيع متطورة
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 text-shadow-lg">
              أسرع نظام بيع، <br/>
              <span className="text-brand-light">صُمم لراحتك.</span>
            </h2>
            <p className="text-xl text-white/80">
              تفاعل حي مع واجهة مصممة خصيصاً لتسريع عمليات البيع وتطبيق الخصومات بلمسة واحدة.
            </p>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-end p-12 md:p-24 z-20 pointer-events-none">
          <div className="cinematic-text text-dashboard max-w-lg text-right">
             <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-cyan/50 bg-black/50 text-white backdrop-blur-md">
              تحليلات لحظية
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 text-shadow-lg">
              نبض عملك، <br/>
              <span className="text-cyan">أمام عينيك.</span>
            </h2>
            <p className="text-xl text-white/80">
              لوحة قيادة توفر رؤى ذكية وتتبع لحظي لمبيعاتك ومخزونك بكل فروعك.
            </p>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-start p-12 md:p-24 z-20 pointer-events-none">
          <div className="cinematic-text text-zatca max-w-lg">
             <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-success/50 bg-black/50 text-white backdrop-blur-md">
              هيئة الزكاة والضريبة
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 text-shadow-lg">
              تشفير، توقيع، <br/>
              <span className="text-success">مزامنة.</span>
            </h2>
            <p className="text-xl text-white/80">
              ارتاح تماماً، النظام متوافق بشكل أصلي مع متطلبات المرحلة الثانية للفوترة الإلكترونية.
            </p>
          </div>
        </div>

        {/* --- 3D WIDGET LAYERS (Absolute Center) --- */}
        <div className="absolute inset-0 flex items-center justify-center z-10 transform-style-3d pointer-events-none">
          
          <div className="widget-pos absolute transform-style-3d will-change-transform shadow-[0_0_100px_rgba(61,82,213,0.3)] rounded-2xl pointer-events-auto">
            <WidgetPOS />
          </div>

          <div className="widget-dashboard absolute transform-style-3d will-change-transform shadow-[0_0_100px_rgba(8,145,178,0.3)] rounded-2xl pointer-events-auto">
            <WidgetDashboard />
          </div>

          <div className="widget-zatca absolute transform-style-3d will-change-transform shadow-[0_0_100px_rgba(13,175,122,0.3)] rounded-2xl pointer-events-auto">
            <WidgetZATCA />
          </div>

        </div>

      </div>
    </section>
  );
}
