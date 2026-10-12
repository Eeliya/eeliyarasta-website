/**
 * The layout engine: every page is a list of sections, each a grid of 120 square cells wide,
 * holding blocks
 * ("sections" in its file, content/en/pages/<page>/index.json or a template's [slug].json):
 *
 *   { "id": "s-k3x9", "name": "Our people", "height": "fit", "width": "contained", "enabled": true,
 *     "blocks": [{ "id": "b-7qpa", "type": "heading", "title": "People", "config": {},
 *                  "pos": { "col": 1, "span": 120, "row": 1, "rows": 8 }, "z": 0 }] }
 *
 * The square grid: a section's content width is split into COLS (120) columns of one cell
 * size, --cell = width / 120, and every row is one cell tall, so every cell is exactly square
 * (no gaps either way). src/client/modules/rows.js measures the width at runtime and sets
 * --cell on the section (a ResizeObserver and the window's resize keep it current);
 * _layout.scss has a CSS-only first guess from 100vw. Phones (below 760px) use MCOLS (60)
 * square cells of their own: every block is on that grid, at its own phone area or else at
 * its desktop area halved (grid.js phoneAreaOf; nothing stacks).
 *
 * A section:
 *   name     optional: its anchor, slugified into its HTML id ("Our people" -> id="our-people",
 *            so /page/#our-people scrolls to it, below the header); unique on its page
 *   height   'custom': exactly `rows.min` rows of square cells, its blocks at their rows from
 *            the top (not centred), the rows below the last block empty space, more only when
 *            its content needs more; on phones half as many, rounded up, as a block's desktop
 *            area is halved there | or a minimum, its rows centred: 'fit' (its
 *            content: its rows) | 'third' | 'half' | 'full' (a third, half or all of the
 *            screen's height, svh). Its rows are always down to its lowest block
 *            (uniform square cells); a taller section centres them vertically, and content
 *            taller than the minimum makes it taller. No space above or below it: the space
 *            between sections is empty rows (rows above its first block)
 *   width    'contained': inside the page's side margins | 'full': edge to edge
 *   enabled  false: off: not on the public page at all; in the editor's preview rendered hidden
 *            (so it can be turned on live)
 * A block (its content: src/site/blocks/index.js):
 *   pos      { col, span, row, rows }: its grid area, columns 1-120 and rows (cells) from 1
 *   size     'auto' (default): as tall as its content | 'aspect': as tall as its columns'
 *            width × `aspect` ("4:5", "16:9", any "w:h") | 'rows': exactly its pos.rows (fixed).
 *            Every block spans whole rows: an aspect or auto block the rows its height needs at
 *            the page's width, rows.js on the page works them out (./flow.js); its pos.rows is
 *            that span where it was last placed (the page's first render)
 *   link     optional { to, gap }: it follows block `to` of its section, its top `gap` cells
 *            below that block's bottom (negative: overlapping); without one it is free, at its
 *            row whatever the blocks above do (./links.js)
 *   scale    optional { on, adjust }: a text block's text in cells (./type.js)
 *   place    'none' (default) | 'sticky-<corner>': held at a screen edge while its section
 *            scrolls by | 'fixed-<corner>': at a screen corner the whole time | 'fullscreen':
 *            covers the screen the whole time (behind the page unless its z is set: a
 *            background) | 'pinned': pinned (GSAP) while the rest of its section scrolls by.
 *            Corners: top-left, top-center, top-right, center, bottom-left, bottom-center,
 *            bottom-right
 *   z        its layer when blocks overlap (higher is in front)
 *   mobile   optional, below 760px: { col, span, row, rows } its area on the phone grid of 60
 *            columns (without one: its desktop area halved), { link } its phone link (without a
 *            phone area: its desktop link, the gap halved) and { place } (without one it is in
 *            its area: no sticky, fixed, pin)
 *   motion   optional { anim, ...timing }: its animation from the library and its own timing
 *            (./motion.js)
 *   item     optional { source, slug }: the source item its bound fields show (./bindings.js;
 *            on a [slug] page they show the page's item without one)
 * Positions become CSS variables on the elements; src/client/styles/_layout.scss lays them out.
 */
import { esc, ed, editable, pointer, slugify, warnOnce } from '../helpers.js';
import { BLOCK_TYPES } from '../blocks/index.js';
import { newId } from './ids.js';
import { motionAttrs } from './motion.js';
import { isBound, itemOf, keysOf, resolve, resolveBlock } from './bindings.js';
import { COLS, phoneAreaOf, placeOf } from './grid.js';
import { linkOf } from './links.js';
import { adjustOf, scaled } from './type.js';

