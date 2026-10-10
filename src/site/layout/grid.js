/**
 * The square grid's numbers, without the rest of the layout engine (the page's
 * src/client/modules/rows.js imports them): see ./index.js.
 */
export const COLS = 120;
/** Columns of the phone grid (a block's `mobile` area); see _layout.scss for why 24. */
export const MCOLS = 24;
/** The columns of the grid before the square grid (scripts/migrate-square-grid.mjs). */
export const OLD_COLS = 24;
export const OLD_MCOLS = 12;
/**
 * The size of a cell in px: a section's content width over its columns, floored to the
 * browser's layout unit (1/64 px) so a column and a row come out exactly as wide as tall
 * (the few px left over are centred). src/client/modules/rows.js sets it as --cell.
 */
export const cellOf = (width, cols = COLS) =>
  width > 0 ? Math.max(1 / 64, Math.floor((width / cols) * 64) / 64) : 0;
