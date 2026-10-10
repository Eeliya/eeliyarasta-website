/**
 * The header (logo, nav pill with click-to-open dropdowns, local time, menu toggle) and the
 * mobile menu, both from content/settings/nav.json "header": a list of items
 *
 *   { "label": "About", "page": "/about/" }                  a page, by its URL
 *   { "label": "Shop", "href": "https://…" }                 any other link (opens in a new tab)
 *   { "label": "Photography", "page": "/photography/", "all": "All photography",
 *     "children": [{ "label": "People", "page": "/people/", "items": "people" }, …] }
 *   { "label": "Projects", "page": "/projects/", "all": "All projects", "items": "projects" }
 *
 * An item with "children" (one level) or "items" (the items of a content/sources list) opens a
 * dropdown; "all" labels its link to the item's own page. Items of a source with pages of their
 * own (a [slug].json shows it) are listed with a photo and their photo count; other items (e.g.
 * projects) by title and kind, linking to their spot on the item's page, or to their own site
 * when "linkOut" is on. The menu, close and clock labels stay in settings/site.json "nav".
 */
import {
  html,
  esc,
  img,
  pad,
  extAttrs,
  isExternal,
  ed,
  coverOf,
  imagesOf,
  itemHref,
  itemSlug,
  slugify,
  warnOnce,
} from '../helpers.js';
import { NAV, SITE } from '../files.js';

const caret =
  '<svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const arrowNE = '<span class="arrow-ne" aria-hidden="true">↗</span>';

/** Where a menu item links: its page (warns when there is no such page) or its href. */
export function linkOf(ctx, item) {
  if (item.page === undefined) return item.href || '#';
  if (!(ctx.routes || []).some((r) => r.path === item.page))
    warnOnce(`content/${NAV}: "${item.label}" links to "${item.page}", which is no page`, 'nav');
  return item.page;
}

/** The items of an item's source ("items": "people"), with how to link and show them. */
function itemsOf(ctx, item) {
  if (!item.items) return null;
  const list = ctx.sources?.[item.items];
  if (!Array.isArray(list)) {
    warnOnce(
      `content/${NAV}: "${item.label}" lists source "${item.items}", which is missing`,
      'nav',
    );
    return { list: [], pages: false };
  }
  const pages = (ctx.routes || []).some((r) => r.source === item.items && r.template);
  return { list, pages, source: item.items, page: linkOf(ctx, item) };
}

/** A source item without a page of its own: its own site with "linkOut", else its spot on the page. */
const spotHref = (items, p) => (p.linkOut && p.url ? p.url : `${items.page}#${itemSlug(p)}`);

/** Dropdown rows: photo, name and photo count (items with pages), or title and kind. */
const ddLinks = (ctx, items) =>
  items.pages
    ? items.list.map(
        (a) =>
          html` <li>
        <a class="dd-link" href="${esc(itemHref(ctx, items.source, a))}">
          <span class="dd-link__thumb"
            >${coverOf(a) ? img(ctx, coverOf(a).src, { decorative: true, sizes: '48px' }) : ''}</span
          >
          <span class="dd-link__name">${esc(a.name)}</span>
          <span class="dd-link__count">${pad(imagesOf(a).length)}</span>
        </a>
      </li>`,
      )
    : items.list.map((p) => {
        const href = spotHref(items, p);
        return html`<li>
    <a class="dd-link dd-link--text" href="${esc(href)}" ${extAttrs(href)}>
      <span class="dd-link__name">${esc(p.title)}</span
      ><span class="dd-link__count">${esc(p.kind)}${isExternal(href) ? arrowNE : ''}</span>
    </a>
  </li>`;
      });

/** Mobile menu links of an item's source items. */
const mmLinks = (ctx, items) =>
  items.pages
    ? items.list.map(
        (p) => html`<a href="${esc(itemHref(ctx, items.source, p))}">${esc(p.name)}</a>`,
      )
    : items.list.map((p) => {
        const href = spotHref(items, p);
        return html`<a href="${esc(href)}" ${extAttrs(href)}
                >${esc(p.title)}${isExternal(href) ? arrowNE : ''}</a
              >`;
      });

/** A label, marked for the editor: path in nav.json ['header', 0, 'label']. */
const label = (path, text) => html`<span${ed(NAV, path)}>${esc(text)}</span>`;

/** The <a> attributes of a link: href, a new tab for external ones. */
const hrefAttrs = (href) => `href="${esc(href)}"${extAttrs(href)}`;

