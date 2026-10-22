/**
 * The layout engine: every page is a list of sections, each a grid of 120 square cells wide,
 * holding widgets
 * ("sections" in its file, content/en/pages/<page>/index.json or a template's [param]/index.json):
 *
 *   { "id": "s-k3x9", "name": "Our people",
 *     "widgets": [{ "id": "b-7qpa", "type": "heading", "title": "People",
 *                  "layout": { "base": { "col": 13, "row": 4 } } }] }
 *
 * Every page is on the one grid of COLS (120) columns (not stored). An area's defaults are left
 * out (col 1, row 1, a span to the last column; no "layout": full width at row 1).
 *
 * The square grid: a section's content width is split into COLS (120) columns of one cell
 * size, --cell = width / 120, and every row is one cell tall, so every cell is exactly square
 * (no gaps either way). src/client/modules/rows.js measures the width at runtime and sets
 * --cell on the section (a ResizeObserver and the window's resize keep it current);
 * _layout.scss has a CSS-only first guess from 100vw. Phones (below 760px) use MCOLS (60)
 * square cells of their own: every widget is on that grid, at its own phone area or else at
 * its desktop area halved (grid.js phoneAreaOf; nothing stacks).
 *
 * A section:
 *   name     optional: its anchor, slugified into its HTML id ("Our people" -> id="our-people",
 *            so /page/#our-people scrolls to it, below the header); unique on its page
 *   height   'custom': exactly `rows.min` rows of square cells, its widgets at their rows from
 *            the top (not centred), the rows below the last widget empty space, more only when
 *            its content needs more; on phones half as many, rounded up, as a widget's desktop
 *            area is halved there | or a minimum, its rows centred: 'fit' (its
 *            content: its rows) | 'third' | 'half' | 'full' (a third, half or all of the
 *            screen's height, svh). Its rows are always down to its lowest widget
 *            (uniform square cells); a taller section centres them vertically, and content
 *            taller than the minimum makes it taller. No space above or below it: the space
 *            between sections is empty rows (rows above its first widget)
 *   width    'contained': inside the page's side margins | 'full': edge to edge
 *   enabled  false: off: not on the public page at all; in the editor's preview rendered hidden
 *            (so it can be turned on live)
 * A widget (its content: src/site/widgets/index.js):
 *   layout   { base, phone? }: where it sits. base: { col, span, row, rows?, link? }: its
 *            grid area (columns 1-120, rows (cells) from 1) and its link. phone (optional,
 *            below 760px): any of the same keys over the phone grid of 60 columns: an area of
 *            its own (without one: base's area halved) and its phone link (without a phone
 *            area: base's, the gap halved). `rows` is stored only for size "aspect" / "rows";
 *            an auto widget's rows are measured on the page (rows.js, ./flow.js).
 *   size     'auto' (default): as tall as its content | 'aspect': as tall as its columns'
 *            width × `aspect` ("4:5", "16:9", any "w:h") | 'rows': exactly its base rows (fixed)
 *   link     (in base / phone) optional { to, gap }: it follows widget `to` of its section, its
 *            top `gap` cells below that widget's bottom (negative: overlapping); without one it
 *            is free, at its row whatever the widgets above do (./links.js)
 *   scale    optional { on, adjust }: a text widget's text in cells (./type.js)
 *   z        its layer when widgets overlap (higher is in front)
 *   motion   optional { anim, ...timing }: its animation from the library and its own timing
 *            (./motion.js)
 *   item     optional { source, slug }: the source item its bound fields show (./bindings.js;
 *            on a [param] page they show the page's item without one)
 * Positions become CSS variables on the elements; src/client/styles/_layout.scss lays them out.
 */
import { esc, ed, editRef, editable, slugify, warnOnce } from '../helpers.js';
import { WIDGET_TYPES } from '../widgets/index.js';
import { eachWidget, newId } from './ids.js';
import { motionAttrs } from './motion.js';
import { isBinding, keysOf, resolve, resolveWidget } from './bindings.js';
import { widgetItems } from './source.js';
import { COLS, baseOf, phoneAreaOf, placeOf, setBase } from './grid.js';
import { linkOf } from './links.js';
import { adjustOf, fitted, scaled } from './type.js';

