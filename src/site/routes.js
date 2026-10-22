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
 *   pages/people/[person]/index.json     /people/<slug>/   a [param] page: one page per item its
 *                                                          main widget matches
 *   pages/people/[person]/[year]/index.json
 *                                        /people/<slug>/<year>/  a [param] page in a [param]
 *                                                          page: for each page of the one
 *                                                          around it, one per value of its own
 *
 * Which pages a [param] page has: its main widget decides ("main": "<widget id>", a From URL
 * widget, layout/source.js). Each param of the address matches a field of the main widget's
 * source (its rule, src/site/query.js); its pages: for each page of the folder around it, the
 * items that match the params above, one page per value of its own param's field among them
 * (a URL part: the slug, or the value slugified), the first of those its item. A page exists
 * when at least one item matches; no main widget, or a param without a field to match: no pages
 * (a warning). A [param] folder holds only its page and maybe one more [param] folder. Item
 * pages get `params` ({ person: "eeliya", year: "2018" }), `items` (each param's item), `album`
 * (their own), `source` (the main widget's), `count` (how many items match) and `members` (their
 * ids: an item's link goes to the page it is on).
 *
 * A folder's own page can be turned off ("ownPage": false in its index.json): its URL then
 * redirects (302) to its first sub page, the first one in the menu (nav.json) or else the first
 * in the folder: the route keeps its path for the editor, gets `redirect` (that page's path),
 * links to it go straight there (hrefs.js), and the build writes a redirect instead of the page.
 *
 * Folders nest to any depth. Every page is its list of sections of widgets (src/site/layout/). Its
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
import { coverOf, editRef } from './helpers.js';
import { itemTitle, schemaOf } from './schemas.js';
import { fillTitle } from './seo.js';
import { curtainMode } from '../client/anim/curtain.js';
import { widgetsOf } from './layout/ids.js';
import { lineText } from './text.js';
import { mainOf, mainProblem, refsOf, sourceOf } from './layout/source.js';
import { hasField, query, ruleOf, valueOf, SLUG } from './query.js';

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

/**
 * A page's title: the first title line of its first Text widget with one (widgets/basic.js),
 * else undefined. A title with a field in it names the item, not the page: none.
 */
export const pageTitle = (page) => {
  for (const b of widgetsOf(page))
    if (b?.type === 'text' && Array.isArray(b.body) && b.body.some((l) => l?.style === 'title'))
      return lineText(b.body, 'title');
  return undefined;
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
 * Returns { routes, warnings }: warnings are content problems (a [param] page whose main widget
 * can't decide its pages, items whose value makes no URL part); those get no page.
 *
 * unbuilt (the editor and its preview): a [param] page that builds no pages still gets routes
 * to edit it on, marked `unbuilt` (noindex): with the main widget's rules that can match (a
 * broken one left out); its own param without one, one per page around it at its pattern
 * ("/people/noor/:year/", its first item); no main widget to go by, one at its pattern
 * ("/people/:person/", no item).
 */
export function buildRoutes(content, { unbuilt = false } = {}) {
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
   * The pages of [param] page `id`, memoized: [{ path, params, items, item, index, slug, count,
   * source, parent, parentName, name }], for every page of the folder around it (one, or a
   * [param] page's pages): see the top of this file.
   */
  function instancesOf(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, []); // a loop can't recurse
    const out = [];
    const up = parentId(id);
    const file = pageFile(id);
    if (!up) {
      warnings.push(`${file}: no [param] folder at the root: no pages`);
      return out;
    }
    const problem = mainProblem(content, id);
    if (problem) warnings.push(`${file}: ${problem.message}`);
    const outer = isTemplate(up)
      ? instancesOf(up)
      : [{ path: pathOfId(up), params: {}, items: {} }];
    const s = sourceOf(mainOf(pages[id]));
    const list = sources[s?.from];
    const param = paramOf(id.split('/').at(-1));
    // in the editor: somewhere to edit it, even without an item
    const pattern = () => {
      if (!out.length)
        out.push({ path: pathOfId(id), params: {}, items: {}, item: null, unbuilt: true });
      memo.set(id, out);
      return out;
    };
    if (
      problem &&
      (!unbuilt || problem.kind === 'none' || problem.kind === 'mode' || problem.kind === 'source')
    )
      return unbuilt ? pattern() : (memo.set(id, out), out);
    const schema = schemaOf(content, s.from);
    // unbuilt: the rules that can match (a param without one doesn't filter)
    const where = problem
      ? { ...s.where, rules: s.where.rules.filter((r) => hasField(schema, r.field)) }
      : s.where;
    const field = ruleOf(where, param)?.field;
    for (const at of outer) {
      // the items of the page around it (its params), then one page per value of this param
      const mine = query(list, where, at.params, { schema, refs: refsOf(at) });
      if (!field) {
        // unbuilt, its own param matching nothing: one page to edit it on, at its pattern
        // under the page around it ("/people/noor/:year/"), its first item shown
        const item = mine[0] ?? null;
        out.push({
          name: `[${param}]`,
          path: `${at.path}:${param}/`,
          params: { ...at.params },
          items: { ...at.items },
          item,
          index: item ? list.indexOf(item) : -1,
          count: mine.length,
          members: [],
          source: s.from,
          parent: at.path,
          parentName: at.name,
          unbuilt: true,
        });
        continue;
      }
      const groups = new Map();
      for (const item of mine) {
        const slug = valueOf(item, field, schema);
        const index = list.indexOf(item);
        const label = `sources/${s.from}.json item ${index + 1}`;
        if (!slug) {
          const name = itemTitle(item, schema);
          if (field !== SLUG) warnings.push(`${label}: no "${field}" for ${pathOfId(id)}: no page`);
          else if (name)
            warnings.push(
              `${label}: name "${name}" makes no slug, add a "${schema.slug || 'slug'}": no page`,
            );
          else warnings.push(`${label} has no slug or name: no page`);
          continue;
        }
        if (!isSlug(slug)) {
          warnings.push(`${label}: "${slug}" is not a valid URL part: no page`);
          continue;
        }
        // by slug, one item per page: a second with the same slug is a mistake
        if (field === SLUG && groups.has(slug))
          warnings.push(`${label}: duplicate slug "${slug}": its page shows the first`);
        if (!groups.has(slug)) groups.set(slug, []);
        groups.get(slug).push(item);
      }
      for (const [slug, matched] of groups) {
        if (exists.has(`${up}/${slug}`)) continue; // a fixed page wins over the [param] page
        const item = matched[0];
        out.push({
          // by its slug: the item's name; by another field: its value ("2018")
          name: (field === SLUG ? itemTitle(item, schema) : String(item[field])) ?? slug,
          path: `${at.path}${slug}/`,
          params: { ...at.params, [param]: slug },
          items: { ...at.items, [param]: item },
          item,
          index: list.indexOf(item),
          slug,
          count: matched.length,
          members: matched.map((it) => it?.id).filter(Boolean),
          source: s.from,
          parent: at.path,
          parentName: at.name,
          ...(problem || at.unbuilt ? { unbuilt: true } : {}),
        });
      }
    }
    if (unbuilt && !out.length) return pattern();
    memo.set(id, out);
    return out;
  }

  function itemRoute(id, tpl, at) {
    const file = pageFile(id);
    const { source } = at;
    const meta = tpl.meta || {}; // defaults of its item pages
    // its section: the page around it ("People"), or in a template the item around it
    const section = at.parentName ?? templateSection(pages[parentId(id)], source);
    const { index, slug, count } = at;
    const item = at.item || {}; // unbuilt at its pattern: no item
    const name = at.name ?? id.split('/').at(-1);
    const title = fillTitle(site, `${name} | ${section}`);
    return {
      ...(at.unbuilt ? { unbuilt: true } : {}),
      path: at.path,
      id,
      page: tpl.view || 'album',
      template: file,
      source,
      kind: source,
      slug,
      count,
      members: at.members,
      params: at.params,
      items: at.items,
      name,
      parent: at.parent,
      section,
      album: at.item,
      index,
      file: source ? sourceFile(source) : undefined,
      title,
      description: item.body || meta.description || site.description,
      image: coverOf(item) || meta.image || undefined,
      // Placeholder items (stock photos) are not for search engines: noindex, no sitemap.
      noindex: siteNoindex || !!meta.noindex || !!item.placeholder || !!at.unbuilt,
      curtain: curtainOf(item.curtainText, title),
      curtainEdit: at.item ? editRef(sourceFile(source), ['items', index, 'curtainText']) : '',
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
export const getRoutes = (content, opts) => buildRoutes(content, opts).routes;

/** Pages with their own curtain or none: { "/about/": { mode: 'off' }, ... } for the router. */
export function curtainOverrides(routes) {
  return Object.fromEntries(
    routes.filter((r) => curtainMode(r.transition) !== 'global').map((r) => [r.path, r.transition]),
  );
}
