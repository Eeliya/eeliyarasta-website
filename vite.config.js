import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import staticSite from './scripts/vite-plugin-static-site.mjs';

export default defineConfig({
  plugins: [
    staticSite(),
    // Svelte is editor-only (trial: src/editor/svelte). The public site never imports it.
    svelte({ include: ['src/editor/**/*.svelte'] }),
  ],
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
