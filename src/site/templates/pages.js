import { html, esc, img, pad, coverOf, creditText, ed, lines } from '../helpers.js';
import { albumCard, pageHead, projectList } from './partials.js';

export const people = (ctx) => html`
  ${pageHead(ctx, 'people', { count: ctx.people.length })}
  <section class="agrid" data-anim="album.grid">
    ${ctx.people.map((p, index) => albumCard(ctx, 'people', p, { index }))}
  </section>`;

export const places = (ctx) => html`
  ${pageHead(ctx, 'places', { count: ctx.places.length })}
  <section class="agrid agrid--landscape" data-anim="album.grid">
    ${ctx.places.map((p, index) => albumCard(ctx, 'places', p, { landscape: true, index }))}
  </section>`;

export const photography = (ctx) => {
  const panel = (href, label, list, kind) => {
    const cover = coverOf(list[0]);
    return html`
    <a class="ppanel" href="${href}" data-anim-item data-cursor="Open · ${label}">
      <span class="ppanel__media">${img(ctx, cover.src, { alt: cover.alt, sizes: '(max-width: 760px) 100vw, 50vw', attrs: 'data-anim="place.card.image"' })}</span>
      <span class="ppanel__info"><span class="ppanel__title">${label}</span><span class="label">${pad(list.length)} ${kind}</span></span>
    </a>`;
  };
  return html`
  ${pageHead(ctx, 'photography')}
  <section class="ppanels" data-anim="album.grid">
    ${panel('/people/', 'People', ctx.people, 'models')}
    ${panel('/places/', 'Places', ctx.places, 'places')}
  </section>`;
};

export const projects = (ctx) => html`
  ${pageHead(ctx, 'projects', { count: ctx.projects.length })}
  <section class="section section--projects-page">
    ${projectList(ctx, ctx.projects, { id: 'projects-page', headingLevel: 2 })}
  </section>`;

export const about = (ctx) => {
  const a = ctx.site.about;
  return html`
  <section class="about">
    <div class="about__media">
      <figure class="about__figure" data-anim="about.image">${img(ctx, a.image, { alt: 'Fujifilm X100V camera on a wooden table', sizes: '(max-width: 760px) 100vw, 45vw', priority: true })}</figure>
      <figcaption class="label muted">${esc(creditText(a.imageCredit))}${a.placeholder ? ' · placeholder' : ''}</figcaption>
    </div>
    <div class="about__text">
      <span class="label page-head__crumb"${ed('site.json', ['pages', 'about', 'crumb'])}>${esc(ctx.site.pages.about.crumb)}</span>
      <h1 class="about__headline" data-anim="about.headline"${ed('site.json', ['about', 'headline'])}>${esc(a.headline)}</h1>
      <div class="about__body" data-anim="about.body">
        ${a.paragraphs.map((p, i) => html`<p${ed('site.json', ['about', 'paragraphs', i], 'block')}>${lines(p)}</p>`)}
        <dl class="facts">${a.facts.map((f, i) => html`<div><dt class="label"${ed('site.json', ['about', 'facts', i, 'label'])}>${esc(f.label)}</dt><dd${ed('site.json', ['about', 'facts', i, 'value'])}>${esc(f.value)}</dd></div>`)}</dl>
        <div class="about__links">
          <a class="btn glass" href="mailto:${esc(ctx.site.email)}">Email me <span aria-hidden="true">→</span></a>
          ${ctx.site.social.slice(0, 2).map((s) => html`<a class="btn glass" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="arrow-ne" aria-hidden="true">↗</span></a>`)}
        </div>
      </div>
    </div>
  </section>`;
};

export const notFound = (ctx) =>
  pageHead(ctx, 'notFound', {
    center: true,
    after: html`<a class="btn glass" href="/"><span${ed('site.json', ['pages', 'notFound', 'cta'])}>${esc(ctx.site.pages.notFound.cta)}</span> <span aria-hidden="true">→</span></a>`,
  });

export { creditText };
