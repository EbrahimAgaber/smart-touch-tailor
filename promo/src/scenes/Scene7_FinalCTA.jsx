import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';
import { GlassPanel } from '../components/3d/GlassPanel';
import { FallbackGlassPanel } from '../components/ui/FallbackGlassPanel';
import { useIsMobile } from '../hooks/useIsMobile';

const POS = React.lazy(() => import('../mockups/pages/POS'));

export function Scene7_FinalCTA() {
  const isMobile = useIsMobile();
  const containerRef = useScrollTimeline(() => {
    gsap.fromTo('.cta-content', 
      { opacity: 0, y: 100 },
      { 
        opacity: 1, 
        y: 0, 
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          end: 'center center',
          scrub: true
        }
      }
    );
  });

  return (
    <section ref={containerRef} className="relative w-full min-h-[120vh] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #2B3DAE 0%, #1D2F90 50%, #0E1F72 100%)' }}>
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {!isMobile ? (
          <Canvas camera={{ position: [0, 0, 8] }}>
            <ambientLight intensity={1} />
            <pointLight position={[0, 0, 0]} intensity={3} color="#3D52D5" />
            <Suspense fallback={null}>
               <GlassPanel rotation={[0.5, 0.5, 0]} scale={1.5}>
                 <POS navigate={()=>{}} />
               </GlassPanel>
            </Suspense>
          </Canvas>
        ) : (
          <div className="opacity-30">
            <Suspense fallback={null}>
              <FallbackGlassPanel>
                <POS navigate={()=>{}} />
              </FallbackGlassPanel>
            </Suspense>
          </div>
        )}
      </div>
      <div className="cta-content relative z-10 text-center flex flex-col items-center p-4">
        <h2 className="text-4xl md:text-7xl font-bold mb-8" style={{ background: 'linear-gradient(135deg, #93C5FD, #67E8F9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Ready to upgrade your counter?</h2>
        <p className="text-lg md:text-xl text-text-muted mb-12 max-w-2xl">
          Join thousands of retailers across Saudi Arabia running their business on the most advanced POS system available.
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <button id="cta-demo-btn" className="px-10 py-5 text-white rounded-full font-bold text-xl transition-all transform hover:scale-105" style={{ background: 'var(--brand)', boxShadow: 'var(--sh-brand)' }}>
            Request a Demo
          </button>
          <button id="cta-pricing-btn" className="px-10 py-5 bg-transparent border border-white/30 hover:border-white/60 text-white rounded-full font-bold text-xl transition-all">
            Ask About Pricing
          </button>
        </div>
      </div>
    </section>
  );
}