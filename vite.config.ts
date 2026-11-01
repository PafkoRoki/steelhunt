import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter => the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
