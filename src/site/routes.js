/**
 * Every page of the site, derived from content. The prerender step writes one
 * static HTML file per route; the client router fetches those same files.
 *
 * Routes come from content/en/pages/: every page is a folder, its URL, with the page's own
 * file index.json inside (page ids: "home", "people", "people/whatever", "people/[person]"):
 *
 *   pages/index.json                     /                 home (pages/404/index.json is 404.html)
 *   pages/people/index.json              /people/
 *   pages/people/whatever/index.json     /people/whatever/ a fixed page; when an item has the
 *                                                          same slug, this one wins over the template
 *   pages/people/[person]/index.json     /people/<slug>/   a template ([param] folder): one page per
 *                                                          item of its source
 *                                                          ({ "template": { "source": "people" } })
 *   pages/people/[person]/[year]/index.json
 *                                        /people/<slug>/<year>/  a template in a template: for
 *                                                          each page of the one around it, one per
 *                                                          item of its own source
 *
 * Params: a template's folder name is its param ("[person]": person), its URL part the item's
 * slug, or with "key" in its template the value of that field ({ "source": "photos", "key":
 * "year" }: one page per year, the year's first item its item). In a template inside another,
 * the items are those whose field named after an outer param (a "person" field) holds that
 * page's slug or its item's id, when the source has such a field; else all of them. A [param]
 * folder holds only its page and maybe one more [param] folder. Item pages get `params`
 * ({ person: "eeliya", year: "2018" }), `items` (each param's item) and `album` (their own).
 *
 * A folder's own page can be turned off ("ownPage": false in its index.json): its URL then
 * redirects (302) to its first sub page, the first one in the menu (nav.json) or else the first
 * in the folder: the route keeps its path for the editor, gets `redirect` (that page's path),
 * links to it go straight there (hrefs.js), and the build writes a redirect instead of the page.
 *
 * Folders nest to any depth. Every page is its list of sections of blocks (src/site/layout/). Its
 * "view" (the class of <main> and <html data-page>, for the styles) is its "view" field,
 * else the built-in name of the same page (home, photography, people, places, projects,
 * about, 404), else "page"; templates default to "album" (no footer).
 *
 * Search and share meta (src/site/seo.js): a page's title is its meta.title, else its first
 * heading's title, else its folder name, in the site's titleTemplate (home: meta.title, else
 * site.title, in full); description, image, canonical and noindex come from its "meta".
 * A [param] page: "<item name> | <section>", the item's body and cover, else the template's
 * meta.description / meta.image; its meta.noindex keeps every item page out.
 * Routes with noindex (404, meta.noindex, items with "placeholder": true, or site.json
 * "robots": "noindex") get <meta name="robots" content="noindex"> and stay out of sitemap.xml.
 */
import { isParam, isSlug, isTemplate, pageFile, paramOf, sourceFile } from './files.js';
import { coverOf, editRef, itemSlug, slugify } from './helpers.js';
import { itemTitle, schemaOf } from './schemas.js';
import { fillTitle } from './seo.js';
import { curtainMode } from '../client/anim/curtain.js';
import { blocksOf } from './layout/ids.js';
import { isBinding } from './layout/bindings.js';

/** Curtain label shown during page transitions. Explicit "" means no text; missing falls back to the title. */
function curtainOf(explicit, title) {
  if (explicit !== undefined && explicit !== null) return String(explicit);
  return String(title || '')
    .split('|')[0]
    .trim();
}

/** Views (style hooks) of pages named after them. */
export const NAMED_VIEWS = {
  home: 'home',
  photography: 'photography',
  'photography/people': 'people',
  'photography/places': 'places',
  projects: 'projects',
  about: 'about',
  404: 'notFound',
};

/**
 * A page's path: "about" -> "/about/", "home" -> "/"; a template's is its pattern, a param as
 * ":name": "people/[person]" -> "/people/:person/" (the redirects' patterns read the same).
 */
export const pathOfId = (id) =>
  id === 'home' || id === ''
    ? '/'
    : `/${id
        .split('/')
        .map((s) => (isParam(s) ? `:${paramOf(s)}` : s))
        .join('/')}/`;

/** A page's title: its first heading block's title (blocks/pages.js), else undefined. */
export const pageTitle = (page) => {
  const title = blocksOf(page).find((b) => b?.type === 'heading')?.title;
  // a bound title (layout/bindings.js) names the item, not the page
  return typeof title === 'string' && !isBinding(title) ? title : undefined;
};

