/**
 * Widget types of the home page look: the hero with its scattered photos, a grid of a source's photos, the project list. See ./index.js for the shape.
 */
import {
  html,
  esc,
  img,
  pad,
  lines,
  words,
  itemHref,
  firstPhotos,
  ed,
  coverOf,
  sizes,
} from '../helpers.js';
import { sourceFile } from '../files.js';
import { hrefOf } from '../hrefs.js';
import { schemaOf } from '../schemas.js';
import { sectionHead, projectList } from '../templates/partials.js';
import { sourcePage } from './data.js';

/** Photo paths of a source item: albums have images[], projects a single image. */
const imagesOf = (item) =>
  Array.isArray(item?.images) ? item.images : item?.image ? [item.image] : [];

const heroPhoto = (ctx, b, p, i) => {
  // phone: its own x / y / w over the desktop's (partly or all); null: hidden on phones
  const mobile = p.phone !== null;
  const ph = { x: p.x, y: p.y, w: p.w, ...(p.phone || {}) };
  const style = `--x:${p.x}%;--y:${p.y}%;--w:${p.w}vw;${mobile ? `--mx:${ph.x}%;--my:${ph.y}%;--mw:${ph.w}vw;` : ''}`;
  if (!p.src) return '';
  return html` <a
    class="scatter scatter--${p.layer === 'front' ? 'front' : 'back'}${mobile ? '' : ' scatter--desktop'}"
    href="${esc(hrefOf(ctx, p.link, 'a hero photo'))}"
    style="${style}"
    data-depth="${p.depth}"
    aria-label="${esc(p.label)}"
  >
    <span class="scatter__drift"
      ><span class="scatter__frame">
        ${img(ctx, p.src, { decorative: true, sizes: sizes(`${mobile ? ph.w : 30}vw`, `${p.w}vw`), ...firstPhotos(i), attrs: b.ed(['photos', i, 'src'], 'image') })}
      </span></span
    >
  </a>`;
};

/** The big name over scattered photos (photos: [{ src, link, label, x, y, w, phone?: { x?, y?, w? } | null, depth?, layer? }]). */
export const hero = {
  type: 'hero',
  label: 'Hero',
  icon: 'star',
  line: 'Your name over scattered photos',
  sketch: 'hero',
  fields: [
    { key: 'title', label: 'Name', type: 'words', width: 'half' },
    { key: 'eyebrow', label: 'Eyebrow', width: 'half' },
    { key: 'body', label: 'Subline', type: 'block' },
    {
      key: 'photos',
      label: 'Photos',
      list: { src: 'image', link: { type: 'link', label: 'Link' } },
      // a new photo: in the middle, behind the name (x / y / w in % of the hero; see heroPhoto)
      item: { src: '', x: 40, y: 30, w: 16, depth: 1 },
    },
  ],
  defaults: { title: 'Your name', eyebrow: '', body: '', photos: [] },
  render: (s, ctx, b) =>
    html` <div class="hero" data-hero>
      <div class="hero__photos" data-anim="hero.photos">
        ${(s.photos || []).map((p, i) => heroPhoto(ctx, b, p, i))}
      </div>
      <h1 class="hero__title" data-anim="hero.title">
        <span class="hero__name" ${b.ed('title', 'words')}
          >${words(s.title ?? ctx.site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${b.ed('eyebrow')}>${esc(s.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>Scroll</span>
        <p class="hero__subline" ${b.ed('body', 'block')}>${lines(s.body)}</p>
      </div>
    </div>`,
};

/** Interleave the first N images of each item (e.g. 4 per person) for a photo-tile grid. */
const interleave = (items, indexOf, perItem = 4) => {
  const tiles = [];
  for (let i = 0; i < perItem; i++)
    items.forEach((item) => {
      const at = indexOf(item);
      const image = imagesOf(item)[i];
      if (image) tiles.push({ item, at, image, index: i });
    });
  return tiles;
};