export {
  COLS,
  MCOLS,
  halfArea,
  hasMobileArea,
  phoneAreaOf,
  placeOf,
  baseOf,
  phoneOf,
  setBase,
  setPhone,
  storesRows,
} from './grid.js';
export { linkOf, linkProblems, makesLoop } from './links.js';
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
 * A section's height on phones: its own (phone.height, set in the phone preview), else its
 * desktop height.
 */
export const phoneHeightOf = (s) =>
  HEIGHTS.includes(s?.phone?.height) ? s.phone.height : heightOf(s);
/**
 * A section's phone rows when its phone height is custom: its own (phone.rows.min), or its
 * desktop rows halved, rounded up; 0 otherwise (also custom without rows: as fit).
 */
export const mobileMinRowsOf = (s) => {
  if (phoneHeightOf(s) !== 'custom') return 0;
  const own = s.phone?.rows?.min;
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
/** A widget's height: its content (the default), its width × an aspect ratio, or fixed rows. */
export const SIZES = ['auto', 'aspect', 'rows'];
export const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '3:2', '16:9', '21:9'];

/** "16:9" -> [16, 9]; null unless two positive numbers. */
export function ratioOf(text) {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(text ?? '').trim());
  return m && Number(m[1]) > 0 && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null;
}

/** A widget's size mode ('auto' when unset or unknown). */
export const sizeOf = (b) => (SIZES.includes(b?.size) ? b.size : 'auto');

/**
 * A new widget of `type`: its defaults, on, full width at `pos` (8 rows, ~90px at 1440px, from
 * row 1 by default), auto height, free (no link). taken: the ids already on the page (the new
 * one is added).
 */
export function newWidget(type, taken, pos = {}) {
  const { config = {}, ...rest } = structuredClone(WIDGET_TYPES[type].defaults || {});
  const b = { id: newId('b', taken), type, ...rest, config };
  setBase(b, { col: 1, span: COLS, row: 1, rows: 8, ...pos });
  return b;
}

/** A new section holding `widgets`: its content's height (fit), contained, no name. */
export function newSection(taken, widgets = []) {
  return { id: newId('s', taken), widgets };
}

/** The rows a section has: down to its lowest widget (1 when it has none). */
export function rowsOf(section) {
  const widgets = Array.isArray(section?.widgets) ? section.widgets : [];
  return Math.max(
    1,
    ...widgets.map((b) => {
      const p = placeOf(baseOf(b));
      return p.row + p.rows - 1;
    }),
  );
}

/**
 * The rows of a section's phone grid: as far down as its widgets' phone areas reach, and its
 * desktop rows halved (the empty rows below its widgets scale with it).
 */
export function mobileRowsOf(section) {
  const widgets = Array.isArray(section?.widgets) ? section.widgets : [];
  return Math.max(
    Math.ceil(rowsOf(section) / 2),
    ...widgets.map((b) => {
      const m = phoneAreaOf(b);
      return m.row + m.rows - 1;
    }),
  );
}

