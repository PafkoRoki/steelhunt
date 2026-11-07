/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          // "Future familiar": bone and graphite, like lacquered panels and printed labels on equipment.
          // Numbers keep their role: 950-600 grounds and lines (950 = inset, 900 = page, 850 = panels), 500-100 text.
          950: '#f7f4ee',
          900: '#ebe6dc', // page — bone
          850: '#f3efe7', // panels (cards) — a shade lighter than the page, raised by shadow
          800: '#e2dccf',
          700: '#cfc7b7',
          600: '#b3aa98',
          500: '#5f5a52', // muted — ~6:1 on panels
          400: '#4a463f',
          300: '#35322d',
          200: '#24221f',
          100: '#141312', // graphite
        },
        moss: {
          // the one signal colour: burnt orange (white text on 500 ≥ 5:1; 400-200 for text on bone ≥ 5:1)
          900: '#faeadf',
          800: '#f4d3c2',
          700: '#e9a27f',
          600: '#d9622e',
          500: '#bc4418',
          400: '#a83c14',
          300: '#943410',
          200: '#7a2a0c',
        },
        brass: { 500: '#c9a24a', 400: '#6e520c', 300: '#5a4209' },
        rust: { 500: '#c4623f', 400: '#8c2f14' },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.85) inset, 0 0 0 1px rgba(20,19,18,0.05), 0 10px 22px -16px rgba(40,30,20,0.38)',
      },
    },
  },
  plugins: [],
};
