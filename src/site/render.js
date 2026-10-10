/**
 * Render a route to { head, body } HTML strings.
 * Used by the Vite plugin (dev middleware + build-time prerender).
 * Every page is its file's list of sections (sections/index.js); a [slug] page's are in its
 * template file, rendered for the route's item.
 */
import { accentOf, setEditable } from './helpers.js';
import { head, body } from './templates/layout.js';
import { renderSections } from './sections/index.js';
import { pageFile } from './files.js';
import { getRoutes, buildRoutes, curtainOverrides, sitemapXml } from './routes.js';

export { getRoutes, buildRoutes, sitemapXml };
export { seoWarnings } from './seo.js';

/**
 * { head, body, lang } of a route; lang: <html lang>.
 * editable: render the editor's markers (the dev server), see setEditable in helpers.js. */
export function renderRoute(route, content, { editable = false } = {}) {
  setEditable(editable);
  // curtains: every page carries the pages with their own curtain, for the router.
  // routes: links to source items go to their pages (itemHref in helpers.js).
  const routes = getRoutes(content);
  const ctx = { ...content, route, routes, curtains: curtainOverrides(routes) };
  const file = pageFile(route.id);
  const view = renderSections(ctx, route, file, content.pages[route.id]?.sections);
  const accent = route.album ? accentOf(ctx, route.album) : content.site.accent;
  return {
    head: head(ctx, route, accent),
    body: body(ctx, route, accent, view, file),
    lang: content.site.lang || 'en',
  };
}
