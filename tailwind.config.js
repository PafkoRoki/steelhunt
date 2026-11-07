/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          // Light theme from the taste skill palette "sky-sand". Numbers keep their role:
          // 950-600 grounds and lines (950 = inset panels, 900 = page, 850 = cards), 500-100 text (100 = strongest).
          950: '#e4f2fa',
          900: '#cbe4f2', // page (palette bg)
          850: '#bcdcee', // cards (palette surface)
          800: '#aed3e8',
          700: '#97c2d9',
          600: '#7da8bf',
          500: '#44606e', // palette muted — 4.66:1 on cards
          400: '#33505d',
          300: '#223a45',
          200: '#142630',
          100: '#0a0a0a', // palette ink
        },
        moss: {
          // accent: palette magenta #b0298f; 400-200 darker for text on the light ground (≥ 5:1)
          900: '#f6e1f0',
          800: '#efd0e6',
          700: '#e3b3d6',
          600: '#c84aa6',
          500: '#b0298f',
          400: '#9b2280',
          300: '#8a1a6f',
          200: '#6f1259',
        },
        brass: { 500: '#c9a24a', 400: '#6e520c', 300: '#5a4209' },
        rust: { 500: '#c4623f', 400: '#8c2f14' },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.45) inset, 0 10px 24px -14px rgba(16,48,72,0.35)',
      },
    },
  },
  plugins: [],
};
