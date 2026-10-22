/**
 * This site's config: where its content, photos and build live (scripts/site-config.mjs reads
 * it; every key is optional, these are the defaults spelled out).
 */
export default {
  contentDir: 'content/en',
  mediaDir: 'media',
  publicDir: 'public',
  publicMediaDir: 'public/media',
  generatedDir: '.generated',
  outDir: 'dist',
  // the theme: theme.json (head: theme-color, preloads) and styles/ (colours, fonts, the look)
  themeDir: 'theme',
  // GitHub links (the editor's commits) when the git remote is not on GitHub
  repo: { owner: 'Eeliya', name: 'eeliyarasta-website' },
};
