/**
 * Content checks, shared by the build, the dev server and the editor's Save (Node and browser).
 * Light on purpose: only the shapes the templates and the client rely on, so one bad value
 * gives a clear error naming the file instead of a broken site.
 *
 *   parseContent(text, file)   JSON.parse, with "content/<file>: invalid JSON … (line L, column C)"
 *   checkContent(file, data)   a list of problems ([] when fine), e.g. "footer must be an object"
 */
import { ANIMATIONS, NAV, PHOTOS, SITE, TEMPLATE, pageIdOf, sourceIdOf } from './files.js';
import { SECTION_TYPES } from './sections/index.js';

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

/**
 * nav.json: { header: [items], footer: [items] }, item { label, page | href, all?, items?,
 * children? }. Header items can have one level of children; footer items are plain links.
 * Whether a page exists needs the routes: the templates warn about that (header.js linkOf).
 */
function checkNav(d) {
  const out = optional(d, { header: 'array', footer: 'array' });
  const check = (item, where, { nest, menu }) => {
    if (!isObject(item)) return out.push(`${where} must be an object`);
    const name = `${where}${typeof item.label === 'string' ? ` ("${item.label}")` : ''}`;
    const bad = (msg) => out.push(`${name}: ${msg}`);
    if (typeof item.label !== 'string') bad('needs a "label"');
    if ((item.page === undefined) === (item.href === undefined))
      bad('needs a "page" (a path like /about/) or an "href" (a link), one of them');
    else if (item.page !== undefined && !/^\/([\w-]+\/)*$/.test(String(item.page)))
      bad(`"page" must be a page path like /about/, not "${item.page}"`);
    else if (item.href !== undefined && typeof item.href !== 'string')
      bad('"href" must be a string');
    out.push(...optional(item, { all: 'string', items: 'string' }).map((p) => `${name}: ${p}`));
    if (menu === 'footer' && ['children', 'items', 'all'].some((k) => item[k] !== undefined))
      bad('footer links are plain links (no "children", "items" or "all")');
    if (item.children === undefined) return;
    if (!nest) return bad('"children" go one level deep');
    if (!Array.isArray(item.children)) return bad('"children" must be a list');
    if (item.items !== undefined) bad('has "children" or "items", not both');
    item.children.forEach((c, j) => check(c, `${name} child ${j + 1}`, { nest: false, menu }));
  };
  for (const menu of ['header', 'footer'])
    if (Array.isArray(d[menu]))
      d[menu].forEach((item, i) =>
        check(item, `${menu} item ${i + 1}`, { nest: menu === 'header', menu }),
      );
  return out;
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
  const out = optional(d, { meta: 'object', sections: 'array' });
  if (pageIdOf(file).endsWith(TEMPLATE) && typeof d.config?.source !== 'string')
    out.push('"config.source" must name a source (a [slug] page makes a page per item)');
  if (Array.isArray(d.sections)) out.push(...d.sections.flatMap(checkSection));
  return out;
}

const FIELD_TYPES = { number: 'number' }; // the other field types are strings
const CONFIG_TYPES = { boolean: 'boolean' }; // the other config types are strings

/** One page section against its type in the registry; an unknown type only warns (render). */
function checkSection(s, at) {
  const where = `section ${at + 1}`;
  if (!isObject(s)) return [`${where} must be an object`];
  if (typeof s.type !== 'string') return [`${where} needs a "type"`];
  const t = SECTION_TYPES[s.type];
  if (!t) return [];
  const out = [];
  const bad = (key, want) => out.push(`${where} (${t.label}): "${key}" must be ${want}`);
  for (const f of t.fields || []) {
    const v = s[f.key];
    if (v === undefined) continue;
    if (!f.list) {
      if (typeof v !== (FIELD_TYPES[f.type] || 'string'))
        bad(f.key, `a ${FIELD_TYPES[f.type] || 'string'}`);
    } else if (!Array.isArray(v)) bad(f.key, 'a list');
    else if (
      typeof f.list === 'string' ? !v.every((x) => typeof x === 'string') : !v.every(isObject)
    )
      bad(f.key, typeof f.list === 'string' ? 'a list of strings' : 'a list of objects');
  }
  if (s.config === undefined) return out;
  if (!isObject(s.config)) return [...out, `${where} (${t.label}): "config" must be an object`];
  const { enabled } = s.config;
  if (enabled !== undefined && typeof enabled !== 'boolean') bad('config.enabled', 'true or false');
  for (const c of t.config || []) {
    const v = s.config[c.key];
    if (v === undefined || (c.empty && v === '')) continue;
    if (typeof v !== (CONFIG_TYPES[c.type] || 'string'))
      bad(`config.${c.key}`, `a ${CONFIG_TYPES[c.type] || 'string'}`);
    else if (c.options && !c.options.some(([o]) => o === v))
      bad(`config.${c.key}`, `one of ${c.options.map(([o]) => o).join(', ')}`);
  }
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
  if (file === NAV) return checkNav(data);
  if (file === PHOTOS) return checkPhotos(data);
  if (pageIdOf(file)) return checkPage(file, data);
  return [];
}

/** Throws "content/<file>: <problems>" when the data doesn't fit. */
export function assertContent(file, data) {
  const problems = checkContent(file, data);
  if (problems.length) throw new Error(`content/${file}: ${problems.join('; ')}`);
}
