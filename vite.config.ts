import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: path.resolve('index.html'),
      output: {
        // Prevent TDZ issues by ensuring module evaluation order
        hoistTransitiveImports: false,
      }
    },
  },
  server: {
    port: 3000,
    open: false
  },
  resolve: {
    alias: {
      '@': path.resolve('./'),
    },
  },
  optimizeDeps: {
    // Force re-optimization to pick up removed packages
    force: true,
  },
});
