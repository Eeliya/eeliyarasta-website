/**
 * The pages list (PagesList.svelte, the Content tab): the site's pages one folder at a time,
 * from the content files ({ "pages/index.json": data, …, "settings/nav.json": … }).
 *
 * A level is a page's folder (its page id; '' is the top, home's folder). It shows:
 *   own        a folder's root row: its own page, always (locked first); off ("ownPage":
 *              false: its URL opens its first sub page, src/site/routes.js) it is still there,
 *              quieter. The top has none: its page is home, a row of the menu like the others
 *   sub        the pages in the folder that are in the menu (nav.json), in the menu's order
 *              (at the top home too), then its [param] page (pinned last; a [param] folder
 *              holds only another one)
 *   notLinked  every page not in the menu, the whole site's (filter 'all') or the folder's
 *              ('here': in it, at any depth), in the site's order (home first, then by path)
 * A row: { id, pid, title, path, seg (what the row shows: its own segment under the folder,
 * else the full path), kids (pages directly in its folder), linked, template, nested (a
 * [param] page in one: the outer folder's name), count (a [param] page's pages), fixed (home
 * and 404: never deleted), movable (it has a grip: not a [param] page, not 404), noindex,
 * asRoot (the folder's URL opens it) }.
 *
 * The menu edits (link, unlink, move) take nav.json's data and return a changed copy (null:
 * not possible). Items of the menu are { label, page } (hrefs.js); dropdowns go one level deep.
 * Linking is a drag between the two lists (dropOf: link, or move the page into the folder).
 */
import { NAV, isReserved, isTemplate, pageFile, pageIdOf, sourceFile } from '../../site/files.js';
import { navOrder, pageTitle, parentId, pathOfId, titleCase } from '../../site/routes.js';

export const FIXED = ['home', '404'];
const NOT_FOUND = '404';
const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1);
const join = (level, name) => (level ? `${level}/${name}` : name);

/** The site's order of page ids: home first, then by id. */
const byId = (a, b) => (a === 'home' ? -1 : b === 'home' ? 1 : a < b ? -1 : 1);

/** Every page id of the files (home first). */
export const pageIds = (files) => Object.keys(files).map(pageIdOf).filter(Boolean).sort(byId);

/** The page a level opens: its id ('' is home's folder: home). */
export const levelPage = (level) => level || 'home';

/** A page's title: its meta.title, its first heading's, else its name ("[person]" for templates). */
export function titleOf(files, id) {
  if (id === 'home') return 'Home';
  if (isTemplate(id)) return nameOf(id);
  const d = files[pageFile(id)] || {};
  return d.meta?.title || pageTitle(d) || titleCase(nameOf(id));
}

/** A page's path as the editor shows it: "/people/[person]/" (routes.js: "/people/:person/"). */
export const shownPath = (id) => pathOfId(id).replace(/:([a-z][a-z0-9-]*)/g, '[$1]');

/**
 * Where a deleted page redirects by default: its parent page; in a [param] page, its pattern
 * ("/people/:person/": each item page to the same outer item, one level up).
 */
export const parentPath = (id) => pathOfId(parentId(id) || 'home');

/** The path a row shows at `level`: its own segment under the folder, else the full path. */
export function segOf(id, level) {
  const path = shownPath(id);
  if (!level) return path;
  const base = shownPath(level);
  return path.startsWith(base) && path !== base ? path.slice(base.length) : path;
}

/** Is the level's own page on? (home always; a page with "ownPage": false: off) */
export const ownPageOn = (files, level) =>
  !level || (files[pageFile(level)] || {}).ownPage !== false;

/**
 * The level: { level, id, title, path, own (a folder's root row, `off` when its own page is
 * off; null at the top), canOwn (its own page can be turned off: a folder with a normal sub
 * page), full (only a [param] page could be added and it has one), sub, notLinked, total (Not
 * linked before the filter) }. routes (routes.js, optional): a [param] page's count of pages.
 */
