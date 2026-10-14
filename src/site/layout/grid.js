/**
 * The square grid's numbers and areas, without the rest of the layout engine (the page's
 * src/client/modules/rows.js imports them): see ./index.js.
 */
export const COLS = 120;
/**
 * Columns of the phone grid (a block's `phone` area): 60, half of 120, so a block without a
 * phone area of its own shows its desktop area halved there (phoneAreaOf): the phone is the
 * desktop layout scaled down, ~6px cells at 390px.
 */
export const MCOLS = 60;
/** The widest phone (px): at or below it the phone grid and image sizes. */
export const PHONE_MAX = 760;
/** PHONE_MAX as a media query, for matchMedia and an <img> sizes. */
export const PHONE_MQ = `(max-width: ${PHONE_MAX}px)`;
/**
 * The size of a cell in px: a section's content width over its columns, floored to the
 * browser's layout unit (1/64 px) so a column and a row come out exactly as wide as tall
 * (the few px left over are centred). src/client/modules/rows.js sets it as --cell.
 */
export const cellOf = (width, cols = COLS) =>
  width > 0 ? Math.max(1 / 64, Math.floor((width / cols) * 64) / 64) : 0;

const int = (v, min, fallback) => (Number.isInteger(v) && v >= min ? v : fallback);

/** A block's grid area, completed and kept inside `cols` columns (120; the phone grid's 60). */
export function placeOf(pos, cols = COLS) {
  const col = Math.min(int(pos?.col, 1, 1), cols);
  return {
    col,
    span: Math.min(int(pos?.span, 1, cols), cols - col + 1),
    row: int(pos?.row, 1, 1),
    rows: int(pos?.rows, 1, 1),
  };
}

/** Does a block's `phone` hold an area (it can hold only a link)? */
export const hasMobileArea = (m) =>
  !!m && ['col', 'span', 'row', 'rows'].some((k) => m[k] !== undefined);

/**
 * A desktop area halved onto the phone grid: the cells it covers, half as many (its first
 * column and row rounded down, its last ones up, so it covers at least what it did).
 */
export function halfArea(pos) {
  const p = placeOf(pos);
  const col = Math.floor((p.col - 1) / 2) + 1;
  const end = Math.ceil((p.col + p.span - 1) / 2);
  const row = Math.floor((p.row - 1) / 2) + 1;
  return { col, span: Math.max(1, end - col + 1), row, rows: Math.max(1, Math.ceil(p.rows / 2)) };
}

/** A block's area on the phone grid: its own phone area, else its desktop area halved. */
export const phoneAreaOf = (b) =>
  hasMobileArea(phoneOf(b)) ? placeOf(phoneOf(b), MCOLS) : halfArea(baseOf(b));

/*
 * A block's layout: { base, phone? } (./index.js). base: its area on the page grid
 * { col, span, row, rows? } plus its `link`; phone: what changes on phones, any of the same
 * keys on the phone grid (an area, a link). `rows` is stored only when the
 * block's height isn't its content's (size "aspect" or "rows"): an auto block's rows are
 * measured on the page (src/client/modules/rows.js), never stored.
 */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** The keys of an area. */
export const AREA_KEYS = ['col', 'span', 'row', 'rows'];
/** A block's base layout ({} without one). */
export const baseOf = (b) => (isObj(b?.layout?.base) ? b.layout.base : {});
/** A block's phone layout (undefined without one). */
export const phoneOf = (b) => (isObj(b?.layout?.phone) ? b.layout.phone : undefined);
/** Does a block store its rows (its height isn't its content's)? */
export const storesRows = (b) => b?.size === 'aspect' || b?.size === 'rows';

function tidy(b, o) {
  const next = { ...o };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  if (!storesRows(b)) delete next.rows;
  return next;
}
/** Merge `patch` into a block's base (a key set to undefined is removed). */
export function setBase(b, patch) {
  b.layout = { ...(isObj(b.layout) ? b.layout : {}), base: tidy(b, { ...baseOf(b), ...patch }) };
}
/** Merge `patch` into a block's phone layout; removed when nothing is left (null: removed). */
export function setPhone(b, patch) {
  const next = patch === null ? {} : tidy(b, { ...phoneOf(b), ...patch });
  const layout = { ...(isObj(b.layout) ? b.layout : {}) };
  if (Object.keys(next).length) layout.phone = next;
  else delete layout.phone;
  b.layout = layout;
}
/** Drop stored rows a block no longer keeps (after its size changed). */
export function tidyRows(b) {
  if (storesRows(b)) return;
  if (baseOf(b).rows !== undefined) setBase(b, {});
  if (phoneOf(b)?.rows !== undefined) setPhone(b, {});
}