/** The CSS variables of a section's element. */
export function sectionVars(s) {
  // custom: that many rows, its widgets where they are from the top, the rows below the last
  // one empty space (more when its content needs more); on phones its phone height's (its own
  // or the desktop's): its own phone rows, or the desktop's halved, like a widget's area there.
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
  const own = HEIGHTS.includes(s?.phone?.height);
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

/**
 * The classes of a widget's element: its type, size mode (wgt--aspect, wgt--auto; fixed rows:
 * neither), scaled text, hidden on phones.
 */
export function widgetClass(b) {
  const size = sizeOf(b);
  const aspect = size === 'aspect' && ratioOf(b?.aspect);
  return (
    `wgt wgt--${b?.type}` +
    (aspect ? ' wgt--aspect' : size === 'auto' || size === 'aspect' ? ' wgt--auto' : '') +
    (scaled(b) ? ' wgt--scale' : '') +
    (fitted(b) ? ' wgt--fit' : '') +
    (b?.layout?.phone === null ? ' wgt--m-hidden' : '')
  );
}

/**
 * The CSS variables of a widget's element: its grid area, layer, phone area (its own, or its
 * desktop area halved) and its text's scale.
 */
export function widgetVars(b) {
  const p = placeOf(baseOf(b));
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
 * A widget's links as attributes of its element (src/client/modules/rows.js reads them):
 * data-link="<id> <gap>" (desktop), data-mlink (the phone grid's; ./links.js linkOf).
 */
export function widgetLinks(b) {
  const d = linkOf(b);
  const m = linkOf(b, true);
  return {
    'data-link': d ? `${d.to} ${d.gap}` : null,
    'data-mlink': m ? `${m.to} ${m.gap}` : null,
  };
}

const linkAttrs = (b) =>
  Object.entries(widgetLinks(b))
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');

/** The number (1, 2, ...) of each numbered Text widget on the page, by widget id. */
export function headingNumbers(sections) {
  const numbers = {};
  let n = 0;
  for (const [b, s] of eachWidget(sections))
    if (
      s.enabled !== false &&
      b?.type === 'text' &&
      b.config?.numbered &&
      b.config.enabled !== false
    )
      numbers[b.id] = ++n;
  return numbers;
}

/** One widget of section `at` (its index `j`), rendered with its grid area. */
function renderWidget(ctx, route, file, at, j, widget, numbers) {
  const t = WIDGET_TYPES[widget?.type];
  const where = `content/en/${file} (sections/${at}/widgets/${j})`;
  if (!t) {
    warnOnce(`${where}: unknown widget type "${widget?.type}": skipped`, 'layout');
    return '';
  }
  const parts = (path) => ['sections', at, 'widgets', j, ...[path].flat()];
  // what it shows (./source.js): its items, the first one for its bound fields
  const shown = widgetItems(ctx, route, widget);
  const { item, source } = shown;
  if (t.item && !item) {
    warnOnce(`${where}: a "${t.type}" widget shows an item: it has none: skipped`, 'layout');
    return '';
  }
  const keys = keysOf(ctx, source);
  // a bound value isn't edited in the preview: data-bound instead (a click selects the widget),
  // and data-bound-missing when its item or a field of it is missing (a dimmed {{name}})
  const bound = (value, path) => {
    let missing = false;
    resolve(value, { item, keys, onwarn: () => (missing = true) });
    const attr = ` data-bound="${esc(editRef(file, parts(path)))}"`;
    return missing ? `${attr} data-bound-missing` : attr;
  };
  const b = {
    id: widget.id,
    file,
    ...shown,
    number: numbers[widget.id] || 0,
    ed: (path, type) => {
      const value = [path].flat().reduce((v, k) => v?.[k], widget);
      if (!isBinding(value)) return ed(file, parts(path), type);
      return editable ? bound(value, path) : '';
    },
  };
  // the widget with the item's values in its bound fields (as it is when nothing is bound)
  const data = resolveWidget(widget, t, { item, source, ctx, at: where, placeholders: editable });
  const marker = editable ? ` data-widget="${esc(widget.id)}"` : '';
  const hidden = widget.config?.enabled === false ? ' hidden' : '';
  return `<div class="${widgetClass(widget)}"${marker} style="${widgetVars(widget)}"${linkAttrs(widget)}${motionAttrs(widget)}${hidden}>${t.render(data, ctx, b)}</div>`;
}

/**
 * Section `at` of a page file, rendered. numbers: headingNumbers() of the whole page (a
 * section rendered on its own still counts the headings before it).
 */
export function renderSection(ctx, route, file, section, at, numbers = {}) {
  if (section?.enabled === false && !editable) return ''; // off: not on the public page
  const widgets = (Array.isArray(section?.widgets) ? section.widgets : [])
    .map((b, j) => renderWidget(ctx, route, file, at, j, b, numbers))
    .join('');
  const marker = editable ? ` data-sec="${esc(section?.id ?? '')}"` : '';
  const anchor = sectionAnchor(section);
  const hidden = section?.enabled === false ? ' hidden' : '';
  return `<section${anchor ? ` id="${anchor}"` : ''} class="${sectionClass(section)}"${marker} style="${sectionVars(section)}"${hidden}>${widgets}</section>`;
}

/** The sections of a page file, rendered in order. route: the page's route (route.album on [param] pages). */
export function renderSections(ctx, route, file, sections) {
  const list = Array.isArray(sections) ? sections : [];
  const numbers = headingNumbers(list);
  return list.map((s, at) => renderSection(ctx, route, file, s, at, numbers)).join('');
}
