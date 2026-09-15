import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GlassPanel } from '../components/3d/GlassPanel';
import { FallbackGlassPanel } from '../components/ui/FallbackGlassPanel';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import { useIsMobile } from '../hooks/useIsMobile';
import gsap from 'gsap';

// Dynamically load the dashboard for the 3D scene
const Dashboard = React.lazy(() => import('../mockups/pages/Dashboard'));

export function Scene3_HeroDevice() {
  const isMobile = useIsMobile();
  const containerRef = useScrollTimeline(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: 1
      }
    });
    tl.fromTo('.callout-1', { opacity: 0, x: -50 }, { opacity: 1, x: 0 })
      .fromTo('.callout-2', { opacity: 0, x: 50 }, { opacity: 1, x: 0 })
      .fromTo('.callout-3', { opacity: 0, y: 50 }, { opacity: 1, y: 0 });
  });

  return (
    <section ref={containerRef} className="relative w-full h-screen flex items-center justify-center bg-transparent">
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        {!isMobile ? (
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }} className="pointer-events-auto">
            <ambientLight intensity={1.2} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#3D52D5" />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#0DAF7A" />
            <Suspense fallback={null}>
              <GlassPanel rotation={[0.2, -0.4, 0]} scale={1.2}>
                <Dashboard navigate={() => {}} />
              </GlassPanel>
            </Suspense>
          </Canvas>
        ) : (
          <Suspense fallback={<div className="text-brand font-bold animate-pulse">جاري التحميل...</div>}>
            <FallbackGlassPanel>
              <Dashboard navigate={() => {}} />
            </FallbackGlassPanel>
          </Suspense>
        )}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-12 md:p-24 pointer-events-none">
        <div className="callout-1 self-start p-6 rounded-2xl mt-20 md:mt-0 glass-panel max-w-sm shadow-md">
          <h3 className="font-bold text-xl mb-2 text-brand">يعمل بدون إنترنت</h3>
          <p className="text-text-muted text-sm">استمر في البيع وإصدار الفواتير حتى في حالة انقطاع الاتصال.</p>
        </div>
        <div className="callout-2 self-end p-6 rounded-2xl text-right glass-panel max-w-sm mt-12 shadow-md">
          <h3 className="font-bold text-xl mb-2 text-success">نظام ثنائي اللغة</h3>
          <p className="text-text-muted text-sm">تبديل فوري بين العربية والإنجليزية لجميع الشاشات بضغطة زر.</p>
        </div>
        <div className="callout-3 self-center text-center mt-auto mb-10">
          <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-success/30 bg-success/10 text-success">
            متوافق مع ZATCA المرحلة الثانية
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-text-primary leading-tight">
            كل فاتورة، كل مزامنة، كل ريال <br/> 
            <span className="text-gradient">محسوب بدقة تامة.</span>
          </h2>
        </div>
      </div>
    </section>
  );
}