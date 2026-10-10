/**
 * Real rows: a section is a grid of uniform rows (one square cell, --cell, tall), and every block
 * spans a whole number of them. A block's stored area (pos, or its phone area) is where it was
 * placed; at any width a block may need another number of rows than it stores:
 *
 *   rows    at least its stored rows, more when its content needs them (text never spills)
 *   auto    the rows its content needs
 *   aspect  the rows its width × its ratio needs
 *
 * flowRows works out where the blocks go then. A block that needs n more (or fewer) rows
 * than it stores pushes the blocks below it in its columns down (or lets them up) by n, and
 * those push theirs; a block held by two blocks above it moves by the larger push. Blocks
 * beside it, or overlapping it, stay. The section has as many rows as it needs to hold them,
 * plus the empty rows it had below its lowest block. The client (src/client/modules/rows.js)
 * measures the blocks and applies the result; the editor stores it when a block is dragged.
 */

/**
 * items: [{ id, col, span, row, rows, need }]: a block's stored area and the rows it needs
 * now (null or undefined: its stored rows, e.g. a sticky block). sectionRows: the section's
 * stored row count (rowsOf). Returns { rows, at: { id: { row, rows } } }.
 */
export function flowRows(items, sectionRows = 1) {
  const list = items
    .map((b) => ({ ...b, now: Number.isInteger(b.need) && b.need > 0 ? b.need : b.rows }))
    .sort((a, b) => a.row - b.row);
  const shift = new Map();
  for (const b of list) {
    let by = null;
    for (const a of list) {
      if (a === b || a.row + a.rows - 1 >= b.row) continue; // not above b
      if (a.col + a.span <= b.col || b.col + b.span <= a.col) continue; // not in its columns
      const push = shift.get(a) + a.now - a.rows;
      by = by === null ? push : Math.max(by, push);
    }
    shift.set(b, by ?? 0);
  }
  const at = {};
  let end = 0;
  let stored = 0;
  for (const b of list) {
    const row = Math.max(1, b.row + shift.get(b));
    at[b.id] = { row, rows: b.now };
    end = Math.max(end, row + b.now - 1);
    stored = Math.max(stored, b.row + b.rows - 1);
  }
  const rows = list.length ? end + Math.max(0, sectionRows - stored) : sectionRows;
  return { rows: Math.max(1, rows), at };
}

/** Rows of `row` px that `px` needs (a hair under a whole row still counts as that row). */
export const rowsFor = (px, row) => Math.max(1, Math.ceil(px / row - 0.01));
