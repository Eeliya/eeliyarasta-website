/**
 * One-off migration (exp/square-grid-120, second step): free blocks with links, auto height by
 * default, a 60-column phone grid.
 *
 *   size     a block without one was 'rows' (its rows, more when its content needed them);
 *            the default is 'auto' now, so it gets 'rows' (fixed) and keeps its height
 *   links    blocks used to push the blocks below them in their columns; they are free now, so
 *            a block that had blocks above it in its columns follows the lowest of them (the
 *            one whose growth pushed it: { to, gap } with the rows between them as the gap),
 *            on the desktop grid and, where it had one, on its phone area
 *   phone    phone areas on the 24-column grid -> 60 columns (×2.5, columns and rows: the
 *            cells are 2.5 times smaller); sections that stacked on phones now show their
 *            desktop layout halved (nothing to store)
 *
 *   node scripts/migrate-links.mjs [content dir]    (default: content)
 *
 * Run it once: a page that already has a link, or a phone area reaching past column 24,
 * counts as migrated and is left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { COLS, MCOLS, OLD_SQUARE_MCOLS, hasMobileArea, placeOf } from '../src/site/layout/grid.js';
import { formatJSON } from '../src/editor/lib/json-format.js';

const K = MCOLS / OLD_SQUARE_MCOLS; // 2.5

/** A phone area of the 24-column square grid on the 60-column one. */
export function widenPhone(m) {
  const a = placeOf(m, OLD_SQUARE_MCOLS);
  const col = Math.round((a.col - 1) * K) + 1;
  const end = Math.round((a.col + a.span - 1) * K);
  const row = Math.round((a.row - 1) * K) + 1;
  const last = Math.round((a.row + a.rows - 1) * K);
  return {
    col,
    span: Math.max(1, Math.min(MCOLS, end) - col + 1),
    row,
    rows: Math.max(1, last - row + 1),
  };
}

/**
 * The link that keeps a block where the old flow put it: the lowest block above it in its
 * columns (areas: { id: area }), or null. Ties: the one that shares the most columns with it.
 */
export function pusherOf(id, areas) {
  const b = areas[id];
  let best = null;
  for (const [other, a] of Object.entries(areas)) {
    if (other === id || a.row + a.rows - 1 >= b.row) continue; // not above
    const shared = Math.min(a.col + a.span, b.col + b.span) - Math.max(a.col, b.col);
    if (shared <= 0) continue; // not in its columns
    const bottom = a.row + a.rows - 1;
    if (!best || bottom > best.bottom || (bottom === best.bottom && shared > best.shared))
      best = { to: other, bottom, shared };
  }
  return best && { to: best.to, gap: b.row - best.bottom - 1 };
}

/** A section with links, sizes and 60-column phone areas. */
export function migrateSection(s) {
  const blocks = (s.blocks || []).map((b) => {
    const next = structuredClone(b);
    if (next.size === undefined) next.size = 'rows';
    if (hasMobileArea(next.mobile)) next.mobile = { ...next.mobile, ...widenPhone(next.mobile) };
    return next;
  });
  const desk = Object.fromEntries(
    blocks.filter((b) => b.pos).map((b) => [b.id, placeOf(b.pos, COLS)]),
  );
  const phone = Object.fromEntries(
    blocks.filter((b) => hasMobileArea(b.mobile)).map((b) => [b.id, placeOf(b.mobile, MCOLS)]),
  );
  for (const b of blocks) {
    // fixed placements (sticky, fixed, fullscreen, pinned) weren't pushed
    if (desk[b.id] && !b.link && (b.place ?? 'none') === 'none') {
      const l = pusherOf(b.id, desk);
      if (l) b.link = l;
    }
    if (phone[b.id] && !b.mobile.link && (b.mobile.place ?? 'none') === 'none') {
      const l = pusherOf(b.id, phone);
      if (l) b.mobile.link = l;
    }
  }
  return { ...s, blocks };
}

/** Has a page been migrated (a link, or a phone area past column 24)? */
const migrated = (page) =>
  (page.sections || []).some((s) =>
    (s.blocks || []).some(
      (b) =>
        b.link ||
        b.mobile?.link ||
        (hasMobileArea(b.mobile) &&
          (b.mobile.col || 1) + (b.mobile.span || 0) - 1 > OLD_SQUARE_MCOLS),
    ),
  );

/** A page file's content migrated (unchanged when it already is, or has no sections). */
export function migratePage(page) {
  if (!Array.isArray(page?.sections) || migrated(page)) return page;
  const next = { ...page, sections: page.sections.map(migrateSection) };
  return JSON.stringify(next) === JSON.stringify(page) ? page : next;
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
