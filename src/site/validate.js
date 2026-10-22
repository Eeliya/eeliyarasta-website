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
import { AREA_KEYS, storesRows } from './layout/grid.js';
import { storedDefaults } from './defaults.js';
import {
  ANIMATIONS,
  NAV,
  PHOTOS,
  REDIRECTS,
  SITE,
  STRINGS,
  VERSION,
  isTemplate,
  isParamName,
  isSlug,
  pageIdOf,
  DOC_KINDS,
  docKindOf,
  schemaIdOf,
  sourceIdOf,
  contentPath,
} from './files.js';
import { CORE_STRINGS } from './strings.js';
import { checkSchema } from './schemas.js';
import { WIDGET_TYPES } from './widgets/index.js';
import {
  COLS,
  HEIGHTS,
  MAX_MIN_ROWS,
  MCOLS,
  SIZES,
  WIDTHS,
  nameProblems,
  ratioOf,
} from './layout/index.js';
import { linkProblems } from './layout/links.js';
import { checkScale, checkTypography } from './layout/type.js';
import { checkLayout } from './layout/contain.js';
import { isId } from './layout/ids.js';
import { linkProblem } from './hrefs.js';
import { checkMotion } from './layout/motion.js';
import { checkBackdrop } from './backdrop.js';
import { bindTypeOf, FORMAT_TYPES, isBinding } from './layout/bindings.js';
import { isObject } from './is.js';

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
      `${contentPath(file)}: invalid JSON, ${msg.replace(/ at position \d+/, '')}${where}`,
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
      entityType: 'string',
      themeColor: 'string',
      timezone: 'string',
      social: 'array',
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

/** site.json "forms": where contact forms send (src/site/widgets/form/index.js). */
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
 * nav.json: { header: [items] }, item { label, page | item | href, all?, items?, children? }.
 * Items can have one level of children. Whether a page exists needs the routes: the templates
 * warn about that (header.js linkOf).
 */
function checkNav(d) {
  const out = optional(d, { header: 'array' });
  if (d.footer !== undefined)
    out.push('"footer" is gone: the footer is settings/footer.json, sections like a page');
  const check = (item, where, { nest }) => {
    if (!isObject(item)) return out.push(`${where} must be an object`);
    const name = `${where}${typeof item.label === 'string' ? ` ("${item.label}")` : ''}`;
    const bad = (msg) => out.push(`${name}: ${msg}`);
    if (typeof item.label !== 'string') bad('needs a "label"');
    const link = linkProblem(item, ['label', 'all', 'items', 'children']);
    if (link) bad(link);
    out.push(...optional(item, { all: 'string', items: 'string' }).map((p) => `${name}: ${p}`));
    if (item.children === undefined) return;
    if (!nest) return bad('"children" go one level deep');
    if (!Array.isArray(item.children)) return bad('"children" must be a list');
    if (item.items !== undefined) bad('has "children" or "items", not both');
    item.children.forEach((c, j) => check(c, `${name} child ${j + 1}`, { nest: false }));
  };
  if (Array.isArray(d.header))
    d.header.forEach((item, i) => check(item, `header item ${i + 1}`, { nest: true }));
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
    ...optional(d, { interactions: 'object' }),
  ];
  if (d.elements !== undefined)
    out.push('"elements" is gone: a widget\'s own part animations are its "motion.parts"');
  for (const group of ['presets', 'targets'])
    for (const [k, v] of Object.entries(isObject(d[group]) ? d[group] : {}))
      if (!isObject(v)) out.push(`${group}["${k}"] must be an object`);
  return out;
}

/**
 * A document (src/site/files.js DOC_KINDS): "kind" as its file says, its sections, and what its
 * kind has: a page its id, meta, backdrop, transition and template; a part only sections.
 */
