/**
 * One-off migration (layout engine, phase 1): every page's old list of typed sections
 * becomes a list of layout sections, each holding its old section as one full-width block.
 * The old outer paddings (CSS, in vh) become the new section's spacing, in rows of 8px.
 *
 *   node scripts/migrate-layout.mjs [content dir]    (default: content)
 *
 * Phase 3 adds each old type's phone paddings as the section's `mobile.spacing` (they were
 * smaller than the desktop's), also to sections migrated before, when their spacing is still
 * the migrated one.
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

/**
 * The old phone paddings (below 760px) in rows, measured on a 390x844 phone with its 64px
 * header: [top, bottom], or nothing when the phone had the desktop's.
 *   intro 14vh/14vh · grid, projects 10vh/12vh · heading header+8vh/8vh · albums, panels
 *   -/16vh · about header+4vh/14vh · text, photo, button, form 4vh/4vh
 */
const PHONE = {
  hero: [0, 0],
  album: [0, 0],
  intro: [15, 15],
  grid: [11, 13],
  projects: [11, 13],
  heading: [16, 8],
  albums: [0, 17],
  panels: [0, 17],
  about: [12, 15],
  text: [4, 4],
  photo: [4, 4],
  button: [4, 4],
  form: [4, 4],
};

/** The phone spacing of an old section ({ top, bottom }), or null when it is the desktop's. */
export function phoneSpacingOf(old) {
  const [, , , top, bottom] = lookOf(old);
  let phone = PHONE[old.type] || PHONE.text;
  if (old.type === 'heading' && old.config?.center) phone = [0, 0];
  if (old.type === 'projects' && !old.title) phone = [0, 13];
  return phone[0] === top && phone[1] === bottom ? null : { top: phone[0], bottom: phone[1] };
}

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
  const phone = phoneSpacingOf(old);
  return {
    id: newId('s', taken),
    height,
    align,
    rows: 1,
    width,
    spacing: { top, bottom },
    ...(phone && { mobile: { spacing: phone } }),
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

/**
 * A section migrated before phase 3, with the phone spacing of its one old block, when its
 * spacing is still the migrated one and it has no phone spacing yet (else unchanged).
 */
export function withPhoneSpacing(section) {
  const block = section.blocks?.length === 1 && section.blocks[0];
  if (!block || section.mobile?.spacing) return section;
  const old = { ...block, config: block.config || {} };
  const [, , , top, bottom] = lookOf(old);
  if (section.spacing?.top !== top || section.spacing?.bottom !== bottom) return section;
  const phone = phoneSpacingOf(old);
  return phone ? { ...section, mobile: { ...section.mobile, spacing: phone } } : section;
}

/** A page file's content, migrated (unchanged when it already is). */
export function migratePage(page) {
  const list = Array.isArray(page?.sections) ? page.sections : [];
  const taken = idsOf(list);
  const next = list.map((s) =>
    Array.isArray(s?.blocks) ? withPhoneSpacing(s) : migrateSection(s, taken),
  );
  return next.some((s, i) => s !== list[i]) ? { ...page, sections: next } : page;
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
