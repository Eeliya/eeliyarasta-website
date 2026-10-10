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
 * Folders nest to any depth. Every page is its list of sections of blocks (src/site/layout/). Its
 * "view" (the class of <main> and <html data-page>, for the styles) is its "view" field,
 * else the built-in name of the same page (home, photography, people, places, projects,
 * about, 404), else "page"; templates default to "album" (no footer).
 *
 * Search and share meta (src/site/seo.js): a page's title is its meta.title, else its first
 * heading's title, else its folder name, in the site's titleTemplate (home: meta.title, else
 * site.title, in full); description, image, canonical and noindex come from its "meta".
 * A [slug] page: "<item name> | <section>", the item's summary and cover, else the template's
 * meta.description / meta.image; its meta.noindex keeps every item page out.
 * Routes with noindex (404, meta.noindex, items with "placeholder": true, or site.json
 * "robots": "noindex") get <meta name="robots" content="noindex"> and stay out of sitemap.xml.
 */
import { TEMPLATE, isSlug, pageFile, sourceFile } from './files.js';
import { coverOf, itemSlug } from './helpers.js';
import { itemTitle, schemaOf } from './schemas.js';
import { fillTitle } from './seo.js';
import { curtainMode } from '../client/anim/curtain.js';
import { blocksOf } from './layout/ids.js';

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

/** Views (style hooks) of pages named after them. */
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

/** A page's title: its first heading block's title (blocks/pages.js), else undefined. */
export const pageTitle = (page) => blocksOf(page).find((b) => b?.type === 'heading')?.title;

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
  const { site = {}, pages = {}, sources = {} } = content;
  const warnings = [];
  const siteNoindex = site.robots === 'noindex';
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
        ? meta.title || site.title
        : fillTitle(site, meta.title || pageTitle(page) || titleCase(segments.at(-1)));
    routes.push({
      path: pathOfId(id),
      id,
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
    const schema = schemaOf(content, source);
    const meta = tpl.meta || {}; // defaults of its item pages
    const seen = new Set();
    const items = [];
    list.forEach((item, index) => {
      const slug = itemSlug(item, schema);
      const label = `sources/${source}.json item ${index + 1}`;
      if (!slug) {
        const name = itemTitle(item, schema);
        return warnings.push(
          name
            ? `${label}: name "${name}" makes no slug, add a "${schema.slug || 'slug'}": no page`
            : `${label} has no slug or name: no page`,
        );
      }
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
        const name = itemTitle(item, schema) ?? slug;
        const title = fillTitle(site, `${name} | ${section}`);
        return {
          path,
          id,
          page: tpl.view || 'album',
          template: file,
          source,
          kind: source,
          slug,
          name,
          parent,
          section,
          nextLabel: tpl.next ?? 'Next',
          album: item,
          index,
          file: sourceFile(source),
          next: next.item,
          nextPath: next.path,
          title,
          description: item.summary || meta.description || site.description,
          image: coverOf(item)?.src || meta.image || undefined,
          // Placeholder items (stock photos) are not for search engines: noindex, no sitemap.
          noindex: siteNoindex || !!meta.noindex || !!item.placeholder,
          curtain: curtainOf(item.curtain, title),
          curtainEdit: curtainEditOf(sourceFile(source), [index, 'curtain']),
          transition: item.transition,
          transitionEdit: curtainEditOf(sourceFile(source), [index, 'transition']),
        };
      });
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
