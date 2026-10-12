/**
 * Content checks, shared by the build, the dev server and the editor's Save (Node and browser).
 * Light on purpose: only the shapes the templates and the client rely on, so one bad value
 * gives a clear error naming the file instead of a broken site.
 *
 *   parseContent(text, file)   JSON.parse, with "content/<file>: invalid JSON … (line L, column C)"
 *   checkContent(file, data)   a list of problems ([] when fine), e.g. "footer must be an object"
 *
 * A source's items against its schema (required fields, types, photos) are checked by
 * checkItems (src/site/schemas.js): that needs the schema and the photos, not one file.
 */
import {
  ANIMATIONS,
  NAV,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  VERSION,
  TEMPLATE,
  isSlug,
  pageIdOf,
  schemaIdOf,
  sourceIdOf,
} from './files.js';
import { checkSchema } from './schemas.js';
import { BLOCK_TYPES } from './blocks/index.js';
import {
  COLS,
  HEIGHTS,
  MAX_MIN_ROWS,
  MCOLS,
  PLACES,
  SIZES,
  WIDTHS,
  nameProblems,
  ratioOf,
} from './layout/index.js';
import { linkProblems } from './layout/links.js';
import { checkScale, checkTypography } from './layout/type.js';
import { checkLayout } from './layout/contain.js';
import { isId } from './layout/ids.js';
import { checkMotion } from './layout/motion.js';
import { bindTypeOf, FORMAT_TYPES, isBinding } from './layout/bindings.js';

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
      `content/en/${file}: invalid JSON, ${msg.replace(/ at position \d+/, '')}${where}`,
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
      titleTemplate: 'string',
      description: 'string',
      ogImage: 'string',
      lang: 'string',
      timezone: 'string',
      social: 'array',
      labels: 'object',
      forms: 'object',
    }),
    ...checkForms(d.forms),
    ...checkTypography(d.typography),
    ...checkLayout(d.layout),
    ...(d.robots === undefined || ['index', 'noindex'].includes(d.robots)
      ? []
      : ['"robots" must be "index" or "noindex"']),
  ];
}

