/**
 * Defaults are never stored: a page file leaves out every value that equals its default.
 * DEFAULTS lists them; omitDefaults(file, data) strips them (the editor's save does this before
 * writing), storedDefaults(file, data) lists the ones still there (validation reports them).
 *
 *   section  enabled: true, width: "contained", height: "fit"
 *   block    size: "auto", config.enabled: true
 *   hero     photos[].layer: "back"
 *
 * The animation library (animations.json presets) is not covered: each animation carries every
 * value it uses (there is no global layer to fall back on).
 */
import { pageIdOf } from './files.js';

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

/** A copy of a content file's data without its default values (only page files have any). */
export function omitDefaults(file, data) {
  if (!pageIdOf(file) || !isObject(data)) return data;
  const copy = structuredClone(data);
  for (const [obj, defs] of places(copy))
    for (const [k, v] of Object.entries(defs)) if (obj[k] === v) delete obj[k];
  return copy;
}

/** Problems for values stored that equal their default: ["section 1: \"enabled\" is the default (true): leave it out"]. */
export function storedDefaults(file, data) {
  if (!pageIdOf(file) || !isObject(data)) return [];
  const out = [];
  for (const [obj, defs, where] of places(data))
    for (const [k, v] of Object.entries(defs))
      if (obj[k] === v)
        out.push(`${where}: "${k}" is the default (${JSON.stringify(v)}): leave it out`);
  return out;
}
