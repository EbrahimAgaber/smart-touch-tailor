import React from "react";
import { Environment, ContactShadows } from "@react-three/drei";

export const LightingAndEnvironment: React.FC = () => {
  return (
    <group>
      {/* Removed remote Environment to prevent Puppeteer network timeouts during render. Relying on studio lighting. */}


      {/* Main Studio Key Lighting */}
      <ambientLight intensity={0.65} color="#EBF0FC" />
      
      <directionalLight
        position={[12, 14, 10]}
        intensity={1.5}
        color="#FFFFFF"
        castShadow
      />

      {/* Brand Accent Softbox Lights for edge highlights */}
      <spotLight
        position={[-18, 12, 14]}
        angle={0.45}
        penumbra={1}
        intensity={2.2}
        color="#3D52D5"
      />
      <spotLight
        position={[18, -10, 12]}
        angle={0.45}
        penumbra={1}
        intensity={1.6}
        color="#00E5FF"
      />
      <spotLight
        position={[0, -15, 8]}
        angle={0.5}
        penumbra={1}
        intensity={1.2}
        color="#0DAF7A"
      />

      {/* Ground Contact Shadow for depth grounding */}
      <ContactShadows
        position={[0, -6.5, 0]}
        opacity={0.45}
        scale={40}
        blur={2.8}
        far={12}
        color="#1E293B"
      />
    </group>
  );
};
