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

/** Does a block's `phone` hold an area (it can hold only a placement or a link)? */
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
  hasMobileArea(b?.phone) ? placeOf(b.phone, MCOLS) : halfArea(b?.pos);
