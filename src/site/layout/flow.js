/**
 * Real rows: a section is a grid of uniform rows (one square cell, --cell, tall), and every widget
 * spans a whole number of them. A widget's stored area (layout.base, or its phone area; an auto widget stores no rows: 1) is where it was
 * placed; at any width a widget may need another number of rows than it stores:
 *
 *   auto    the rows its content needs (the default)
 *   aspect  the rows its width × its ratio needs
 *   rows    exactly its stored rows (fixed)
 *
 * Widgets are free: a widget stays at its stored row whatever the widgets above it do, and widgets
 * may overlap. A linked widget (./links.js) follows its leader instead: its first row is the
 * leader's last row now + 1 + its gap (cells; negative overlaps them), at least row 1.
 * resolveRows works that out in the links' order (a leader before its followers; a link to a
 * widget that isn't placed, or one in a loop, counts as free). The section has the rows its
 * lowest widget reaches now, plus the empty rows it had below its lowest widget as stored. The
 * client (src/client/modules/rows.js) measures the widgets and applies the result; the editor
 * stores it when a widget is dragged.
 */

/**
 * items: [{ id, row, rows, need, link }]: a widget's stored rows, the rows it needs now (null or
 * undefined: its stored rows) and the link it follows ({ to, gap } or
 * null). sectionRows: the section's stored row count. Returns { rows, at: { id: { row, rows } } }.
 */
export function resolveRows(items, sectionRows = 1) {
  const byId = new Map();
  for (const b of items)
    byId.set(b.id, { ...b, now: Number.isInteger(b.need) && b.need > 0 ? b.need : b.rows });
  const at = {};
  const busy = new Set();
  const place = (b) => {
    if (at[b.id]) return at[b.id];
    let row = b.row;
    const lead = b.link && b.link.to !== b.id ? byId.get(b.link.to) : null;
    if (lead && !busy.has(lead.id)) {
      busy.add(b.id);
      const l = place(lead);
      busy.delete(b.id);
      // a loop through b: placed while b was busy, so b counts as free
      if (!at[b.id]) row = l.row + l.rows + (Number.isInteger(b.link.gap) ? b.link.gap : 0);
    }
    if (at[b.id]) return at[b.id];
    at[b.id] = { row: Math.max(1, row), rows: b.now };
    return at[b.id];
  };
  for (const b of byId.values()) place(b);
  let end = 0;
  let stored = 0;
  for (const b of byId.values()) {
    end = Math.max(end, at[b.id].row + b.now - 1);
    stored = Math.max(stored, b.row + b.rows - 1);
  }
  const rows = byId.size ? end + Math.max(0, sectionRows - stored) : sectionRows;
  return { rows: Math.max(1, rows), at };
}

/** Rows of `row` px that `px` needs (a hair under a whole row still counts as that row). */
export const rowsFor = (px, row) => Math.max(1, Math.ceil(px / row - 0.01));
