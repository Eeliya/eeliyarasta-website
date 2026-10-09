/**
 * Every page of the site, derived from content. The prerender step writes one
 * static HTML file per route; the client router fetches those same files.
 *
 * Routes come from content/pages/: every page is a folder, its URL, with the page's own
 * file index.json inside (page ids: "home", "people", "people/whatever", "people/[slug]"):
 *
 *   pages/index.json                   /                  home (pages/404/index.json is 404.html)
 *   pages/people/index.json            /people/
 *   pages/people/[slug].json           /people/<slug>/    a template: one page per item of its
 *                                                         source ({ "config": { "source": "people" } })
 *   pages/people/whatever/index.json   /people/whatever/  a fixed page; when an item has the same
 *                                                         slug, this one wins over the template
 *
 * Folders nest to any depth. A page uses the view named in its "view" field, else the
 * built-in view of the same name (home, photography, people, places, projects, about,
 * 404), else the plain "page" view (just its heading); templates default to "album".
 */
import { TEMPLATE, isSlug, pageFile, sourceFile } from './files.js';
import { coverOf, itemSlug } from './helpers.js';
import { curtainMode } from '../client/anim/curtain.js';

/** Curtain label shown during page transitions. Explicit "" means no text; missing falls back to the title. */
function curtainOf(explicit, title) {
  if (explicit !== undefined && explicit !== null) return String(explicit);
  return String(title || '')
    .split('|')[0]
    .trim();
}

/** Edit pointer ("file#/json/pointer") of a page value, e.g. its curtain text. */
function curtainEditOf(file, parts) {
  const ptr = parts.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
  return `${file}#${ptr}`;
}

/** Built-in views of pages named after them (src/site/templates/). */
export const NAMED_VIEWS = {
  home: 'home',
  photography: 'photography',
  people: 'people',
  places: 'places',
  projects: 'projects',
  about: 'about',
  404: 'notFound',
};

/** "people/[slug]" -> "/people/", "about" -> "/about/", "home" -> "/". */
export const pathOfId = (id) =>
  id === 'home' ? '/' : `/${id.replace(/(^|\/)\[slug\]$/, '')}/`.replace(/\/+$/, '/');

const titleCase = (s) =>
  String(s)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Page ids in tree order: home first, 404 last, a page before the pages in its folder, templates last. */
const byTree = (a, b) => {
  const rank = (id) => (id === 'home' ? 0 : id === '404' ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const pa = a.split('/').map((s) => (s === TEMPLATE ? '\uffff' : s));
  const pb = b.split('/').map((s) => (s === TEMPLATE ? '\uffff' : s));
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
  const { site, pages = {}, sources = {} } = content;
  const warnings = [];
  const ids = Object.keys(pages).sort(byTree);
  const exists = new Set(ids);
  const routes = [];

  // Curtain text and transition of a page live in its own file, content/pages/<id>/index.json.
  const pageCurtain = (id, title) => ({
    curtain: curtainOf(pages[id]?.curtain, title),
    curtainEdit: curtainEditOf(pageFile(id), ['curtain']),
    transition: pages[id]?.transition,
    transitionEdit: curtainEditOf(pageFile(id), ['transition']),
  });

  for (const id of ids) {
    const page = pages[id] || {};
    const segments = id.split('/');
    if (segments.at(-1) === TEMPLATE) {
      routes.push(...templateRoutes(id, page));
      continue;
    }
    const meta = page.meta || {};
    const title =
      id === 'home'
        ? (meta.title ?? site.title)
        : `${meta.title ?? page.title ?? titleCase(segments.at(-1))} | ${site.name}`;
    routes.push({
      path: pathOfId(id),
      id,
      page: page.view || NAMED_VIEWS[id] || 'page',
      ...(id === '404' ? { out: '404.html', noindex: true } : {}),
      title,
      description: meta.description ?? site.description,
      ...pageCurtain(id, title),
    });
  }
  return { routes, warnings };

  function templateRoutes(id, tpl) {
    const file = pageFile(id);
    const parent = pathOfId(id);
    const folder = id.slice(0, -TEMPLATE.length); // "people/"
    const source = tpl.config?.source;
    const list = sources[source];
    if (!Array.isArray(list)) {
      warnings.push(`${file}: config.source "${source ?? ''}" is not a source list`);
      return [];
    }
    const section = tpl.section ?? titleCase(source);
    const seen = new Set();
    const items = [];
    list.forEach((item, index) => {
      const slug = itemSlug(item);
      const label = `sources/${source}.json item ${index + 1}`;
      if (!slug) return warnings.push(`${label} has no slug or name: no page`);
      if (!isSlug(slug)) return warnings.push(`${label}: slug "${slug}" is not valid: no page`);
      if (seen.has(slug))
        return warnings.push(`${label}: duplicate slug "${slug}": no page for this one`);
      seen.add(slug);
      items.push({ item, index, slug, path: `${parent}${slug}/` });
    });
    return items
      .filter(({ slug }) => !exists.has(folder + slug)) // a fixed page wins over the template
      .map(({ item, index, slug, path }) => {
        const k = items.findIndex((x) => x.item === item);
        const next = items[(k + 1) % items.length];
        const title = `${item.name ?? item.title ?? slug} | ${section} | ${site.name}`;
        return {
          path,
          id,
          page: tpl.view || 'album',
          template: file,
          source,
          kind: source,
          slug,
          parent,
          section,
          nextLabel: tpl.next ?? 'Next',
          album: item,
          index,
          file: sourceFile(source),
          next: next.item,
          nextPath: next.path,
          title,
          description: item.summary,
          image: coverOf(item)?.src,
          curtain: curtainOf(item.curtain, title),
          curtainEdit: curtainEditOf(sourceFile(source), [index, 'curtain']),
          transition: item.transition,
          transitionEdit: curtainEditOf(sourceFile(source), [index, 'transition']),
        };
      });
  }
}

/** Every route of the site (see buildRoutes). */
export const getRoutes = (content) => buildRoutes(content).routes;

/** Pages with their own curtain or none: { "/about/": { mode: 'off' }, ... } for the router. */
export function curtainOverrides(routes) {
  return Object.fromEntries(
    routes.filter((r) => curtainMode(r.transition) !== 'global').map((r) => [r.path, r.transition]),
  );
}
