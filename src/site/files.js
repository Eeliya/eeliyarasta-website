/**
 * Content files, by kind. Each kind has its own folder under content/, so a name
 * never means two things (a page called "site" and the site settings can coexist):
 *
 *   content/en/pages/              one folder per page, its URL: the page's file is index.json in
 *                               it (pages/index.json is home, pages/people/index.json is
 *                               /people/); a folder named [param] ("[person]") is a template:
 *                               a page per item of a source, one URL segment per item, and
 *                               can hold one more [param] folder (see src/site/routes.js)
 *   content/en/sources/<id>.json   lists that grids pull from; the top level is a JSON array
 *   content/en/sources/<id>.schema.json  the fields of that list's items (src/site/schemas.js)
 *   content/en/settings/<id>.json  site-wide settings (site.json, nav.json: the menus,
 *                               animations.json, redirects.json: a list, footer.json: the
 *                               footer, a document like a page's: kind "part"), and photos.json:
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
 * The content folder from the site's root ("content/en", site.config.mjs), for the paths in
 * messages. scripts/content.mjs sets it when it loads a site, the editor from its config.
 */
export let CONTENT_DIR = 'content/en';
export const setContentDir = (dir) => {
  if (dir) CONTENT_DIR = String(dir).replace(/\/+$/, '');
};
/** A content file's path from the site's root, for messages: "content/en/pages/index.json". */
export const contentPath = (file) => `${CONTENT_DIR}/${file}`;
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
 * "people/[person]" -> "pages/people/[person]/index.json". Every page is a folder.
 */
export const pageFile = (id) => (id === 'home' ? 'pages/index.json' : `pages/${id}/index.json`);
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
 * The footer: a site part, rendered under every page, outside the view (templates/footer.js).
 */
export const FOOTER = settingsFile('footer');

/**
 * Documents: the files of sections and widgets, one shape ({ version, kind, sections, ... }).
 * "kind" says which: "page" (a page file; its id, meta, backdrop, template, ...) or "part" (a
 * site part shown on every page: the footer; only sections). The file decides the kind.
 */
export const DOC_KINDS = ['page', 'part'];
export const docKindOf = (file) => (pageIdOf(file) ? 'page' : file === FOOTER ? 'part' : null);

/** The document a file holds in the render content (a page's, or a part's), else undefined. */
export const docOf = (content, file) =>
  docKindOf(file) === 'part' ? content.footer : content.pages?.[pageIdOf(file)];

/**
 * A page file's id (pageFile backwards): "pages/index.json" -> "home",
 * "pages/people/index.json" -> "people", "pages/people/[person]/index.json" ->
 * "people/[person]". Null for anything else.
 */
export function pageIdOf(file) {
  if (file === 'pages/index.json') return 'home';
  const m = PAGE_FILE.exec(file || '');
  return m ? m[1] : null;
}

/** A URL segment and file name: lowercase letters, digits and dashes ("noor-vermeer"). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (s) => SLUG.test(String(s ?? ''));

/**
 * Top-level names that are not pages (pages/<name>/ can't be one): home and 404 (their files
 * are pages/index.json and pages/404/), the editor, Vite's assets, the photos, the sandbox.
 */
export const RESERVED = ['home', '404', 'edit', 'assets', 'media', 'sandbox'];
/** Is `name` a name no page can have in folder `parent` ('' the top)? */
export const isReserved = (parent, name) => !parent && RESERVED.includes(name);

/**
 * URL params: a page folder named "[name]" ("[person]", "[year]") is a template, one page per
 * item, the item's slug in that part of the URL. A param's name: a-z first, then a-z, 0-9, -.
 */
const PARAM_NAME = '[a-z][a-z0-9-]*';
const PARAM = new RegExp(`^\\[(${PARAM_NAME})\\]$`);
/** "[person]" -> "person"; null for any other folder name. */
export const paramOf = (segment) => PARAM.exec(segment ?? '')?.[1] ?? null;
/** Is a folder name a param's ("[person]")? */
export const isParam = (segment) => paramOf(segment) !== null;
/** Is page `id` a template (its own folder a [param]: "people/[person]")? */
export const isTemplate = (id) =>
  isParam(
    String(id ?? '')
      .split('/')
      .at(-1),
  );
/** The params of page `id`, outermost first: "people/[person]/[year]" -> ["person", "year"]. */
export const paramsOf = (id) =>
  String(id ?? '')
    .split('/')
    .map(paramOf)
    .filter(Boolean);
/** A new template's folder name: param "person" -> "[person]". */
export const paramFolder = (name) => `[${name}]`;
/** Is `s` a valid param name ("person")? */
export const isParamName = (s) => new RegExp(`^${PARAM_NAME}$`).test(String(s ?? ''));

const NAME = '[a-z0-9][a-z0-9_-]*';
const SOURCE = new RegExp(`^sources/(${NAME})\\.json$`, 'i');
const SCHEMA = new RegExp(`^sources/(${NAME})\\.schema\\.json$`, 'i');
// a page folder: a name, or a [param]
const SEG = `(?:${NAME}|\\[${PARAM_NAME}\\])`;
// the first part is a name: no [param] folder at the root
const PAGE_FILE = new RegExp(`^pages/(${NAME}(?:/${SEG})*)/index\\.json$`);
const CONTENT_FILE = new RegExp(
  `^(?:strings|(?:sources|settings)/${NAME}|sources/${NAME}\\.schema|pages/(?:${NAME}/(?:${SEG}/)*)?index)\\.json$`,
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
 * settings/<name>.json, and the page files: pages/index.json and pages/<folders>/index.json
 * (a folder: a name or a [param]). Nothing else.
 */
export const isContentFile = (file) => CONTENT_FILE.test(file || '');

/** Name without the kind folder, for compact labels: "pages/people/index.json" -> "people/index.json". */
export const baseName = (file) => String(file || '').replace(/^(pages|sources|settings)\//, '');

/**
 * Render context from content files keyed by path ({ "pages/index.json": data, ... }).
 * pages is keyed by page id ({ home, people, "people/[person]", ... }), sources and schemas
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
    footer: files[FOOTER] || { kind: 'part', sections: [] },
    // UI text of the templates (the menu): { nav: {...} }
    strings: files[STRINGS] || {},
  };
}
