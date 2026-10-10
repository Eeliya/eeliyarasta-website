/**
 * Block types of the inner pages: a page heading, album cards of a source (People,
 * Places), photography panels, the About bio. See ./index.js for the shape.
 */
import { html, esc, img, pad, lines, coverOf, creditText, firstPhotos } from '../helpers.js';
import { albumCard } from '../templates/partials.js';
import { sourceList, sourcePage } from './data.js';

/**
 * A page's heading: crumb, big title (with the item count of a source: config.count), intro,
 * and a button (cta, to config.href). config.center: centred on the screen (404);
 * config.numbered: the crumb starts with its number among the page's numbered headings (01).
 */
export const heading = {
  type: 'heading',
  label: 'Page heading',
  icon: 'heading',
  fields: [
    { key: 'crumb', label: 'Crumb' },
    { key: 'title', label: 'Title' },
    { key: 'intro', label: 'Intro', type: 'block' },
    { key: 'cta', label: 'Button (empty: none)' },
  ],
  config: [
    { key: 'count', label: 'Count of', type: 'source', empty: 'No count' },
    { key: 'href', label: 'Button link', type: 'text' },
    { key: 'center', label: 'Centred', type: 'boolean' },
    { key: 'numbered', label: 'Numbered (01)', type: 'boolean' },
  ],
  defaults: { crumb: '', title: 'New page', intro: '', config: {} },
  render: (s, ctx, b) => {
    const c = s.config || {};
    const count = c.count ? sourceList(ctx, c.count).length : undefined;
    return html`
  <div class="page-head${c.center ? ' page-head--center' : ''}">
    <span class="label page-head__crumb">${c.numbered ? `(${pad(b.number)}) ` : ''}<span${b.ed('crumb')}>${esc(s.crumb)}</span></span>
    <h1 class="page-title" data-anim="page.title"><span${b.ed('title')}>${esc(s.title)}</span>${count !== undefined ? html`<sup class="page-title__count">${pad(count)}</sup>` : ''}</h1>
    ${s.intro ? html`<p class="page-intro" data-anim="page.intro" ${b.ed('intro', 'block')}>${lines(s.intro)}</p>` : ''}
    ${s.cta ? html`<a class="btn glass" href="${esc(c.href || '/')}"><span${b.ed('cta')}>${esc(s.cta)}</span> <span aria-hidden="true">→</span></a>` : ''}
  </div>`;
  },
};

/** Album cards of a source, each linking to its page; config.layout landscape for wide photos. */
export const albums = {
  type: 'albums',
  label: 'Album cards',
  icon: 'images',
  config: [
    { key: 'source', label: 'Source', type: 'source' },
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      options: [
        ['portrait', 'Portrait'],
        ['landscape', 'Landscape'],
      ],
    },
  ],
  defaults: { config: { source: 'people', layout: 'portrait' } },
  render: (s, ctx) => {
    const source = s.config?.source || 'people';
    const landscape = s.config?.layout === 'landscape';
    return html` <div class="agrid${landscape ? ' agrid--landscape' : ''}" data-anim="album.grid">
      ${sourceList(ctx, source).map((p, index) => albumCard(ctx, source, p, { landscape, index }))}
    </div>`;
  },
};

/** Big panels linking to sources' pages: panels [{ source, title, unit }] ("People", "models"). */
export const panels = {
  type: 'panels',
  label: 'Photo panels',
  icon: 'table-columns',
  fields: [
    {
      key: 'panels',
      label: 'Panels',
      list: {
        source: { type: 'source', label: 'Source' },
        title: { type: 'text', label: 'Title', width: 'half' },
        unit: { type: 'text', label: 'Unit (after the count)', width: 'half' },
      },
      item: { source: 'people', title: 'People', unit: 'items' },
    },
  ],
  defaults: { panels: [{ source: 'people', title: 'People', unit: 'models' }] },
  render: (s, ctx, b) => {
    const panel = ({ source, title, unit }, i) => {
      const list = Array.isArray(ctx.sources[source]) ? ctx.sources[source] : [];
      const cover = list.map(coverOf).find(Boolean);
      return html` <a class="ppanel" href="${esc(sourcePage(ctx, source))}" data-anim-item>
      <span class="ppanel__media"
        >${cover ? img(ctx, cover.src, { sizes: '(max-width: 760px) 100vw, 50vw', ...firstPhotos(i), attrs: 'data-anim="place.card.image"' }) : ''}</span
      >
      <span class="ppanel__info"
        ><span class="ppanel__title"${b.ed(['panels', i, 'title'])}>${esc(title)}</span
        ><span class="label">${pad(list.length)} <span${b.ed(['panels', i, 'unit'])}>${esc(unit)}</span></span></span
      >
    </a>`;
    };
    return html` <div class="ppanels" data-anim="album.grid">
      ${(s.panels || []).map(panel)}
    </div>`;
  },
};

/** The About bio: photo (with credit), crumb, headline, paragraphs, facts, email and socials. */
export const about = {
  type: 'about',
  label: 'Bio',
  icon: 'user',
  fields: [
    { key: 'image', label: 'Photo', type: 'image' },
    { key: 'crumb', label: 'Crumb' },
    { key: 'headline', label: 'Headline' },
    { key: 'paragraphs', label: 'Paragraphs', list: 'block' },
    {
      key: 'facts',
      label: 'Facts',
      list: {
        label: { type: 'text', label: 'Label', width: 'half' },
        value: { type: 'text', label: 'Value', width: 'half' },
      },
    },
    { key: 'emailLabel', label: 'Email button' },
  ],
  defaults: {
    image: '',
    crumb: 'About',
    headline: 'A line about you.',
    paragraphs: ['A paragraph about you.'],
    facts: [{ label: 'Based in', value: 'Netherlands' }],
    emailLabel: 'Email me',
  },
  render: (a, ctx, b) => html` <div class="about">
    <div class="about__media">
      <figure class="about__figure" data-anim="about.image">
        ${a.image ? img(ctx, a.image, { sizes: '(max-width: 760px) 100vw, 45vw', priority: true, attrs: b.ed('image', 'image') }) : ''}
      </figure>
      <figcaption class="label muted">
        ${esc(creditText(a.imageCredit))}
      </figcaption>
    </div>
    <div class="about__text">
      <span class="label page-head__crumb" ${b.ed('crumb')}>${esc(a.crumb)}</span>
      <h1 class="about__headline" data-anim="about.headline" ${b.ed('headline')}>
        ${esc(a.headline)}
      </h1>
      <div class="about__body" data-anim="about.body">
        ${(a.paragraphs || []).map((p, i) => html`<p${b.ed(['paragraphs', i], 'block')}>${lines(p)}</p>`)}
        <dl class="facts">
          ${(a.facts || []).map((f, i) => html`<div><dt class="label"${b.ed(['facts', i, 'label'])}>${esc(f.label)}</dt><dd${b.ed(['facts', i, 'value'])}>${esc(f.value)}</dd></div>`)}
        </dl>
        <div class="about__links">
          <a class="btn glass" href="mailto:${esc(ctx.site.email)}"
            ><span${b.ed('emailLabel')}>${esc(a.emailLabel)}</span>
            <span aria-hidden="true">→</span></a
          >
          ${(ctx.site.social || []).slice(0, 2).map((s) => html`<a class="btn glass" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="arrow-ne" aria-hidden="true">↗</span></a>`)}
        </div>
      </div>
    </div>
  </div>`,
};
