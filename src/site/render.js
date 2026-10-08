/**
 * Render a route to { head, body } HTML strings.
 * Used by the Vite plugin (dev middleware + build-time prerender).
 */
import { accentOf } from './helpers.js';
import { head, body } from './templates/layout.js';
import { home } from './templates/home.js';
import { album } from './templates/album.js';
import * as pages from './templates/pages.js';

const views = { home, album, ...pages };

export { getRoutes } from './routes.js';

export function renderRoute(route, content) {
  const ctx = { ...content, route };
  const view = views[route.page];
  if (!view) throw new Error(`No template for page "${route.page}"`);
  const accent = route.album ? accentOf(ctx, route.album) : content.site.accent;
  return { head: head(ctx, route, accent), body: body(ctx, route, accent, view(ctx, route)) };
}
