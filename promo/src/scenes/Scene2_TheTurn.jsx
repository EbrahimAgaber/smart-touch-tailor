import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ParticleField } from '../components/3d/ParticleField';
import { useScrollTimeline } from '../hooks/useScrollTimeline';
import gsap from 'gsap';

export function Scene2_TheTurn() {
  const [progress, setProgress] = useState(0);

  const containerRef = useScrollTimeline(() => {
    // Pin this scene and scrub the animation
    gsap.to(containerRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=150%',
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          setProgress(self.progress);
        },
      },
    });
    
    // Headline animation
    gsap.fromTo('.scene2-headline', 
      { opacity: 0, y: 50 },
      { 
        opacity: 1, 
        y: 0, 
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=50%',
          scrub: true,
        }
      }
    );
  });

  return (
    <section 
      ref={containerRef} 
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <ParticleField progress={progress} />
        </Canvas>
      </div>
      
      <div className="relative z-10 text-center pointer-events-none">
        <h2 className="scene2-headline text-5xl md:text-7xl font-bold text-text-primary text-gradient-brand">
          Meet Smart Touch POS.
        </h2>
      </div>
    </section>
  );
}
