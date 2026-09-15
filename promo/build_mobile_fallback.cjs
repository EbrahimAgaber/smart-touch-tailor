const fs = require('fs');
const path = require('path');
const dir = 'C:/my-pos/v2/promo';

const write = (relPath, content) => {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
};

write('src/components/ui/FallbackGlassPanel.jsx', `
import React from 'react';

export function FallbackGlassPanel({ children }) {
  return (
    <div className="w-[90vw] max-w-lg aspect-video rounded-xl border border-white/20 bg-bg-surface/50 backdrop-blur-md shadow-[0_0_30px_rgba(14,165,233,0.3)] flex items-center justify-center overflow-hidden p-2 transform rotate-2">
      <div className="w-full h-full relative" style={{ zoom: 0.4 }}>
        {children}
      </div>
    </div>
  );
}
`);

write('src/scenes/Scene3_HeroDevice.jsx', `
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
    <section ref={containerRef} className="relative w-full h-screen flex items-center justify-center">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {!isMobile ? (
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={1} />
            <pointLight position={[10, 10, 10]} intensity={2} color="#0EA5E9" />
            <Suspense fallback={null}>
              <GlassPanel rotation={[0.2, -0.4, 0]} scale={1.2}>
                <Dashboard navigate={() => {}} />
              </GlassPanel>
            </Suspense>
          </Canvas>
        ) : (
          <Suspense fallback={<div>Loading...</div>}>
            <FallbackGlassPanel>
              <Dashboard navigate={() => {}} />
            </FallbackGlassPanel>
          </Suspense>
        )}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-12 md:p-24 pointer-events-none">
        <div className="callout-1 self-start bg-bg-surface/80 p-6 rounded-xl border border-white/10 backdrop-blur mt-20 md:mt-0">
          <h3 className="text-accent font-bold text-xl mb-1">Offline-first</h3>
          <p className="text-text-muted">Never stop selling.</p>
        </div>
        <div className="callout-2 self-end bg-bg-surface/80 p-6 rounded-xl border border-white/10 backdrop-blur text-right">
          <h3 className="text-accent font-bold text-xl mb-1">Bilingual</h3>
          <p className="text-text-muted">AR/EN on the fly.</p>
        </div>
        <div className="callout-3 self-center text-center mt-auto mb-10">
          <div className="inline-block bg-success/20 text-success px-3 py-1 rounded-full text-sm font-bold mb-4">ZATCA Phase-2 Certified</div>
          <h2 className="text-2xl md:text-5xl font-bold">Every receipt, every sync, every riyal <br/> <span className="text-accent text-shadow-glow">— handled.</span></h2>
        </div>
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene7_FinalCTA.jsx', `
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
    <section ref={containerRef} className="relative w-full min-h-[120vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {!isMobile ? (
          <Canvas camera={{ position: [0, 0, 8] }}>
            <ambientLight intensity={1} />
            <pointLight position={[0, 0, 0]} intensity={3} color="#0EA5E9" />
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
        <h2 className="text-4xl md:text-7xl font-bold mb-8 text-shadow-glow">Ready to upgrade your counter?</h2>
        <p className="text-lg md:text-xl text-text-muted mb-12 max-w-2xl">
          Join thousands of retailers across Saudi Arabia running their business on the most advanced POS system available.
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <button className="px-10 py-5 bg-accent hover:bg-accent-hover text-white rounded-full font-bold text-xl shadow-[var(--glow-accent)] transition-all transform hover:scale-105">
            Request a Demo
          </button>
          <button className="px-10 py-5 bg-transparent border-2 border-white/20 hover:border-white/50 text-white rounded-full font-bold text-xl transition-all">
            Ask About Pricing
          </button>
        </div>
      </div>
    </section>
  );
}
`);