export { COLS, MCOLS, cellOf, halfArea, hasMobileArea, phoneAreaOf, placeOf } from './grid.js';
export { linkOf, linkProblems, makesLoop, halfGap } from './links.js';
/** A section's minimum height: its content, or a third, a half or all of the screen's. */
export const HEIGHTS = ['custom', 'fit', 'third', 'half', 'full'];
/** The most rows a custom height can ask for. */
export const MAX_MIN_ROWS = 999;
/** A custom section's minimum rows (desktop), or 0. */
export const minRowsOf = (s) =>
  s?.height === 'custom' && Number.isInteger(s.rows?.min) && s.rows.min >= 1
    ? Math.min(s.rows.min, MAX_MIN_ROWS)
    : 0;
/**
 * A section's height on phones: its own (mobile.height, set in the phone preview), else its
 * desktop height.
 */
export const phoneHeightOf = (s) =>
  HEIGHTS.includes(s?.mobile?.height) ? s.mobile.height : heightOf(s);
/**
 * A section's phone rows when its phone height is custom: its own (mobile.rows.min), or its
 * desktop rows halved, rounded up; 0 otherwise (also custom without rows: as fit).
 */
export const mobileMinRowsOf = (s) => {
  if (phoneHeightOf(s) !== 'custom') return 0;
  const own = s.mobile?.rows?.min;
  if (Number.isInteger(own) && own >= 1) return Math.min(own, MAX_MIN_ROWS);
  return Math.ceil(minRowsOf(s) / 2);
};
export const WIDTHS = ['contained', 'full'];
/** Ids the page's own templates use: no section is named one of them. */
const RESERVED_IDS = ['main', 'portal', 'page-curtains', 'accent-init', 'mobile-menu'];

/** A section's height preset ('fit' when unset or unknown). */
export const heightOf = (s) => (HEIGHTS.includes(s?.height) ? s.height : 'fit');

/** A section name's anchor: "Our People" -> "our-people" ('' when it has no letters or digits). */
export const anchorOf = (name) => slugify(typeof name === 'string' ? name : '');
/** Whether an anchor can be a section's id: a letter first (a number is an album photo's hash). */
const isAnchor = (a) => /^[a-z][a-z0-9-]*$/.test(a) && !RESERVED_IDS.includes(a);
/** A block's height: its content (the default), its width × an aspect ratio, or fixed rows. */
export const SIZES = ['auto', 'aspect', 'rows'];
export const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '3:2', '16:9', '21:9'];
const CORNERS = [
  'top-left',
  'top-center',
  'top-right',
  'center',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
/** Where a block is held while the page scrolls (see _layout.scss and modules/placements.js). */
export const PLACES = [
  'none',
  ...CORNERS.map((c) => `sticky-${c}`),
  ...CORNERS.map((c) => `fixed-${c}`),
  'fullscreen',
  'pinned',
];

/** "16:9" -> [16, 9]; null unless two positive numbers. */
export function ratioOf(text) {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(text ?? '').trim());
  return m && Number(m[1]) > 0 && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null;
}

/** A block's size mode ('auto' when unset or unknown). */
export const sizeOf = (b) => (SIZES.includes(b?.size) ? b.size : 'auto');

/**
 * A new block of `type`: its defaults, on, full width at `pos` (8 rows, ~90px at 1440px, from
 * row 1 by default), auto height, free (no link). taken: the ids already on the page (the new
 * one is added).
 */
export function newBlock(type, taken, pos = {}) {
  const { config = {}, ...rest } = structuredClone(BLOCK_TYPES[type].defaults || {});
  return {
    id: newId('b', taken),
    type,
    ...rest,
    config,
    pos: { col: 1, span: COLS, row: 1, rows: 8, ...pos },
  };
}

/** A new section holding `blocks`: its content's height (fit), contained, no name. */
export function newSection(taken, blocks = []) {
  return { id: newId('s', taken), height: 'fit', width: 'contained', enabled: true, blocks };
}

/** The rows a section has: down to its lowest block (1 when it has none). */
export function rowsOf(section) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  return Math.max(1, ...blocks.map((b) => placeOf(b?.pos).row + placeOf(b?.pos).rows - 1));
}

/**
 * The rows of a section's phone grid: as far down as its blocks' phone areas reach, and its
 * desktop rows halved (the empty rows below its blocks scale with it).
 */
