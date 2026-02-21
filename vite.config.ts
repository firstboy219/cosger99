
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // FLAT STRUCTURE CONFIGURATION
  root: './', // Explicitly set root to current directory
  base: './', // Use relative paths for production assets
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve('index.html'), // Explicitly point to root index.html
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
});
