/**
 * The site's config, site.config.mjs at the site's root, and the paths it resolves to. Node only.
 *
 *   export default {
 *     contentDir: 'content/en',        // pages/, sources/, settings/, strings.json
 *     mediaDir: 'media',               // original photos (scripts/images.mjs reads them)
 *     publicDir: 'public',             // Vite's public folder
 *     publicMediaDir: 'public/media',  // the photos' generated sizes (served as /media/...)
 *     generatedDir: '.generated',      // the media manifest (media.json)
 *     outDir: 'dist',                  // the build
 *     themeDir: 'theme',               // the theme: theme.json, styles/ (the site-theme alias)
 *     widgets: ['./widgets/quote'],    // the site's own widgets (widget modules), after the built-ins
 *     repo: { owner, name },           // GitHub links when the git remote names none
 *   };
 *
 * Every key is optional (DEFAULTS); paths are relative to the root. loadSiteConfig(root) gives
 * the merged config (config) and the absolute paths (contentDir, mediaDir, publicDir,
 * publicMediaDir, generatedDir, manifest, outDir, themeDir), theme (theme.json, {} without one),
 * plus contentRel (contentDir from the root,
 * with "/": git paths and messages) and mediaUrl (publicMediaDir as a URL: "/media").
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const CONFIG_FILE = 'site.config.mjs';

export const DEFAULTS = Object.freeze({
  contentDir: 'content/en',
  mediaDir: 'media',
  publicDir: 'public',
  publicMediaDir: 'public/media',
  generatedDir: '.generated',
  outDir: 'dist',
  themeDir: 'theme',
  widgets: Object.freeze([]),
  repo: Object.freeze({ owner: '', name: '' }),
});

const require = createRequire(import.meta.url);
const cache = new Map();
const posix = (p) => p.split(path.sep).join('/');
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});

/** The site at root (default: the working folder): its config and paths. Cached per root. */
export function loadSiteConfig(root = process.cwd()) {
  root = path.resolve(root);
  if (cache.has(root)) return cache.get(root);
  const file = path.join(root, CONFIG_FILE);
  const own = fs.existsSync(file) ? require(file).default || {} : {};
  const config = { ...DEFAULTS, ...own, repo: { ...DEFAULTS.repo, ...own.repo } };
  const abs = (p) => path.resolve(root, p);
  const site = {
    root,
    config,
    contentDir: abs(config.contentDir),
    mediaDir: abs(config.mediaDir),
    publicDir: abs(config.publicDir),
    publicMediaDir: abs(config.publicMediaDir),
    generatedDir: abs(config.generatedDir),
    manifest: path.join(abs(config.generatedDir), 'media.json'),
    outDir: abs(config.outDir),
    themeDir: abs(config.themeDir),
    theme: readJson(path.join(abs(config.themeDir), 'theme.json')),
    contentRel: posix(path.relative(root, abs(config.contentDir))),
    mediaUrl: `/${posix(path.relative(abs(config.publicDir), abs(config.publicMediaDir)))}`,
  };
  cache.set(root, site);
  return site;
}

/** https://github.com/<owner>/<repo> from a git remote URL, else from the config's repo, else ''. */
export function repoUrl(remote, { repo } = DEFAULTS) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote || '');
  if (m) return `https://github.com/${m[1]}/${m[2]}`;
  return repo?.owner && repo?.name ? `https://github.com/${repo.owner}/${repo.name}` : '';
}
