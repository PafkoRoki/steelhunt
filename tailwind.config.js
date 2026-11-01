/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0e0f0f',
          900: '#141516',
          850: '#191b1c',
          800: '#1f2122',
          700: '#2a2d2e',
          600: '#3a3e3f',
          500: '#5a5f60',
          400: '#8a8f8e',
          300: '#b4b8b5',
          200: '#d6d8d4',
          100: '#ecede9',
        },
        moss: {
          900: '#1d2a1f',
          800: '#26382a',
          700: '#33503a',
          600: '#46694d',
          500: '#5f8665',
          400: '#7fa283',
          300: '#a3bfa5',
          200: '#c9dbc9',
        },
        brass: { 500: '#c9a24a', 400: '#d8b86a', 300: '#e6cf95' },
        rust: { 500: '#c4623f', 400: '#d77e5d' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Barlow Condensed"', '"IBM Plex Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
