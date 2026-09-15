import React from 'react';

export const ThobeSilhouette = () => (
  <svg viewBox="0 0 120 180" className="w-20 h-28" style={{ display: 'block' }}
    stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {/* Main body */}
    <path d="M38 22 L28 38 L10 44 L10 130 L110 130 L110 44 L92 38 L82 22 Z" fill="#f1f5f9" />
    {/* Skirt flare */}
    <path d="M10 130 L4 175 L116 175 L110 130 Z" fill="#f1f5f9" />
    {/* Left sleeve */}
    <path d="M28 38 L4 52 L4 92 L18 88 L28 38" fill="#e2e8f0" />
    {/* Right sleeve */}
    <path d="M92 38 L116 52 L116 92 L102 88 L92 38" fill="#e2e8f0" />
    {/* Collar */}
    <path d="M50 22 C55 28 65 28 70 22" />
    {/* Placket */}
    <line x1="60" y1="25" x2="60" y2="70" strokeDasharray="2 2" strokeWidth="1" />
    {/* Buttons */}
    <circle cx="60" cy="33" r="1.5" fill="#1e293b" />
    <circle cx="60" cy="44" r="1.5" fill="#1e293b" />
    <circle cx="60" cy="55" r="1.5" fill="#1e293b" />
    {/* Shoulder line */}
    <line x1="28" y1="38" x2="92" y2="38" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
    {/* Chest line */}
    <line x1="16" y1="55" x2="104" y2="55" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
  </svg>
);

export const SirwalSilhouette = () => (
  <svg viewBox="0 0 120 180" className="w-20 h-28" style={{ display: 'block' }}
    stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {/* Waistband */}
    <path d="M25 18 L95 18" strokeWidth="3" />
    {/* Pants body */}
    <path d="M25 18 L15 35 L15 170 L55 170 L60 80 L65 170 L105 170 L105 35 L95 18 Z" fill="#f1f5f9" />
    {/* Crotch curve */}
    <path d="M15 80 Q60 60 105 80" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
    {/* Pocket lines */}
    <path d="M18 45 L35 48" />
    <path d="M102 45 L85 48" />
    {/* Length helper */}
    <line x1="10" y1="18" x2="10" y2="170" strokeDasharray="3 2" strokeWidth="1" stroke="#34d399" />
  </svg>
);

export const BishtSilhouette = () => (
  <svg viewBox="0 0 120 180" className="w-20 h-28" style={{ display: 'block' }}
    stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {/* Main robe body */}
    <path d="M30 22 L20 38 L20 170 L100 170 L100 38 L90 22 Z" fill="#f1f5f9" />
    {/* Armhole cutouts */}
    <path d="M20 38 C28 55 28 70 20 82" />
    <path d="M100 38 C92 55 92 70 100 82" />
    {/* Neck open */}
    <path d="M42 22 L60 52 L78 22" />
    {/* Open front seam */}
    <line x1="60" y1="52" x2="60" y2="170" strokeDasharray="3 2" strokeWidth="1" />
    {/* Shoulder line */}
    <line x1="20" y1="38" x2="100" y2="38" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
  </svg>
);

export const ShirtSilhouette = () => (
  <svg viewBox="0 0 120 180" className="w-20 h-28" style={{ display: 'block' }}
    stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {/* Main body */}
    <path d="M35 22 L22 34 L8 38 L8 84 L20 80 L26 34 L26 165 L94 165 L94 34 L100 80 L112 84 L112 38 L98 34 L85 22 Z" fill="#f1f5f9" />
    {/* Collar */}
    <path d="M46 22 L54 32 L60 24 L66 32 L74 22" />
    {/* Placket */}
    <line x1="60" y1="30" x2="60" y2="165" strokeDasharray="2 2" strokeWidth="1" />
    {/* Pocket */}
    <rect x="33" y="45" width="12" height="14" rx="1" />
    {/* Shoulder */}
    <line x1="26" y1="34" x2="94" y2="34" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
  </svg>
);
