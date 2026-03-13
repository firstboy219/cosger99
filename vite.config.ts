import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * BUGFIX LOG:
 * ─────────────────────────────────────────────────────────────────────────────
 * [FIX #1] TDZ: "Cannot access 'O' before initialization" (react-vendor chunk)
 *
 * ROOT CAUSE:
 *   lucide-react v0.300+ menggunakan deep ESM named re-exports. Ketika Rollup
 *   menempatkannya di chunk TERPISAH ('lucide-vendor'), Rollup's tree-shaking
 *   dapat meng-hoist variabel dari lucide ke dalam react-vendor SEBELUM
 *   lucide-vendor selesai diinisialisasi → TDZ ReferenceError saat runtime.
 *
 *   Isolasi chunk TERPISAH justru memperparah masalah karena menciptakan
 *   cross-chunk circular initialization dependency yang Rollup tidak bisa
 *   resolve dengan aman.
 *
 * FIX YANG DILAKUKAN:
 *   1. lucide-react DIHAPUS dari manualChunks (tidak lagi jadi chunk sendiri).
 *      Ia masuk ke 'vendor' chunk bersama semua node_modules lain.
 *      esbuild pre-bundle (optimizeDeps.include) tetap aktif untuk dev server.
 *   2. Tambahkan minifyInternalExports: false → Rollup tidak meng-rename/
 *      mereorder internal exports yang melewati batas chunk → mencegah TDZ.
 *   3. Tambahkan build.minify: 'esbuild' untuk konsistensi (default Vite,
 *      tapi kita eksplisitkan agar jelas tidak menggunakan terser).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default defineConfig({
  plugins: [react()],
  root: './',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    // [FIX #1] Gunakan esbuild sebagai minifier (default Vite, lebih aman untuk ESM)
    minify: 'esbuild',
    rollupOptions: {
      input: path.resolve('index.html'),
      output: {
        hoistTransitiveImports: false,
        // [FIX #1] minifyInternalExports: false — cegah Rollup meng-rename
        // internal exports yang melewati batas chunk. Ini adalah penyebab
        // utama TDZ: minifikasi mengubah urutan inisialisasi variabel
        // di cross-chunk references.
        minifyInternalExports: false,
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

          // [FIX #1] lucide-react TIDAK lagi diisolasi ke chunk sendiri.
          // Chunk terpisah menyebabkan cross-chunk TDZ initialization error
          // "Cannot access 'O' before initialization" di react-vendor.
          // lucide-react sekarang masuk ke 'vendor' chunk (baris di bawah),
          // dan tetap di-pre-bundle oleh esbuild via optimizeDeps.include.
          //
          // KODE LAMA (DIHAPUS — penyebab bug):
          // if (id.includes('lucide-react')) {
          //   return 'lucide-vendor';
          // }

          // Chunk 2: React core — stable, evaluated first
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          // Chunk 3: All other node_modules (termasuk lucide-react sekarang)
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
    // [FIX #1] lucide-react tetap di-pre-bundle oleh esbuild untuk dev server.
    // esbuild menangani ESM circular re-exports dengan benar (berbeda dari Rollup).
    // Ini mencegah TDZ di dev mode.
    include: ['lucide-react', 'react-router-dom'],
    // recharts is excluded: LazyCharts.tsx loads it via dynamic import()
    exclude: ['recharts'],
  },
});