function checkDoc(file, d) {
  const kind = docKindOf(file);
  const out = optional(d, { sections: 'array' });
  if (d.kind !== kind)
    out.push(`"kind" must be "${kind}" (${DOC_KINDS.join(' or ')}: this file's)`);
  if (kind === 'part') {
    for (const k of Object.keys(d))
      if (k !== 'kind' && k !== 'sections')
        out.push(`"${k}" must be left out: a part has only "sections"`);
    return [...out, ...checkSections(d.sections)];
  }
  out.push(...optional(d, { meta: 'object' }), ...checkMeta(d.meta), ...checkBackdrop(d.backdrop));
  // its stable id: what links point at (its folder, the URL, can change)
  if (!isId(d.id, 'pg')) out.push('"id" must be a page id like "pg-k3x9"');
  // the grid is always COLS (120) columns: not stored
  if (d.grid !== undefined) out.push(`"grid" must be left out: the page grid is always ${COLS}`);
  // its page transition: none (the site's curtain) or { preset: "none" } (no curtain)
  const t = d.transition;
  if (t !== undefined && !(isObject(t) && t.preset === 'none' && Object.keys(t).length === 1))
    out.push('"transition" must be { "preset": "none" } or left out (the site\'s curtain)');
  // a [param] page: its main widget decides which pages exist (layout/source.js)
  const template = isTemplate(pageIdOf(file));
  if (d.template !== undefined)
    out.push('"template" is gone: a [param] page\'s main widget decides its pages ("main")');
  if (d.main !== undefined && !template) out.push('"main" is only for [param] pages');
  else if (d.main !== undefined && !isId(d.main, 'b'))
    out.push('"main" must be the id of one of its widgets ("b-7qpa")');
  // its folder's URL opens its first sub page instead (routes.js)
  if (d.ownPage !== undefined && d.ownPage !== false)
    out.push('"ownPage" must be false (the folder opens its first sub page) or left out');
  if (d.ownPage !== undefined && (template || ['home', '404'].includes(pageIdOf(file))))
    out.push('"ownPage" is only for a folder\'s own page (not home, 404 or a [param] page)');
  return [...out, ...checkSections(d.sections)];
}

/** A document's sections: each one, their names, links and ids. */
function checkSections(sections) {
  const out = [];
  if (!Array.isArray(sections)) return out;
  out.push(...sections.flatMap(checkSection));
  // names: their anchors (ids) unique on the page, and ids at all
  nameProblems(sections).forEach((p, at) => p && out.push(`section ${at + 1}: "name" ${p}`));
  // links: within their section, to a widget that is there, no loops (layout/links.js)
  const all = new Set(
    sections.flatMap((s) => (Array.isArray(s?.widgets) ? s.widgets.map((b) => b?.id) : [])),
  );
  sections.forEach((s, at) => {
    if (!Array.isArray(s?.widgets)) return;
    out.push(...linkProblems(s.widgets, all).map((p) => `section ${at + 1}: ${p}`));
  });
  const seen = new Set();
  for (const id of sections.flatMap((s) => [s?.id, ...(s?.widgets || []).map((b) => b?.id)]))
    if (typeof id === 'string' && seen.has(id)) out.push(`the id "${id}" is used twice`);
    else seen.add(id);
  return out;
}

const FIELD_TYPES = { number: 'number' }; // the other field types are strings
const CONFIG_TYPES = { boolean: 'boolean' }; // the other config types are strings
const whole = (v, min) => Number.isInteger(v) && v >= min;

/**
 * A grid area { col, span, row, rows? } of a widget (its base, or its phone area); rows: does
 * the widget store its rows (size aspect / rows: required; auto: left out).
 */
function checkArea(p, key, cols = COLS, rows = true, defaults = false) {
  const out = [];
  for (const k of ['col', 'span', 'row'])
    if (!(defaults && p[k] === undefined) && !whole(p[k], 1))
      out.push(`"${key}.${k}" must be a whole number from 1`);
  if (rows && !whole(p.rows, 1)) out.push(`"${key}.rows" must be a whole number from 1`);
  if (!rows && p.rows !== undefined)
    out.push(`"${key}.rows" must be left out: an auto widget's rows are measured on the page`);
  const col = p.col ?? 1;
  if (!out.length && p.span !== undefined && col + p.span - 1 > cols)
    out.push(`"${key}" must end by column ${cols} (col ${col} + span ${p.span})`);
  return out;
}

/**
 * A widget's "layout": { base: { col, span, row, rows?, link? }, phone?: the same keys
 * on the phone grid, or null (hidden on phones) }. Links are checked with their section.
 */
function checkWidgetLayout(b) {
  const out = [];
  for (const k of ['pos', 'phone', 'link', 'mobile'])
    if (b[k] !== undefined)
      out.push(`"${k}" must be left out: it is in "layout" ({ base, phone })`);
  const l = b.layout;
  if (l === undefined) return out; // full width at row 1
  if (!isObject(l) || Object.keys(l).some((k) => k !== 'base' && k !== 'phone'))
    return [...out, '"layout" must be an object { base, phone? }'];
  const rows = storesRows(b);
  const part = (o, key, cols, whole) => {
    if (!isObject(o)) return [`"${key}" must be an object { col, span, row, rows?, link? }`];
    const res = [];
    const extra = Object.keys(o).filter((k) => !AREA_KEYS.includes(k) && k !== 'link');
    if (extra.length) res.push(`"${key}.${extra[0]}" must be left out (area and link only)`);
    if (whole || AREA_KEYS.some((k) => o[k] !== undefined))
      res.push(...checkArea(o, key, cols, rows, whole));
    return res;
  };
  out.push(...part(l.base, 'layout.base', COLS, true));
  if (l.phone !== undefined && l.phone !== null)
    out.push(...part(l.phone, 'layout.phone', MCOLS, false));
  return out;
}

