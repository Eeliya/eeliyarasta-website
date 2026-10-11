/**
 * One-off migration of a page's sections to their settings now: a name (optional, untouched),
 * a minimum height preset with the content always centred, a width, no space above or below.
 *
 *   height   'screen' (Fullscreen) -> 'full'; 'auto' (Rows), 'aspect' or none -> 'fit'. Its
 *            `aspect` is dropped
 *   align    dropped: the content is always centred ('stretch' was centred too)
 *   rows     dropped: a section's rows are down to its lowest block (rows below it were empty
 *            space, which a block placed lower in the next section gives now)
 *   spacing  dropped, with the phone's (`mobile.spacing`; `mobile` had nothing else): no
 *            compensation, the space between sections is set by hand (empty rows)
 *
 *   node scripts/migrate-sections.mjs [content dir]    (default: content)
 *
 * Safe to run again: a migrated page is left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatJSON } from '../src/editor/lib/json-format.js';
import { HEIGHTS } from '../src/site/layout/index.js';

/** One section migrated (the same object when there is nothing to change). */
export function migrateSection(s) {
  if (!s || typeof s !== 'object') return s;
  const { aspect, spacing, mobile, align, rows, ...rest } = s; // eslint-disable-line no-unused-vars
  const next = { ...rest };
  next.height =
    next.height === 'screen' ? 'full' : HEIGHTS.includes(next.height) ? next.height : 'fit';
  // a section's `mobile` only ever held its phone spacing; anything else in it is kept
  const { spacing: _, ...phone } = mobile && typeof mobile === 'object' ? mobile : {}; // eslint-disable-line no-unused-vars
  if (Object.keys(phone).length) next.mobile = phone;
  return JSON.stringify(next) === JSON.stringify(s) ? s : next;
}

/** A page file's content migrated (unchanged when it already is, or has no sections). */
export function migratePage(page) {
  if (!Array.isArray(page?.sections)) return page;
  const sections = page.sections.map(migrateSection);
  return sections.every((s, i) => s === page.sections[i]) ? page : { ...page, sections };
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
