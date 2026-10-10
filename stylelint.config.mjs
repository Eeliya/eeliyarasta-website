// Stylelint: standard SCSS rules, relaxed where they fight the code's conventions.
// Prettier owns formatting. Editor files also get the local 4px-grid and text-color rules.
import local from './scripts/stylelint-4px.mjs';

export default {
  extends: ['stylelint-config-standard-scss'],
  plugins: local,
  ignoreFiles: ['dist/**', '.generated/**', 'media/**', 'node_modules/**', 'public/**'],
  rules: {
    // blank lines and alpha notation are left to the author
    'rule-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'scss/double-slash-comment-empty-line-before': null,
    'alpha-value-notation': null,
    // Safari still needs -webkit-backdrop-filter and -webkit-user-select
    'property-no-vendor-prefix': null,
    // font names in SCSS variables (Menlo) look like keywords
    'value-keyword-case': ['lower', { ignoreKeywords: ['/^[A-Z]/'] }],
    // Svelte's :global()
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    // BEM: block, block__elem, block--mod, block__elem--mod (lowercase, hyphenated)
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: (s) => `Expected class "${s}" to be BEM (block__elem--mod)` },
    ],
  },
  overrides: [
    {
      files: ['**/*.svelte'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['src/editor/**/*.{scss,svelte}'],
      rules: { 'local/grid-4px': true, 'local/no-alpha-text-color': true },
    },
  ],
};