/** Photo tiles (people look): the first 4 images of every item, interleaved. */
const photoTiles = (ctx, source, items, layout, indexOf) => {
  const { title } = schemaOf(ctx, source); // the field that names an item
  return html` <div class="tiles${layout === 'even' ? ' tiles--even' : ''}">
    ${interleave(items, indexOf).map(
      ({ item, at, image, index }) => html`
      <a class="tile" href="${esc(itemHref(ctx, source, item))}#${index + 1}" data-anim-item>
        <span class="tile__media">${img(ctx, image, { sizes: sizes('50vw', '25vw') })}</span>
        <span class="tile__cap"><span${ed(sourceFile(source), ['items', at, title])}>${esc(item[title])}</span><span>${pad(index + 1)}</span></span>
      </a>`,
    )}
  </div>`;
};

/** Landscape cards (places look): cover image, name, location · year · photo count. */
const placeCards = (ctx, source, items, layout, indexOf) =>
  html` <div
    class="placecards${layout === 'even' ? ' placecards--even' : ''}"
  >
    ${items.map((p) => {
      const i = indexOf(p);
      const cover = coverOf(p);
      return html`
      <a class="placecard" href="${esc(itemHref(ctx, source, p))}" data-anim-item>
        <span class="placecard__media">${cover ? img(ctx, cover, { sizes: sizes('100vw', '50vw'), attrs: 'data-anim="place.card.image"' }) : ''}</span>
        <span class="placecard__info">
          <span class="placecard__name"${ed(sourceFile(source), ['items', i, 'title'])}>${esc(p.title)}</span>
          <span class="label"><span${ed(sourceFile(source), ['items', i, 'location'])}>${esc(p.location)}</span> · <span${ed(sourceFile(source), ['items', i, 'year'], 'number')}>${esc(p.year)}</span> · ${pad(imagesOf(p).length)} photos</span>
        </span>
      </a>`;
    })}
  </div>`;

/** Which tile look a grid uses, by source. Anything not listed gets photo tiles. */
const GRID_LOOKS = { places: placeCards };

/**
 * A head (eyebrow, title, button), then its source's photos as tiles (or place cards for
 * places): a list widget (its items: all of a source, or the ones From URL matches).
 */
export const grid = {
  type: 'grid',
  list: true,
  label: 'Photo grid',
  icon: 'table-cells',
  line: 'Photos from a source list',
  sketch: 'grid',
  fields: [
    { key: 'eyebrow', label: 'Label', width: 'half' },
    { key: 'title', label: 'Title', width: 'half' },
    { key: 'cta', label: 'Button' },
  ],
  config: [
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
    eyebrow: 'People',
    title: 'New grid',
    cta: 'See all',
    source: { mode: 'all', from: 'people' },
    config: { layout: 'staggered' },
    motion: { anim: 'grid-reveal' },
  },
  render: (s, ctx, b) => {
    // no source (None): its head without a link, and no tiles
    const source = b.source || '';
    const look = GRID_LOOKS[source] || photoTiles;
    const layout = s.config?.layout === 'even' ? 'even' : 'staggered';
    return html` <div class="gridwidget gridwidget--${esc(source)}">
      ${sectionHead({ at: b.ed, ...s, href: source && sourcePage(ctx, source) })}
      ${look(ctx, source, b.items, layout, b.indexOf)}
    </div>`;
  },
};

/**
 * The project list (a source's items, rows that open). With a title it has a head
 * and a link to all (the home look); without, it is a page's own list.
 */
export const projects = {
  type: 'projects',
  list: true,
  label: 'Project list',
  icon: 'list',
  line: 'Rows that open each project',
  sketch: 'projects',
  fields: [
    { key: 'eyebrow', label: 'Label', width: 'half' },
    { key: 'title', label: 'Title (empty: no heading)', width: 'half' },
    { key: 'cta', label: 'Button' },
  ],
  defaults: {
    eyebrow: 'Projects',
    title: 'Things I build',
    cta: 'All projects',
    source: { mode: 'all', from: 'projects' },
    motion: { anim: 'list-up' },
  },
  render: (s, ctx, b) => {
    const source = b.source || ''; // None: an empty list
    const list = b.items;
    const { indexOf } = b;
    if (!s.title)
      return html` <div class="projectswidget">
        ${projectList(ctx, list, { id: `projects-${b.id}`, source, headingLevel: 2, indexOf })}
      </div>`;
    return html` <div class="projectswidget">
      ${sectionHead({ at: b.ed, ...s, href: source && sourcePage(ctx, source) })}
      ${projectList(ctx, list, { id: `projects-${b.id}`, source, indexOf })}
    </div>`;
  },
};