export function mobileRowsOf(section) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  return Math.max(
    Math.ceil(rowsOf(section) / 2),
    ...blocks.map((b) => {
      const m = phoneAreaOf(b);
      return m.row + m.rows - 1;
    }),
  );
}

/** The CSS variables of a section's element. */
export function sectionVars(s) {
  // custom: that many rows, its blocks where they are from the top, the rows below the last
  // one empty space (more when its content needs more); on phones its phone height's (its own
  // or the desktop's): its own phone rows, or the desktop's halved, like a block's area there.
  // rows.js keeps it so as the content grows (--minrows / --mminrows)
  const min = minRowsOf(s);
  const m = mobileMinRowsOf(s);
  return (
    `--rows:${Math.max(rowsOf(s), min)};--mrows:${Math.max(mobileRowsOf(s), m)}` +
    (min ? `;--minrows:${min}` : '') +
    (m ? `;--mminrows:${m}` : '')
  );
}

/** The classes of a section's element: its minimum height (sec--h-third …) and width. */
export function sectionClass(s) {
  const h = heightOf(s) === 'custom' && !minRowsOf(s) ? 'fit' : heightOf(s);
  // a phone height of its own: sec--mh-* (phones only)
  const own = HEIGHTS.includes(s?.mobile?.height);
  const m = phoneHeightOf(s) === 'custom' && !mobileMinRowsOf(s) ? 'fit' : phoneHeightOf(s);
  return (
    'sec' +
    (h !== 'fit' ? ` sec--h-${h}` : '') +
    (own ? ` sec--mh-${m}` : '') +
    (s?.width === 'full' ? ' sec--full' : '')
  );
}

/**
 * What is wrong with each section's name, by index ('' when nothing, or no name): text whose
 * anchor starts with a letter, isn't one of the page's own ids, and no other section on the
 * page has (src/site/validate.js; the editor's name field shows it as you type).
 */
export function nameProblems(sections) {
  const list = Array.isArray(sections) ? sections : [];
  const first = new Map();
  return list.map((s, at) => {
    const name = s?.name;
    if (name === undefined || name === '') return '';
    if (typeof name !== 'string') return 'must be text';
    const a = anchorOf(name);
    if (!a) return "needs a letter or a digit (it becomes the section's #anchor)";
    if (!/^[a-z]/.test(a)) return `#${a} must start with a letter (a number is a photo's link)`;
    if (RESERVED_IDS.includes(a)) return `#${a} is taken by the page itself`;
    if (first.has(a)) return `#${a} is already section ${first.get(a) + 1}'s anchor`;
    first.set(a, at);
    return '';
  });
}

/** A section's anchor id, or '' (no name, or one that can't be an id). */
export function sectionAnchor(s) {
  const a = anchorOf(s?.name);
  return isAnchor(a) ? a : '';
}

/** A placement's classes: kind (sticky, fixed, full, pinned) and corner, `m` for the phone's. */
function placeClass(place, m = '') {
  if (!PLACES.includes(place) || place === 'none') return '';
  if (place === 'fullscreen') return ` blk--${m}full`;
  if (place === 'pinned') return ` blk--${m}pinned`;
  const [kind, ...corner] = place.split('-');
  const [v, h = 'center'] = corner.join('-') === 'center' ? ['center'] : corner;
  return ` blk--${m}${kind} blk--${m}v-${v} blk--${m}h-${h}`;
}

/**
 * The classes of a block's element: its type, size mode (blk--aspect, blk--auto; fixed rows:
 * neither), scaled text and placements (desktop, phone).
 */
export function blockClass(b) {
  const size = sizeOf(b);
  const aspect = size === 'aspect' && ratioOf(b?.aspect);
  return (
    `blk blk--${b?.type}` +
    (aspect ? ' blk--aspect' : size === 'auto' || size === 'aspect' ? ' blk--auto' : '') +
    (scaled(b) ? ' blk--scale' : '') +
    placeClass(b?.place) +
    placeClass(b?.mobile?.place, 'm-')
  );
}

/**
 * The CSS variables of a block's element: its grid area, layer, phone area (its own, or its
 * desktop area halved) and its text's scale.
 */
export function blockVars(b) {
  const p = placeOf(b?.pos);
  const m = phoneAreaOf(b);
  const ratio = sizeOf(b) === 'aspect' ? ratioOf(b?.aspect) : null;
  const k = scaled(b) ? adjustOf(b) : 1;
  return (
    `--c:${p.col};--s:${p.span};--r:${p.row};--rs:${p.rows}` +
    (Number.isInteger(b?.z) && b.z !== 0 ? `;--z:${b.z}` : '') +
    (ratio ? `;--ar:${ratio[0]} / ${ratio[1]}` : '') +
    `;--mc:${m.col};--ms:${m.span};--mr:${m.row};--mrs:${m.rows}` +
    (k !== 1 ? `;--tk:${k}` : '')
  );
}

