/**
 * ESLint (npm run lint): JS recommended + Svelte recommended (Svelte 5 runes, a11y), with
 * browser or Node globals per folder. No style rules: Prettier formats (eslint-config-prettier).
 */
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.generated/', 'media/', 'node_modules/'] },
  js.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    rules: {
      // _unused arguments are fine (callbacks with a fixed signature)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  // The site, its templates and the editor run in the browser.
  {
    files: ['src/**/*.{js,svelte}', 'src/**/*.svelte.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }] },
  },
  // Build scripts, the Vite plugin and config, and the tests run in Node.
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