/** site.json "forms": where contact forms send (src/site/blocks/form.js). */
function checkForms(f) {
  if (!isObject(f)) return [];
  const out = optional(f, { target: 'string', endpoint: 'string', turnstileSiteKey: 'string' });
  if (f.target !== undefined && !['function', 'endpoint', 'email'].includes(f.target))
    out.push('"target" must be "function", "endpoint" or "email"');
  if (f.endpoint && !/^https:\/\/\S+$/.test(f.endpoint))
    out.push('"endpoint" must be an https:// URL');
  return out.map((p) => `forms: ${p}`);
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

/**
 * settings/redirects.json (src/site/redirects.js): a list of { from, to, status? }. Whether `to`
 * is a page needs the routes: the build warns about that.
 */
function checkRedirects(d) {
  if (!Array.isArray(d)) return [`"redirects" must be a list (a JSON array), not ${typeOf(d)}`];
  const out = [];
  const seen = new Set();
  d.forEach((r, i) => {
    const name = `redirect ${i + 1}`;
    if (!isObject(r)) return out.push(`${name} must be an object`);
    if (typeof r.from !== 'string' || !r.from.startsWith('/') || r.from.startsWith('//'))
      out.push(`${name}: "from" must be a path that starts with /`);
    else if (/\s/.test(r.from)) out.push(`${name}: "from" can't have spaces`);
    else if (seen.has(r.from)) out.push(`${name}: another redirect is from ${r.from}`);
    seen.add(r.from);
    if (typeof r.to !== 'string' || !/^(\/(?!\/)|https?:\/\/)\S*$/.test(r.to))
      out.push(`${name}: "to" must be a path that starts with / or an http(s) URL, without spaces`);
    if (r.status !== undefined && ![301, 302].includes(r.status))
      out.push(`${name}: "status" is 301 (moved for good, the default) or 302 (for now)`);
  });
  return out;
}

/** A page's search and share meta (src/site/seo.js). */
function checkMeta(meta) {
  if (!isObject(meta)) return [];
  return optional(meta, {
    title: 'string',
    description: 'string',
    image: 'string',
    canonical: 'string',
    noindex: 'boolean',
  }).map((p) => `meta: ${p}`);
}

function checkAnimations(d) {
  const out = [
    ...required(d, ['presets', 'targets', 'transitions'], 'object'),
    ...optional(d, { elements: 'object', interactions: 'object' }),
  ];
  for (const group of ['presets', 'targets', 'elements'])
    for (const [k, v] of Object.entries(isObject(d[group]) ? d[group] : {}))
      if (!isObject(v)) out.push(`${group}["${k}"] must be an object`);
  return out;
}

function checkPage(file, d) {
  const out = [...optional(d, { meta: 'object', sections: 'array' }), ...checkMeta(d.meta)];
  if (pageIdOf(file).endsWith(TEMPLATE) && typeof d.template?.source !== 'string')
    out.push('"template.source" must name a source (a [slug] page makes a page per item)');
  if (!pageIdOf(file).endsWith(TEMPLATE) && d.template !== undefined)
    out.push('"template" is only for [slug] pages');
  if (!Array.isArray(d.sections)) return out;
  out.push(...d.sections.flatMap(checkSection));
  // names: their anchors (ids) unique on the page, and ids at all
  nameProblems(d.sections).forEach((p, at) => p && out.push(`section ${at + 1}: "name" ${p}`));
  // links: within their section, to a block that is there, no loops (layout/links.js)
  const all = new Set(
    d.sections.flatMap((s) => (Array.isArray(s?.blocks) ? s.blocks.map((b) => b?.id) : [])),
  );
  d.sections.forEach((s, at) => {
    if (!Array.isArray(s?.blocks)) return;
    out.push(...linkProblems(s.blocks, all).map((p) => `section ${at + 1}: ${p}`));
  });
  const seen = new Set();
  for (const id of d.sections.flatMap((s) => [s?.id, ...(s?.blocks || []).map((b) => b?.id)]))
    if (typeof id === 'string' && seen.has(id)) out.push(`the id "${id}" is used twice`);
    else seen.add(id);
  return out;
}

const FIELD_TYPES = { number: 'number' }; // the other field types are strings
const CONFIG_TYPES = { boolean: 'boolean' }; // the other config types are strings
const whole = (v, min) => Number.isInteger(v) && v >= min;

/** A grid area { col, span, row, rows } of a block (pos, or its mobile area). */
function checkArea(p, key, cols = COLS) {
  if (!isObject(p)) return [`"${key}" must be an object { col, span, row, rows }`];
  const out = [];
  for (const k of ['col', 'span', 'row', 'rows'])
    if (!whole(p[k], 1)) out.push(`"${key}.${k}" must be a whole number from 1`);
  if (!out.length && p.col + p.span - 1 > cols)
    out.push(`"${key}" must end by column ${cols} (col ${p.col} + span ${p.span})`);
  return out;
}

const isRatio = (v) => typeof v === 'string' && ratioOf(v) !== null;

/** One page section: its layout, then each block. */
function checkSection(s, at) {
  const where = `section ${at + 1}`;
  if (!isObject(s)) return [`${where} must be an object`];
  const out = [];
  const bad = (key, want) => out.push(`${where}: "${key}" must be ${want}`);
  if (!isId(s.id, 's')) bad('id', 'a section id like "s-k3x9"');
  if (s.height !== undefined && !HEIGHTS.includes(s.height))
    bad('height', `one of ${HEIGHTS.join(', ')}`);
  // custom: its minimum rows (only there)
  const min = s.rows?.min;
  if (s.rows !== undefined && (!isObject(s.rows) || Object.keys(s.rows).some((k) => k !== 'min')))
    bad('rows', "an object { min } (a custom height's rows)");
  else if (s.height === 'custom' && !whole(min, 1))
    bad('rows.min', 'a whole number of rows from 1 (a custom height)');
  else if (min !== undefined && !(whole(min, 1) && min <= MAX_MIN_ROWS))
    bad('rows.min', `a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  else if (s.rows !== undefined && s.height !== 'custom')
    bad('rows', 'left out unless the height is custom');
  // phones: a height of its own and, custom there, its rows
  if (s.mobile !== undefined) {
    const { rows, height, ...rest } = isObject(s.mobile) ? s.mobile : { x: 1 };
    const minRows = rows?.min;
    const phone = HEIGHTS.includes(height) ? height : s.height;
    if (
      !isObject(s.mobile) ||
      Object.keys(rest).length ||
      (rows !== undefined && (!isObject(rows) || Object.keys(rows).some((k) => k !== 'min')))
    )
      bad('mobile', "an object { height, rows: { min } } (the phone's height and rows)");
    else if (height !== undefined && !HEIGHTS.includes(height))
      bad('mobile.height', `one of ${HEIGHTS.join(', ')}`);
    else if (height === 'custom' && s.height !== 'custom' && minRows === undefined)
      bad('mobile.rows.min', 'a whole number of rows from 1 (a custom phone height)');
    else if (minRows !== undefined && phone !== 'custom')
      bad('mobile.rows', 'left out unless the phone height is custom');
    else if (minRows !== undefined && !(whole(minRows, 1) && minRows <= MAX_MIN_ROWS))
      bad('mobile.rows.min', `a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  }
  if (s.width !== undefined && !WIDTHS.includes(s.width)) bad('width', WIDTHS.join(' or '));
  if (s.enabled !== undefined && typeof s.enabled !== 'boolean') bad('enabled', 'true or false');
  if (!Array.isArray(s.blocks)) return [...out, `${where}: "blocks" must be a list`];
  return [...out, ...s.blocks.flatMap((b, j) => checkBlock(b, `${where}, block ${j + 1}`))];
}

/** One block: its place, then its content against its type in the registry. */
function checkBlock(b, where) {
  if (!isObject(b)) return [`${where} must be an object`];
  if (typeof b.type !== 'string') return [`${where} needs a "type"`];
  const t = BLOCK_TYPES[b.type];
  const name = t ? `${where} (${t.label})` : where;
  const out = [];
  const bad = (key, want) => out.push(`${name}: "${key}" must be ${want}`);
  if (!isId(b.id, 'b')) bad('id', 'a block id like "b-7qpa"');
  if (b.pos !== undefined) out.push(...checkArea(b.pos, 'pos').map((p) => `${name}: ${p}`));
  if (b.size !== undefined && !SIZES.includes(b.size)) bad('size', SIZES.join(', '));
  if ((b.size === 'aspect' || b.aspect !== undefined) && !isRatio(b.aspect))
    bad('aspect', 'a ratio like "4:5"');
  if (b.place !== undefined && !PLACES.includes(b.place)) bad('place', 'a placement (see layout)');
  if (b.mobile !== undefined) {
    if (!isObject(b.mobile)) bad('mobile', 'an object { col, span, row, rows, place, link }');
    else {
      const { place, link, ...area } = b.mobile; // eslint-disable-line no-unused-vars
      if (place !== undefined && !PLACES.includes(place))
        bad('mobile.place', 'a placement (see layout)');
      if (Object.keys(area).length)
        out.push(...checkArea(area, 'mobile', MCOLS).map((p) => `${name}: ${p}`));
    }
  }
  if (b.z !== undefined && !Number.isInteger(b.z)) bad('z', 'a whole number');
  out.push(...checkScale(b).map((p) => `${name}: ${p}`));
  if (b.motion !== undefined) out.push(...checkMotion(b.motion).map((p) => `${name}: ${p}`));
  if (!t) return out; // an unknown type only warns (render)
  if (
    b.item !== undefined &&
    !(isObject(b.item) && isSlug(b.item.source) && typeof b.item.slug === 'string')
  )
    bad('item', '{ "source": "<source>", "slug": "<item slug>" }');
  // a value can be bound to the item (../layout/bindings.js): { "bind": "<field>", "format"? }
  const bindShape = (key, v, type) => {
    const extra = Object.keys(v).filter((k) => k !== 'bind' && k !== 'format');
    if (extra.length || !/^[\w-]+$/.test(v.bind))
      bad(key, '{ "bind": "<field>", "format": "… {value} …" } (one field name)');
    else if (!type) bad(key, "a list of its own (it can't be bound)");
    else if (v.format !== undefined && !FORMAT_TYPES.includes(type))
      bad(`${key}.format`, 'left out (only a text can have a format)');
    else if (
      v.format !== undefined &&
      !(typeof v.format === 'string' && v.format.includes('{value}'))
    )
      bad(`${key}.format`, 'a text with {value} in it');
  };
  for (const c of t.config || []) {
    const v = b.config?.[c.key];
    if (isBinding(v)) bindShape(`config.${c.key}`, v, bindTypeOf(c, { config: true }));
  }
  for (const f of t.fields || []) {
    const v = b[f.key];
    if (v === undefined) continue;
    if (isBinding(v)) {
      bindShape(f.key, v, bindTypeOf(f));
      continue;
    }
    if (Array.isArray(v) && isObject(f.list))
      v.forEach((e, i) =>
        Object.entries(isObject(e) ? e : {}).forEach(([k, sv]) => {
          const sub = f.list[k];
          const type = (isObject(sub) ? sub.type : sub) || 'text';
          if (isBinding(sv))
            bindShape(`${f.key}.${i}.${k}`, sv, FORMAT_TYPES.includes(type) ? type : null);
        }),
      );
    if (!f.list) {
      if (typeof v !== (FIELD_TYPES[f.type] || 'string'))
        bad(f.key, `a ${FIELD_TYPES[f.type] || 'string'}`);
    } else if (!Array.isArray(v)) bad(f.key, 'a list');
    else if (
      typeof f.list === 'string' ? !v.every((x) => typeof x === 'string') : !v.every(isObject)
    )
      bad(f.key, typeof f.list === 'string' ? 'a list of strings' : 'a list of objects');
  }
  if (t.check) out.push(...t.check(b).map((p) => `${name}: ${p}`));
  if (b.config === undefined) return out;
  if (!isObject(b.config)) return [...out, `${name}: "config" must be an object`];
  const { enabled } = b.config;
  if (enabled !== undefined && typeof enabled !== 'boolean') bad('config.enabled', 'true or false');
  for (const c of t.config || []) {
    const v = b.config[c.key];
    if (v === undefined || (c.empty && v === '') || isBinding(v)) continue;
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

/**
 * Problems with one content file's data, [] when it's fine. file: "settings/site.json", …
 * Every file is an object with "version": 1 (VERSION, src/site/files.js) first; a source's
 * list is its "items", redirects.json's "redirects", photos.json's map "photos".
 */
export function checkContent(file, data) {
  if (!isObject(data)) return [`must be an object, not ${typeOf(data)}`];
  if (data.version !== VERSION) return [`"version" must be ${VERSION} (the content's shape)`];
  const { version: _v, ...d } = data; // eslint-disable-line no-unused-vars
  if (sourceIdOf(file)) {
    if (d.items === undefined) return ['"items" is missing (a list, a JSON array)'];
    if (!Array.isArray(d.items))
      return [`"items" must be a list (a JSON array), not ${typeOf(d.items)}`];
    return d.items.flatMap((item, i) =>
      isObject(item) ? [] : [`item ${i + 1} must be an object`],
    );
  }
  if (schemaIdOf(file)) return checkSchema(d);
  if (file === REDIRECTS) return checkRedirects(d.redirects);
  if (file === SITE) return checkSite(d);
  if (file === ANIMATIONS) return checkAnimations(d);
  if (file === NAV) return checkNav(d);
  if (file === STRINGS) return optional(d, { footer: 'object', nav: 'object' });
  if (file === PHOTOS)
    return isObject(d.photos) ? checkPhotos(d.photos) : ['"photos" must be an object'];
  if (pageIdOf(file)) return checkPage(file, d);
  return [];
}

/** Throws "content/<file>: <problems>" when the data doesn't fit. */
export function assertContent(file, data) {
  const problems = checkContent(file, data);
  if (problems.length) throw new Error(`content/en/${file}: ${problems.join('; ')}`);
}
