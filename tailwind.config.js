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
          500: '#868b8c', // ≥ 4.5:1 on card backgrounds (was #5a5f60, 2.7:1)
          400: '#a6aba9',
          300: '#b4b8b5',
          200: '#d6d8d4',
          100: '#ecede9',
        },
        moss: {
          900: '#1f2021',
          800: '#2a2c2d',
          700: '#3b3e3f',
          600: '#55595a',
          500: '#8e9394',
          400: '#a9adae',
          300: '#c4c7c8',
          200: '#dfe1e1',
        },
        brass: { 500: '#c9a24a', 400: '#d8b86a', 300: '#e6cf95' },
        rust: { 500: '#c4623f', 400: '#d77e5d' },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
