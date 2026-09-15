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
  return <div id="scroll-progress-bar" className="fixed top-0 left-0 h-1 z-50 transition-all duration-75" style={{width: `${scroll}%`, background: 'var(--brand)', boxShadow: 'var(--sh-brand)'}} />;
}