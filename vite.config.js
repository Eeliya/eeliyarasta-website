import { defineConfig } from 'vite';
import staticSite from './scripts/vite-plugin-static-site.mjs';

export default defineConfig({
  plugins: [staticSite()],
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // Two entries: the public site (index.html, prerendered per route) and the
    // visual editor (edit/index.html). The site bundle never imports editor code.
    rolldownOptions: {
      input: { main: 'index.html', edit: 'edit/index.html' },
    },
  },
  preview: { port: 4173 },
});
