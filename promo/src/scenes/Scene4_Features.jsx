import React, { Suspense } from 'react';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

import POS from '../mockups/pages/POS';
import QuickInvoice from '../mockups/pages/QuickInvoice';
import Inventory from '../mockups/pages/Inventory';
import Financial from '../mockups/pages/Financial';
import CRM from '../mockups/pages/CRM';

// A wrapper to "crop" into a specific part of a mockup component
function MockupCrop({ children, width = '800px', height = '600px', x = 0, y = 0, scale = 1 }) {
  return (
    <div className="relative overflow-hidden w-full h-full rounded-2xl" style={{ isolation: 'isolate', background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div 
        className="absolute origin-top-left"
        style={{
          width,
          height,
          transform: `scale(${scale}) translate(${x}px, ${y}px)`
        }}
      >
        {children}
      </div>
    </div>
  );
}

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

  // Different layouts and crops for each feature
  return (
    <section ref={containerRef} className="relative w-full h-screen overflow-hidden flex" style={{ background: 'var(--bg)' }}>
      <div className="absolute top-12 left-12 z-20">
        <h2 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Feature Walkthrough</h2>
      </div>
      <div className="flex w-[500vw] h-full items-center pl-[10vw]">
        
        {/* Card 1: POS - Left Text, Right Cropped Cart */}
        <div className="feature-card w-[80vw] h-[60vh] flex-shrink-0 flex items-center p-12">
          <div className="w-1/2 pr-12">
            <h3 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>Point of Sale</h3>
            <p className="text-2xl mb-8" style={{ color: 'var(--text-2)' }}>Built for the counter, not a spreadsheet.</p>
            <div className="text-4xl p-4 rounded inline-block" style={{ fontFamily: 'var(--font-en)', color: 'var(--brand)', background: 'var(--brand-bg)', border: '1px solid rgba(61,82,213,0.2)' }}>SAR 142.50</div>
          </div>
          <div className="w-1/2 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
             <Suspense fallback={<div className="p-8">Loading...</div>}>
               {/* Show the cart section on the left/right depending on layout */}
               <MockupCrop width="1200px" height="900px" x="-600" y="-100" scale={0.8}>
                 <POS navigate={()=>{}} />
               </MockupCrop>
             </Suspense>
          </div>
        </div>

        {/* Card 2: ZATCA - Right Text, Left Cropped QR/Invoice */}
        <div className="feature-card w-[80vw] h-[60vh] flex-shrink-0 flex items-center p-12">
          <div className="w-1/2 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
             <Suspense fallback={<div className="p-8">Loading...</div>}>
               <MockupCrop width="1000px" height="800px" x="-100" y="-100" scale={0.85}>
                 <QuickInvoice navigate={()=>{}} />
               </MockupCrop>
             </Suspense>
          </div>
          <div className="w-1/2 pl-12 text-right">
            <h3 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>ZATCA Compliance</h3>
            <p className="text-2xl mb-8" style={{ color: 'var(--text-2)' }}>Every invoice signed, queued, and reported.</p>
            <div className="text-4xl p-4 rounded inline-block" style={{ fontFamily: 'var(--font-en)', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid rgba(13,175,122,0.2)' }}>100% Valid</div>
          </div>
        </div>

        {/* Card 3: Inventory - Full Bleed with Text Overlay Scrim */}
        <div className="feature-card w-[80vw] h-[70vh] flex-shrink-0 relative rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
           <Suspense fallback={<div className="p-8">Loading...</div>}>
             <MockupCrop width="1400px" height="900px" x="-200" y="-50" scale={0.9}>
               <Inventory navigate={()=>{}} />
             </MockupCrop>
           </Suspense>
           <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent flex flex-col justify-end p-16">
             <h3 className="text-6xl font-bold mb-4 text-white">Inventory</h3>
             <p className="text-3xl text-white/80 mb-8 max-w-2xl">One shop or ten branches — always in sync.</p>
             <div>
              <div className="text-4xl p-4 rounded inline-block backdrop-blur-md" style={{ fontFamily: 'var(--font-en)', color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.3)' }}>24 Items left</div>
             </div>
           </div>
        </div>

        {/* Card 4: Finance - Left Text, Right Cropped Chart */}
        <div className="feature-card w-[80vw] h-[60vh] flex-shrink-0 flex items-center p-12">
          <div className="w-1/3 pr-12">
            <h3 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>Finance Hub</h3>
            <p className="text-2xl mb-8" style={{ color: 'var(--text-2)' }}>Know your numbers before your accountant does.</p>
            <div className="text-4xl p-4 rounded inline-block" style={{ fontFamily: 'var(--font-en)', color: 'var(--cyan)', background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)' }}>+24% Revenue</div>
          </div>
          <div className="w-2/3 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
             <Suspense fallback={<div className="p-8">Loading...</div>}>
               <MockupCrop width="1200px" height="800px" x="-200" y="-200" scale={0.9}>
                 <Financial navigate={()=>{}} />
               </MockupCrop>
             </Suspense>
          </div>
        </div>

        {/* Card 5: CRM - Right Text, Left List */}
        <div className="feature-card w-[80vw] h-[60vh] flex-shrink-0 flex items-center p-12">
          <div className="w-1/2 h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
             <Suspense fallback={<div className="p-8">Loading...</div>}>
               <MockupCrop width="1000px" height="800px" x="-50" y="-150" scale={0.8}>
                 <CRM navigate={()=>{}} />
               </MockupCrop>
             </Suspense>
          </div>
          <div className="w-1/2 pl-12">
            <h3 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>CRM &amp; Loyalty</h3>
            <p className="text-2xl mb-8" style={{ color: 'var(--text-2)' }}>Turn walk-ins into regulars.</p>
            <div className="text-4xl p-4 rounded inline-block" style={{ fontFamily: 'var(--font-en)', color: 'var(--text-1)', background: 'var(--brand-bg)', border: '1px solid var(--border)' }}>4,021 Members</div>
          </div>
        </div>

      </div>
    </section>
  );
}