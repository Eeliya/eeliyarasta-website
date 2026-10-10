/**
 * One-off migration (phase 4, block motion): the animations of whole blocks move from
 * data-anim names in the block templates (targets in animations.json) to the blocks' own
 * `motion` (src/site/layout/motion.js), with the same animation and timing:
 *
 *   intro             home.intro        -> { anim: 'scrub-words' }
 *   grid              home.people.grid  -> { anim: 'grid-reveal' }
 *                     home.places.grid  -> { anim: 'grid-reveal', stagger: 0.15 } (places)
 *   albums, panels    album.grid        -> { anim: 'grid-reveal', trigger: 'load', delay: 0.3 }
 *   projects          projects.list     -> { anim: 'list-up', trigger: 'load' }
 *
 * Those targets leave animations.json, and the library gets the animations blocks use that it
 * lacked (lines-up, list-up) and scroll-linked ones (parallax-y, fade-scrub, scale-scrub).
 * Parts of blocks with their own markup (hero, page heading, about, album, section heads,
 * card photos, the project preview) and the footer keep their data-anim names.
 *
 *   node scripts/migrate-motion.mjs [content dir]    (default: content)
 *
 * Kept for reference; running it again changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatJSON } from '../src/editor/lib/json-format.js';

/** The motion an old block had, by its type (and source), or null. */
export function motionOf(b) {
  switch (b?.type) {
    case 'intro':
      return { anim: 'scrub-words' };
    case 'grid':
      return b.config?.source === 'places'
        ? { anim: 'grid-reveal', stagger: 0.15 }
        : { anim: 'grid-reveal' };
    case 'albums':
    case 'panels':
      return { anim: 'grid-reveal', trigger: 'load', delay: 0.3 };
    case 'projects':
      return { anim: 'list-up', trigger: 'load' };
    default:
      return null;
  }
}

export const MOVED = [
  'home.intro',
  'home.people.grid',
  'home.places.grid',
  'album.grid',
  'projects.list',
];

/** Animations the library gets when it lacks them. */
export const ADDED = {
  'lines-up': {
    type: 'split',
    children: 'h1, h2, h3, p',
    split: 'lines',
    mask: 'lines',
    from: { yPercent: 105 },
    to: { yPercent: 0 },
    duration: 1.1,
    stagger: 0.08,
    ease: 'expo.out',
    delay: 0,
    trigger: 'scroll',
    start: 'top 85%',
  },
  'list-up': {
    type: 'reveal',
    children: '[data-prow]',
    from: { autoAlpha: 0, y: 60 },
    to: { autoAlpha: 1, y: 0 },
    duration: 1.1,
    ease: 'expo.out',
    delay: 0,
    stagger: 0.06,
    trigger: 'scroll',
    start: 'top 90%',
  },
  'parallax-y': {
    type: 'scroll',
    from: { y: 80 },
    to: { y: -80 },
    ease: 'none',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
  'fade-scrub': {
    type: 'scroll',
    from: { autoAlpha: 0 },
    to: { autoAlpha: 1 },
    ease: 'none',
    start: 'top 95%',
    end: 'top 55%',
    scrub: true,
  },
  'scale-scrub': {
    type: 'scroll',
    from: { scale: 0.85 },
    to: { scale: 1 },
    ease: 'none',
    start: 'top bottom',
    end: 'top 35%',
    scrub: true,
  },
};

/** animations.json with the moved targets out and the added animations in. */
export function migrateAnimations(cfg) {
  const targets = Object.fromEntries(
    Object.entries(cfg.targets || {}).filter(([k]) => !MOVED.includes(k)),
  );
  const presets = { ...cfg.presets };
  for (const [k, v] of Object.entries(ADDED)) if (!presets[k]) presets[k] = v;
  const same =
    Object.keys(targets).length === Object.keys(cfg.targets || {}).length &&
    Object.keys(presets).length === Object.keys(cfg.presets || {}).length;
  return same ? cfg : { ...cfg, presets, targets };
}

/** A page with its blocks' motion (blocks that have one are left alone). */
export function migratePage(page) {
  let changed = false;
  const sections = (page?.sections || []).map((s) => ({
    ...s,
    blocks: (s.blocks || []).map((b) => {
      const motion = b.motion ? null : motionOf(b);
      if (!motion) return b;
      changed = true;
      return { ...b, motion };
    }),
  }));
  return changed ? { ...page, sections } : page;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'content';
  const write = (file, data) => fs.writeFileSync(file, formatJSON(data));
  const anim = path.join(dir, 'settings', 'animations.json');
  const cfg = JSON.parse(fs.readFileSync(anim, 'utf8'));
  const next = migrateAnimations(cfg);
  if (next !== cfg) {
    write(anim, next);
    console.log(`migrated ${anim}`);
  }
  const pages = path.join(dir, 'pages');
  for (const f of fs.readdirSync(pages, { recursive: true }).filter((f) => f.endsWith('.json'))) {
    const file = path.join(pages, f);
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = migratePage(page);
    if (out !== page) {
      write(file, out);
      console.log(`migrated ${file}`);
    }
  }
}
