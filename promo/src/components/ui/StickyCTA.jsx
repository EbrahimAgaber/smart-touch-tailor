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
    <div className={`fixed bottom-8 right-8 z-50 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
      <button id="sticky-cta-btn" className="px-6 py-3 text-white rounded-full font-bold transition-all hover:scale-105" style={{ background: 'var(--brand)', boxShadow: 'var(--sh-brand)' }}>
        Request a Demo
      </button>
    </div>
  );
}