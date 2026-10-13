/**
 * Defaults are never stored: a page file leaves out every value that equals its default.
 * DEFAULTS lists them; omitDefaults(file, data) strips them (the editor's save does this before
 * writing), storedDefaults(file, data) lists the ones still there (validation reports them).
 *
 *   section  enabled: true, width: "contained", height: "fit"
 *   block    size: "auto", config.enabled: true
 *   hero     photos[].layer: "back"
 *   backdrop the page's (src/site/backdrop.js BACKDROP_DEFAULTS); and the other transition's
 *            options, and a backdrop without photos, are left out too
 *
 * omitDefaults also tidies (not a validation error): no empty "config" or "meta", and a block's
 * area without col 1, row 1 or a span to the last column (no "layout": full width at row 1).
 *
 * The animation library (animations.json presets) is not covered: each animation carries every
 * value it uses (there is no global layer to fall back on).
 */
import { pageIdOf } from './files.js';
import { COLS } from './layout/grid.js';
import { tidyBackdrop } from './backdrop.js';

export const DEFAULTS = {
  section: { enabled: true, width: 'contained', height: 'fit' },
  block: { size: 'auto' },
  config: { enabled: true },
  heroPhoto: { layer: 'back' },
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every [object, defaults, where] of a page's data that can hold a default. */
function* places(data) {
  for (const [at, s] of (Array.isArray(data?.sections) ? data.sections : []).entries()) {
    if (!isObject(s)) continue;
    yield [s, DEFAULTS.section, `section ${at + 1}`];
    for (const [j, b] of (Array.isArray(s.blocks) ? s.blocks : []).entries()) {
      if (!isObject(b)) continue;
      const where = `section ${at + 1}, block ${j + 1}`;
      yield [b, DEFAULTS.block, where];
      if (isObject(b.config)) yield [b.config, DEFAULTS.config, `${where} config`];
      if (b.type === 'hero' && Array.isArray(b.photos))
        for (const [i, p] of b.photos.entries())
          if (isObject(p)) yield [p, DEFAULTS.heroPhoto, `${where} photo ${i + 1}`];
    }
  }
}

const isEmpty = (v) => isObject(v) && !Object.keys(v).length;

/** Strip the DEFAULTS values from a page's `data` in place, calling found(where, message) for each. */
function strip(data, found) {
  tidyBackdrop(data, (message) => found('backdrop', message));
  for (const [obj, defs, where] of places(data))
    for (const [k, v] of Object.entries(defs))
      if (obj[k] === v) {
        found(where, `"${k}" is the default (${JSON.stringify(v)}): leave it out`);
        delete obj[k];
      }
}

/**
 * Tidy a page's `data` in place for saving (not a validation error: the editor's copy keeps
 * whole areas while it works): no empty "config" or "meta", and a block's desktop area without
 * its defaults (col 1, row 1, a span that reaches the last column; placeOf fills them in), its
 * "layout" left out when nothing is left (full width at row 1).
 */
function tidy(data) {
  if (isEmpty(data.meta)) delete data.meta;
  for (const s of Array.isArray(data.sections) ? data.sections : [])
    for (const b of Array.isArray(s?.blocks) ? s.blocks : []) {
      if (!isObject(b)) continue;
      if (isEmpty(b.config)) delete b.config;
      const base = b.layout?.base;
      if (!isObject(base)) continue;
      const col = Number.isInteger(base.col) ? base.col : 1;
      if (base.col === 1) delete base.col;
      if (base.row === 1) delete base.row;
      if (Number.isInteger(base.span) && col + base.span - 1 === COLS) delete base.span;
      if (isEmpty(base) && Object.keys(b.layout).length === 1) delete b.layout;
    }
}

/** A copy of a content file's data without its default values (only page files have any). */
export function omitDefaults(file, data) {
  if (!pageIdOf(file) || !isObject(data)) return data;
  const copy = structuredClone(data);
  strip(copy, () => {});
  tidy(copy);
  return copy;
}

/** Problems for values stored that equal their default: ["section 1: \"enabled\" is the default (true): leave it out"]. */
export function storedDefaults(file, data) {
  if (!pageIdOf(file) || !isObject(data)) return [];
  const out = [];
  strip(structuredClone(data), (where, message) => out.push(`${where}: ${message}`));
  return out;
}
