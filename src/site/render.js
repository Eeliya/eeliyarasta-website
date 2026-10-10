/**
 * Render a route to { head, body } HTML strings.
 * Used by the Vite plugin (dev middleware + build-time prerender).
 * Every page is its file's list of sections of blocks (layout/index.js); a [slug] page's are
 * in its template file, rendered for the route's item.
 */
import { accentOf, setEditable } from './helpers.js';
import { head, body } from './templates/layout.js';
import { renderSections, renderSection, headingNumbers } from './layout/index.js';
import { pageFile } from './files.js';
import { bindingProblems } from './layout/bindings.js';
import { BLOCK_TYPES } from './blocks/index.js';
import { getRoutes, buildRoutes, curtainOverrides, sitemapXml } from './routes.js';

export { getRoutes, buildRoutes, sitemapXml };
export { seoWarnings } from './seo.js';
export { buildRedirects, pathsOf, redirectsText } from './redirects.js';

/** Schema-aware checks of the pages' bindings: [{ level, message }] (layout/bindings.js). */
export const bindingChecks = (content, files = null) =>
  bindingProblems(content, { types: BLOCK_TYPES, pageFile, files });

/**
 * { head, body, lang } of a route; lang: <html lang>.
 * editable: render the editor's markers (the dev server), see setEditable in helpers.js. */
export function renderRoute(route, content, { editable = false } = {}) {
  setEditable(editable);
  const ctx = contextOf(route, content);
  const file = pageFile(route.id);
  const view = renderSections(ctx, route, file, content.pages[route.id]?.sections);
  const accent = route.album ? accentOf(ctx, route.album) : content.site.accent;
  return {
    head: head(ctx, route, accent),
    body: body(ctx, route, accent, view, file),
    lang: content.site.lang || 'en',
  };
}

/** What a page's blocks render with. */
function contextOf(route, content) {
  // curtains: every page carries the pages with their own curtain, for the router.
  // routes: links to source items go to their pages (itemHref in helpers.js).
  const routes = getRoutes(content);
  return { ...content, route, routes, curtains: curtainOverrides(routes) };
}

/**
 * The editor's HTML of the sections `ids` of a route's page, by id (the dev server's
 * /__editor/render, so the preview swaps sections without loading the page again).
 */
export function renderRouteSections(route, content, ids) {
  setEditable(true);
  const ctx = contextOf(route, content);
  const file = pageFile(route.id);
  const list = content.pages[route.id]?.sections || [];
  const numbers = headingNumbers(list);
  const out = {};
  list.forEach((s, at) => {
    if (ids.includes(s?.id)) out[s.id] = renderSection(ctx, route, file, s, at, numbers);
  });
  return out;
}
