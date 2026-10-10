/**
 * Content checks, shared by the build, the dev server and the editor's Save (Node and browser).
 * Light on purpose: only the shapes the templates and the client rely on, so one bad value
 * gives a clear error naming the file instead of a broken site.
 *
 *   parseContent(text, file)   JSON.parse, with "content/<file>: invalid JSON … (line L, column C)"
 *   checkContent(file, data)   a list of problems ([] when fine), e.g. "footer must be an object"
 */
import { ANIMATIONS, PHOTOS, SITE, TEMPLATE, pageIdOf, sourceIdOf } from './files.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const typeOf = (v) =>
  v === null
    ? 'null'
    : Array.isArray(v)
      ? 'an array'
      : typeof v === 'object'
        ? 'an object'
        : `a ${typeof v}`;

/** JSON.parse with the file and the line and column of the mistake in the error. */
export function parseContent(text, file) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const msg = err.message.replace(/\s*\(line \d+ column \d+\)$/, '');
    const at = /at position (\d+)/.exec(msg);
    let where = '';
    if (at) {
      const before = text.slice(0, Number(at[1])).split('\n');
      where = ` (line ${before.length}, column ${before.at(-1).length + 1})`;
    }
    throw new Error(
      `content/${file}: invalid JSON, ${msg.replace(/ at position \d+/, '')}${where}`,
      { cause: err },
    );
  }
}

/** Problems of keys that may be missing but must have this kind when present. */
function optional(data, kinds) {
  const out = [];
  for (const [key, kind] of Object.entries(kinds)) {
    const v = data[key];
    if (v === undefined) continue;
    const ok =
      kind === 'array' ? Array.isArray(v) : kind === 'object' ? isObject(v) : typeof v === kind;
    if (!ok)
      out.push(
        `"${key}" must be ${kind === 'array' || kind === 'object' ? `an ${kind}` : `a ${kind}`}, not ${typeOf(v)}`,
      );
  }
  return out;
}

const required = (data, keys, kind) =>
  keys
    .filter((k) => (kind === 'object' ? !isObject(data[k]) : typeof data[k] !== kind))
    .map((k) => `"${k}" must be ${kind === 'object' ? 'an object' : `a ${kind}`}`);

function checkSite(d) {
  return [
    ...required(d, ['name', 'url'], 'string'),
    ...optional(d, {
      title: 'string',
      description: 'string',
      timezone: 'string',
      social: 'array',
      footer: 'object',
      nav: 'object',
      labels: 'object',
    }),
  ];
}

function checkAnimations(d) {
  const out = [
    ...required(d, ['presets', 'targets', 'transitions'], 'object'),
    ...optional(d, { elements: 'object', interactions: 'object', smoothScroll: 'boolean' }),
  ];
  for (const group of ['presets', 'targets', 'elements'])
    for (const [k, v] of Object.entries(isObject(d[group]) ? d[group] : {}))
      if (!isObject(v)) out.push(`${group}["${k}"] must be an object`);
  return out;
}

function checkPage(file, d) {
  const out = optional(d, { meta: 'object', sections: 'array', title: 'string' });
  if (pageIdOf(file).endsWith(TEMPLATE) && typeof d.config?.source !== 'string')
    out.push('"config.source" must name a source (a [slug] page makes a page per item)');
  return out;
}

/** photos.json: { alt?, and for R2 photos srcset: [{ key, w }], width, height, ... } per photo. */
function checkPhotos(d) {
  return Object.entries(d).flatMap(([k, v]) => {
    if (!isObject(v)) return [`photo "${k}" must be an object`];
    const out = optional(v, { alt: 'string', srcset: 'array' }).map((p) => `photo "${k}": ${p}`);
    if (Array.isArray(v.srcset) && !v.srcset.every((s) => isObject(s) && typeof s.key === 'string'))
      out.push(`photo "${k}": every size in "srcset" needs a "key"`);
    return out;
  });
}

/** Problems with one content file's data, [] when it's fine. file: "settings/site.json", … */
export function checkContent(file, data) {
  const sourceId = sourceIdOf(file);
  if (sourceId) {
    if (!Array.isArray(data)) return [`must be a list (a JSON array), not ${typeOf(data)}`];
    return data.flatMap((item, i) => (isObject(item) ? [] : [`item ${i + 1} must be an object`]));
  }
  if (!isObject(data)) return [`must be an object, not ${typeOf(data)}`];
  if (file === SITE) return checkSite(data);
  if (file === ANIMATIONS) return checkAnimations(data);
  if (file === PHOTOS) return checkPhotos(data);
  if (pageIdOf(file)) return checkPage(file, data);
  return [];
}

/** Throws "content/<file>: <problems>" when the data doesn't fit. */
export function assertContent(file, data) {
  const problems = checkContent(file, data);
  if (problems.length) throw new Error(`content/${file}: ${problems.join('; ')}`);
}
