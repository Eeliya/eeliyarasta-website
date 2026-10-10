/**
 * One-off migration (layout engine, phase 1): every page's old list of typed sections
 * becomes a list of layout sections, each holding its old section as one full-width block.
 * The old outer paddings (CSS, in vh) become the new section's spacing, in rows of 8px.
 *
 *   node scripts/migrate-layout.mjs [content dir]    (default: content)
 *
 * Kept for reference; running it again on migrated content changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { newId, idsOf } from '../src/site/layout/ids.js';

/** The new section around each old type: [height, align, width, spacing top, bottom]. */
const LOOK = {
  hero: ['screen', 'stretch', 'full', 0, 0],
  album: ['screen', 'stretch', 'full', 0, 0],
  intro: ['auto', 'center', 'contained', 25, 22],
  grid: ['auto', 'center', 'contained', 11, 14],
  projects: ['auto', 'center', 'contained', 11, 14],
  heading: ['auto', 'center', 'contained', 23, 9],
  albums: ['auto', 'center', 'contained', 0, 18],
  panels: ['auto', 'center', 'contained', 0, 18],
  about: ['auto', 'center', 'contained', 21, 16],
  text: ['auto', 'center', 'contained', 5, 5],
  photo: ['auto', 'center', 'contained', 5, 5],
  button: ['auto', 'center', 'contained', 5, 5],
  form: ['auto', 'center', 'contained', 5, 5],
};

/** The look of an old section, with its variants (a centred heading, a page's own project list). */
function lookOf(old) {
  if (old.type === 'heading' && old.config?.center) return ['screen', 'center', 'contained', 0, 0];
  if (old.type === 'projects' && !old.title) return ['auto', 'center', 'contained', 0, 14];
  return LOOK[old.type] || LOOK.text;
}

/** An old section ({ type, ...fields, config }) as a new section with it as its one block. */
export function migrateSection(old, taken) {
  const { type, config = {}, ...fields } = old;
  const { enabled = true, ...settings } = config;
  const [height, align, width, top, bottom] = lookOf(old);
  return {
    id: newId('s', taken),
    height,
    align,
    rows: 1,
    width,
    spacing: { top, bottom },
    enabled: enabled !== false,
    blocks: [
      {
        id: newId('b', taken),
        type,
        ...fields,
        config: settings,
        pos: { col: 1, span: 24, row: 1, rows: 1 },
      },
    ],
  };
}

/** A page file's content, migrated (unchanged when it already is). */
export function migratePage(page) {
  const list = Array.isArray(page?.sections) ? page.sections : [];
  if (!list.some((s) => s && !Array.isArray(s.blocks))) return page;
  const taken = idsOf(list);
  return {
    ...page,
    sections: list.map((s) => (Array.isArray(s?.blocks) ? s : migrateSection(s, taken))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.join(process.argv[2] || 'content', 'pages');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const file = path.join(dir, f);
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = migratePage(page);
    if (next === page) continue;
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    console.log(`migrated ${file}`);
  }
}
