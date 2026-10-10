import {
  html,
  esc,
  img,
  pad,
  extAttrs,
  coverOf,
  imagesOf,
  ed,
  lines,
  itemHref,
  firstPhotos,
} from '../helpers.js';
import { HOME, pageFile, sourceFile } from '../files.js';

const PROJECTS = sourceFile('projects');

/** Section header used on the home page: (01) Label / Title / glass CTA. */
export const sectionHead = ({ key, index, label, title, href, cta }) => {
  const at = (field) => ed(HOME, ['sections', key, field]);
  return html`
  <header class="section__head">
    <span class="section__label label" data-anim="section.label">(${pad(index)}) <span${at('label')}>${esc(label)}</span></span>
    <h2 class="section__title" data-anim="section.title"${at('title')}>${esc(title)}</h2>
    ${href ? html`<a class="btn glass section__cta" href="${esc(href)}"><span${at('cta')}>${esc(cta)}</span> <span aria-hidden="true">→</span></a>` : ''}
  </header>`;
};

/** Album card (People / Places index). Hovering cycles through the first images. */
export const albumCard = (ctx, kind, album, { landscape = false, index = 0 } = {}) => {
  const at = (field, type) => ed(sourceFile(kind), [index, field], type);
  const meta = [['role'], ['location'], ['year', 'number']].filter(([f]) => album[f]);
  const first = [coverOf(album), ...imagesOf(album).filter((_, i) => i !== (album.cover || 0))]
    .filter(Boolean)
    .slice(0, 4);
  const sizes = landscape
    ? '(max-width: 760px) 100vw, 50vw'
    : '(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 40vw';
  return html` <a
    class="acard ${landscape ? 'acard--landscape' : ''}"
    href="${esc(itemHref(ctx, kind, album))}"
    data-anim-item
    data-card-cycle
  >
    <div class="acard__media">
      ${first.map((im, i) => img(ctx, im.src, { alt: i === 0 ? im.alt : '', sizes, cls: i === 0 ? 'is-active' : '', ...(i === 0 ? firstPhotos(index) : {}) }))}
      <span class="acard__count">${pad(imagesOf(album).length)}</span>
    </div>
    <div class="acard__info">
      <h2 class="acard__name" ${at('name')}>${esc(album.name)}</h2>
      <span class="acard__meta"
        >${meta.map(([f, type], i) => html`${i ? ' · ' : ''}<span${at(f, type)}>${esc(album[f])}</span>`)}</span
      >
      ${album.placeholder ? '<span class="tag">Placeholder</span>' : ''}
    </div>
  </a>`;
};

/** Editorial index list of projects with a hover image preview (anchored to the row) + click-to-expand details. */
export const projectList = (ctx, projects, { id = 'projects', headingLevel = 3 } = {}) => {
  const h = `h${headingLevel}`;
  return html` <div class="plist" data-anim="projects.list" data-project-list="${id}">
      ${projects.map(
        (p, i) => html`
    <article class="prow" id="${esc(p.slug)}" data-prow data-preview-index="${i}">
      <button class="prow__head" type="button" aria-expanded="false" aria-controls="prow-${esc(p.slug)}">
        <span class="prow__num">${pad(i + 1)}</span>
        <${h} class="prow__title"${ed(PROJECTS, [i, 'title'])}>${esc(p.title)}</${h}>
        <span class="prow__kind"${ed(PROJECTS, [i, 'kind'])}>${esc(p.kind)}</span>
        <span class="prow__year"${ed(PROJECTS, [i, 'year'], 'number')}>${esc(p.year)}</span>
        <span class="prow__icon" aria-hidden="true"><i></i><i></i></span>
      </button>
      <div class="prow__body" id="prow-${esc(p.slug)}" hidden>
        <div class="prow__inner">
          <div class="prow__media">${p.image ? img(ctx, p.image, { alt: p.title, sizes: '(max-width: 760px) 100vw, 30vw', attrs: ed(PROJECTS, [i, 'image'], 'image') }) : ''}</div>
          <div class="prow__text">
            <p${ed(PROJECTS, [i, 'description'], 'block')}>${lines(p.description)}</p>
            ${p.placeholder ? '<span class="tag">Placeholder</span>' : ''}
            ${p.url ? html`<a class="btn glass" href="${esc(p.url)}"${extAttrs(p.url)}><span${ed(PROJECTS, [i, 'linkLabel'])}>${esc(p.linkLabel || 'Visit')}</span> <span class="arrow-ne" aria-hidden="true">↗</span></a>` : ''}
          </div>
        </div>
      </div>
    </article>`,
      )}
    </div>
    <div
      class="preview"
      data-portal
      data-anim="projects.preview"
      data-preview-for="${id}"
      aria-hidden="true"
    >
      <div class="preview__frame">
        ${projects.map((p, i) => (p.image ? img(ctx, p.image, { alt: '', sizes: '360px', attrs: ed(PROJECTS, [i, 'image'], 'image') }) : '<img alt="" />'))}
      </div>
    </div>`;
};

/** Page heading used by index pages; copy comes from the page's own file, content/pages/<id>/index.json. */
export const pageHead = (ctx, id, { count, center = false, after = '' } = {}) => {
  const { crumb, title, intro } = ctx.pages[id];
  const at = (field, type) => ed(pageFile(id), [field], type);
  return html`
  <section class="page-head${center ? ' page-head--center' : ''}">
    <span class="label page-head__crumb"${at('crumb')}>${esc(crumb)}</span>
    <h1 class="page-title" data-anim="page.title"><span${at('title')}>${esc(title)}</span>${count !== undefined ? html`<sup class="page-title__count">${pad(count)}</sup>` : ''}</h1>
    ${intro ? html`<p class="page-intro" data-anim="page.intro" ${at('intro', 'block')}>${lines(intro)}</p>` : ''}
    ${after}
  </section>`;
};