const isRatio = (v) => typeof v === 'string' && ratioOf(v) !== null;

/** One page section: its layout, then each widget. */
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
  if (s.phone !== undefined) {
    const { rows, height, ...rest } = isObject(s.phone) ? s.phone : { x: 1 };
    const minRows = rows?.min;
    const phone = HEIGHTS.includes(height) ? height : s.height;
    if (
      !isObject(s.phone) ||
      Object.keys(rest).length ||
      (rows !== undefined && (!isObject(rows) || Object.keys(rows).some((k) => k !== 'min')))
    )
      bad('phone', "an object { height, rows: { min } } (the phone's height and rows)");
    else if (height !== undefined && !HEIGHTS.includes(height))
      bad('phone.height', `one of ${HEIGHTS.join(', ')}`);
    else if (height === 'custom' && s.height !== 'custom' && minRows === undefined)
      bad('phone.rows.min', 'a whole number of rows from 1 (a custom phone height)');
    else if (minRows !== undefined && phone !== 'custom')
      bad('phone.rows', 'left out unless the phone height is custom');
    else if (minRows !== undefined && !(whole(minRows, 1) && minRows <= MAX_MIN_ROWS))
      bad('phone.rows.min', `a whole number of rows from 1 to ${MAX_MIN_ROWS}`);
  }
  if (s.width !== undefined && !WIDTHS.includes(s.width)) bad('width', WIDTHS.join(' or '));
  if (s.enabled !== undefined && typeof s.enabled !== 'boolean') bad('enabled', 'true or false');
  if (!Array.isArray(s.widgets)) return [...out, `${where}: "widgets" must be a list`];
  return [...out, ...s.widgets.flatMap((b, j) => checkWidget(b, `${where}, widget ${j + 1}`))];
}

/** A widget's "source" (layout/source.js) against its type: list widgets All, others Item. */
function sourceProblems(src, t) {
  const SHAPE =
    '"source" must be { "mode": "item", "from", "id" }, { "mode": "all", "from" } or { "mode": "url", "from", "where" }';
  if (!isObject(src) || !isSlug(src.from)) return [SHAPE];
  const keys = { item: ['id'], all: [], url: ['where'] }[src.mode];
  if (!keys) return [SHAPE];
  if (Object.keys(src).some((k) => !['mode', 'from', ...keys].includes(k))) return [SHAPE];
  if (src.mode === 'all' && !t.list)
    return ['"source": "all" is for list widgets (Item: one item)'];
  if (src.mode === 'item' && t.list) return ['"source": "item" is for one item (a list: "all")'];
  if (src.mode === 'item' && !isId(src.id, 'p'))
    return ['"source.id" must be an item id ("p-k3x9")'];
  if (src.mode !== 'url') return [];
  const w = src.where;
  const rule = (r) =>
    isObject(r) &&
    isParamName(r.param) &&
    typeof r.field === 'string' &&
    /^[\w-]+$/.test(r.field) &&
    Object.keys(r).length === 2;
  if (!isObject(w) || w.op !== 'and' || !Array.isArray(w.rules) || !w.rules.every(rule))
    return ['"source.where" must be { "op": "and", "rules": [{ "param", "field" }] }'];
  const params = w.rules.map((r) => r.param);
  if (new Set(params).size !== params.length) return ['"source.where": one rule per param'];
  return [];
}

