import { html, esc, img, pad, coverOf, creditText, ed, lines } from '../helpers.js';
import { pageFile } from '../files.js';

const ABOUT = pageFile('about');
const NOT_FOUND = pageFile('404');
import { albumCard, pageHead, projectList } from './partials.js';

export const people = (ctx) =>
  html` ${pageHead(ctx, 'people', { count: ctx.people.length })}
    <section class="agrid" data-anim="album.grid">
      ${ctx.people.map((p, index) => albumCard(ctx, 'people', p, { index }))}
    </section>`;

export const places = (ctx) =>
  html` ${pageHead(ctx, 'places', { count: ctx.places.length })}
    <section class="agrid agrid--landscape" data-anim="album.grid">
      ${ctx.places.map((p, index) => albumCard(ctx, 'places', p, { landscape: true, index }))}
    </section>`;

export const photography = (ctx) => {
  const page = ctx.pages.photography || {};
  const PHOTOGRAPHY = pageFile('photography');
  // One panel per entry of "panels": { source, title, unit } ("People", "models").
  const panel = ({ source, title, unit }, i) => {
    const list = Array.isArray(ctx.sources[source]) ? ctx.sources[source] : [];
    const cover = list.map(coverOf).find(Boolean);
    return html` <a class="ppanel" href="/${esc(source)}/" data-anim-item>
      <span class="ppanel__media"
        >${cover ? img(ctx, cover.src, { alt: cover.alt, sizes: '(max-width: 760px) 100vw, 50vw', attrs: 'data-anim="place.card.image"' }) : ''}</span
      >
      <span class="ppanel__info"
        ><span class="ppanel__title"${ed(PHOTOGRAPHY, ['panels', i, 'title'])}>${esc(title)}</span
        ><span class="label">${pad(list.length)} <span${ed(PHOTOGRAPHY, ['panels', i, 'unit'])}>${esc(unit)}</span></span></span
      >
    </a>`;
  };
  return html` ${pageHead(ctx, 'photography')}
    <section class="ppanels" data-anim="album.grid">${(page.panels || []).map(panel)}</section>`;
};

export const projects = (ctx) =>
  html` ${pageHead(ctx, 'projects', { count: ctx.projects.length })}
    <section class="section section--projects-page">
      ${projectList(ctx, ctx.projects, { id: 'projects-page', headingLevel: 2 })}
    </section>`;

export const about = (ctx) => {
  const a = ctx.pages.about;
  return html` <section class="about">
    <div class="about__media">
      <figure class="about__figure" data-anim="about.image">
        ${img(ctx, a.image, { alt: a.imageAlt, sizes: '(max-width: 760px) 100vw, 45vw', priority: true, attrs: ed(ABOUT, ['image'], 'image') })}
      </figure>
      <figcaption class="label muted">
        ${esc(creditText(a.imageCredit))}${a.placeholder ? ' · placeholder' : ''}
      </figcaption>
    </div>
    <div class="about__text">
      <span class="label page-head__crumb" ${ed(ABOUT, ['crumb'])}>${esc(a.crumb)}</span>
      <h1 class="about__headline" data-anim="about.headline" ${ed(ABOUT, ['headline'])}>
        ${esc(a.headline)}
      </h1>
      <div class="about__body" data-anim="about.body">
        ${(a.paragraphs || []).map((p, i) => html`<p${ed(ABOUT, ['paragraphs', i], 'block')}>${lines(p)}</p>`)}
        <dl class="facts">
          ${(a.facts || []).map((f, i) => html`<div><dt class="label"${ed(ABOUT, ['facts', i, 'label'])}>${esc(f.label)}</dt><dd${ed(ABOUT, ['facts', i, 'value'])}>${esc(f.value)}</dd></div>`)}
        </dl>
        <div class="about__links">
          <a class="btn glass" href="mailto:${esc(ctx.site.email)}"
            ><span${ed(ABOUT, ['emailLabel'])}>${esc(a.emailLabel)}</span>
            <span aria-hidden="true">→</span></a
          >
          ${(ctx.site.social || []).slice(0, 2).map((s) => html`<a class="btn glass" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="arrow-ne" aria-hidden="true">↗</span></a>`)}
        </div>
      </div>
    </div>
  </section>`;
};

export const notFound = (ctx) =>
  pageHead(ctx, '404', {
    center: true,
    after: html`<a class="btn glass" href="/"><span${ed(NOT_FOUND, ['cta'])}>${esc(ctx.pages['404'].cta)}</span> <span aria-hidden="true">→</span></a>`,
  });

/** A page without a view of its own (content/pages/<any>.json): its heading. */
export const page = (ctx, route) => pageHead(ctx, route.id);

export { creditText };
