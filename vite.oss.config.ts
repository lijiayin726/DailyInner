import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'static',
  plugins: [react()],
  publicDir: 'public',
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: '../oss-dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
