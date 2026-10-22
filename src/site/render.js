/**
 * Render a route to { head, body } HTML strings.
 * Used by the Vite plugin (dev middleware + build-time prerender).
 * Every page is its file's list of sections of widgets (layout/index.js); a [param] page's are
 * in its template file, rendered for the route's item.
 */
import { accentOf, setEditable, warnOnce } from './helpers.js';
import { head, body } from './templates/layout.js';
import { renderSections, renderSection, headingNumbers, sectionAnchor } from './layout/index.js';
import { docKindOf, docOf, pageFile } from './files.js';
import { bindingProblems } from './layout/bindings.js';
import { motionProblems } from './layout/motion.js';
import { WIDGET_TYPES } from './widgets/index.js';
import { BACKDROP, renderBackdrop } from './backdrop.js';
import { getRoutes, buildRoutes, curtainOverrides, sitemapXml } from './routes.js';

export { getRoutes, buildRoutes, sitemapXml };
export { seoWarnings } from './seo.js';
export {
  buildRedirects,
  ownPageRedirects,
  pathsOf,
  redirectPage,
  redirectsText,
} from './redirects.js';

/** Schema-aware checks of the pages' bindings: [{ level, message }] (layout/bindings.js). */
export const bindingChecks = (content) => bindingProblems(content, { types: WIDGET_TYPES });

/** Widgets whose animation isn't in the library (or can't play on a widget): messages. */
export const motionChecks = (content) => motionProblems(content);

/**
 * { head, body, lang } of a route; lang: <html lang>.
 * editable: render the editor's markers (the dev server), see setEditable in helpers.js. */
export function renderRoute(route, content, { editable = false, unbuilt = false } = {}) {
  setEditable(editable);
  const ctx = contextOf(route, content, unbuilt);
  const file = pageFile(route.id);
  const page = content.pages[route.id];
  const view =
    renderBackdrop(ctx, page?.backdrop) + renderSections(ctx, route, file, page?.sections);
  const accent = route.album ? accentOf(ctx, route.album) : content.site.accent;
  const html = body(ctx, route, accent, view, file);
  anchorClashes(route, page?.sections, html);
  return { head: head(ctx, route, accent), body: html, lang: content.site.lang || 'en' };
}

/**
 * Warns about a section anchor (its name's id) that another element on the rendered page
 * also uses (a project row's slug, a form): its link would scroll to the first of them.
 * Two sections named alike are a validation error (src/site/validate.js).
 */
function anchorClashes(route, sections, html) {
  for (const s of Array.isArray(sections) ? sections : []) {
    const a = sectionAnchor(s);
    if (a && html.split(` id="${a}"`).length > 2)
      warnOnce(
        `${route.path}: section "${s.name}" (#${a}) shares its id with another element on the page`,
        'anchors',
      );
  }
}

/** What a page's widgets render with. */
function contextOf(route, content, unbuilt = false) {
  // curtains: every page carries the pages with their own curtain, for the router.
  // routes: links to source items go to their pages (itemHref in helpers.js); the editor's
  // preview: those of [param] pages that build none too (unbuilt, routes.js)
  const routes = getRoutes(content, { unbuilt });
  return { ...content, route, routes, curtains: curtainOverrides(routes) };
}

/**
 * The editor's HTML of the sections `ids` of a route's page, by id (the dev server's
 * /__editor/render, so the preview swaps sections without loading the page again). The id
 * BACKDROP ("__backdrop") is the page's backdrop ('' without one, src/site/backdrop.js).
 */
export { BACKDROP };

export function renderRouteSections(route, content, ids, file = pageFile(route.id)) {
  setEditable(true);
  const ctx = contextOf(route, content, true);
  const doc = docOf(content, file);
  const list = doc?.sections || [];
  const numbers = headingNumbers(list);
  const out = {};
  list.forEach((s, at) => {
    if (ids.includes(s?.id)) out[s.id] = renderSection(ctx, route, file, s, at, numbers);
  });
  if (ids.includes(BACKDROP) && docKindOf(file) === 'page')
    out[BACKDROP] = renderBackdrop(ctx, doc?.backdrop);
  return out;
}
