/**
 * One-off migration (experiment exp/square-grid-120, then named exp/square-grid-100): the 24-column grid with rows of 8px (or
 * a section's rowHeight) becomes the square grid of 120 columns whose rows are one cell
 * (src/site/layout/grid.js), so a page looks about the same at 1440px wide:
 *
 *   columns  ×5 exactly: col c, span s -> col 5(c - 1) + 1, span 5s (phone areas: 12 -> 24
 *            columns, ×2)
 *   rows     a block's top and bottom edge in px (old rows × row height) over the new cell at
 *            1440px wide (390px for phone areas), rounded to the nearest row line; at least
 *            one row. A section's rows likewise.
 *   rowHeight removed (a row is one cell). Spacing is unchanged: it stays in steps of 8px.
 *
 *   node scripts/migrate-square-grid.mjs [content dir]    (default: content)
 *
 * A page whose blocks already reach past column 24 counts as migrated and is left alone. (Its
 * phone grid was 24 columns; scripts/migrate-links.mjs takes it to 60.)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  COLS,
  OLD_SQUARE_MCOLS as MCOLS,
  OLD_COLS,
  OLD_MCOLS,
  cellOf,
} from '../src/site/layout/grid.js';
import { formatJSON } from '../src/editor/lib/json-format.js';

const OLD_ROW = 8;
/** --pad at a width (clamp(16px, 2.6vw, 40px), src/client/styles/_tokens.scss). */
const padAt = (w) => Math.min(40, Math.max(16, 0.026 * w));
/** The cell of a section at a screen width (contained: inside --pad on both sides). */
export const cellAt = (w, full, cols) => cellOf(full ? w : w - 2 * padAt(w), cols);
export const DESKTOP = 1440;
export const PHONE = 390;

/** An area's rows (row, rows of `old` px) as rows of `cell` px, by its edges. */
export function convertRows({ row, rows }, old, cell) {
  const top = Math.round(((row - 1) * old) / cell);
  const bottom = Math.max(top + 1, Math.round(((row - 1 + rows) * old) / cell));
  return { row: top + 1, rows: bottom - top };
}

const whole = (v, fallback) => (Number.isInteger(v) && v >= 1 ? v : fallback);

/** An area { col, span, row, rows } on `from` columns of `old` px rows, on `to` columns of `cell`. */
export function convertArea(a, from, to, old, cell) {
  const k = to / from;
  const col = whole(a?.col, 1);
  return {
    ...a,
    col: (col - 1) * k + 1,
    span: whole(a?.span, from - col + 1) * k,
    ...convertRows({ row: whole(a?.row, 1), rows: whole(a?.rows, 1) }, old, cell),
  };
}

const hasArea = (m) => !!m && ['col', 'span', 'row', 'rows'].some((k) => m[k] !== undefined);

/** A section on the square grid. */
export function migrateSection(s) {
  const old = Number.isInteger(s.rowHeight) ? s.rowHeight : OLD_ROW;
  const full = s.width === 'full';
  const cell = cellAt(DESKTOP, full, COLS);
  const mcell = cellAt(PHONE, full, MCOLS);
  const { rowHeight: _, ...rest } = s; // eslint-disable-line no-unused-vars
  const blocks = (s.blocks || []).map((b) => {
    const next = { ...b };
    if (b.pos) next.pos = convertArea(b.pos, OLD_COLS, COLS, old, cell);
    if (hasArea(b.mobile)) next.mobile = convertArea(b.mobile, OLD_MCOLS, MCOLS, old, mcell);
    return next;
  });
  const rows = Math.max(
    1,
    Math.round((whole(s.rows, 1) * old) / cell),
    ...blocks.map((b) => (b.pos ? b.pos.row + b.pos.rows - 1 : 1)),
  );
  return { ...rest, rows, blocks };
}

/** Is a page on the square grid already (a block reaches past column 24)? */
const migrated = (page) =>
  (page.sections || []).some((s) =>
    (s.blocks || []).some((b) => (b.pos?.col || 1) + (b.pos?.span || 0) - 1 > OLD_COLS),
  );

/** A page file's content on the square grid (unchanged when it already is). */
export function migratePage(page) {
  if (!Array.isArray(page?.sections) || migrated(page)) return page;
  return { ...page, sections: page.sections.map(migrateSection) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.join(process.argv[2] || 'content', 'pages');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const file = path.join(dir, f);
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = migratePage(page);
    if (next === page) continue;
    fs.writeFileSync(file, formatJSON(next));
    console.log(`migrated ${file}`);
  }
}
