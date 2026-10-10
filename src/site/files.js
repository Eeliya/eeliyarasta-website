/**
 * Content files, by kind. Each kind has its own folder under content/, so a name
 * never means two things (a page called "site" and the site settings can coexist):
 *
 *   content/pages/              one folder per page, its URL: the page's file is index.json in
 *                               it (pages/index.json is home, pages/people/index.json is
 *                               /people/), plus maybe [slug].json, a template page for every
 *                               item of a source (see src/site/routes.js)
 *   content/sources/<id>.json   lists that grids pull from; the top level is a JSON array
 *   content/settings/<id>.json  site-wide settings (site.json, nav.json: the menus,
 *                               animations.json), and photos.json:
 *                               every photo's alt text (media/ paths and R2 keys) plus the
 *                               sizes of photos uploaded to R2; written by the editor's Media
 *                               window and the upload (not by Save), committed by Publish
 *
 * Paths are relative to content/ and are also the keys the editor uses
 * (data-edit="pages/index.json#/hero/title").
 */
export const FOLDERS = ['pages', 'sources', 'settings'];

/**
 * The file of a page by id: "home" -> "pages/index.json", "people" -> "pages/people/index.json",
 * "people/[slug]" -> "pages/people/[slug].json".
 */
export const pageFile = (id) =>
  id === 'home'
    ? 'pages/index.json'
    : id.endsWith('[slug]')
      ? `pages/${id}.json`
      : `pages/${id}/index.json`;
export const sourceFile = (id) => `sources/${id}.json`;
export const settingsFile = (id) => `settings/${id}.json`;

export const SITE = settingsFile('site');
export const NAV = settingsFile('nav');
export const ANIMATIONS = settingsFile('animations');
export const HOME = pageFile('home');
export const PHOTOS = settingsFile('photos');

/**
 * A page file's id (pageFile backwards): "pages/index.json" -> "home",
 * "pages/people/index.json" -> "people", "pages/people/[slug].json" -> "people/[slug]".
 * Null for anything else.
 */
export function pageIdOf(file) {
  if (file === 'pages/index.json') return 'home';
  const m = /^pages\/(.+)\/(index|\[slug\])\.json$/.exec(file || '');
  if (!m) return null;
  return m[2] === 'index' ? m[1] : `${m[1]}/[slug]`;
}

/** A URL segment and file name: lowercase letters, digits and dashes ("noor-vermeer"). */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s) => SLUG.test(String(s ?? ''));

/** The name of a template page (pages/people/[slug].json) and the last part of its id. */
export const TEMPLATE = '[slug]';

/** "sources/people.json" -> "people" (null for files outside content/sources/). */
export const sourceIdOf = (file) => /^sources\/([^/]+)\.json$/.exec(file || '')?.[1] ?? null;

const NAME = '[a-z0-9][a-z0-9_-]*';
const CONTENT_FILE = new RegExp(
  `^(?:(?:sources|settings)/${NAME}|pages/(?:${NAME}/)*index|pages/(?:${NAME}/)+\\[slug\\])\\.json$`,
  'i',
);

/**
 * Editable content file name: sources/<name>.json, settings/<name>.json, and the page files:
 * pages/index.json, pages/<folders>/index.json and pages/<folders>/[slug].json. Nothing else.
 */
export const isContentFile = (file) => CONTENT_FILE.test(file || '');

/** Name without the kind folder, for compact labels: "pages/people/index.json" -> "people/index.json". */
export const baseName = (file) => String(file || '').replace(/^(pages|sources|settings)\//, '');

/**
 * Render context from content files keyed by path ({ "pages/index.json": data, ... }).
 * pages is keyed by page id ({ home, people, "people/[slug]", ... }).
 * Sources that are not arrays stay as-is in `sources` (grids warn and render empty).
 */
export function contentFromFiles(files) {
  const byFolder = (folder) =>
    Object.fromEntries(
      Object.entries(files)
        .filter(([f]) => f.startsWith(`${folder}/`))
        .map(([f, data]) => [f.slice(folder.length + 1, -'.json'.length), data]),
    );
  const sources = byFolder('sources');
  const list = (id) => (Array.isArray(sources[id]) ? sources[id] : []);
  return {
    site: files[SITE],
    nav: files[NAV] || {},
    pages: Object.fromEntries(
      Object.entries(files)
        .map(([f, data]) => [pageIdOf(f), data])
        .filter(([id]) => id),
    ),
    sources,
    people: list('people'),
    places: list('places'),
    projects: list('projects'),
    animations: files[ANIMATIONS] || {},
    // { path or key: { alt, and for R2 photos width, height, srcset, color, lqip } }
    photos: files[PHOTOS] || {},
  };
}
