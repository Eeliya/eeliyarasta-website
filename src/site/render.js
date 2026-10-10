/**
 * Render a route to { head, body } HTML strings.
 * Used by the Vite plugin (dev middleware + build-time prerender).
 */
import { accentOf } from './helpers.js';
import { head, body } from './templates/layout.js';
import { home } from './templates/home.js';
import { album } from './templates/album.js';
import * as pages from './templates/pages.js';
import { getRoutes, buildRoutes, curtainOverrides, sitemapXml } from './routes.js';

const views = { home, album, ...pages };

export { getRoutes, buildRoutes, sitemapXml };

export function renderRoute(route, content) {
  // curtains: every page carries the pages with their own curtain, for the router.
  // routes: links to source items go to their pages (itemHref in helpers.js).
  const routes = getRoutes(content);
  const ctx = { ...content, route, routes, curtains: curtainOverrides(routes) };
  const view = views[route.page];
  if (!view) throw new Error(`No template for page "${route.page}"`);
  const accent = route.album ? accentOf(ctx, route.album) : content.site.accent;
  return { head: head(ctx, route, accent), body: body(ctx, route, accent, view(ctx, route)) };
}
