const fs = require('fs');
const path = require('path');
const dir = 'C:/my-pos/v2/promo';

const write = (relPath, content) => {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
};

write('src/components/3d/GlassPanel.jsx', `
import React from 'react';
import { Html } from '@react-three/drei';

export function GlassPanel({ position = [0,0,0], rotation = [0,0,0], scale = 1, children }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <boxGeometry args={[4, 2.5, 0.1]} />
      <meshPhysicalMaterial 
        color="#111827"
        transmission={0.9}
        opacity={1}
        metalness={0}
        roughness={0.1}
        ior={1.5}
        thickness={0.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[4.1, 2.6, 0.05]} />
        <meshBasicMaterial color="#0EA5E9" transparent opacity={0.3} />
      </mesh>
      {children && (
        <Html transform position={[0, 0, 0.06]} scale={0.0028} distanceFactor={0}>
          <div className="w-[1400px] h-[875px] bg-[#0A0F1A] rounded-xl overflow-hidden pointer-events-none" style={{boxShadow: 'var(--glow-accent)'}}>
            <div className="w-full h-full scale-100 origin-top-left pointer-events-none">
              {children}
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}
`);

write('src/scenes/Scene3_HeroDevice.jsx', `
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GlassPanel } from '../components/3d/GlassPanel';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

// Dynamically load the dashboard for the 3D scene
import Dashboard from '../mockups/pages/Dashboard';

export function Scene3_HeroDevice() {
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
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={1} />
          <pointLight position={[10, 10, 10]} intensity={2} color="#0EA5E9" />
          <Suspense fallback={null}>
            <GlassPanel rotation={[0.2, -0.4, 0]} scale={1.2}>
              <Dashboard navigate={() => {}} />
            </GlassPanel>
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-12 md:p-24 pointer-events-none">
        <div className="callout-1 self-start bg-bg-surface/80 p-6 rounded-xl border border-white/10 backdrop-blur">
          <h3 className="text-accent font-bold text-xl mb-1">Offline-first</h3>
          <p className="text-text-muted">Never stop selling.</p>
        </div>
        <div className="callout-2 self-end bg-bg-surface/80 p-6 rounded-xl border border-white/10 backdrop-blur text-right">
          <h3 className="text-accent font-bold text-xl mb-1">Bilingual</h3>
          <p className="text-text-muted">AR/EN on the fly.</p>
        </div>
        <div className="callout-3 self-center text-center mt-auto">
          <div className="inline-block bg-success/20 text-success px-3 py-1 rounded-full text-sm font-bold mb-4">ZATCA Phase-2 Certified</div>
          <h2 className="text-3xl md:text-5xl font-bold">Every receipt, every sync, every riyal <br/> <span className="text-accent text-shadow-glow">— handled.</span></h2>
        </div>
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene4_Features.jsx', `
import React, { Suspense } from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

import POS from '../mockups/pages/POS';
import QuickInvoice from '../mockups/pages/QuickInvoice';
import Inventory from '../mockups/pages/Inventory';
import Financial from '../mockups/pages/Financial';
import CRM from '../mockups/pages/CRM';

export function Scene4_Features() {
  const containerRef = useScrollTimeline(() => {
    const sections = gsap.utils.toArray('.feature-card');
    gsap.to(sections, {
      xPercent: -100 * (sections.length - 1),
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 1,
      }
    });
  });

  const features = [
    { title: 'Point of Sale', subtitle: 'Built for the counter, not a spreadsheet.', kpi: 'SAR 142.50', comp: <POS navigate={()=>{}} /> },
    { title: 'ZATCA Compliance', subtitle: 'Every invoice signed, queued, and reported — zero manual work.', kpi: '100% Valid', comp: <QuickInvoice navigate={()=>{}} /> },
    { title: 'Inventory', subtitle: 'One shop or ten branches — always in sync.', kpi: '24 Items left', comp: <Inventory navigate={()=>{}} /> },
    { title: 'Finance Hub', subtitle: 'Know your numbers before your accountant does.', kpi: '+24% Revenue', comp: <Financial navigate={()=>{}} /> },
    { title: 'CRM & Loyalty', subtitle: 'Turn walk-ins into regulars.', kpi: '4,021 Members', comp: <CRM navigate={()=>{}} /> }
  ];

  return (
    <section ref={containerRef} className="relative w-full h-screen overflow-hidden flex bg-transparent">
      <div className="absolute top-12 left-12 z-20">
        <h2 className="text-3xl font-bold text-text-primary">Feature Walkthrough</h2>
      </div>
      <div className="flex w-[500vw] h-full items-center pl-[10vw]">
        {features.map((feat, i) => (
          <div key={i} className="feature-card w-[80vw] h-[60vh] flex-shrink-0 flex items-center p-12">
            <div className="w-1/2 pr-12">
              <h3 className="text-5xl font-bold mb-4">{feat.title}</h3>
              <p className="text-2xl text-text-muted mb-8">{feat.subtitle}</p>
              <div className="font-mono text-4xl text-accent shadow-accent glow p-4 border border-accent/30 rounded inline-block bg-accent/5">{feat.kpi}</div>
            </div>
            <div className="w-1/2 h-full bg-bg-surface rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden group shadow-[var(--glow-accent)]">
               <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-purple/10 opacity-50 transition-opacity z-10 pointer-events-none" />
               <div className="w-full h-full relative" style={{ zoom: 0.6 }}>
                 <Suspense fallback={<div className="p-8">Loading mockup...</div>}>
                   {feat.comp}
                 </Suspense>
               </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
`);
