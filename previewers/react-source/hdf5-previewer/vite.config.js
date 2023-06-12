import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { checker } from 'vite-plugin-checker';
import eslintPlugin from 'vite-plugin-eslint';

export default defineConfig({
  server: { open: true },
  preview: { open: true },
  plugins: [react(), eslintPlugin(), checker({ typescript: true })],

  // `es2020` required by @h5web/h5wasm for BigInt `123n` notation support
  optimizeDeps: { esbuildOptions: { target: 'es2020' } },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: './HDF5Preview.html',
      },
      output: {
        entryFileNames: 'hdf5.js',
        assetFileNames: 'hdf5.css',
      }
    }
  },
});
