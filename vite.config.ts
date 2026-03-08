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
        hoistTransitiveImports: false,
        manualChunks(id) {
          // Isolate recharts + d3 into a separate async chunk
          // Prevents d3 TDZ (Cannot access 'z'/'q'/'V' before initialization)
          if (id.includes('recharts') || id.includes('node_modules/d3') ||
              id.includes('d3-shape') || id.includes('d3-scale') ||
              id.includes('d3-color') || id.includes('d3-interpolate') ||
              id.includes('d3-path') || id.includes('d3-array')) {
            return 'charts-vendor';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
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
    exclude: ['recharts'],
  },
});