export function levelOf(files, level, filter = 'all', routes = null) {
  const ids = pageIds(files);
  const nav = files[NAV] || {};
  const order = navOrder(nav);
  const pidOf = (id) => files[pageFile(id)]?.id;
  const linked = (id) => order.includes(pidOf(id));
  const kids = (id) => (id === 'home' ? [] : ids.filter((p) => p !== 'home' && parentId(p) === id));
  const row = (id) => {
    const d = files[pageFile(id)] || {};
    const template = isTemplate(id);
    const items = template ? files[sourceFile(d.template?.source)]?.items : null;
    return {
      id,
      pid: d.id,
      title: titleOf(files, id),
      path: pathOfId(id),
      seg: segOf(id, level),
      kids: kids(id).length,
      linked: linked(id),
      template,
      // a [param] page in one: its pages are per outer page ("[person]")
      nested: template && isTemplate(parentId(id)) ? nameOf(parentId(id)) : null,
      items: Array.isArray(items) ? items.length : undefined,
      count: template
        ? routes
          ? routes.filter((r) => r.id === id).length
          : Array.isArray(items)
            ? items.length
            : 0
        : undefined,
      fixed: FIXED.includes(id),
      movable: !template && id !== NOT_FOUND,
      noindex: !!d.meta?.noindex,
      asRoot: false,
    };
  };
  // at the top: home too (its page; a row of the menu like the others)
  const inFolder = ids.filter((id) => (id === 'home' ? !level : parentId(id) === level));
  const rank = (id) => order.indexOf(pidOf(id));
  const sub = inFolder
    .filter((id) => !isTemplate(id) && linked(id))
    .sort((a, b) => rank(a) - rank(b))
    .map(row);
  const template = inFolder.find(isTemplate);
  if (template) sub.push(row(template));
  const under = (id) => !level || id.startsWith(`${level}/`);
  const all = ids.filter((id) => !isTemplate(id) && !linked(id)).map(row);
  const notLinked = filter === 'here' && level ? all.filter((r) => under(r.id)) : all;
  const on = ownPageOn(files, level);
  // off: the folder's URL opens its first sub page (in the menu's order, else the folder's)
  if (!on) {
    const first =
      sub.find((r) => !r.template) || all.find((r) => r.id !== 'home' && parentId(r.id) === level);
    if (first) first.asRoot = true;
  }
  const id = levelPage(level);
  return {
    level,
    id,
    title: titleOf(files, id),
    path: shownPath(id),
    own: level ? { ...row(id), seg: '/', self: true, off: !on } : null,
    canOwn:
      !!level &&
      !isTemplate(level) &&
      !FIXED.includes(level) &&
      inFolder.some((p) => !isTemplate(p)),
    full: isTemplate(level) && inFolder.some(isTemplate),
    sub,
    notLinked,
    total: all.length,
  };
}

/**
 * Does a double click on the row go into its level (else it opens the page in the editor)?
 * Every page's row does, a plain page's too (its root row, "No sub pages yet"); not a level's
 * root row (it is that page: open it), home (it is /, the top) or 404 (it holds no pages).
 */
export const goesInside = (row) => !row.self && row.id !== 'home' && row.id !== NOT_FOUND;

/**
 * A row's tag after its title: "root" (a level's own row), a [param] page's "per item · 4" or
 * "per [person] · 4" (its pages; 0: warn, its source has no items), else null.
 */
export function tagOf(row) {
  if (row.self) return { text: 'root' };
  if (!row.template) return null;
  const n = row.count ?? 0;
  return { text: `per ${row.nested || 'item'} · ${n}`, warn: n === 0 };
}

/** Can its Edit open it? Not a [param] page with no pages (its source has no items: none to show). */
export const editable = (row) => !(row.template && row.count === 0);

/** A row has a level of pages under it to go into: the › hint (not on a level's own row). */
export const hasInside = (row) => !row.self && !row.part && (row.kids > 0 || !!row.template);

/**
 * What a row's Edit opens (its Sections in Content): its page entry (ui.pages, main.js
 * pageEntries: { kind, path, template?, items?, id? }): a site part's, a [param] page's (its
 * items: the preview shows one), else the page at the row's path.
 */
export const entryFor = (pages, row) =>
  pages.find((p) =>
    row.part
      ? p.kind === 'part' && p.id === row.id
      : row.template
        ? p.template === row.id
        : p.kind === 'page' && p.path === row.path && !p.items,
  );

/** The path crumbs of a level: [{ label: '/', level: '' }, { label: 'photography/', … }]. */
export const crumbsOf = (level) => [
  { label: '/', level: '' },
  ...(level ? level.split('/') : []).map((name, i, all) => ({
    label: `${name}/`,
    level: all.slice(0, i + 1).join('/'),
  })),
];

/** How many links point at page `pid` (menu items included), in all the files but its own. */
export function linksTo(files, pid, own = '') {
  let n = 0;
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (v.page === pid) n++;
      Object.values(v).forEach(walk);
    }
  };
  for (const [file, data] of Object.entries(files)) if (file !== own) walk(data);
  return n;
}

// ---- the menu (nav.json)

