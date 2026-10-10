/**
 * Redirects: content/settings/redirects.json, a list of { from, to, status? } (status 301, the
 * default, or 302). `from` is a path of the site ("/old/"), or a pattern for the item pages of
 * a template ("/old/:slug/"); `to` is a path ("/new/", "/new/:slug/") or a URL. The build writes
 * them to dist/_redirects (Cloudflare Pages and Netlify read it); the dev server ignores them.
 *
 * Kept up to date by the editor (scripts/editor-server.mjs, src/editor/main.js), with the
 * functions here:
 *   a page renamed   every path of its folder (its pages, and a pattern for the item pages of
 *                    a [slug] page in it) redirects to the new path
 *   a page deleted   its paths redirect to a page (its parent by default), or go (no redirect)
 *   an item's slug   its old page redirects to the new one (on Save)
 * and in every case the content's links to the old paths follow (moveLinks), redirects that
 * pointed at an old path point at the new one (no chains), and redirects to themselves or
 * from a path that is a page (again) go (pruneRedirects).
 */
import { PHOTOS, REDIRECTS, TEMPLATE, contentFromFiles } from './files.js';
import { getRoutes, pathOfId } from './routes.js';
import { isExternal } from './helpers.js';

export const STATUSES = [301, 302];

/** "/people/:slug/": the paths of a template's item pages, as a redirect pattern. */
export const itemPattern = (id) => `${pathOfId(id)}:slug/`;

/** The redirect list of `files` (empty when there is none). */
export const redirectsOf = (files) =>
  Array.isArray(files[REDIRECTS]) ? files[REDIRECTS].filter((r) => r && typeof r === 'object') : [];

