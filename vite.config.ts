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
    // Without this, an electron-builder run (dist:win/dist:mac/dist:linux) while `npm run dev` is
    // still up writes thousands of files under release/, and Vite's watcher treats every one as a
    // reason to full-reload the running app — wiping in-progress UI state (e.g. a Settings pick)
    // for no reason related to the actual source code.
    watch: {
      ignored: ['**/release/**', '**/dist-electron/**'],
    },
  },
});
