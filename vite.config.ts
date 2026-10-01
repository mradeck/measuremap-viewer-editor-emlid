import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is CRITICAL for hosting in a subdirectory (e.g. your-site.com/tools/metalens/)
  // It ensures assets are loaded relatively (./assets/...) instead of absolutely (/assets/...)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});