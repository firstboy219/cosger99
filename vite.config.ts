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
          // Isolate ALL recharts + d3 packages into a separate async chunk.
          // This prevents d3 circular-module TDZ errors
          // ("Cannot access 'X' before initialization") in the vendor bundle.
          // recharts 3.x uses victory-vendor which bundles d3 internally.
          if (
            id.includes('recharts') ||
            id.includes('victory-vendor') ||
            id.includes('node_modules/d3') ||
            id.includes('d3-shape') ||
            id.includes('d3-scale') ||
            id.includes('d3-color') ||
            id.includes('d3-interpolate') ||
            id.includes('d3-path') ||
            id.includes('d3-array') ||
            id.includes('d3-time') ||
            id.includes('d3-time-format') ||
            id.includes('d3-format') ||
            id.includes('d3-selection') ||
            id.includes('d3-ease') ||
            id.includes('d3-hierarchy') ||
            id.includes('d3-contour') ||
            id.includes('d3-delaunay') ||
            id.includes('d3-dispatch') ||
            id.includes('d3-drag') ||
            id.includes('d3-dsv') ||
            id.includes('d3-fetch') ||
            id.includes('d3-force') ||
            id.includes('d3-geo') ||
            id.includes('d3-brush') ||
            id.includes('d3-chord') ||
            id.includes('d3-random') ||
            id.includes('d3-sankey') ||
            id.includes('d3-transition') ||
            id.includes('d3-zoom') ||
            id.includes('internmap') ||
            id.includes('delaunator') ||
            id.includes('robust-predicates')
          ) {
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
    // Do NOT exclude recharts — let Vite pre-bundle it during dev.
    // Pre-bundling resolves d3 circular deps automatically in dev mode.
    // Dynamic import() in LazyCharts.tsx handles the runtime lazy loading.
    include: ['recharts'],
  },
});
