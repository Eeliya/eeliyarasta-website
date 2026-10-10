/**
 * Search and share meta of a page: what <head> says about it (templates/layout.js), what the
 * editor's SEO previews show, and the build's [seo] warnings.
 *
 * Site defaults live in content/settings/site.json:
 *   title          home's title (in full)
 *   titleTemplate  every other page's title: "{page}" is the page's own title, "{site}" the
 *                  site name ("{page} | {site}", the default)
 *   description    the description of pages without their own
 *   ogImage        the share image of pages without their own
 *   url            the site's address: canonical links, og:url, sitemap.xml
 *   robots         "index" (default) or "noindex": keeps the whole site out of search engines
 *   lang           <html lang>
 * A page's own, in its file's "meta" (src/site/routes.js reads them into its route):
 *   title, description, image (a photo: media/ path or R2 key), noindex, canonical
 * [slug] pages: see routes.js (the item's name, summary and cover, then the template's meta).
 */
import { altOf, isExternal, mediaUrl, photoOf } from './helpers.js';

/** Search engines show about this much of a title / description. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** The site's address without a trailing slash. */
export const siteBase = (site) => String(site?.url || '').replace(/\/+$/, '');

/** A path or URL made absolute on the site ("/about/" -> "https://eeliyarasta.com/about/"). */
export const absolute = (site, url) => (isExternal(url) ? url : siteBase(site) + url);

/** A page's title: the site's titleTemplate around the page's own title (route.js). */
export const fillTitle = (site, page) =>
  String(site?.titleTemplate || '{page} | {site}')
    .replaceAll('{page}', page)
    .replaceAll('{site}', site?.name ?? '');

/**
 * A share image: { url (absolute), width, height, alt } of photo `src` (media/ path, R2 key or
 * URL), the size of the file the URL points at (from the photo's sizes); null without one.
 */
export function shareImage(ctx, src) {
  if (!src) return null;
  const url = absolute(ctx.site, mediaUrl(ctx, src));
  const photo = photoOf(ctx, src);
  const size = photo?.srcset?.find((s) => absolute(ctx.site, s.url) === url);
  const width = size?.w || photo?.width;
  return {
    url,
    width,
    height: width && photo?.width ? Math.round((width * photo.height) / photo.width) : undefined,
    alt: altOf(ctx, src),
  };
}

/** Everything <head> says about `route`: { title, description, url, image, noindex }. */
export function seoOf(ctx, route) {
  const { site } = ctx;
  const path = route.out === '404.html' ? '/404' : route.path;
  return {
    title: route.title,
    description: route.description || '',
    url: absolute(site, route.canonical || path),
    image: shareImage(ctx, route.image || site.ogImage),
    noindex: !!route.noindex,
  };
}

/** Pages search engines index that need a look: no description, title or description too long. */
export function seoWarnings(routes) {
  return routes
    .filter((r) => !r.noindex)
    .flatMap((r) => [
      ...(r.description ? [] : [`${r.path}: no description (and no site default)`]),
      ...(r.title.length > TITLE_MAX
        ? [`${r.path}: title is ${r.title.length} characters (search shows ~${TITLE_MAX})`]
        : []),
      ...((r.description || '').length > DESCRIPTION_MAX
        ? [
            `${r.path}: description is ${r.description.length} characters (search shows ~${DESCRIPTION_MAX})`,
          ]
        : []),
    ]);
}
