import React from 'react';

export function FallbackGlassPanel({ children }) {
  return (
    <div className="w-[90vw] max-w-lg aspect-video rounded-xl flex items-center justify-center overflow-hidden p-2 transform rotate-2" style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', boxShadow: '0 0 30px var(--brand-glow)' }}>
      <div className="w-full h-full relative" style={{ zoom: 0.4 }}>
        {children}
      </div>
    </div>
  );
}