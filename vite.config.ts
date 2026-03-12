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
    target: 'esnext',
    rollupOptions: {
      input: path.resolve('index.html'),
      output: {
        hoistTransitiveImports: false,
        manualChunks(id) {
          // Chunk 1: Recharts + ALL d3 sub-packages
          // Isolated to prevent d3 circular-module TDZ errors
          if (
            id.includes('recharts') || id.includes('victory-vendor') ||
            id.includes('node_modules/d3') || id.includes('d3-shape') ||
            id.includes('d3-scale') || id.includes('d3-color') ||
            id.includes('d3-interpolate') || id.includes('d3-path') ||
            id.includes('d3-array') || id.includes('d3-time') ||
            id.includes('d3-time-format') || id.includes('d3-format') ||
            id.includes('d3-selection') || id.includes('d3-ease') ||
            id.includes('d3-hierarchy') || id.includes('d3-contour') ||
            id.includes('d3-delaunay') || id.includes('d3-dispatch') ||
            id.includes('d3-drag') || id.includes('d3-dsv') ||
            id.includes('d3-fetch') || id.includes('d3-force') ||
            id.includes('d3-geo') || id.includes('d3-brush') ||
            id.includes('d3-chord') || id.includes('d3-random') ||
            id.includes('d3-sankey') || id.includes('d3-transition') ||
            id.includes('d3-zoom') || id.includes('internmap') ||
            id.includes('delaunator') || id.includes('robust-predicates')
          ) {
            return 'charts-vendor';
          }

          // Chunk 2: lucide-react — MUST be isolated separately.
          // lucide-react v0.300+ has deep ESM named exports that Rollup
          // mis-orders during tree-shaking, causing TDZ errors like
          // "Cannot access 'O' before initialization" in the vendor chunk.
          // Own chunk = evaluated fully before any app module references it.
          if (id.includes('lucide-react')) {
            return 'lucide-vendor';
          }

          // Chunk 3: React core — stable, evaluated first
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          // Chunk 4: All other node_modules
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
    // Pre-bundle in dev to resolve internal circular deps via esbuild.
    include: ['lucide-react', 'react-router-dom'],
    // recharts is excluded: LazyCharts.tsx loads it via dynamic import()
    exclude: ['recharts'],
  },
});