/** One top-level item of the nav pill. */
function navItem(ctx, item, i) {
  const at = ['header', i];
  const href = linkOf(ctx, item);
  const own = item.page ? ` data-nav="${esc(item.page)}"` : '';
  const children = item.children || [];
  const items = itemsOf(ctx, item);
  if (!children.length && !items)
    return html`<a class="nav__item" ${hrefAttrs(href)}${own}>${label([...at, 'label'], item.label)}</a>`;
  const id = `dd-${slugify(item.page || item.label) || i}`;
  const section = [item.page, ...children.map((c) => c.page)].filter(Boolean).join(',');
  const all = item.all
    ? html`
            <a class="dropdown__all" ${hrefAttrs(href)}>${label([...at, 'all'], item.all)} <span aria-hidden="true">→</span></a>`
    : '';
  const body = children.length
    ? html`<div class="dropdown glass" id="${id}" data-dropdown hidden>
            <div class="dropdown__cols">
              ${children
                .map((c, j) => {
                  const sub = itemsOf(ctx, c);
                  return html`<div class="dropdown__col">
                <a class="dropdown__head" ${hrefAttrs(linkOf(ctx, c))}>${label([...at, 'children', j, 'label'], c.label)}${sub ? html` <sup>${pad(sub.list.length)}</sup>` : ''}</a>
                ${sub ? html`<ul>${ddLinks(ctx, sub)}</ul>` : ''}
              </div>`;
                })
                .join('\n              ')}
            </div>${all}
          </div>`
    : html`<div class="dropdown dropdown--narrow glass" id="${id}" data-dropdown hidden>
            <ul class="dropdown__list">${ddLinks(ctx, items)}</ul>${all}
          </div>`;
  return html`<div class="nav__group">
          <button class="nav__item" type="button" aria-expanded="false" aria-controls="${id}" data-dropdown-toggle data-nav-section="${esc(section)}">${label([...at, 'label'], item.label)} ${caret}</button>
          ${body}
        </div>`;
}

/** Persistent header: logo, glass nav pill with click-to-open dropdowns, local time, mobile menu toggle. */
export function header(ctx) {
  const { site } = ctx;
  const nav = site.nav || {};
  const n = (key, fallback) => nav[key] ?? fallback;
  const items = Array.isArray(ctx.nav?.header) ? ctx.nav.header : [];
  return html`
  <header class="header" data-header>
    <a class="header__logo" href="/" aria-label="${esc(site.name)}, home">${esc(site.name)}</a>

    <nav class="nav" aria-label="Main">
      <div class="nav__pill">
        ${items.map((item, i) => navItem(ctx, item, i)).join('\n        ')}
      </div>
    </nav>

    <div class="header__right">
      <span class="header__clock"><span class="header__clock-dot"></span><span${ed(SITE, ['nav', 'clock'])}>${esc(nav.clock)}</span> <time data-clock="${esc(site.timezone)}">--:--</time></span>
      <button class="menu-toggle glass" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
        <span class="menu-toggle__label" data-open-label="${esc(n('close', 'Close'))}"><span${ed(SITE, ['nav', 'menu'])}>${esc(n('menu', 'Menu'))}</span></span>
        <span class="menu-toggle__icon" aria-hidden="true"><i></i><i></i></span>
      </button>
    </div>
  </header>`;
}

/** One top-level item of the mobile menu. */
function mmItem(ctx, item, i) {
  const at = ['header', i];
  const href = linkOf(ctx, item);
  const own = item.page ? ` data-nav="${esc(item.page)}"` : '';
  const children = item.children || [];
  const items = itemsOf(ctx, item);
  const big = (attrs) =>
    html`<a class="mmenu__big" ${hrefAttrs(href)}${own}${attrs}>${label([...at, 'label'], item.label)}</a>`;
  if (!children.length && !items) return big(' data-mm-item');
  const sub = children.length
    ? html`<div class="mmenu__sub">
            ${children
              .map((c, j) => {
                const list = itemsOf(ctx, c);
                return html`<div><a class="mmenu__head" ${hrefAttrs(linkOf(ctx, c))}>${label([...at, 'children', j, 'label'], c.label)}</a>${list ? mmLinks(ctx, list) : ''}</div>`;
              })
              .join('\n            ')}
          </div>`
    : html`<div class="mmenu__sub mmenu__sub--single">
            <div>${mmLinks(ctx, items)}</div>
          </div>`;
  return html`<div class="mmenu__group" data-mm-item>
          ${big('')}
          ${sub}
        </div>`;
}

/** Full-screen glass menu used on small screens (opens on click only). */
export function mobileMenu(ctx) {
  const { site } = ctx;
  const items = Array.isArray(ctx.nav?.header) ? ctx.nav.header : [];
  return html`
  <div class="mmenu" id="mobile-menu" data-mobile-menu hidden>
    <div class="mmenu__panel glass">
      <nav class="mmenu__nav" aria-label="Mobile">
        ${items.map((item, i) => mmItem(ctx, item, i)).join('\n        ')}
      </nav>
      <div class="mmenu__foot" data-mm-item>
        ${(site.social || []).slice(0, 2).map((s) => html`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ${arrowNE}</a>`)}
      </div>
    </div>
  </div>`;
}
