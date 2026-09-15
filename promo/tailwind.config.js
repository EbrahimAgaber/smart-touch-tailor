/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Page Backgrounds ── */
        bg: {
          base:    '#F4F6FB',
          surface: '#FFFFFF',
          raised:  '#EAF0FB',
        },

        /* ── Brand (PRIMARY) ── */
        brand: {
          DEFAULT: '#3D52D5',
          dark:    '#2D3FAA',
          light:   '#6478E8',
          bg:      'rgba(61,82,213,0.06)',
          glow:    'rgba(61,82,213,0.22)',
        },

        /* ── Semantic ── */
        success: '#0DAF7A',
        warning: '#F59E0B',
        danger:  '#EF4444',
        cyan:    '#0891B2',

        /* ── Text ── */
        text: {
          primary: '#0F172A',
          muted:   '#475569',
          subtle:  '#94A3B8',
        },

        /* ── Surfaces ── */
        border:        '#DDE3EF',
        'border-strong': '#B8C4DE',
      },

      fontFamily: {
        ar: ['Cairo', 'sans-serif'],
        en: ['Inter', 'sans-serif'],
      },

      boxShadow: {
        'brand': '0 8px 28px rgba(61,82,213,0.30)',
        'xs':    '0 1px 3px rgba(15,23,42,0.07)',
        'sm':    '0 4px 14px rgba(15,23,42,0.09)',
        'md':    '0 10px 32px rgba(15,23,42,0.11)',
        'lg':    '0 20px 64px rgba(15,23,42,0.13)',
      },

      borderRadius: {
        'base': '12px',
        'lg':   '18px',
        'xl':   '24px',
      },
    },
  },
  plugins: [],
}
