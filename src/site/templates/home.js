import {
  html,
  esc,
  img,
  pad,
  ed,
  lines,
  words,
  sectionAttrs,
  itemHref,
  firstPhotos,
} from '../helpers.js';
import { HOME, sourceFile } from '../files.js';
import { sectionHead, projectList } from './partials.js';

const heroPhoto = (ctx, p, i) => {
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
        ${img(ctx, p.src, { alt: '', sizes: `(max-width: 760px) ${p.mw || 30}vw, ${p.w}vw`, ...firstPhotos(i), attrs: ed(HOME, ['hero', 'photos', i, 'src'], 'image') })}
      </span></span
    >
  </a>`;
};

/** Images of a source item: albums have images[], projects a single image. */
const imagesOf = (item) =>
  Array.isArray(item?.images)
    ? item.images
    : item?.image
      ? [{ src: item.image, alt: item.title || item.name || '' }]
      : [];

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

/**
 * The list a grid section pulls from: content/sources/<source>.json. A missing file or
 * one that isn't a top-level array logs a warning and renders an empty grid.
 */
function sourceList(ctx, source) {
  const list = ctx.sources?.[source];
  if (Array.isArray(list)) return list;
  console.warn(
    `[home] grid source "content/${sourceFile(source)}" ${list === undefined ? 'is missing' : 'is not a JSON array'}; the grid renders empty.`,
  );
  return [];
}

/** Grid layouts: staggered (default, offset columns) or even (every row lines up). */
const LAYOUTS = ['staggered', 'even'];
const layoutOf = (section) =>
  LAYOUTS.includes(section.config?.layout) ? section.config.layout : 'staggered';

/** Photo tiles (people look): the first 4 images of every item, interleaved. */
const photoTiles = (ctx, source, items, layout) =>
  html` <div class="tiles${layout === 'even' ? ' tiles--even' : ''}" data-anim="home.people.grid">
    ${interleave(items).map(
      ({ item, at, image, index }) => html`
      <a class="tile" href="${esc(itemHref(ctx, source, item))}#${index + 1}" data-anim-item>
        <span class="tile__media">${img(ctx, image.src, { alt: image.alt, sizes: '(max-width: 760px) 50vw, 25vw' })}</span>
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
        <span class="placecard__media">${cover ? img(ctx, cover.src, { alt: cover.alt, sizes: '(max-width: 760px) 100vw, 50vw', attrs: 'data-anim="place.card.image"' }) : ''}</span>
        <span class="placecard__info">
          <span class="placecard__name"${ed(sourceFile(source), [i, 'name'])}>${esc(p.name)}</span>
          <span class="label"><span${ed(sourceFile(source), [i, 'location'])}>${esc(p.location)}</span> · <span${ed(sourceFile(source), [i, 'year'], 'number')}>${esc(p.year)}</span> · ${pad(imagesOf(p).length)} photos</span>
        </span>
      </a>`;
    })}
  </div>`;

/** Which tile look a grid uses, by source. Anything not listed gets photo tiles. */
const GRID_LOOKS = { places: placeCards };

const sectionOn = (section) => section?.config?.enabled !== false;

/**
 * Home sections, rendered in the order of pages/index.json "sections". Each item has a `type`,
 * its content fields, and settings under `config` (enabled, source, layout).
 */
const SECTIONS = {
  intro: (ctx, s, { at, attrs }) =>
    html` <section class="intro" ${attrs}>
      <p class="intro__text" data-anim="home.intro" ${ed(HOME, ['sections', at, 'text'], 'block')}>
        ${lines(s.text)}
      </p>
    </section>`,

  grid: (ctx, s, { at, number, attrs }) => {
    const source = s.config?.source || 'people';
    const look = GRID_LOOKS[source] || photoTiles;
    return html` <section class="section section--${esc(source)}" ${attrs}>
      ${sectionHead({ key: at, index: number, ...s, href: `/${source}/` })}
      ${look(ctx, source, sourceList(ctx, source), layoutOf(s))}
    </section>`;
  },

  projects: (ctx, s, { at, number, attrs }) =>
    html` <section class="section section--projects" ${attrs}>
      ${sectionHead({ key: at, index: number, ...s, href: '/projects/' })}
      ${projectList(ctx, ctx.projects, { id: 'home-projects' })}
    </section>`,
};

export function home(ctx) {
  const { home, site } = ctx;
  const hero = home.hero || {};
  const sections = Array.isArray(home.sections) ? home.sections : [];
  let number = 0; // section numbers (01), (02), … count the visible headed sections in order
  return html` <section class="hero" data-hero${sectionAttrs('hero', hero.enabled !== false)}>
      <div class="hero__photos" data-anim="hero.photos">
        ${(hero.photos || []).map((p, i) => heroPhoto(ctx, p, i))}
      </div>
      <h1 class="hero__title" data-anim="hero.title">
        <span class="hero__name" ${ed(HOME, ['hero', 'title'], 'words')}
          >${words(hero.title ?? site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${ed(HOME, ['hero', 'eyebrow'])}>${esc(hero.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>Scroll</span>
        <p class="hero__subline" ${ed(HOME, ['hero', 'subline'], 'block')}>
          ${lines(hero.subline)}
        </p>
      </div>
    </section>
    ${sections.map((s, at) => {
      const render = SECTIONS[s?.type];
      if (!render) {
        console.warn(`[home] unknown section type "${s?.type}" at sections/${at}; skipped.`);
        return '';
      }
      const on = sectionOn(s);
      if (s.type !== 'intro' && on) number++;
      const attrs = `${sectionAttrs(`s${at}`, on).trim()} data-section-kind="${esc(s.type === 'grid' ? `grid:${s.config?.source || 'people'}` : s.type)}"`;
      return render(ctx, s, { at, number, attrs });
    })}`;
}
