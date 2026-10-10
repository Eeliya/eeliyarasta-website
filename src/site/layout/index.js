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
 *            a row grows when its content needs more | 'screen': at least the screen's height,
 *            its rows placed by `align` ('top' | 'center' | 'bottom' | 'stretch': fill it)
 *   width    'contained': inside the page's side margins | 'full': edge to edge
 *   spacing  { top, bottom }: empty rows above and below the grid
 *   enabled  false: hidden (still rendered, so the editor can turn it on live)
 * A block (its content: src/site/blocks/index.js):
 *   pos      { col, span, row, rows }: its grid area, columns 1-24 and rows from 1
 *   z        its layer when blocks overlap (higher is in front)
 *   mobile   optional { col, span, row, rows } below 760px; without one, the section's
 *            blocks stack full width in their order
 * Positions become CSS variables on the elements; src/client/styles/_layout.scss lays them out.
 */
import { esc, ed, editable, warnOnce } from '../helpers.js';
import { BLOCK_TYPES } from '../blocks/index.js';
import { newId } from './ids.js';

export const COLS = 24;
export const HEIGHTS = ['auto', 'screen'];
export const WIDTHS = ['contained', 'full'];
export const ALIGNS = ['top', 'center', 'bottom', 'stretch'];

const int = (v, min, fallback) => (Number.isInteger(v) && v >= min ? v : fallback);

/** A block's grid area, completed and kept inside the 24 columns. */
export function placeOf(pos) {
  const col = Math.min(int(pos?.col, 1, 1), COLS);
  return {
    col,
    span: Math.min(int(pos?.span, 1, COLS), COLS - col + 1),
    row: int(pos?.row, 1, 1),
    rows: int(pos?.rows, 1, 1),
  };
}

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
    ...blocks.map((b) => placeOf(b?.pos).row + placeOf(b?.pos).rows - 1),
  );
}

/** The CSS variables of a section's element. */
export const sectionVars = (s) =>
  `--rows:${rowsOf(s)};--pt:${int(s?.spacing?.top, 0, 0)};--pb:${int(s?.spacing?.bottom, 0, 0)}`;

/** The classes of a section's element: its height, width and alignment. */
export function sectionClass(s) {
  const screen = s?.height === 'screen';
  const align = ALIGNS.includes(s?.align) ? s.align : 'center';
  const mobile = (s?.blocks || []).some((b) => b?.mobile);
  return `sec${screen ? ` sec--screen sec--${align}` : ''}${s?.width === 'full' ? ' sec--full' : ''}${mobile ? ' sec--mgrid' : ''}`;
}

/** The CSS variables of a block's element: its grid area, layer and mobile area. */
export function blockVars(b) {
  const p = placeOf(b?.pos);
  const m = b?.mobile ? placeOf(b.mobile) : null;
  return (
    `--c:${p.col};--s:${p.span};--r:${p.row};--rs:${p.rows}` +
    (Number.isInteger(b?.z) && b.z !== 0 ? `;--z:${b.z}` : '') +
    (m ? `;--mc:${m.col};--ms:${m.span};--mr:${m.row};--mrs:${m.rows}` : '')
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
  const b = {
    id: block.id,
    file,
    number: numbers[block.id] || 0,
    ed: (path, type) => ed(file, ['sections', at, 'blocks', j, ...[path].flat()], type),
  };
  const marker = editable ? ` data-block="${esc(block.id)}"` : '';
  const hidden = block.config?.enabled === false ? ' hidden' : '';
  return `<div class="blk blk--${t.type}"${marker} style="${blockVars(block)}"${hidden}>${t.render(block, ctx, b)}</div>`;
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
