/**
 * The built-in Photo grid widget (grid): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, pad, itemHref, ed, coverOf, sizes } from '../../helpers.js';
import { sourceFile } from '../../files.js';
import { schemaOf } from '../../schemas.js';
import { sectionHead } from '../../templates/partials.js';
import { sourcePage } from '../data.js';

/** Photo paths of a source item: albums have images[], projects a single image. */
const imagesOf = (item) =>
  Array.isArray(item?.images) ? item.images : item?.image ? [item.image] : [];

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

export default grid;
