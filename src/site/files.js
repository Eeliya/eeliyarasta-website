/**
 * Content files, by kind. Each kind has its own folder under content/, so a name
 * never means two things (a page called "site" and the site settings can coexist):
 *
 *   content/pages/<id>.json     one file per page: heading, copy, curtain text and transition
 *                               (home, photography, people, places, projects, about, 404)
 *   content/sources/<id>.json   lists that grids pull from; the top level is a JSON array
 *   content/settings/<id>.json  site-wide settings (site.json, animations.json)
 *
 * Paths are relative to content/ and are also the keys the editor uses
 * (data-edit="pages/home.json#/hero/title").
 */
export const FOLDERS = ['pages', 'sources', 'settings'];

export const pageFile = (id) => `pages/${id}.json`;
export const sourceFile = (id) => `sources/${id}.json`;
export const settingsFile = (id) => `settings/${id}.json`;

export const SITE = settingsFile('site');
export const ANIMATIONS = settingsFile('animations');
export const HOME = pageFile('home');

/** "pages/about.json" -> "about" (null for files outside content/pages/). */
export const pageIdOf = (file) => /^pages\/([^/]+)\.json$/.exec(file || '')?.[1] ?? null;

/** "sources/people.json" -> "people" (null for files outside content/sources/). */
export const sourceIdOf = (file) => /^sources\/([^/]+)\.json$/.exec(file || '')?.[1] ?? null;

/** Editable content file name: <folder>/<name>.json, nothing else. */
export const isContentFile = (file) =>
  new RegExp(`^(${FOLDERS.join('|')})/[a-z0-9][a-z0-9_-]*\\.json$`, 'i').test(file || '');

/** File name without its folder, for compact labels: "pages/home.json" -> "home.json". */
export const baseName = (file) => String(file || '').replace(/^.*\//, '');

/**
 * Render context from content files keyed by path ({ "pages/home.json": data, ... }).
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
    home: files[HOME],
    pages: byFolder('pages'),
    sources,
    people: list('people'),
    places: list('places'),
    projects: list('projects'),
    animations: files[ANIMATIONS] || {},
  };
}