/** One widget: its place, then its content against its type in the registry. */
function checkWidget(b, where) {
  if (!isObject(b)) return [`${where} must be an object`];
  if (typeof b.type !== 'string') return [`${where} needs a "type"`];
  const t = WIDGET_TYPES[b.type];
  const name = t ? `${where} (${t.label})` : where;
  const out = [];
  const bad = (key, want) => out.push(`${name}: "${key}" must be ${want}`);
  if (!isId(b.id, 'b')) bad('id', 'a widget id like "b-7qpa"');
  out.push(...checkWidgetLayout(b).map((p) => `${name}: ${p}`));
  if (b.size !== undefined && !SIZES.includes(b.size)) bad('size', SIZES.join(', '));
  if (b.type === 'hero' && Array.isArray(b.photos))
    b.photos.forEach((p, i) => {
      const ph = p?.phone;
      if (ph === undefined || ph === null) return;
      if (!isObject(ph) || Object.keys(ph).some((k) => !['x', 'y', 'w'].includes(k)))
        bad(`photos.${i}.phone`, 'null (hidden on phones) or { x?, y?, w? }');
      else
        for (const [k, v] of Object.entries(ph))
          if (typeof v !== 'number') bad(`photos.${i}.phone.${k}`, 'a number');
    });
  if ((b.size === 'aspect' || b.aspect !== undefined) && !isRatio(b.aspect))
    bad('aspect', 'a ratio like "4:5"');
  if (b.z !== undefined && !Number.isInteger(b.z)) bad('z', 'a whole number');
  out.push(...checkScale(b).map((p) => `${name}: ${p}`));
  if (b.motion !== undefined) out.push(...checkMotion(b.motion).map((p) => `${name}: ${p}`));
  if (!t) return out; // an unknown type only warns (render)
  if (b.item !== undefined) bad('item', 'left out: its "source" says which item');
  if (b.source !== undefined) out.push(...sourceProblems(b.source, t).map((p) => `${name}: ${p}`));
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
          else if (type === 'link' && sv !== undefined && linkProblem(sv))
            bad(`${f.key}.${i}.${k}`, linkProblem(sv));
        }),
      );
    if (f.type === 'rich') continue; // a Text widget's body: its type's check (../text.js)
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
    if (c.type === 'link') {
      const p = linkProblem(v);
      if (p) bad(`config.${c.key}`, p);
      continue;
    }
    if (typeof v !== (CONFIG_TYPES[c.type] || 'string'))
      bad(`config.${c.key}`, `a ${CONFIG_TYPES[c.type] || 'string'}`);
    else if (c.options && !c.options.some(([o]) => o === v))
      bad(`config.${c.key}`, `one of ${c.options.map(([o]) => o).join(', ')}`);
  }
  return out;
}

/**
 * photos.json, the one photo library: { alt?, credit?: { name, url?, source?, license? },
 * focal?: { x, y } (0–100, where to keep in view when cropped), and for R2 photos
 * srcset: [{ key, w }], width, height, ... } per photo. Content refers to photos by path only.
 */
function checkPhotos(d) {
  return Object.entries(d).flatMap(([k, v]) => {
    if (!isObject(v)) return [`photo "${k}" must be an object`];
    const out = optional(v, { alt: 'string', srcset: 'array' }).map((p) => `photo "${k}": ${p}`);
    if (
      v.credit !== undefined &&
      !(
        isObject(v.credit) &&
        typeof v.credit.name === 'string' &&
        v.credit.name &&
        ['url', 'source', 'license'].every(
          (x) => v.credit[x] === undefined || typeof v.credit[x] === 'string',
        )
      )
    )
      out.push(`photo "${k}": "credit" must be { "name", "url"?, "source"?, "license"? } (texts)`);
    const pct = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    if (v.focal !== undefined && !(isObject(v.focal) && pct(v.focal.x) && pct(v.focal.y)))
      out.push(`photo "${k}": "focal" must be { "x", "y" } (0 to 100)`);
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
  const notes = commentKeys(data);
  if (notes.length)
    return notes.map((k) => `"${k}": no comments in content (the README documents the shape)`);
  const defaults = storedDefaults(file, data);
  if (defaults.length) return defaults;
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
  if (file === STRINGS)
    return [
      // the groups of UI text (src/site/strings.js CORE_STRINGS): objects of strings
      ...optional(d, Object.fromEntries(Object.keys(CORE_STRINGS).map((g) => [g, 'object']))),
      ...(d.footer !== undefined
        ? ['"footer" is gone: the footer is settings/footer.json, sections like a page']
        : []),
    ];
  if (file === PHOTOS)
    return isObject(d.photos) ? checkPhotos(d.photos) : ['"photos" must be an object'];
  if (docKindOf(file)) return checkDoc(file, d);
  return [];
}

/** Keys starting with "_" (comments), anywhere in the data: their paths. */
function commentKeys(v, at = '') {
  if (Array.isArray(v)) return v.flatMap((x, i) => commentKeys(x, `${at}${at ? '.' : ''}${i}`));
  if (!isObject(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => {
    const p = `${at}${at ? '.' : ''}${k}`;
    return k.startsWith('_') ? [p] : commentKeys(x, p);
  });
}

/** Throws "content/<file>: <problems>" when the data doesn't fit. */
export function assertContent(file, data) {
  const problems = checkContent(file, data);
  if (problems.length) throw new Error(`${contentPath(file)}: ${problems.join('; ')}`);
}
