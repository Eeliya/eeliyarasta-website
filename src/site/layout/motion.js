/**
 * Block motion: a block's `motion` picks an animation of the library
 * (content/en/settings/animations.json, `presets`) and may set its own timing:
 *
 *   "motion": { "anim": "grid-reveal", "delay": 0.3, "trigger": "load" }
 *
 * The library alone says what an animation does (its type, from / to, split, children, ...);
 * a block only picks one and may override TIMING (duration, ease, delay, stagger, trigger,
 * start, end, scrub). It is rendered as data-motion (the animation) and data-motion-options
 * (the overrides, JSON) on the block's element, and played by src/client/anim/engine.js on the
 * block's content (its children, or the animation's `children` inside it), so the block's
 * own element stays free for its placement (sticky, fixed, pinned).
 *
 * Animation types a block can use (BLOCK_ANIM_TYPES): entrances (`reveal`, `split`), and
 * scroll-linked ones (`scroll`, `scrub-words`, `parallax`). The others (scatter, hero-title,
 * hover-preview) need their own markup: they stay on data-anim elements inside a block type.
 *
 * Parts: those data-anim elements inside a block may get their own animation or timing for
 * this block only, under `parts`, keyed by their data-anim name (every element with that name
 * in the block):
 *
 *   "motion": { "parts": { "hero.title": { "preset": "stagger-up", "delay": 0.2 } } }
 *
 * A part's values go over the name's own (animations.json `targets`). Rendered as
 * data-anim-parts (JSON) on the block's element. `anim` is left out when only parts are set.
 */
import { esc } from '../helpers.js';

/** The values a block (or any element) may set for itself: when and how fast, not what. */
export const TIMING_KEYS = [
  'duration',
  'ease',
  'delay',
  'stagger',
  'trigger',
  'start',
  'end',
  'scrub',
];

/** Animation types that work on any block. */
export const BLOCK_ANIM_TYPES = ['reveal', 'split', 'scroll', 'scrub-words', 'parallax'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Shape problems of a block's `motion` (not whether its animation exists: motionProblems). */
export function checkMotion(m) {
  if (!isObject(m)) return ['"motion" must be an object { anim, ...timing, parts }'];
  const out = [];
  const bad = (k, want) => out.push(`"motion.${k}" must be ${want}`);
  const { parts, ...rest } = m;
  if (parts !== undefined) {
    if (!isObject(parts) || !Object.keys(parts).length)
      bad('parts', 'an object { "<data-anim name>": { preset, ...timing } }, or left out');
    else
      for (const [name, p] of Object.entries(parts)) {
        if (!isObject(p) || !Object.keys(p).length) {
          bad(`parts.${name}`, 'an object { preset, ...timing }');
          continue;
        }
        const { preset, ...timing } = p;
        if (preset !== undefined && (typeof preset !== 'string' || !preset))
          bad(`parts.${name}.preset`, 'the id of an animation');
        out.push(...timingProblems(timing, `parts.${name}.`));
      }
  }
  if (m.anim === undefined && parts !== undefined) {
    if (Object.keys(rest).length) bad('anim', 'set when the block sets its own timing');
    return out;
  }
  if (typeof m.anim !== 'string' || !m.anim) bad('anim', 'the id of an animation');
  const { anim: _a, ...timing } = rest; // eslint-disable-line no-unused-vars
  return [...out, ...timingProblems(timing, '')];
}

function timingProblems(t, pre) {
  const out = [];
  const bad = (k, want) => out.push(`"motion.${pre}${k}" must be ${want}`);
  for (const [k, v] of Object.entries(t)) {
    if (!TIMING_KEYS.includes(k)) bad(k, `left out: only ${TIMING_KEYS.join(', ')} can be set`);
    else if (['duration', 'delay', 'stagger'].includes(k) && !num(v))
      bad(k, 'a number (0 or more)');
    else if (['ease', 'start', 'end'].includes(k) && typeof v !== 'string') bad(k, 'a string');
    else if (k === 'trigger' && !['load', 'scroll'].includes(v)) bad(k, '"load" or "scroll"');
    else if (k === 'scrub' && typeof v !== 'boolean' && !num(v))
      bad(k, 'true, false or seconds of smoothing');
  }
  return out;
}

/**
 * Blocks whose animation isn't in the library, or can't play on a block:
 * [{ file, message }]. content: loadContent()'s; files: only these page files (null: all).
 */
export function motionProblems(content, { pageFile, files = null } = {}) {
  const presets = content.animations?.presets || {};
  const out = [];
  for (const [id, page] of Object.entries(content.pages || {})) {
    const file = pageFile(id);
    if (files && !files.has(file)) continue;
    (page?.sections || []).forEach((s, at) =>
      (s?.blocks || []).forEach((b, j) => {
        const where = `content/en/${file}: section ${at + 1}, block ${j + 1} (${b.type})`;
        const parts = b?.motion?.parts;
        if (isObject(parts))
          for (const [name, p] of Object.entries(parts))
            if (typeof p?.preset === 'string' && !presets[p.preset])
              out.push({
                file,
                message: `${where}: part "${name}" uses unknown animation "${p.preset}"`,
              });
        const anim = b?.motion?.anim;
        if (typeof anim !== 'string') return;
        const p = presets[anim];
        if (!p) out.push({ file, message: `${where}: unknown animation "${anim}"` });
        else if (!BLOCK_ANIM_TYPES.includes(p.type))
          out.push({
            file,
            message: `${where}: the animation "${anim}" (${p.type}) needs its own markup, not a block`,
          });
      }),
    );
  }
  return out;
}

/** The motion attributes of a block's element ('' without motion). */
export function motionAttrs(b) {
  const m = b?.motion;
  if (!isObject(m)) return '';
  const { anim, parts, ...timing } = m;
  const own = isObject(parts) ? ` data-anim-parts="${esc(JSON.stringify(parts))}"` : '';
  if (typeof anim !== 'string') return own;
  const opts = Object.keys(timing).length
    ? ` data-motion-options="${esc(JSON.stringify(timing))}"`
    : '';
  return ` data-motion="${esc(anim)}"${opts}${own}`;
}
