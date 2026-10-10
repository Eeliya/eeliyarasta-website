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
} from '../helpers.js';
import { SITE } from '../files.js';

const caret =
  '<svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const arrowNE = '<span class="arrow-ne" aria-hidden="true">↗</span>';

const albumLinks = (ctx, kind, list) =>
  list.map(
    (a) =>
      html` <li>
        <a class="dd-link" href="${esc(itemHref(ctx, kind, a))}">
          <span class="dd-link__thumb"
            >${coverOf(a) ? img(ctx, coverOf(a).src, { alt: '', sizes: '48px' }) : ''}</span
          >
          <span class="dd-link__name">${esc(a.name)}</span>
          <span class="dd-link__count">${pad(imagesOf(a).length)}</span>
        </a>
      </li>`,
  );

/** Where a project links in the menus: its own site when "linkOut" is on, else its spot on /projects/. */
const projectHref = (p) => (p.linkOut && p.url ? p.url : `/projects/#${p.slug}`);

const projectLink = (p) => {
  const href = projectHref(p);
  return html`<li>
    <a class="dd-link dd-link--text" href="${esc(href)}" ${extAttrs(href)}>
      <span class="dd-link__name">${esc(p.title)}</span
      ><span class="dd-link__count">${esc(p.kind)}${isExternal(href) ? arrowNE : ''}</span>
    </a>
  </li>`;
};

/** Persistent header: logo, glass nav pill with click-to-open dropdowns, local time, mobile menu toggle. */
export function header(ctx) {
  const { site, people, places, projects } = ctx;
  const nav = site.nav || {};
  const n = (key, fallback) => nav[key] ?? fallback;
  return html`
  <header class="header" data-header>
    <a class="header__logo" href="/" aria-label="${esc(site.name)}, home">${esc(site.name)}</a>

    <nav class="nav" aria-label="Main">
      <div class="nav__pill">
        <a class="nav__item" href="/" data-nav="/"><span${ed(SITE, ['nav', 'home'])}>${esc(n('home', 'Home'))}</span></a>
        <div class="nav__group">
          <button class="nav__item" type="button" aria-expanded="false" aria-controls="dd-photography" data-dropdown-toggle data-nav-section="/photography/,/people/,/places/"><span${ed(SITE, ['nav', 'photography'])}>${esc(n('photography', 'Photography'))}</span> ${caret}</button>
          <div class="dropdown glass" id="dd-photography" data-dropdown hidden>
            <div class="dropdown__cols">
              <div class="dropdown__col">
                <a class="dropdown__head" href="/people/"><span${ed(SITE, ['nav', 'people'])}>${esc(n('people', 'People'))}</span> <sup>${pad(people.length)}</sup></a>
                <ul>${albumLinks(ctx, 'people', people)}</ul>
              </div>
              <div class="dropdown__col">
                <a class="dropdown__head" href="/places/"><span${ed(SITE, ['nav', 'places'])}>${esc(n('places', 'Places'))}</span> <sup>${pad(places.length)}</sup></a>
                <ul>${albumLinks(ctx, 'places', places)}</ul>
              </div>
            </div>
            <a class="dropdown__all" href="/photography/"><span${ed(SITE, ['nav', 'allPhotography'])}>${esc(n('allPhotography', 'All photography'))}</span> <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div class="nav__group">
          <button class="nav__item" type="button" aria-expanded="false" aria-controls="dd-projects" data-dropdown-toggle data-nav-section="/projects/"><span${ed(SITE, ['nav', 'projects'])}>${esc(n('projects', 'Projects'))}</span> ${caret}</button>
          <div class="dropdown dropdown--narrow glass" id="dd-projects" data-dropdown hidden>
            <ul class="dropdown__list">${projects.map(projectLink)}</ul>
            <a class="dropdown__all" href="/projects/"><span${ed(SITE, ['nav', 'allProjects'])}>${esc(n('allProjects', 'All projects'))}</span> <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <a class="nav__item" href="/about/" data-nav="/about/"><span${ed(SITE, ['nav', 'about'])}>${esc(n('about', 'About'))}</span></a>
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

/** Full-screen glass menu used on small screens (opens on click only). */
export function mobileMenu(ctx) {
  const { site, people, places, projects } = ctx;
  const nav = site.nav || {};
  const n = (key, fallback) => nav[key] ?? fallback;
  return html`
  <div class="mmenu" id="mobile-menu" data-mobile-menu hidden>
    <div class="mmenu__panel glass">
      <nav class="mmenu__nav" aria-label="Mobile">
        <a class="mmenu__big" href="/" data-nav="/" data-mm-item><span${ed(SITE, ['nav', 'home'])}>${esc(n('home', 'Home'))}</span></a>
        <div class="mmenu__group" data-mm-item>
          <a class="mmenu__big" href="/photography/" data-nav="/photography/"><span${ed(SITE, ['nav', 'photography'])}>${esc(n('photography', 'Photography'))}</span></a>
          <div class="mmenu__sub">
            <div><a class="mmenu__head" href="/people/"><span${ed(SITE, ['nav', 'people'])}>${esc(n('people', 'People'))}</span></a>${people.map((p) => html`<a href="${esc(itemHref(ctx, 'people', p))}">${esc(p.name)}</a>`)}</div>
            <div><a class="mmenu__head" href="/places/"><span${ed(SITE, ['nav', 'places'])}>${esc(n('places', 'Places'))}</span></a>${places.map((p) => html`<a href="${esc(itemHref(ctx, 'places', p))}">${esc(p.name)}</a>`)}</div>
          </div>
        </div>
        <div class="mmenu__group" data-mm-item>
          <a class="mmenu__big" href="/projects/" data-nav="/projects/"><span${ed(SITE, ['nav', 'projects'])}>${esc(n('projects', 'Projects'))}</span></a>
          <div class="mmenu__sub mmenu__sub--single">
            <div>${projects.map((p) => {
              const href = projectHref(p);
              return html`<a href="${esc(href)}" ${extAttrs(href)}
                >${esc(p.title)}${isExternal(href) ? arrowNE : ''}</a
              >`;
            })}</div>
          </div>
        </div>
        <a class="mmenu__big" href="/about/" data-nav="/about/" data-mm-item><span${ed(SITE, ['nav', 'about'])}>${esc(n('about', 'About'))}</span></a>
      </nav>
      <div class="mmenu__foot" data-mm-item>
        ${(site.social || []).slice(0, 2).map((s) => html`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ${arrowNE}</a>`)}
      </div>
    </div>
  </div>`;
}
