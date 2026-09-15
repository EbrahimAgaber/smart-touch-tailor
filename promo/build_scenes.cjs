const fs = require('fs');
const path = require('path');
const dir = 'C:/my-pos/v2/promo';

const write = (relPath, content) => {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
};

write('src/styles/globals.css', `
@import './tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .text-shadow-glow {
    text-shadow: 0 0 20px rgba(14, 165, 233, 0.6);
  }
  .bg-noise {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 50;
    opacity: 0.03;
    background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
  }
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-base);
  color: var(--text-primary);
  background-image: radial-gradient(circle at 50% 0%, var(--bg-raised) 0%, var(--bg-base) 100%);
  background-attachment: fixed;
}
`);

write('src/components/ui/ProgressBar.jsx', `
import React, { useEffect, useState } from 'react';
export function ProgressBar() {
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScroll((window.scrollY / total) * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return <div className="fixed top-0 left-0 h-1 bg-accent z-50 transition-all duration-75" style={{width: \`\${scroll}%\`, boxShadow: 'var(--glow-accent)'}} />;
}
`);

write('src/components/ui/StickyCTA.jsx', `
import React, { useEffect, useState } from 'react';
export function StickyCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 1.5);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return (
    <div className={\`fixed bottom-8 right-8 z-50 transition-all duration-500 \${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}\`}>
      <button className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-full font-bold shadow-[var(--glow-accent)] transition-all">
        Request a Demo
      </button>
    </div>
  );
}
`);

write('src/components/3d/GlassPanel.jsx', `
import React from 'react';
export function GlassPanel({ position = [0,0,0], rotation = [0,0,0], scale = 1 }) {
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
    </mesh>
  );
}
`);

