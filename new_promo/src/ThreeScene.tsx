import React, { Suspense, useRef } from "react";
import { useCurrentFrame, interpolate, staticFile } from "remotion";
import { GlassUI } from "./models/GlassUI";
import { UIEcosystemField } from "./components/UIEcosystemField";
import { LightingAndEnvironment } from "./components/LightingAndEnvironment";
import { Sparkles, Float } from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// Easing helper for butter-smooth exponential / cubic transitions
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

export const ThreeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { camera } = useThree();

  // Act timeline frame boundaries
  const act1End = 150;   // 0:05 Hook zoom out
  const act2End = 300;   // 0:10 Reveal sweep
  const beat1End = 440;  // 0:14.6 POS cashier
  const beat2End = 580;  // 0:19.3 Inventory
  const act3End = 720;   // 0:24.0 ZATCA & Analytics
  // Act 4: 720 - 900 (0:30 CTA)

  const focusDistRef = useRef(0.04);

  // ── Continuous Motion Camera Controller ──
  useFrame(() => {
    // Continuous dynamic drift math - ensures velocity NEVER hits absolute zero
    const continuousX = Math.sin(frame * 0.008) * 0.6 + Math.cos(frame * 0.004) * 0.3;
    const continuousY = Math.cos(frame * 0.009) * 0.4 + Math.sin(frame * 0.005) * 0.2;

    let targetX = 0;
    let targetY = 0;
    let targetZ = 12;
    let lookX = 0;
    let lookY = 0;

    if (frame < act1End) {
      // Act 1: Macro Close-up -> Rapid Exponential Pull Out
      const progress = easeOutExpo(frame / act1End);
      targetX = interpolate(progress, [0, 1], [-2.0, 0]) + continuousX;
      targetY = interpolate(progress, [0, 1], [1.5, 0]) + continuousY;
      targetZ = interpolate(progress, [0, 1], [4.5, 15]);
      lookX = interpolate(progress, [0, 1], [-1.0, 0]);
      lookY = interpolate(progress, [0, 1], [0.8, 0]);
      focusDistRef.current = interpolate(progress, [0, 1], [0.1, 0.035]);
    } else if (frame >= act1End && frame < act2End) {
      // Act 2: Cinematic Arc Sweep to Hero Focus
      const p = (frame - act1End) / (act2End - act1End);
      const progress = easeInOutCubic(p);
      const angle = interpolate(progress, [0, 1], [-Math.PI / 5, 0]);
      const radius = interpolate(progress, [0, 1], [16, 11]);
      
      targetX = Math.sin(angle) * radius + continuousX;
      targetY = interpolate(progress, [0, 1], [3, 0]) + continuousY;
      targetZ = Math.cos(angle) * radius;
      lookX = continuousX * 0.15;
      focusDistRef.current = 0.045;
    } else if (frame >= act2End && frame < act3End) {
      // Act 3: Dynamic Feature Cuts & Smooth Camera Movements
      if (frame < beat1End) {
        // Beat 3.1: Cashier POS
        const p = easeInOutCubic((frame - act2End) / (beat1End - act2End));
        targetX = interpolate(p, [0, 1], [0, -1.8]) + continuousX;
        targetY = interpolate(p, [0, 1], [0, 0.4]) + continuousY;
        targetZ = interpolate(p, [0, 1], [11, 9.8]);
      } else if (frame < beat2End) {
        // Beat 3.2: Inventory
        const p = easeInOutCubic((frame - beat1End) / (beat2End - beat1End));
        targetX = interpolate(p, [0, 1], [-1.8, 1.8]) + continuousX;
        targetY = interpolate(p, [0, 1], [0.4, -0.3]) + continuousY;
        targetZ = interpolate(p, [0, 1], [9.8, 9.5]);
      } else {
        // Beat 3.3: ZATCA & Analytics
        const p = easeInOutCubic((frame - beat2End) / (act3End - beat2End));
        targetX = interpolate(p, [0, 1], [1.8, 0]) + continuousX;
        targetY = interpolate(p, [0, 1], [-0.3, 0.8]) + continuousY;
        targetZ = interpolate(p, [0, 1], [9.5, 10.2]);
      }
      focusDistRef.current = 0.048;
    } else {
      // Act 4: Majestic Pull Back to Grand Ecosystem CTA
      const p = easeOutExpo(Math.min(1, (frame - act3End) / (900 - act3End)));
      targetX = continuousX * 1.2;
      targetY = interpolate(p, [0, 1], [0.8, 1.5]) + continuousY;
      targetZ = interpolate(p, [0, 1], [10.2, 21.0]);
      lookX = 0;
      lookY = 0.5;
      focusDistRef.current = interpolate(p, [0, 1], [0.048, 0.025]);
    }

    camera.position.set(targetX, targetY, targetZ);
    camera.lookAt(lookX, lookY, 0);
  });

  // Dynamic Texture Switching for Hero Card
  let heroTexture = staticFile("assets/1.png");
  if (frame < act1End) {
    heroTexture = staticFile("assets/12.png");
  } else if (frame >= act1End && frame < act2End) {
    heroTexture = staticFile("assets/1.png");
  } else if (frame >= act2End && frame < beat1End) {
    heroTexture = staticFile("assets/2.png");
  } else if (frame >= beat1End && frame < beat2End) {
    heroTexture = staticFile("assets/5.png");
  } else if (frame >= beat2End && frame < act3End) {
    heroTexture = staticFile("assets/10.png");
  } else {
    heroTexture = staticFile("assets/1.png");
  }

  return (
    <Suspense fallback={null}>
      {/* Pristine Light Studio Background */}
      <color attach="background" args={["#F4F6FB"]} />

      {/* Lighting Rig */}
      <LightingAndEnvironment />

      {/* Post Processing for Glass Depth & Sharpness */}
      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={1.1} 
          luminanceSmoothing={0.85} 
          intensity={0.4} 
        />
        <DepthOfField 
          focusDistance={focusDistRef.current} 
          focalLength={0.08} 
          bokehScale={6} 
        />
        <ChromaticAberration 
          blendFunction={BlendFunction.NORMAL} 
          offset={new THREE.Vector2(0.0006, 0.0006)} 
        />
      </EffectComposer>

      {/* Background Parallax Field of Floating Glass Cards */}
      <UIEcosystemField />

      {/* Hero Glass UI Panel */}
      <group position={[0, 0, 0]}>
        <Float speed={2.5} rotationIntensity={0.15} floatIntensity={0.4}>
          <GlassUI 
            textureSrc={heroTexture} 
            position={[0, 0, 0]} 
            scale={1.0}
            highlightColor="#3D52D5"
          />
        </Float>

        {/* Dynamic Action Particles in Feature & CTA Acts */}
        {frame >= act1End && frame < act3End && (
          <Sparkles 
            count={70} 
            scale={16} 
            size={3.5} 
            speed={0.4} 
            color="#0DAF7A" 
          />
        )}

        {frame >= act3End && (
          <Sparkles 
            count={140} 
            scale={24} 
            size={5.0} 
            speed={0.3} 
            color="#3D52D5" 
          />
        )}
      </group>
    </Suspense>
  );
};
