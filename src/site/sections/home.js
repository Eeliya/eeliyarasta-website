/**
 * Section types of the home page look: the hero with its scattered photos, the big intro
 * statement, a grid of a source's photos, the project list. See ./index.js for the shape.
 */
import { html, esc, img, pad, lines, words, itemHref, firstPhotos, ed } from '../helpers.js';
import { sourceFile } from '../files.js';
import { sectionHead, projectList } from '../templates/partials.js';
import { sourceList } from './data.js';

/** Images of a source item: albums have images[], projects a single image. */
const imagesOf = (item) =>
  Array.isArray(item?.images) ? item.images : item?.image ? [{ src: item.image }] : [];

const heroPhoto = (ctx, sec, p, i) => {
  const mobile = p.mx !== undefined;
  const style = `--x:${p.x}%;--y:${p.y}%;--w:${p.w}vw;${mobile ? `--mx:${p.mx}%;--my:${p.my}%;--mw:${p.mw}vw;` : ''}`;
  return html` <a
    class="scatter scatter--${p.layer === 'front' ? 'front' : 'back'}${mobile ? '' : ' scatter--desktop'}"
    href="${esc(p.link)}"
    style="${style}"
    data-depth="${p.depth}"
    aria-label="${esc(p.label)}"
  >
    <span class="scatter__drift"
      ><span class="scatter__frame">
        ${img(ctx, p.src, { decorative: true, sizes: `(max-width: 760px) ${p.mw || 30}vw, ${p.w}vw`, ...firstPhotos(i), attrs: sec.ed(['photos', i, 'src'], 'image') })}
      </span></span
    >
  </a>`;
};

/** The big name over scattered photos (photos: [{ src, link, label, x, y, w, mx?, my?, mw?, depth, layer }]). */
export const hero = {
  type: 'hero',
  label: 'Hero',
  icon: 'star',
  fields: [
    { key: 'title', label: 'Name', type: 'words' },
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'subline', label: 'Subline', type: 'block' },
    { key: 'photos', label: 'photo', list: { src: 'image' } },
  ],
  defaults: { title: 'Your name', eyebrow: '', subline: '', photos: [] },
  render: (s, ctx, sec) =>
    html` <section class="hero" data-hero${sec.attrs}>
      <div class="hero__photos" data-anim="hero.photos">
        ${(s.photos || []).map((p, i) => heroPhoto(ctx, sec, p, i))}
      </div>
      <h1 class="hero__title" data-anim="hero.title">
        <span class="hero__name" ${sec.ed('title', 'words')}
          >${words(s.title ?? ctx.site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${sec.ed('eyebrow')}>${esc(s.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>Scroll</span>
        <p class="hero__subline" ${sec.ed('subline', 'block')}>${lines(s.subline)}</p>
      </div>
    </section>`,
};

/** A big statement in the display font. */
export const intro = {
  type: 'intro',
  label: 'Statement',
  icon: 'quote-left',
  fields: [{ key: 'text', label: 'Text', type: 'block' }],
  defaults: { text: 'A sentence about your work.' },
  render: (s, ctx, sec) =>
    html` <section class="intro" ${sec.attrs}>
      <p class="intro__text" data-anim="home.intro" ${sec.ed('text', 'block')}>${lines(s.text)}</p>
    </section>`,
};

/** Interleave the first N images of each item (e.g. 4 per person) for a photo-tile grid. */
const interleave = (items, perItem = 4) => {
  const tiles = [];
  for (let i = 0; i < perItem; i++)
    items.forEach((item, at) => {
      const image = imagesOf(item)[i];
      if (image) tiles.push({ item, at, image, index: i });
    });
  return tiles;
};

/** Photo tiles (people look): the first 4 images of every item, interleaved. */
const photoTiles = (ctx, source, items, layout) =>
  html` <div class="tiles${layout === 'even' ? ' tiles--even' : ''}" data-anim="home.people.grid">
    ${interleave(items).map(
      ({ item, at, image, index }) => html`
      <a class="tile" href="${esc(itemHref(ctx, source, item))}#${index + 1}" data-anim-item>
        <span class="tile__media">${img(ctx, image.src, { sizes: '(max-width: 760px) 50vw, 25vw' })}</span>
        <span class="tile__cap"><span${ed(sourceFile(source), [at, item.name !== undefined ? 'name' : 'title'])}>${esc(item.name ?? item.title)}</span><span>${pad(index + 1)}</span></span>
      </a>`,
    )}
  </div>`;

