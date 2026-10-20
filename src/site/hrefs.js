/**
 * Links in the content point at what they mean, not at a URL: the URL is made at build time.
 *
 *   { "page": "pg-k3x9" }                              a page, by its id (its file's "id")
 *   { "item": { "source": "people", "id": "p-k3x9" } } a source item's page, by the item's id
 *   { "href": "https://…" }                            anything else: a full URL, mailto:, #anchor
 *
 * So renaming or moving a page, or changing an item's slug, never breaks a link (redirects, the
 * one place paths stay, are for the outside world). A link field bound to an item's link
 * field ({ "bind" }, bindings.js) resolves to that field's text, which is used as the URL.
 * Menu items (nav.json) are links too: { label, page | item | href, ... }.
 */
import { isId } from './layout/ids.js';
import { isSlug } from './files.js';
import { itemHref, warnOnce } from './helpers.js';
import { isObject } from './is.js';

const KINDS = ['page', 'item', 'href'];

/**
 * Is `href` a URL a link may have: http(s):, mailto:, tel:, or one without a scheme (a path,
 * #anchor, ?query). javascript:, data:, vbscript: and the like are not (also hidden behind
 * whitespace, control characters or odd case: browsers ignore those).
 */
export function isSafeHref(href) {
  if (typeof href !== 'string') return false;
  // eslint-disable-next-line no-control-regex -- the control characters browsers skip
  const s = href.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase());
}
export const UNSAFE_HREF =
  'a link must be a web address (https://…), mailto:, tel:, a path (/about/) or #anchor';

/** Which kind of link `v` holds ('page' | 'item' | 'href'), or null. */
export const linkKind = (v) =>
  isObject(v) ? (KINDS.filter((k) => v[k] !== undefined)[0] ?? null) : null;

/**
 * What's wrong with the shape of a link (`v`: the link, or a menu item holding one): null when
 * fine. `extra`: other keys `v` may have (a menu item's label, children, ...).
 */
export function linkProblem(v, extra = []) {
  if (!isObject(v)) return 'a link: { "page" }, { "item" } or { "href" }';
  const kinds = KINDS.filter((k) => v[k] !== undefined);
  if (kinds.length !== 1) return 'one of "page" (a page id), "item" ({ source, id }) or "href"';
  const others = Object.keys(v).filter((k) => !KINDS.includes(k) && !extra.includes(k));
  if (others.length) return `a link has no "${others[0]}"`;
  if (kinds[0] === 'page' && !isId(v.page, 'pg')) return `"page" must be a page id ("pg-k3x9")`;
  if (kinds[0] === 'item' && !(isObject(v.item) && isSlug(v.item.source) && isId(v.item.id, 'p')))
    return '"item" must be { "source": "<source>", "id": "<item id>" }';
  if (kinds[0] === 'href' && typeof v.href !== 'string') return '"href" must be a text';
  if (kinds[0] === 'href' && !isSafeHref(v.href)) return UNSAFE_HREF;
  return null;
}

/** The page route of a page id (ctx.routes: fixed pages only; [param] pages have no one URL). */
export const pageRoute = (ctx, id) =>
  (ctx.routes || []).find((r) => r.pid === id && !r.template) || null;

/**
 * The URL of a link: a page's path, an item page's path, or the href as it is. '' for no
 * link; '#' (and a build warning naming `where`) for a page or item that isn't there.
 */
export function hrefOf(ctx, link, where = 'a link') {
  // bound: the item's own link text; never an unsafe URL (javascript:, …)
  const safe = (href) => {
    if (isSafeHref(href)) return href;
    warnOnce(`${where} has an unsafe URL: "#"`, 'links');
    return '#';
  };
  if (typeof link === 'string') return safe(link);
  switch (linkKind(link)) {
    case 'href':
      return safe(String(link.href));
    case 'page': {
      const r = pageRoute(ctx, link.page);
      if (r) return r.redirect || r.path; // a folder without its own page: its first sub page
      warnOnce(`${where} points at page "${link.page}", which is no page: "#"`, 'links');
      return '#';
    }
    case 'item': {
      const { source, id } = link.item || {};
      const list = ctx.sources?.[source];
      const item = Array.isArray(list) ? list.find((it) => it?.id === id) : null;
      if (item) return itemHref(ctx, source, item);
      warnOnce(`${where} points at item "${id}" of "${source}", which isn't there: "#"`, 'links');
      return '#';
    }
    default:
      return '';
  }
}