write('src/scenes/Scene1_ColdOpen.jsx', `
import React from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

export function Scene1_ColdOpen() {
  const containerRef = useScrollTimeline(() => {
    gsap.to('.receipt', {
      y: (i) => -200 - (Math.random() * 200),
      rotation: (i) => (Math.random() - 0.5) * 180,
      opacity: 0,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  });

  return (
    <section ref={containerRef} className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden border-b border-danger/20">
      <div className="absolute inset-0 bg-danger/5 pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="receipt absolute bg-white/10 w-16 h-24 rounded border border-white/20" 
               style={{ left: \`\${20 + Math.random() * 60}%\`, top: \`\${20 + Math.random() * 60}%\`, transform: \`rotate(\${Math.random() * 45}deg)\` }} 
          />
        ))}
      </div>
      <div className="z-10 text-center max-w-3xl px-4">
        <div className="inline-block border-2 border-danger text-danger px-4 py-1 text-xl font-bold uppercase tracking-widest mb-8 rotate-[-5deg] opacity-80">
          Zatca Rejected ⚠
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-text-primary leading-tight">
          Running a shop in Saudi <br/> shouldn't feel like <span className="text-danger opacity-80">this.</span>
        </h1>
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene3_HeroDevice.jsx', `
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { GlassPanel } from '../components/3d/GlassPanel';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

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
          <GlassPanel rotation={[0.2, -0.4, 0]} scale={1.2} />
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
import React from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

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
    { title: 'Point of Sale', subtitle: 'Built for the counter, not a spreadsheet.', kpi: 'SAR 142.50' },
    { title: 'ZATCA Compliance', subtitle: 'Every invoice signed, queued, and reported — zero manual work.', kpi: '100% Valid' },
    { title: 'Inventory', subtitle: 'One shop or ten branches — always in sync.', kpi: '24 Items left' },
    { title: 'Finance Hub', subtitle: 'Know your numbers before your accountant does.', kpi: '+24% Revenue' },
    { title: 'CRM & Loyalty', subtitle: 'Turn walk-ins into regulars.', kpi: '4,021 Members' }
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
            <div className="w-1/2 h-full bg-bg-surface rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-purple/10 opacity-50 group-hover:opacity-100 transition-opacity" />
               <p className="text-text-muted font-mono">[ Mockup Component: {feat.title} ]</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene5_Trust.jsx', `
import React, { useState } from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

export function Scene5_Trust() {
  const [invoices, setInvoices] = useState(0);
  const containerRef = useScrollTimeline(() => {
    const obj = { val: 0 };
    gsap.to(obj, {
      val: 845920,
      duration: 2,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top center',
        toggleActions: 'play none none reverse',
      },
      onUpdate: () => setInvoices(Math.floor(obj.val))
    });
  });

  return (
    <section ref={containerRef} className="w-full py-32 flex flex-col items-center justify-center text-center">
      <h2 className="text-3xl md:text-5xl font-bold mb-16">Trusted across the Kingdom</h2>
      <div className="flex flex-wrap justify-center gap-12 mb-24">
        <div className="w-40 h-40 rounded-full border border-success/30 flex items-center justify-center bg-success/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
           <span className="text-success font-bold text-xl text-center">ZATCA<br/>Certified</span>
        </div>
        <div className="w-40 h-40 rounded-full border border-accent/30 flex items-center justify-center bg-accent/5 shadow-[0_0_30px_rgba(14,165,233,0.1)]">
           <span className="text-accent font-bold text-xl">VAT Ready</span>
        </div>
      </div>
      <div className="mb-12">
        <div className="font-mono text-7xl md:text-9xl text-text-primary font-bold tracking-tighter">{invoices.toLocaleString()}</div>
        <p className="text-2xl text-accent mt-4 font-bold tracking-widest uppercase">Invoices Processed</p>
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene6_Bilingual.jsx', `
import React, { useState } from 'react';
export function Scene6_Bilingual() {
  const [isRTL, setIsRTL] = useState(false);
  return (
    <section className="w-full min-h-screen flex items-center justify-center overflow-hidden py-32">
      <div className="max-w-6xl w-full flex flex-col items-center p-8">
        <div className="mb-12 text-center">
          <h2 dir="rtl" className="text-4xl md:text-6xl font-bold font-ui text-text-primary mb-4">صُمم للسعودية. مبني بلا حدود.</h2>
          <h2 className="text-2xl md:text-4xl font-bold text-text-muted">Made for Saudi. Built without limits.</h2>
        </div>
        <div className="relative w-full max-w-4xl h-[400px] bg-bg-surface border border-white/10 rounded-2xl shadow-2xl p-8 flex flex-col transition-all duration-700 ease-in-out" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
            <h3 className="text-2xl font-bold">{isRTL ? 'نقطة البيع الذكية' : 'Smart Touch POS'}</h3>
            <button onClick={() => setIsRTL(!isRTL)} className="px-4 py-2 bg-accent/20 text-accent rounded hover:bg-accent/40 transition-colors">
              {isRTL ? 'Switch to English' : 'التبديل للعربية'}
            </button>
          </div>
          <div className="flex gap-8 h-full">
            <div className="w-2/3 bg-bg-base rounded-xl p-4 border border-white/5">
              <div className="h-8 w-1/3 bg-white/5 rounded mb-4"></div>
              <div className="h-4 w-full bg-white/5 rounded mb-2"></div>
              <div className="h-4 w-2/3 bg-white/5 rounded"></div>
            </div>
            <div className="w-1/3 bg-bg-base rounded-xl p-4 border border-white/5 flex flex-col justify-end">
              <div className="flex justify-between font-mono text-xl mb-4 text-accent">
                <span>{isRTL ? 'الإجمالي' : 'Total'}</span>
                <span>SAR 420.00</span>
              </div>
              <button className="w-full py-4 bg-success text-white rounded font-bold text-xl">{isRTL ? 'دفع' : 'Pay'}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

write('src/scenes/Scene7_FinalCTA.jsx', `
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';
import { GlassPanel } from '../components/3d/GlassPanel';

export function Scene7_FinalCTA() {
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
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8] }}>
          <ambientLight intensity={1} />
          <pointLight position={[0, 0, 0]} intensity={3} color="#0EA5E9" />
          <GlassPanel rotation={[0.5, 0.5, 0]} scale={1.5} />
        </Canvas>
      </div>
      <div className="cta-content relative z-10 text-center flex flex-col items-center">
        <h2 className="text-5xl md:text-7xl font-bold mb-8 text-shadow-glow">Ready to upgrade your counter?</h2>
        <p className="text-xl text-text-muted mb-12 max-w-2xl">
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

write('src/App.jsx', `
import React, { useEffect } from 'react';
import Lenis from 'lenis';

import { ProgressBar } from './components/ui/ProgressBar';
import { StickyCTA } from './components/ui/StickyCTA';

import { Scene1_ColdOpen } from './scenes/Scene1_ColdOpen';
import { Scene2_TheTurn } from './scenes/Scene2_TheTurn';
import { Scene3_HeroDevice } from './scenes/Scene3_HeroDevice';
import { Scene4_Features } from './scenes/Scene4_Features';
import { Scene5_Trust } from './scenes/Scene5_Trust';
import { Scene6_Bilingual } from './scenes/Scene6_Bilingual';
import { Scene7_FinalCTA } from './scenes/Scene7_FinalCTA';

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    return () => lenis.destroy();
  }, []);

  return (
    <div className="w-full relative">
      <div className="bg-noise" />
      <ProgressBar />
      <StickyCTA />
      
      <Scene1_ColdOpen />
      <Scene2_TheTurn />
      <Scene3_HeroDevice />
      <Scene4_Features />
      <Scene5_Trust />
      <Scene6_Bilingual />
      <Scene7_FinalCTA />
    </div>
  );
}
export default App;
`);
