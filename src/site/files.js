/**
 * Content files, by kind. Each kind has its own folder under content/, so a name
 * never means two things (a page called "site" and the site settings can coexist):
 *
 *   content/en/pages/              one folder per page, its URL: the page's file is index.json in
 *                               it (pages/index.json is home, pages/people/index.json is
 *                               /people/), plus maybe [slug].json, a template page for every
 *                               item of a source (see src/site/routes.js)
 *   content/en/sources/<id>.json   lists that grids pull from; the top level is a JSON array
 *   content/en/sources/<id>.schema.json  the fields of that list's items (src/site/schemas.js)
 *   content/en/settings/<id>.json  site-wide settings (site.json, nav.json: the menus,
 *                               animations.json, redirects.json: a list, footer.json: the
 *                               footer's sections, like a page's), and photos.json:
 *                               every photo's alt text (media/ paths and R2 keys) plus the
 *                               sizes of photos uploaded to R2; written by the editor's Media
 *                               window and the upload (not by Save), committed by Publish
 *
 * Paths are relative to content/ and are also the keys the editor uses
 * (data-edit="pages/index.json#/hero/title").
 */
import { isObject } from './is.js';
export const FOLDERS = ['pages', 'sources', 'settings'];
/**
 * The shape version of every content file: its first key, "version": 1. A file whose top level
 * is a list or a map keeps it under one key next to it: a source's "items", redirects.json
 * "redirects", photos.json "photos".
 */
export const VERSION = 1;

/** A source file's list (its "items"); anything else as it is, for the warnings. */
export const itemsOf = (data) => (isObject(data) && 'items' in data ? data.items : data);

/** Content files at the top of the locale's folder (content/en/strings.json: UI text). */
export const ROOT_FILES = ['strings.json'];

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
export const schemaFile = (id) => `sources/${id}.schema.json`;
const settingsFile = (id) => `settings/${id}.json`;

export const SITE = settingsFile('site');
export const NAV = settingsFile('nav');
export const ANIMATIONS = settingsFile('animations');
export const PHOTOS = settingsFile('photos');
export const REDIRECTS = settingsFile('redirects');
export const STRINGS = 'strings.json';
/**
 * The footer: a page-like file ({ version, sections }: the same sections, blocks, grid and
 * motion as a page) rendered under every page, outside the view (templates/footer.js).
 */
export const FOOTER = settingsFile('footer');

/** A file of sections and blocks: a page's, or the footer's. */
export const hasSections = (file) => file === FOOTER || !!pageIdOf(file);

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
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s) => SLUG.test(String(s ?? ''));

/** The name of a template page (pages/people/[slug].json) and the last part of its id. */
export const TEMPLATE = '[slug]';

const NAME = '[a-z0-9][a-z0-9_-]*';
const SOURCE = new RegExp(`^sources/(${NAME})\\.json$`, 'i');
const SCHEMA = new RegExp(`^sources/(${NAME})\\.schema\\.json$`, 'i');
const CONTENT_FILE = new RegExp(
  `^(?:strings|(?:sources|settings)/${NAME}|sources/${NAME}\\.schema|pages/(?:${NAME}/)*index|pages/(?:${NAME}/)+\\[slug\\])\\.json$`,
  'i',
);

/** "sources/people.json" -> "people" (null for anything else, schema files too). */
export const sourceIdOf = (file) => SOURCE.exec(file || '')?.[1] ?? null;
/** The ids of the sources among `files` (a { file: data } map, e.g. the store's), sorted. */
export const sourceIds = (files) => Object.keys(files).map(sourceIdOf).filter(Boolean).sort();

/** "sources/people.schema.json" -> "people" (null for anything else). */
export const schemaIdOf = (file) => SCHEMA.exec(file || '')?.[1] ?? null;

/**
 * Editable content file name: sources/<name>.json and its sources/<name>.schema.json,
 * settings/<name>.json, and the page files: pages/index.json, pages/<folders>/index.json
 * and pages/<folders>/[slug].json. Nothing else.
 */
export const isContentFile = (file) => CONTENT_FILE.test(file || '');

/** Name without the kind folder, for compact labels: "pages/people/index.json" -> "people/index.json". */
export const baseName = (file) => String(file || '').replace(/^(pages|sources|settings)\//, '');

/**
 * Render context from content files keyed by path ({ "pages/index.json": data, ... }).
 * pages is keyed by page id ({ home, people, "people/[slug]", ... }), sources and schemas
 * by source id. Sources that are not arrays stay as-is in `sources` (grids warn and render
 * empty).
 */
export function contentFromFiles(files) {
  const byId = (idOf, of = (d) => d) =>
    Object.fromEntries(
      Object.entries(files)
        .map(([f, data]) => [idOf(f), of(data)])
        .filter(([id]) => id),
    );
  const sources = byId(sourceIdOf, itemsOf);
  return {
    site: files[SITE],
    nav: files[NAV] || {},
    pages: byId(pageIdOf),
    sources,
    schemas: byId(schemaIdOf),
    animations: files[ANIMATIONS] || {},
    // { path or key: { alt, and for R2 photos width, height, srcset, color, lqip } }
    photos: files[PHOTOS]?.photos || {},
    redirects: Array.isArray(files[REDIRECTS]?.redirects) ? files[REDIRECTS].redirects : [],
    footer: files[FOOTER] || { sections: [] },
    // UI text of the templates (the menu): { nav: {...} }
    strings: files[STRINGS] || {},
  };
}