/** Where page `pid` is in the menu: { list (header or a children list), index } or null. */
function findItem(header, pid) {
  for (let i = 0; i < header.length; i++) {
    if (header[i]?.page === pid) return { list: header, index: i };
    const kids = header[i]?.children;
    if (Array.isArray(kids)) {
      const j = kids.findIndex((c) => c?.page === pid);
      if (j >= 0) return { list: kids, index: j };
    }
  }
  return null;
}

const copy = (nav) => {
  const next = structuredClone(nav || {});
  if (!Array.isArray(next.header)) next.header = [];
  return next;
};

/**
 * Add page `pid` to the menu as `label`: into the dropdown of `parentPid`'s item when it is a
 * top item without a source list, else at the end of the top level. Returns the copy.
 */
export function linkPage(nav, pid, label, parentPid) {
  const next = copy(nav);
  if (findItem(next.header, pid)) return next;
  const parent = next.header.find((it) => it?.page === parentPid);
  const item = { label, page: pid };
  if (parent && parent.items === undefined) (parent.children ||= []).push(item);
  else next.header.push(item);
  return next;
}

/** Take page `pid` out of the menu (every item of it); its dropdown's items take its place. */
export function unlinkPage(nav, pid) {
  const next = copy(nav);
  const out = [];
  for (const it of next.header) {
    if (it?.page === pid) out.push(...(Array.isArray(it.children) ? it.children : []));
    else {
      if (Array.isArray(it?.children)) {
        it.children = it.children.filter((c) => c?.page !== pid);
        if (!it.children.length) delete it.children;
      }
      out.push(it);
    }
  }
  next.header = out;
  return next;
}

/**
 * Move page `pid`'s menu item to just before `beforePid`'s (or just after `afterPid`'s, when
 * dropped last), into that item's list. null when it can't: not in the menu, or an item with a
 * dropdown into a dropdown (one level deep).
 */
export function movePage(nav, pid, { before, after } = {}) {
  const next = copy(nav);
  const from = findItem(next.header, pid);
  if (!from) return null;
  const [item] = from.list.splice(from.index, 1);
  const to = findItem(next.header, before ?? after);
  if (!to || (to.list !== next.header && Array.isArray(item.children))) return null;
  to.list.splice(to.index + (before ? 0 : 1), 0, item);
  for (const it of next.header)
    if (Array.isArray(it?.children) && !it.children.length) delete it.children;
  return next;
}

/** A new page's id at `level`: join(level, name). */
export const childId = join;

/**
 * Link page `pid` into the menu at `place` ({ before | after: a pid }, or null: where
 * linkPage puts it): linkPage, then movePage. Returns the copy (null: it can't go there).
 */
export function linkAt(nav, pid, label, parentPid, place) {
  const next = linkPage(nav, pid, label, parentPid);
  return place ? movePage(next, pid, place) : next;
}

/**
 * A drop on the level's menu list (index `to` among its movable rows, the row itself left
 * out): what it does. Dragging from Not linked links a page of this folder; a page of
 * another folder moves here (its address changes; nothing redirects: the old one goes):
 *   { kind: 'link', place }               place: { before | after: a pid } or null
 *   { kind: 'move', place, to }           to: its new id
 *   { kind: 'refuse', why }
 */
export function dropOf(files, L, row, to) {
  const level = L.level;
  if (!row.movable) return { kind: 'refuse', why: `${row.title} stays where it is` };
  if (isTemplate(level))
    return { kind: 'refuse', why: 'A [param] folder holds only its [param] page' };
  const rest = L.sub.filter((r) => r.movable && r.id !== row.id);
  const place =
    to < rest.length ? { before: rest[to].pid } : rest.length ? { after: rest.at(-1).pid } : null;
  const here = row.id === 'home' ? !level : row.id !== 'home' && parentId(row.id) === level;
  if (here) return { kind: 'link', place };
  if (row.fixed) return { kind: 'refuse', why: `${row.title} stays at ${shownPath(row.id)}` };
  if (level === row.id || level.startsWith(`${row.id}/`))
    return { kind: 'refuse', why: `${row.title} can't go into itself` };
  const id = join(level, nameOf(row.id));
  if (isReserved(level, nameOf(row.id)))
    return { kind: 'refuse', why: `"${nameOf(row.id)}" is reserved at the top: rename it first` };
  if (pageIds(files).includes(id))
    return {
      kind: 'refuse',
      why: `${shownPath(id)} exists already: rename one of them first (SEO › Address)`,
    };
  return { kind: 'move', place, to: id };
}

/** Where a row dropped on Not linked shows up there: its index in the site's order. */
export const sortedAt = (rows, id) => rows.filter((r) => byId(r.id, id) < 0).length;
