import { html, esc, img, pad, coverOf, creditText } from '../helpers.js';
import { albumCard, pageHead, projectList } from './partials.js';

export const people = (ctx) => html`
  ${pageHead({ crumb: 'Photography / People', title: 'People', count: ctx.people.length, intro: 'Models and the people I have photographed. Portraits, editorial and fashion, mostly natural light.' })}
  <section class="agrid" data-anim="album.grid">
    ${ctx.people.map((p) => albumCard(ctx, 'people', p))}
  </section>`;

export const places = (ctx) => html`
  ${pageHead({ crumb: 'Photography / Places', title: 'Places', count: ctx.places.length, intro: 'Buildings, streets and castles. What is left when the people walk out of frame.' })}
  <section class="agrid agrid--landscape" data-anim="album.grid">
    ${ctx.places.map((p) => albumCard(ctx, 'places', p, { landscape: true }))}
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
  ${pageHead({ crumb: 'Photography', title: 'Photography', intro: 'Two sides of the same habit: the people I photograph, and the places I keep coming back to.' })}
  <section class="ppanels" data-anim="album.grid">
    ${panel('/people/', 'People', ctx.people, 'models')}
    ${panel('/places/', 'Places', ctx.places, 'places')}
  </section>`;
};

export const projects = (ctx) => html`
  ${pageHead({ crumb: 'Projects', title: 'Projects', count: ctx.projects.length, intro: 'Things I build when I am not behind the camera: websites, developer tools and DIY experiments.' })}
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
      <span class="label page-head__crumb">About</span>
      <h1 class="about__headline" data-anim="about.headline">${esc(a.headline)}</h1>
      <div class="about__body" data-anim="about.body">
        ${a.paragraphs.map((p) => html`<p>${esc(p)}</p>`)}
        <dl class="facts">${a.facts.map((f) => html`<div><dt class="label">${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`)}</dl>
        <div class="about__links">
          <a class="btn glass" href="mailto:${esc(ctx.site.email)}">Email me <span aria-hidden="true">→</span></a>
          ${ctx.site.social.slice(0, 2).map((s) => html`<a class="btn glass" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="arrow-ne" aria-hidden="true">↗</span></a>`)}
        </div>
      </div>
    </div>
  </section>`;
};

export const notFound = () => html`
  <section class="page-head page-head--center">
    <span class="label page-head__crumb">Error 404</span>
    <h1 class="page-title" data-anim="page.title">Lost frame</h1>
    <p class="page-intro" data-anim="page.intro">This page doesn't exist (yet).</p>
    <a class="btn glass" href="/">Back home <span aria-hidden="true">→</span></a>
  </section>`;

export { creditText };