/** "/about#team" -> "/about/": a path as a key, without its #hash or ?query, ending in "/". */
export function pathKey(s) {
  const p = String(s).split(/[?#]/)[0];
  return p.endsWith('/') ? p : `${p}/`;
}

/** An internal link: a path on the site ("/about/", "/projects/#x"), not "//host" or a URL. */
const isPath = (s) => typeof s === 'string' && s.startsWith('/') && !s.startsWith('//');

/** The pages of the site: every route's path (not 404) and a pattern per [slug] page. */
export function pathsOf(content) {
  const paths = new Set(
    getRoutes(content)
      .filter((r) => r.out !== '404.html')
      .map((r) => r.path),
  );
  for (const id of Object.keys(content.pages))
    if (id.endsWith(TEMPLATE)) paths.add(itemPattern(id));
  return paths;
}

/** pathsOf the content files ({ "pages/index.json": data, ... }). */
export const sitePaths = (files) => pathsOf(contentFromFiles(files));

/** Every string in data, with its JSON pointer parts: fn(value, parts). */
function eachString(data, fn, parts = []) {
  if (typeof data === 'string') fn(data, parts);
  else if (data && typeof data === 'object')
    for (const [k, v] of Object.entries(data)) eachString(v, fn, [...parts, k]);
}

/**
 * The paths that move: a Map of old path -> new path (null: gone, no redirect). `hash`: links
 * keep their #hash and ?query (a rename; not when sent to another page).
 * Returns the link edits [{ file, parts, value }] (redirects.json and photos.json aside) and
 * `broken`, the number of links to gone paths, which stay as they are.
 */
export function moveLinks(files, moves, { hash = true } = {}) {
  const edits = [];
  let broken = 0;
  for (const [file, data] of Object.entries(files)) {
    if (file === REDIRECTS || file === PHOTOS) continue;
    eachString(data, (s, parts) => {
      if (!isPath(s) || !moves.has(pathKey(s))) return;
      const to = moves.get(pathKey(s));
      if (to === null) broken++;
      else
        edits.push({ file, parts, value: to + (hash ? s.slice(s.split(/[?#]/)[0].length) : '') });
    });
  }
  return { edits, broken };
}

/**
 * The redirect list after `moves` (old path -> new path, or null): redirects to a moved path
 * follow it (or go with it), every moved path that has a new one gets a redirect (replacing
 * one from the same path; item pages through their template's pattern when that moves too),
 * and self-redirects go. Returns { list, added }.
 */
export function moveRedirects(list, moves) {
  const out = [];
  for (const r of list) {
    if (!isPath(r.to) || !moves.has(pathKey(r.to))) out.push(r);
    else if (moves.get(pathKey(r.to)) !== null) out.push({ ...r, to: moves.get(pathKey(r.to)) });
  }
  // an item page's redirect is its pattern's ("/people/:slug/"), when that moves too
  const patterns = [...moves.keys()]
    .filter((p) => p.endsWith('/:slug/'))
    .map((p) => p.slice(0, -6));
  const covered = (p) =>
    patterns.some((b) => p.startsWith(b) && /^[^/:]+\/$/.test(p.slice(b.length)));
  const added = [...moves]
    .filter(([from, to]) => to !== null && !covered(from))
    .map(([from, to]) => ({ from, to }));
  const froms = new Set(added.map((r) => r.from));
  const next = [...out.filter((r) => !froms.has(r.from)), ...added].filter((r) => r.from !== r.to);
  return { list: next, added: added.filter((r) => r.from !== r.to) };
}

/** Redirects from a path that is a page: they go (the page wins). Returns { list, pruned }. */
export function pruneRedirects(list, paths) {
  const pruned = list.filter((r) => isPath(r.from) && paths.has(pathKey(r.from)));
  return { list: list.filter((r) => !pruned.includes(r)), pruned };
}

/**
 * The moves of a page change, from the content files before it (`files`):
 *   { id, name }      page `id` renamed to `name` (its folder and everything in it)
 *   { id, to }        page `id` deleted, its paths sent to `to` (a path), or gone (to null)
 * A [slug] page's own paths are its item pages (only its pattern and items move).
 */
export function pageMoves(files, { id, name, to }) {
  const template = id.endsWith(TEMPLATE);
  const from = pathOfId(id);
  const routes = getRoutes(contentFromFiles(files)).filter((r) =>
    template ? r.id === id : r.path.startsWith(from),
  );
  const paths = [
    ...routes.map((r) => r.path),
    ...[...sitePaths(files)].filter((p) =>
      template ? p === itemPattern(id) : p.includes(':') && p.startsWith(from),
    ),
  ];
  const renamed = name !== undefined && from.replace(/[^/]+\/$/, `${name}/`);
  return new Map(paths.map((p) => [p, renamed ? renamed + p.slice(from.length) : to]));
}

/**
 * Item pages whose path changed between two versions of the content (an item's slug or name
 * changed): old path -> new path. An item is found by its name (or title), else at the same
 * place in its list.
 */
export function itemMoves(before, after) {
  const items = (files) => getRoutes(contentFromFiles(files)).filter((r) => r.album);
  const now = items(after);
  const paths = new Set(now.map((r) => r.path));
  const nameOf = (r) => r.album.name ?? r.album.title;
  const moves = new Map();
  for (const r of items(before)) {
    if (paths.has(r.path)) continue;
    const same = now.filter((n) => n.id === r.id);
    const match =
      same.find((n) => nameOf(n) !== undefined && nameOf(n) === nameOf(r)) ||
      same.find((n) => n.index === r.index);
    if (match && !moves.has(r.path)) moves.set(r.path, match.path);
  }
  return moves;
}

/** _redirects lines: "from to status"; a page path also without its trailing "/". */
export function redirectsText(list) {
  return list
    .flatMap((r) => {
      const status = r.status ?? 301;
      const froms =
        r.from !== '/' && r.from.endsWith('/') ? [r.from, r.from.slice(0, -1)] : [r.from];
      return froms.map((f) => `${f} ${r.to} ${status}`);
    })
    .join('\n');
}

/**
 * The build's redirects: the list without those from a page (they would hide it), and
 * warnings for those and for a `to` that is no page of the site.
 */
export function buildRedirects(list, paths) {
  const warnings = [];
  const kept = list.filter((r) => {
    if (paths.has(pathKey(r.from))) {
      warnings.push(
        `${r.from} is a page: its redirect is left out (remove it in Settings > Redirects)`,
      );
      return false;
    }
    if (!isExternal(r.to) && !paths.has(pathKey(r.to)))
      warnings.push(`${r.from} -> ${r.to}: there is no page ${r.to}`);
    return true;
  });
  return { list: kept, warnings };
}
