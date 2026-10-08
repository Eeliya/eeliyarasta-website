import { defineConfig } from 'vite';
import staticSite from './scripts/vite-plugin-static-site.mjs';

export default defineConfig({
  plugins: [staticSite()],
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // Only the public site is built. The visual editor (edit/index.html → src/editor)
    // is served by the dev server only (`npm run dev` → /edit/) and never ships.
    rolldownOptions: {
      input: { main: 'index.html' },
    },
  },
  preview: { port: 4173 },
});
