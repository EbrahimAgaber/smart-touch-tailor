import React from "react";
import { staticFile } from "remotion";
import { GlassUI } from "../models/GlassUI";

interface BackgroundCardConfig {
  texture: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  highlightColor?: string;
}

const CARDS_CONFIG: BackgroundCardConfig[] = [
  // Far Left Layer
  { texture: staticFile("assets/3.png"), position: [-14, 5, -8], rotation: [0.15, 0.45, -0.05], scale: 0.75, highlightColor: "#3D52D5" },
  { texture: staticFile("assets/4.png"), position: [-16, -4, -12], rotation: [-0.2, 0.5, 0.1], scale: 0.85, highlightColor: "#0DAF7A" },
  
  // Far Right Layer
  { texture: staticFile("assets/6.png"), position: [15, 6, -9], rotation: [-0.1, -0.4, 0.05], scale: 0.8, highlightColor: "#0891B2" },
  { texture: staticFile("assets/7.png"), position: [17, -5, -11], rotation: [0.25, -0.5, -0.08], scale: 0.85, highlightColor: "#3D52D5" },
  
  // Mid Depth Top / Bottom
  { texture: staticFile("assets/9.png"), position: [-6, 8, -14], rotation: [0.3, 0.2, -0.1], scale: 0.9, highlightColor: "#6366F1" },
  { texture: staticFile("assets/11.png"), position: [7, 8.5, -15], rotation: [0.25, -0.25, 0.12], scale: 0.9, highlightColor: "#3D52D5" },
  { texture: staticFile("assets/13.png"), position: [-5, -7.5, -13], rotation: [-0.3, 0.3, 0.05], scale: 0.85, highlightColor: "#0DAF7A" },
  { texture: staticFile("assets/14.png"), position: [6, -8, -14], rotation: [-0.25, -0.3, -0.08], scale: 0.85, highlightColor: "#0891B2" },
  
  // Deep Background Layer
  { texture: staticFile("assets/12.png"), position: [0, 11, -22], rotation: [0.1, 0, 0], scale: 1.1, highlightColor: "#3D52D5" },
  { texture: staticFile("assets/15.png"), position: [0, -11, -20], rotation: [-0.1, 0, 0], scale: 1.0, highlightColor: "#6366F1" },
  
  // Close Parallax Accents
  { texture: staticFile("assets/8.png"), position: [-12, 1, -4], rotation: [0.1, 0.35, -0.02], scale: 0.65, highlightColor: "#0891B2" },
  { texture: staticFile("assets/5.png"), position: [12, -1, -5], rotation: [-0.08, -0.35, 0.03], scale: 0.65, highlightColor: "#0DAF7A" },
];

export const UIEcosystemField: React.FC = () => {
  return (
    <group>
      {CARDS_CONFIG.map((card, idx) => (
        <GlassUI
          key={`bg-card-${idx}`}
          textureSrc={card.texture}
          position={card.position}
          rotation={card.rotation}
          scale={card.scale}
          highlightColor={card.highlightColor}
          isBackground
        />
      ))}
    </group>
  );
};
