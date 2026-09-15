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