/**
 * A block's links as attributes of its element (src/client/modules/rows.js reads them):
 * data-link="<id> <gap>" (desktop), data-mlink (the phone grid's; ./links.js linkOf).
 */
export function blockLinks(b) {
  const d = linkOf(b);
  const m = linkOf(b, true);
  return {
    'data-link': d ? `${d.to} ${d.gap}` : null,
    'data-mlink': m ? `${m.to} ${m.gap}` : null,
  };
}

const linkAttrs = (b) =>
  Object.entries(blockLinks(b))
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');

/** The number (1, 2, ...) of each numbered heading block on the page, by block id. */
export function headingNumbers(sections) {
  const numbers = {};
  let n = 0;
  for (const s of Array.isArray(sections) ? sections : []) {
    if (s?.enabled === false) continue;
    for (const b of Array.isArray(s?.blocks) ? s.blocks : [])
      if (b?.type === 'heading' && b.config?.numbered && b.config.enabled !== false)
        numbers[b.id] = ++n;
  }
  return numbers;
}

/** One block of section `at` (its index `j`), rendered with its grid area. */
function renderBlock(ctx, route, file, at, j, block, numbers) {
  const t = BLOCK_TYPES[block?.type];
  const where = `content/en/${file} (sections/${at}/blocks/${j})`;
  if (!t) {
    warnOnce(`${where}: unknown block type "${block?.type}": skipped`, 'layout');
    return '';
  }
  if (t.item && !route.album) {
    warnOnce(`${where}: a "${t.type}" block only works on a [slug] page: skipped`, 'layout');
    return '';
  }
  const parts = (path) => ['sections', at, 'blocks', j, ...[path].flat()];
  const { item, source } = itemOf(ctx, route, block);
  const keys = keysOf(ctx, source);
  // a bound value isn't edited in the preview: data-bound instead (a click selects the block),
  // and data-bound-missing when its item or a field of it is missing (a dimmed {{name}})
  const bound = (value, path) => {
    let missing = false;
    resolve(value, { item, keys, onwarn: () => (missing = true) });
    const attr = ` data-bound="${esc(file + '#' + pointer(parts(path)))}"`;
    return missing ? `${attr} data-bound-missing` : attr;
  };
  const b = {
    id: block.id,
    file,
    number: numbers[block.id] || 0,
    ed: (path, type) => {
      const value = [path].flat().reduce((v, k) => v?.[k], block);
      if (!isBound(value)) return ed(file, parts(path), type);
      return editable ? bound(value, path) : '';
    },
  };
  // the block with the item's values in its bound fields (as it is when nothing is bound)
  const data = resolveBlock(block, t, { item, source, ctx, at: where, placeholders: editable });
  const marker = editable ? ` data-block="${esc(block.id)}"` : '';
  const hidden = block.config?.enabled === false ? ' hidden' : '';
  return `<div class="${blockClass(block)}"${marker} style="${blockVars(block)}"${linkAttrs(block)}${motionAttrs(block)}${hidden}>${t.render(data, ctx, b)}</div>`;
}

/**
 * Section `at` of a page file, rendered. numbers: headingNumbers() of the whole page (a
 * section rendered on its own still counts the headings before it).
 */
export function renderSection(ctx, route, file, section, at, numbers = {}) {
  if (section?.enabled === false && !editable) return ''; // off: not on the public page
  const blocks = (Array.isArray(section?.blocks) ? section.blocks : [])
    .map((b, j) => renderBlock(ctx, route, file, at, j, b, numbers))
    .join('');
  const marker = editable ? ` data-sec="${esc(section?.id ?? '')}"` : '';
  const anchor = sectionAnchor(section);
  const hidden = section?.enabled === false ? ' hidden' : '';
  return `<section${anchor ? ` id="${anchor}"` : ''} class="${sectionClass(section)}"${marker} style="${sectionVars(section)}"${hidden}>${blocks}</section>`;
}

/** The sections of a page file, rendered in order. route: the page's route (route.album on [slug] pages). */
export function renderSections(ctx, route, file, sections) {
  const list = Array.isArray(sections) ? sections : [];
  const numbers = headingNumbers(list);
  return list.map((s, at) => renderSection(ctx, route, file, s, at, numbers)).join('');
}
