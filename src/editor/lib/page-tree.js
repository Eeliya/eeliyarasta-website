/**
 * The pages list (PagesList.svelte, the Content tab): the site's pages one folder at a time,
 * from the content files ({ "pages/index.json": data, …, "settings/nav.json": … }).
 *
 * A level is a page's folder (its page id; '' is the top, home's folder). It shows:
 *   own        the folder's own page ("this page"), unless it is turned off ("ownPage": false:
 *              its URL opens its first sub page, src/site/routes.js); home is always its own
 *   sub        "Sub items": the pages in the folder that are in the menu (nav.json), in the
 *              menu's order, then its [slug] page (pinned last)
 *   notLinked  every page not in the menu, the whole site's (filter 'all') or the folder's
 *              ('here': in it, at any depth)
 * A row: { id, pid, title, path, seg (what the row shows: its own segment under the folder,
 * else the full path), kids (pages directly in its folder), linked, template, fixed (home and
 * 404: never deleted), noindex, asRoot (the folder's URL opens it) }.
 *
 * The menu edits (link, unlink, move) take nav.json's data and return a changed copy (null:
 * not possible). Items of the menu are { label, page } (hrefs.js); dropdowns go one level deep.
 */
import { NAV, TEMPLATE, pageFile, pageIdOf, sourceFile } from '../../site/files.js';
import { navOrder, pageTitle, parentId, pathOfId, titleCase } from '../../site/routes.js';

export const FIXED = ['home', '404'];
const isTemplate = (id) => id === TEMPLATE || id.endsWith(`/${TEMPLATE}`);
const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1);
const join = (level, name) => (level ? `${level}/${name}` : name);

/** Every page id of the files (home first). */
export const pageIds = (files) =>
  Object.keys(files)
    .map(pageIdOf)
    .filter(Boolean)
    .sort((a, b) => (a === 'home' ? -1 : b === 'home' ? 1 : a < b ? -1 : 1));

/** The page a level opens: its id ('' is home's folder: home). */
export const levelPage = (level) => level || 'home';

/** A page's title: its meta.title, its first heading's, else its name ("[slug]" for templates). */
export function titleOf(files, id) {
  if (id === 'home') return 'Home';
  if (isTemplate(id)) return TEMPLATE;
  const d = files[pageFile(id)] || {};
  return d.meta?.title || pageTitle(d) || titleCase(nameOf(id));
}

/** The path a row shows at `level`: its own segment under the folder, else the full path. */
export function segOf(id, level) {
  const path = isTemplate(id) ? `${pathOfId(id)}‹slug›/` : pathOfId(id);
  if (!level) return path;
  const base = pathOfId(level);
  return path.startsWith(base) && path !== base ? path.slice(base.length) : path;
}

/** Is the level's own page on? (home always; a page with "ownPage": false: off) */
export const ownPageOn = (files, level) =>
  !level || (files[pageFile(level)] || {}).ownPage !== false;

/**
 * The level: { level, id, title, path, own (its own page row, or null when off), canOwn (it
 * can be turned off: not the top, it has sub pages), sub, notLinked, total (Not linked before
 * the filter) }.
 */
export function levelOf(files, level, filter = 'all') {
  const ids = pageIds(files);
  const nav = files[NAV] || {};
  const order = navOrder(nav);
  const pidOf = (id) => files[pageFile(id)]?.id;
  const linked = (id) => order.includes(pidOf(id));
  const kids = (id) => (id === 'home' ? [] : ids.filter((p) => parentId(p) === id));
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
      items: Array.isArray(items) ? items.length : undefined,
      fixed: FIXED.includes(id),
      noindex: !!d.meta?.noindex,
      asRoot: false,
    };
  };
  const inFolder = ids.filter((id) => id !== 'home' && parentId(id) === level);
  const rank = (id) => order.indexOf(pidOf(id));
  const sub = inFolder
    .filter((id) => !isTemplate(id) && linked(id))
    .sort((a, b) => rank(a) - rank(b))
    .map(row);
  const template = inFolder.find(isTemplate);
  if (template) sub.push(row(template));
  const under = (id) => !level || id.startsWith(`${level}/`);
  const all = ids.filter((id) => !isTemplate(id) && id !== 'home' && !linked(id)).map(row);
  const notLinked = filter === 'here' ? all.filter((r) => under(r.id)) : all;
  const on = ownPageOn(files, level);
  // off: the folder's URL opens its first sub page (in the menu's order, else the folder's)
  if (!on) {
    const first = sub.find((r) => !r.template) || notLinked.find((r) => parentId(r.id) === level);
    if (first) first.asRoot = true;
  }
  const id = levelPage(level);
  return {
    level,
    id,
    title: titleOf(files, id),
    path: pathOfId(id),
    own: on ? { ...row(id), seg: '/', self: true } : null,
    canOwn:
      !!level &&
      !isTemplate(level) &&
      !FIXED.includes(level) &&
      inFolder.some((p) => !isTemplate(p)),
    sub,
    notLinked,
    total: all.length,
  };
}

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