/** Landscape cards (places look): cover image, name, location · year · photo count. */
const placeCards = (ctx, source, items, layout) =>
  html` <div
    class="placecards${layout === 'even' ? ' placecards--even' : ''}"
    data-anim="home.places.grid"
  >
    ${items.map((p, i) => {
      const cover = imagesOf(p)[p.cover || 0] || imagesOf(p)[0];
      return html`
      <a class="placecard" href="${esc(itemHref(ctx, source, p))}" data-anim-item>
        <span class="placecard__media">${cover ? img(ctx, cover.src, { sizes: '(max-width: 760px) 100vw, 50vw', attrs: 'data-anim="place.card.image"' }) : ''}</span>
        <span class="placecard__info">
          <span class="placecard__name"${ed(sourceFile(source), [i, 'name'])}>${esc(p.name)}</span>
          <span class="label"><span${ed(sourceFile(source), [i, 'location'])}>${esc(p.location)}</span> · <span${ed(sourceFile(source), [i, 'year'], 'number')}>${esc(p.year)}</span> · ${pad(imagesOf(p).length)} photos</span>
        </span>
      </a>`;
    })}
  </div>`;

/** Which tile look a grid uses, by source. Anything not listed gets photo tiles. */
const GRID_LOOKS = { places: placeCards };

/** A numbered head (01), then a source's photos as tiles (or place cards for places). */
export const grid = {
  type: 'grid',
  label: 'Photo grid',
  icon: 'table-cells',
  numbered: true,
  fields: [
    { key: 'label', label: 'Label' },
    { key: 'title', label: 'Title' },
    { key: 'cta', label: 'Button' },
  ],
  config: [
    { key: 'source', label: 'Source', type: 'source' },
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      options: [
        ['staggered', 'Staggered'],
        ['even', 'Even'],
      ],
    },
  ],
  defaults: {
    label: 'People',
    title: 'New grid',
    cta: 'See all',
    config: { source: 'people', layout: 'staggered' },
  },
  render: (s, ctx, sec) => {
    const source = s.config?.source || 'people';
    const look = GRID_LOOKS[source] || photoTiles;
    const layout = s.config?.layout === 'even' ? 'even' : 'staggered';
    return html` <section class="section section--${esc(source)}" ${sec.attrs}>
      ${sectionHead({ at: sec.ed, index: sec.number, ...s, href: `/${source}/` })}
      ${look(ctx, source, sourceList(ctx, source), layout)}
    </section>`;
  },
};

/**
 * The project list (a source's items, rows that open). With a title it has a numbered head
 * and a link to all (the home look); without, it is a page's own list.
 */
export const projects = {
  type: 'projects',
  label: 'Project list',
  icon: 'list',
  numbered: (s) => !!s.title,
  fields: [
    { key: 'label', label: 'Label' },
    { key: 'title', label: 'Title (empty: no heading)' },
    { key: 'cta', label: 'Button' },
  ],
  config: [{ key: 'source', label: 'Source', type: 'source' }],
  defaults: {
    label: 'Projects',
    title: 'Things I build',
    cta: 'All projects',
    config: { source: 'projects' },
  },
  render: (s, ctx, sec) => {
    const source = s.config?.source || 'projects';
    const list = sourceList(ctx, source);
    if (!s.title)
      return html` <section class="section section--projects-page" ${sec.attrs}>
        ${projectList(ctx, list, { id: `projects-${sec.at}`, source, headingLevel: 2 })}
      </section>`;
    return html` <section class="section section--projects" ${sec.attrs}>
      ${sectionHead({ at: sec.ed, index: sec.number, ...s, href: `/${source}/` })}
      ${projectList(ctx, list, { id: `projects-${sec.at}`, source })}
    </section>`;
  },
};
