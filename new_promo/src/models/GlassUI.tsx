import React, { useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useCurrentFrame } from "remotion";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";

interface GlassUIProps {
  textureSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  isBackground?: boolean;
  opacity?: number;
  highlightColor?: string;
}

export const GlassUI: React.FC<GlassUIProps> = ({
  textureSrc,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isBackground = false,
  opacity = 1,
  highlightColor = "#3D52D5",
}) => {
  const frame = useCurrentFrame();
  const groupRef = useRef<THREE.Group>(null);
  
  const texture = useTexture(textureSrc);
  
  useLayoutEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 16;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    }
  }, [texture]);

  useFrame(() => {
    if (groupRef.current) {
      // Dynamic continuous floating physics with organic multi-wave motion
      const speed = isBackground ? 0.025 : 0.04;
      const amplitudeY = isBackground ? 0.06 : 0.1;
      const amplitudeX = isBackground ? 0.03 : 0.05;

      const seed = position[0] * 1.5 + position[1] * 2.1 + position[2] * 0.7;
      
      groupRef.current.position.y = position[1] + Math.sin(frame * speed + seed) * amplitudeY;
      groupRef.current.position.x = position[0] + Math.cos(frame * (speed * 0.7) + seed) * amplitudeX;
      
      // Gentle continuous rotation drift
      groupRef.current.rotation.x = rotation[0] + Math.sin(frame * 0.015 + seed) * (isBackground ? 0.04 : 0.02);
      groupRef.current.rotation.y = rotation[1] + Math.cos(frame * 0.012 + seed) * (isBackground ? 0.05 : 0.025);
      groupRef.current.rotation.z = rotation[2] + Math.sin(frame * 0.009 + seed) * 0.015;
    }
  });

  // Precise 16:9 Aspect Ratio dimensions
  // 10.6666 x 6.0 is exact 16:9
  const width = 10.666;
  const height = 6.0;
  const depth = 0.16;
  const cornerRadius = 0.18;

  // Screen plane slightly smaller to sit inside the glass border (16:9)
  const screenWidth = 10.45;
  const screenHeight = 5.878;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Premium Thick Glass Backing */}
      <RoundedBox args={[width, height, depth]} radius={cornerRadius} smoothness={10}>
        <meshPhysicalMaterial 
          color="#ffffff" 
          transmission={0.88}
          thickness={0.45}
          roughness={0.12}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          ior={1.52}
          reflectivity={0.9}
          envMapIntensity={2.5}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </RoundedBox>

      {/* Subtle Metallic/Brand Edge Highlight Trim */}
      <RoundedBox args={[width + 0.02, height + 0.02, 0.02]} radius={cornerRadius + 0.01} smoothness={10}>
        <meshStandardMaterial 
          color={highlightColor} 
          metalness={0.9} 
          roughness={0.1} 
          transparent 
          opacity={0.35 * opacity} 
        />
      </RoundedBox>

      {/* High-DPI UI Screen Flush with Front of Glass */}
      <mesh position={[0, 0, depth / 2 + 0.002]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial 
          map={texture} 
          toneMapped={false}
          side={THREE.FrontSide}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
};

