import { defineConfig } from 'vite';
import staticSite from './scripts/vite-plugin-static-site.mjs';

export default defineConfig({
  plugins: [staticSite()],
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  preview: { port: 4173 },
});