/** "photography/people" -> "photography", "about" -> "" (home's folder). */
export const parentId = (id) => (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '');

/** The page ids the menu (nav.json "header") links to, in its order (children after their item). */
export function navOrder(nav) {
  const out = [];
  const walk = (list) => {
    for (const item of Array.isArray(list) ? list : []) {
      if (typeof item?.page === 'string') out.push(item.page);
      walk(item?.children);
    }
  };
  walk(nav?.header);
  return out;
}

/** "photo-walks" → "Photo Walks": a name from a slug. */
export const titleCase = (s) =>
  String(s)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** A [param] page's section label: its folder's page title ("People"), else its source's name. */
export const templateSection = (folderPage, source) =>
  pageTitle(folderPage || {}) || titleCase(source);

/** Page ids in tree order: home first, 404 last, a page before the pages in its folder, templates last. */
const byTree = (a, b) => {
  const rank = (id) => (id === 'home' ? 0 : id === '404' ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const pa = a.split('/').map((s) => (isParam(s) ? '\uffff' : s));
  const pb = b.split('/').map((s) => (isParam(s) ? '\uffff' : s));
  for (let i = 0; i < Math.min(pa.length, pb.length); i++)
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return pa.length - pb.length;
};

/**
 * Every route has its curtain text (curtain, curtainEdit) and its page transition
 * (transition, transitionEdit): where it is stored next to that text. The transition says
 * which curtain plays when navigating to the page: see curtainFor in client/anim/curtain.js.
 *
 * Returns { routes, warnings }: warnings are content problems (a template without a
 * source, items without or with duplicate slugs); those items get no page.
 */
export function buildRoutes(content) {
  const { site = {}, pages = {}, sources = {}, nav = {} } = content;
  const warnings = [];
  const siteNoindex = site.robots === 'noindex';
  const ids = Object.keys(pages).sort(byTree);
  const exists = new Set(ids);
  const routes = [];
  const memo = new Map();

  // Curtain text and transition of a page live in its own file, content/en/pages/<id>/index.json.
  const pageCurtain = (id, title) => ({
    curtain: curtainOf(pages[id]?.curtainText, title),
    curtainEdit: editRef(pageFile(id), ['curtainText']),
    transition: pages[id]?.transition,
    transitionEdit: editRef(pageFile(id), ['transition']),
  });

  for (const id of ids) {
    const page = pages[id] || {};
    const segments = id.split('/');
    if (isTemplate(id)) {
      routes.push(...instancesOf(id).map((at) => itemRoute(id, page, at)));
      continue;
    }
    if (segments.some(isParam)) {
      warnings.push(`${pageFile(id)}: a [param] folder holds only another [param] folder: no page`);
      continue;
    }
    const meta = page.meta || {};
    const title =
      id === 'home'
        ? meta.title || site.title
        : fillTitle(site, meta.title || pageTitle(page) || titleCase(segments.at(-1)));
    routes.push({
      path: pathOfId(id),
      id,
      pid: page.id,
      page: page.view || NAMED_VIEWS[id] || 'page',
      ...(id === '404' ? { out: '404.html' } : {}),
      title,
      description: meta.description || site.description,
      image: meta.image || undefined,
      canonical: meta.canonical || undefined,
      noindex: siteNoindex || id === '404' || !!meta.noindex,
      ...pageCurtain(id, title),
    });
  }
  // folders without their own page: their first sub page (in the menu's order, else the tree's)
  const order = navOrder(nav);
  const rankOf = (pid) => (order.includes(pid) ? order.indexOf(pid) : Infinity);
  for (const r of routes) {
    if (r.template || pages[r.id]?.ownPage !== false) continue;
    const subs = routes
      .filter((s) => !s.template && s.id !== r.id && parentId(s.id) === r.id)
      .sort((a, b) => rankOf(a.pid) - rankOf(b.pid));
    if (!subs.length) {
      warnings.push(`${pageFile(r.id)}: "ownPage": false, but it has no sub page to open: kept`);
      continue;
    }
    Object.assign(r, { redirect: subs[0].path, noindex: true });
  }
  return { routes, warnings };

  /**
   * The pages of template `id`, memoized: [{ path, params, items, item, index, slug, parent,
   * parentName }], for every page of the folder around it (one, or a template's pages).
   */
  function instancesOf(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, []); // a loop can't recurse
    const out = [];
    const up = parentId(id);
    const file = pageFile(id);
    const tpl = pages[id] || {};
    const { source, key } = tpl.template || {};
    const list = sources[source];
    const outer = isTemplate(up)
      ? instancesOf(up)
      : [{ path: pathOfId(up || 'home'), params: {}, items: {} }];
    if (!up) warnings.push(`${file}: no [param] folder at the root: no pages`);
    else if (!Array.isArray(list))
      warnings.push(`${file}: template.source "${source ?? ''}" is not a source list`);
    if (!up || !Array.isArray(list)) return out;
    const schema = schemaOf(content, source);
    const fields = new Set((schema.fields || []).map((f) => f.key));
    const param = paramOf(id.split('/').at(-1));
    for (const at of outer) {
      // in a template in a template: the items that name the outer pages (a "person" field)
      const mine = (item) =>
        Object.entries(at.params).every(
          ([p, slug]) =>
            !fields.has(p) || [slug, at.items[p]?.id].includes(String(item?.[p] ?? '')),
        );
      const seen = new Set();
      list.forEach((item, index) => {
        if (!mine(item)) return;
        const label = `sources/${source}.json item ${index + 1}`;
        const slug = key ? slugify(String(item?.[key] ?? '')) : itemSlug(item, schema);
        if (!slug) {
          if (key) return warnings.push(`${label}: no "${key}" for ${pathOfId(id)}: no page`);
          const name = itemTitle(item, schema);
          return warnings.push(
            name
              ? `${label}: name "${name}" makes no slug, add a "${schema.slug || 'slug'}": no page`
              : `${label} has no slug or name: no page`,
          );
        }
        if (!isSlug(slug)) return warnings.push(`${label}: slug "${slug}" is not valid: no page`);
        if (seen.has(slug)) {
          // keyed: one page per value, its first item; by slug: two items, one URL
          if (!key) warnings.push(`${label}: duplicate slug "${slug}": no page for this one`);
          return;
        }
        seen.add(slug);
        if (exists.has(`${up}/${slug}`)) return; // a fixed page wins over the template
        out.push({
          name: (key ? String(item[key]) : itemTitle(item, schema)) ?? slug,
          path: `${at.path}${slug}/`,
          params: { ...at.params, [param]: slug },
          items: { ...at.items, [param]: item },
          item,
          index,
          slug,
          parent: at.path,
          parentName: at.name,
        });
      });
    }
    memo.set(id, out);
    return out;
  }

  function itemRoute(id, tpl, at) {
    const file = pageFile(id);
    const source = tpl.template?.source;
    const meta = tpl.meta || {}; // defaults of its item pages
    // its section: the page around it ("People"), or in a template the item around it
    const section = at.parentName ?? templateSection(pages[parentId(id)], source);
    const { item, index, slug, name } = at;
    const title = fillTitle(site, `${name} | ${section}`);
    return {
      path: at.path,
      id,
      page: tpl.view || 'album',
      template: file,
      source,
      kind: source,
      slug,
      params: at.params,
      items: at.items,
      name,
      parent: at.parent,
      section,
      album: item,
      index,
      file: sourceFile(source),
      title,
      description: item.body || meta.description || site.description,
      image: coverOf(item) || meta.image || undefined,
      // Placeholder items (stock photos) are not for search engines: noindex, no sitemap.
      noindex: siteNoindex || !!meta.noindex || !!item.placeholder,
      curtain: curtainOf(item.curtainText, title),
      curtainEdit: editRef(sourceFile(source), ['items', index, 'curtainText']),
      // one curtain choice for every item page: its template's
      transition: tpl.transition,
      transitionEdit: editRef(file, ['transition']),
    };
  }
}

/** sitemap.xml: every route except the noindex ones (404, placeholder items, meta.noindex). */
export function sitemapXml(routes, siteUrl) {
  const urls = routes
    .filter((r) => !r.noindex)
    .map((r) => `  <url><loc>${siteUrl}${r.path}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Every route of the site (see buildRoutes). */
export const getRoutes = (content) => buildRoutes(content).routes;

/** Pages with their own curtain or none: { "/about/": { mode: 'off' }, ... } for the router. */
export function curtainOverrides(routes) {
  return Object.fromEntries(
    routes.filter((r) => curtainMode(r.transition) !== 'global').map((r) => [r.path, r.transition]),
  );
}
