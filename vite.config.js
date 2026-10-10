import { defineConfig } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import staticSite from './scripts/vite-plugin-static-site.mjs';

export default defineConfig({
  plugins: [
    staticSite(),
    // Svelte is editor-only (src/editor/svelte). The public site never imports it.
    // vitePreprocess: components can use <style lang="scss">. Runes mode everywhere (also for a
    // component that uses none); scripts/svelte.test.mjs compiles with the same options.
    svelte({
      include: ['src/editor/**/*.svelte'],
      preprocess: vitePreprocess(),
      compilerOptions: { runes: true },
    }),
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
