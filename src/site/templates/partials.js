import { html, esc, img, pad, extAttrs, coverOf } from '../helpers.js';

/** Section header used on the home page: (01) Label / Title / glass CTA. */
export const sectionHead = ({ index, label, title, href, cta }) => html`
  <header class="section__head">
    <span class="section__label label" data-anim="section.label">(${pad(index)}) ${esc(label)}</span>
    <h2 class="section__title" data-anim="section.title">${esc(title)}</h2>
    ${href ? html`<a class="btn glass section__cta" href="${esc(href)}">${esc(cta)} <span aria-hidden="true">→</span></a>` : ''}
  </header>`;

/** Album card (People / Places index). Hovering cycles through the first images. */
export const albumCard = (ctx, kind, album, { landscape = false } = {}) => {
  const first = [coverOf(album), ...album.images.filter((_, i) => i !== (album.cover || 0))].slice(0, 4);
  const sizes = landscape ? '(max-width: 760px) 100vw, 50vw' : '(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 40vw';
  return html`
  <a class="acard ${landscape ? 'acard--landscape' : ''}" href="/${kind}/${album.slug}/" data-anim-item data-card-cycle data-cursor="View · ${esc(album.name)}">
    <div class="acard__media">
      ${first.map((im, i) => img(ctx, im.src, { alt: i === 0 ? im.alt : '', sizes, cls: i === 0 ? 'is-active' : '' }))}
      <span class="acard__count">${pad(album.images.length)}</span>
    </div>
    <div class="acard__info">
      <h2 class="acard__name">${esc(album.name)}</h2>
      <span class="acard__meta">${esc([album.role, album.location, album.year].filter(Boolean).join(' · '))}</span>
      ${album.placeholder ? '<span class="tag">Placeholder</span>' : ''}
    </div>
  </a>`;
};

/** Editorial index list of projects with hover image preview + click-to-expand details. */
export const projectList = (ctx, projects, { id = 'projects', headingLevel = 3 } = {}) => {
  const h = `h${headingLevel}`;
  return html`
  <div class="plist" data-anim="projects.list" data-project-list="${id}">
    ${projects.map((p, i) => html`
    <article class="prow" id="${esc(p.slug)}" data-prow data-preview-index="${i}">
      <button class="prow__head" type="button" aria-expanded="false" aria-controls="prow-${esc(p.slug)}" data-cursor="${p.url ? 'Open' : 'Read'}">
        <span class="prow__num">${pad(i + 1)}</span>
        <${h} class="prow__title">${esc(p.title)}</${h}>
        <span class="prow__kind">${esc(p.kind)}</span>
        <span class="prow__year">${esc(p.year)}</span>
        <span class="prow__icon" aria-hidden="true"><i></i><i></i></span>
      </button>
      <div class="prow__body" id="prow-${esc(p.slug)}" hidden>
        <div class="prow__inner">
          <div class="prow__media">${img(ctx, p.image, { alt: p.title, sizes: '(max-width: 760px) 100vw, 30vw' })}</div>
          <div class="prow__text">
            <p>${esc(p.description)}</p>
            ${p.placeholder ? '<span class="tag">Placeholder</span>' : ''}
            ${p.url ? html`<a class="btn glass" href="${esc(p.url)}"${extAttrs(p.url)}>${esc(p.linkLabel || 'Visit')} <span class="arrow-ne" aria-hidden="true">↗</span></a>` : ''}
          </div>
        </div>
      </div>
    </article>`)}
  </div>
  <div class="preview" data-portal data-anim="projects.preview" data-preview-for="${id}" aria-hidden="true">
    <div class="preview__frame">${projects.map((p) => img(ctx, p.image, { alt: '', sizes: '360px' }))}</div>
  </div>`;
};

/** Page heading used by index pages. */
export const pageHead = ({ crumb, title, intro, count }) => html`
  <section class="page-head">
    <span class="label page-head__crumb">${crumb}</span>
    <h1 class="page-title" data-anim="page.title">${esc(title)}${count !== undefined ? html`<sup class="page-title__count">${pad(count)}</sup>` : ''}</h1>
    ${intro ? html`<p class="page-intro" data-anim="page.intro">${esc(intro)}</p>` : ''}
  </section>`;
