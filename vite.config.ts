import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        control: path.resolve(__dirname, 'index.html'),
        output: path.resolve(__dirname, 'output.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
