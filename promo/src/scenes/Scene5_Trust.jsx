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
        <div className="w-40 h-40 rounded-full flex items-center justify-center" style={{ background: 'var(--green-bg)', border: '1px solid rgba(13,175,122,0.2)', boxShadow: '0 0 30px rgba(13,175,122,0.12)' }}>
           <span className="font-bold text-xl text-center" style={{ color: 'var(--green)' }}>ZATCA<br/>Certified</span>
        </div>
        <div className="w-40 h-40 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-bg)', border: '1px solid rgba(61,82,213,0.2)', boxShadow: '0 0 30px var(--brand-glow)' }}>
           <span className="font-bold text-xl" style={{ color: 'var(--brand)' }}>VAT Ready</span>
        </div>
      </div>
      <div className="mb-12">
        <div className="font-mono text-7xl md:text-9xl text-text-primary font-bold tracking-tighter">{invoices.toLocaleString()}</div>
        <p className="text-2xl mt-4 font-bold tracking-widest uppercase" style={{ color: 'var(--brand)' }}>Invoices Processed</p>
      </div>
    </section>
  );
}