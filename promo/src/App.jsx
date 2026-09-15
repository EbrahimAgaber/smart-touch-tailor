import React, { useEffect } from 'react';
import Lenis from 'lenis';

import { ProgressBar } from './components/ui/ProgressBar';
import { StickyCTA } from './components/ui/StickyCTA';

import { Scene1_ColdOpen } from './scenes/Scene1_ColdOpen';
import { MorphingStory } from './scenes/MorphingStory';

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    return () => lenis.destroy();
  }, []);

  return (
    <div className="w-full relative bg-bg-base text-text-primary overflow-hidden" dir="rtl">
      
      {/* 
        Subtle animated background gradient instead of WebGL 
      */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-br from-bg-surface via-bg-base to-brand-bg opacity-50" />

      <div className="relative z-10">
        <ProgressBar />
        <StickyCTA />
        
        <Scene1_ColdOpen />
        <MorphingStory />
      </div>
    </div>
  );
}
export default App;