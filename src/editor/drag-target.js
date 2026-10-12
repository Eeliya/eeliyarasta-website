/**
 * Where a block row dragged in the page's sections list lands (SectionsList.svelte), from the
 * rows' places as they were when the drag started (the lifted row's own place counts: let go
 * there and nothing moves).
 *   lists  [{ at, top, bottom, rows: [{ top, bottom }] }]: each section's blocks area
 *   from   { at, j }: the dragged row
 *   y      the pointer
 * Returns { at, to, line: { j, side } } (to: its index in that section once moved; line: the
 * drop line, before or after row j), or null: nothing moves (its own place, or the pointer is
 * over no section's blocks: between cards, over the settings).
 */
// px: around a blocks area that still count as over it, and how far a press moves to be a drag
export const SLACK = 4;

export function dropTarget(lists, from, y) {
  const list = lists.find((l) => y >= l.top - SLACK && y <= l.bottom + SLACK);
  if (!list) return null;
  // its insertion point among the list's rows, its own row included: 0..n
  const k = list.rows.filter((r) => (r.top + r.bottom) / 2 < y).length;
  const n = list.rows.length;
  const line = k < n ? { j: k, side: 'before' } : { j: n - 1, side: 'after' };
  if (list.at !== from.at) return { at: list.at, to: k, line: n ? line : { j: 0, side: 'before' } };
  const to = k > from.j ? k - 1 : k;
  return to === from.j ? null : { at: list.at, to, line };
}
