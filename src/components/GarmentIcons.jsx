import React from 'react';

export const ThobeSilhouette = ({ className = "w-20 h-28", size, color = "currentColor" }) => (
  <svg 
    viewBox="0 0 120 180" 
    className={className} 
    style={{ display: 'block', width: size, height: size ? (size * 1.5) : undefined }}
    stroke={color} 
    strokeWidth="1.5" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Main body */}
    <path d="M38 22 L28 38 L10 44 L10 130 L110 130 L110 44 L92 38 L82 22 Z" fill="rgba(241, 245, 249, 0.5)" />
    {/* Skirt flare */}
    <path d="M10 130 L4 175 L116 175 L110 130 Z" fill="rgba(241, 245, 249, 0.5)" />
    {/* Left sleeve */}
    <path d="M28 38 L4 52 L4 92 L18 88 L28 38" fill="rgba(226, 232, 240, 0.5)" />
    {/* Right sleeve */}
    <path d="M92 38 L116 52 L116 92 L102 88 L92 38" fill="rgba(226, 232, 240, 0.5)" />
    {/* Collar */}
    <path d="M50 22 C55 28 65 28 70 22" />
    {/* Placket */}
    <line x1="60" y1="25" x2="60" y2="70" strokeDasharray="2 2" strokeWidth="1" />
    {/* Buttons */}
    <circle cx="60" cy="33" r="1.5" fill={color} />
    <circle cx="60" cy="44" r="1.5" fill={color} />
    <circle cx="60" cy="55" r="1.5" fill={color} />
    {/* Shoulder line */}
    <line x1="28" y1="38" x2="92" y2="38" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
    {/* Chest line */}
    <line x1="16" y1="55" x2="104" y2="55" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
  </svg>
);

export const SirwalSilhouette = ({ className = "w-20 h-28", size, color = "currentColor" }) => (
  <svg 
    viewBox="0 0 120 180" 
    className={className} 
    style={{ display: 'block', width: size, height: size ? (size * 1.5) : undefined }}
    stroke={color} 
    strokeWidth="1.5" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Waistband */}
    <path d="M25 18 L95 18" strokeWidth="3" />
    {/* Pants body */}
    <path d="M25 18 L15 35 L15 170 L55 170 L60 80 L65 170 L105 170 L105 35 L95 18 Z" fill="rgba(241, 245, 249, 0.5)" />
    {/* Crotch curve */}
    <path d="M15 80 Q60 60 105 80" strokeDasharray="3 2" strokeWidth="1" stroke="#94a3b8" />
    {/* Pocket lines */}
    <path d="M18 45 L35 48" />
    <path d="M102 45 L85 48" />
    {/* Length helper */}
    <line x1="10" y1="18" x2="10" y2="170" strokeDasharray="3 2" strokeWidth="1" stroke="#34d399" />
  </svg>
);

export const BishtSilhouette = ({ className = "w-20 h-28", size, color = "currentColor" }) => (
  <svg 
    viewBox="0 0 120 180" 
    className={className} 
    style={{ display: 'block', width: size, height: size ? (size * 1.5) : undefined }}
    stroke={color} 
    strokeWidth="1.5" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Main robe body */}
    <path d="M30 22 L20 38 L20 170 L100 170 L100 38 L90 22 Z" fill="rgba(241, 245, 249, 0.5)" />
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

export const ShirtSilhouette = ({ className = "w-20 h-28", size, color = "currentColor" }) => (
  <svg 
    viewBox="0 0 120 180" 
    className={className} 
    style={{ display: 'block', width: size, height: size ? (size * 1.5) : undefined }}
    stroke={color} 
    strokeWidth="1.5" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Main body */}
    <path d="M35 22 L22 34 L8 38 L8 84 L20 80 L26 34 L26 165 L94 165 L94 34 L100 80 L112 84 L112 38 L98 34 L85 22 Z" fill="rgba(241, 245, 249, 0.5)" />
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

/**
 * GarmentIcon - Compact Vector Silhouettes for POS, Orders Board & Labels
 */
export function GarmentIcon({ type = 'thobe', size = 18, color = 'currentColor', className = '' }) {
  const norm = String(type || '').toLowerCase();
  if (norm.includes('sirwal') || norm.includes('سروال') || norm.includes('pants')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M6 3h12l1 18-5.5-1-1.5-10-1.5 10L5 21 6 3z" />
        <path d="M6 7h12" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (norm.includes('bisht') || norm.includes('بشت') || norm.includes('robe')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 4l7-2 7 2v17l-7-1-7 1V4z" />
        <path d="M12 2v19" />
        <path d="M8 8l4 4 4-4" />
      </svg>
    );
  }
  if (norm.includes('shirt') || norm.includes('قميص')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
      </svg>
    );
  }
  // Default: Thobe / Saudi Robe Silhouette
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 4L4 6v5l3-1v10h10V10l3 1V6l-3-2-2 2-3-1-3 1-2-2z" />
      <path d="M12 7v5" strokeDasharray="1 1" />
      <circle cx="12" cy="8" r="0.5" fill={color} />
      <circle cx="12" cy="10" r="0.5" fill={color} />
    </svg>
  );
}

