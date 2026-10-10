/**
 * The layout engine: every page is a list of sections, each a 24-column grid of blocks
 * ("sections" in its file, content/pages/<page>/index.json or a template's [slug].json):
 *
 *   { "id": "s-k3x9", "height": "auto", "rows": 12, "width": "contained",
 *     "spacing": { "top": 10, "bottom": 12 }, "enabled": true,
 *     "blocks": [{ "id": "b-7qpa", "type": "heading", "title": "People", "config": {},
 *                  "pos": { "col": 1, "span": 24, "row": 1, "rows": 12 }, "z": 0 }] }
 *
 * A section:
 *   height   'auto': `rows` rows of the row height (--grid-row, src/client/styles/_tokens.scss);
 *            a row grows when its content needs more | 'screen': at least the screen's height |
 *            'aspect': at least its width × `aspect` ("16:9"); for both, its rows are placed
 *            by `align` ('top' | 'center' | 'bottom' | 'stretch': fill it)
 *   width    'contained': inside the page's side margins | 'full': edge to edge
 *   spacing  { top, bottom }: empty rows above and below the grid
 *   mobile   optional { spacing: { top, bottom } }: the phone's (below 760px), else `spacing`
 *   enabled  false: hidden (still rendered, so the editor can turn it on live)
 * A block (its content: src/site/blocks/index.js):
 *   pos      { col, span, row, rows }: its grid area, columns 1-24 and rows from 1
 *   size     'rows' (default): as tall as its rows | 'aspect': as tall as its columns' width ×
 *            `aspect` ("4:5", "16:9", any "w:h") | 'auto': as tall as its content. Aspect and
 *            auto blocks take one row (pos.rows doesn't count), which grows to hold them
 *   place    'none' (default) | 'sticky-<corner>': held at a screen edge while its section
 *            scrolls by | 'fixed-<corner>': at a screen corner the whole time | 'fullscreen':
 *            covers the screen the whole time (behind the page unless its z is set: a
 *            background) | 'pinned': pinned (GSAP) while the rest of its section scrolls by.
 *            Corners: top-left, top-center, top-right, center, bottom-left, bottom-center,
 *            bottom-right
 *   z        its layer when blocks overlap (higher is in front)
 *   mobile   optional, below 760px: { col, span, row, rows } its area on the phone grid of 12
 *            columns, and { place }. Without areas a section's blocks stack full width in their
 *            order; without a phone `place` a block is in that flow (no sticky, fixed, pin)
 *   item     optional { source, slug }: the source item its bound fields show (./bindings.js;
 *            on a [slug] page they show the page's item without one)
 * Positions become CSS variables on the elements; src/client/styles/_layout.scss lays them out.
 */
import { esc, ed, editable, pointer, warnOnce } from '../helpers.js';
import { BLOCK_TYPES } from '../blocks/index.js';
import { newId } from './ids.js';
import { isBound, itemOf, keysOf, resolve, resolveBlock } from './bindings.js';

export const COLS = 24;
/** Columns of the phone grid (a block's `mobile` area); see _layout.scss for why 12. */
export const MCOLS = 12;
export const HEIGHTS = ['auto', 'screen', 'aspect'];
export const WIDTHS = ['contained', 'full'];
export const ALIGNS = ['top', 'center', 'bottom', 'stretch'];
/** A block's height: its rows, its width × an aspect ratio, or its content. */
export const SIZES = ['rows', 'aspect', 'auto'];
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

const int = (v, min, fallback) => (Number.isInteger(v) && v >= min ? v : fallback);

/** "16:9" -> [16, 9]; null unless two positive numbers. */
export function ratioOf(text) {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(text ?? '').trim());
  return m && Number(m[1]) > 0 && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null;
}

/** A block's grid area, completed and kept inside `cols` columns (24; the phone grid's 12). */
export function placeOf(pos, cols = COLS) {
  const col = Math.min(int(pos?.col, 1, 1), cols);
  return {
    col,
    span: Math.min(int(pos?.span, 1, cols), cols - col + 1),
    row: int(pos?.row, 1, 1),
    rows: int(pos?.rows, 1, 1),
  };
}

/** Does a block's `mobile` hold an area (it can hold only a placement)? */
export const hasMobileArea = (m) =>
  !!m && ['col', 'span', 'row', 'rows'].some((k) => m[k] !== undefined);

/** A block's size mode ('rows' when unset or unknown). */
export const sizeOf = (b) => (SIZES.includes(b?.size) ? b.size : 'rows');

/** The rows a block takes in its section: its own, or 1 (that row grows) for aspect / auto. */
const spanOf = (b, area) => (sizeOf(b) === 'rows' ? area.rows : 1);

/**
 * A new block of `type`: its defaults, on, full width at `pos` (12 rows from row 1 by
 * default). taken: the ids already on the page (the new one is added).
 */
export function newBlock(type, taken, pos = {}) {
  const { config = {}, ...rest } = structuredClone(BLOCK_TYPES[type].defaults || {});
  return {
    id: newId('b', taken),
    type,
    ...rest,
    config,
    pos: { col: 1, span: COLS, row: 1, rows: 12, ...pos },
  };
}

