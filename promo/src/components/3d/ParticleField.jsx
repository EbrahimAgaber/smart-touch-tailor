import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

function getLogoPoints(count) {
  const canvas = document.createElement('canvas');
  canvas.width = 250;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  
  // Draw the logo text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 45px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SMART', 125, 30);
  ctx.fillText('TOUCH', 125, 75);
  
  const imageData = ctx.getImageData(0, 0, 250, 100).data;
  const points = [];
  
  for (let i = 0; i < count; i++) {
    let found = false;
    let attempts = 0;
    while (!found && attempts < 100) {
      const x = Math.floor(Math.random() * 250);
      const y = Math.floor(Math.random() * 100);
      const alpha = imageData[(y * 250 + x) * 4 + 3];
      if (alpha > 128) {
        // Map to 3D space: X from -5 to 5, Y from 2 to -2
        const px = (x / 250) * 10 - 5;
        const py = -(y / 100) * 4 + 2;
        const pz = (Math.random() - 0.5) * 0.4; // Small z jitter for volume
        points.push([px, py, pz]);
        found = true;
      }
      attempts++;
    }
    // Fallback if we couldn't find a pixel (rare)
    if (!found) points.push([(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 0.4]);
  }
  return points;
}

export function ParticleField({ progress }) {
  const meshRef = useRef();
  
  // Create 1500 particles for better resolution
  const count = 1500;
  
  const [positions, targetPositions, colors] = useMemo(() => {
    const p = new Float32Array(count * 3);
    const tp = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    
    // Brand palette: royal blue → brand light → cyan
    const colorBrandBlue  = new THREE.Color('#3D52D5');
    const colorBrandLight = new THREE.Color('#6478E8');
    const colorCyan       = new THREE.Color('#0891B2');
    
    const logoPoints = getLogoPoints(count);
    
    for (let i = 0; i < count; i++) {
      // Start in a chaotic spread (Scene 1 pain)
      p[i * 3] = (Math.random() - 0.5) * 20;
      p[i * 3 + 1] = (Math.random() - 0.5) * 20;
      p[i * 3 + 2] = (Math.random() - 0.5) * 20;
      
      // Target: form the logo
      tp[i * 3] = logoPoints[i][0];
      tp[i * 3 + 1] = logoPoints[i][1];
      tp[i * 3 + 2] = logoPoints[i][2];
      
      // Interpolate across brand palette for variety
      const mixRatio = Math.random();
      let col;
      if (mixRatio < 0.5) {
        // brand blue → brand light
        col = colorBrandBlue.clone().lerp(colorBrandLight, mixRatio * 2);
      } else {
        // brand light → cyan
        col = colorBrandLight.clone().lerp(colorCyan, (mixRatio - 0.5) * 2);
      }
      c[i * 3]     = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    return [p, tp, c];
  }, [count]);
  
  const currentPositions = useRef(new Float32Array(positions));
  
  useFrame(() => {
    if (!meshRef.current) return;
    
    const geom = meshRef.current.geometry;
    const posAttribute = geom.attributes.position;
    
    // Smoothly interpolate between chaos and order based on scroll progress
    for (let i = 0; i < count * 3; i++) {
      // Add some noise when not fully reformed
      const noise = progress < 1 ? (Math.random() - 0.5) * 0.1 * (1 - progress) : 0;
      currentPositions.current[i] = THREE.MathUtils.lerp(
        positions[i], 
        targetPositions[i], 
        progress
      ) + noise;
      posAttribute.array[i] = currentPositions.current[i];
    }
    
    posAttribute.needsUpdate = true;
    
    // Subtle rotation instead of full 360 spin
    meshRef.current.rotation.y = progress * (Math.PI / 8); // ~22.5 degrees max
    meshRef.current.rotation.x = progress * (Math.PI / 16); // slight tilt

  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors={true}
        transparent={true}
        opacity={0.5}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