/** A new section holding `blocks`: auto height, contained, a little space around. */
export function newSection(taken, blocks = []) {
  const section = {
    id: newId('s', taken),
    height: 'auto',
    align: 'center',
    rows: 12,
    width: 'contained',
    spacing: { top: 8, bottom: 8 },
    enabled: true,
    blocks,
  };
  section.rows = rowsOf(section);
  return section;
}

/** The rows a section has: its own count, or more when a block reaches further down. */
export function rowsOf(section) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  return Math.max(
    int(section?.rows, 1, 1),
    ...blocks.map((b) => placeOf(b?.pos).row + spanOf(b, placeOf(b?.pos)) - 1),
  );
}

/** The rows of a section's phone grid: as far down as its blocks' mobile areas reach. */
export function mobileRowsOf(section) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  return Math.max(
    1,
    ...blocks
      .filter((b) => hasMobileArea(b?.mobile))
      .map((b) => {
        const m = placeOf(b.mobile, MCOLS);
        return m.row + spanOf(b, m) - 1;
      }),
  );
}

/** Does a section lay its blocks out on the phone grid (one of them has a mobile area)? */
const phoneGrid = (s) => (s?.blocks || []).some((b) => hasMobileArea(b?.mobile));

/** The CSS variables of a section's element. */
export function sectionVars(s) {
  const m = s?.mobile?.spacing;
  const ratio = s?.height === 'aspect' ? ratioOf(s.aspect) : null;
  return (
    `--rows:${rowsOf(s)};--pt:${int(s?.spacing?.top, 0, 0)};--pb:${int(s?.spacing?.bottom, 0, 0)}` +
    (Number.isInteger(m?.top) && m.top >= 0 ? `;--mpt:${m.top}` : '') +
    (Number.isInteger(m?.bottom) && m.bottom >= 0 ? `;--mpb:${m.bottom}` : '') +
    (phoneGrid(s) ? `;--mrows:${mobileRowsOf(s)}` : '') +
    (ratio ? `;--sar:${ratio[0]} / ${ratio[1]}` : '')
  );
}

/** The classes of a section's element: its height, width and alignment. */
export function sectionClass(s) {
  const tall = s?.height === 'screen' || (s?.height === 'aspect' && ratioOf(s.aspect));
  const align = ALIGNS.includes(s?.align) ? s.align : 'center';
  return (
    'sec' +
    (tall ? ` sec--${s.height === 'screen' ? 'screen' : 'aspect'} sec--${align}` : '') +
    (s?.width === 'full' ? ' sec--full' : '') +
    (phoneGrid(s) ? ' sec--mgrid' : '')
  );
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

/** The classes of a block's element: its type, size mode and placements (desktop, phone). */
export function blockClass(b) {
  const size = sizeOf(b);
  const aspect = size === 'aspect' && ratioOf(b?.aspect);
  return (
    `blk blk--${b?.type}` +
    (aspect ? ' blk--aspect' : size === 'auto' || size === 'aspect' ? ' blk--auto' : '') +
    placeClass(b?.place) +
    placeClass(b?.mobile?.place, 'm-')
  );
}

/** The CSS variables of a block's element: its grid area, layer and mobile area. */
export function blockVars(b) {
  const p = placeOf(b?.pos);
  const m = hasMobileArea(b?.mobile) ? placeOf(b.mobile, MCOLS) : null;
  const ratio = sizeOf(b) === 'aspect' ? ratioOf(b?.aspect) : null;
  return (
    `--c:${p.col};--s:${p.span};--r:${p.row};--rs:${spanOf(b, p)}` +
    (Number.isInteger(b?.z) && b.z !== 0 ? `;--z:${b.z}` : '') +
    (ratio ? `;--ar:${ratio[0]} / ${ratio[1]}` : '') +
    (m ? `;--mc:${m.col};--ms:${m.span};--mr:${m.row};--mrs:${spanOf(b, m)}` : '')
  );
}

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
  const where = `content/${file} (sections/${at}/blocks/${j})`;
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
  return `<div class="${blockClass(block)}"${marker} style="${blockVars(block)}"${hidden}>${t.render(data, ctx, b)}</div>`;
}

/**
 * Section `at` of a page file, rendered. numbers: headingNumbers() of the whole page (a
 * section rendered on its own still counts the headings before it).
 */
export function renderSection(ctx, route, file, section, at, numbers = {}) {
  const blocks = (Array.isArray(section?.blocks) ? section.blocks : [])
    .map((b, j) => renderBlock(ctx, route, file, at, j, b, numbers))
    .join('');
  const marker = editable ? ` data-sec="${esc(section?.id ?? '')}"` : '';
  const hidden = section?.enabled === false ? ' hidden' : '';
  return `<section class="${sectionClass(section)}"${marker} style="${sectionVars(section)}"${hidden}>${blocks}</section>`;
}

/** The sections of a page file, rendered in order. route: the page's route (route.album on [slug] pages). */
export function renderSections(ctx, route, file, sections) {
  const list = Array.isArray(sections) ? sections : [];
  const numbers = headingNumbers(list);
  return list.map((s, at) => renderSection(ctx, route, file, s, at, numbers)).join('');
}
