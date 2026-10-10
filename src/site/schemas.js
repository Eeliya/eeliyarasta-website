/**
 * Source schemas: content/sources/<id>.schema.json, next to the list it describes
 * (sources/people.json). A small format of its own, shaped like the block registry's
 * field definitions (./blocks/index.js):
 *
 *   {
 *     "label": "People",           the source's name in the editor
 *     "title": "name",             the field that names an item (lists, page titles)
 *     "slug": "slug",              the field with an item's URL slug ('' = from the title)
 *     "fields": [{ key, label, type, width?, required?, help?, options?, list? }]
 *   }
 *
 *   type      text | longtext (lines) | number | photo (a media/ path or R2 key) |
 *             photos (a list of { src, credit? }) | link (https://…, /path/ or mailto:) |
 *             choice (one of options: ["a", "b"]) | boolean | date (YYYY-MM-DD)
 *   width     'half': two half fields side by side in the editor
 *   required  must have a value (a photos list: at least one photo)
 *   help      a short hint under the label
 *   list      shown under the title in the editor's item lists (Source Explorer)
 *
 * Keys of an item that its schema doesn't name are kept as they are (not edited, not
 * checked). A source without a schema gets one inferred from its items (inferSchema), so
 * the editor and the checks work the same; a schema file only makes it explicit.
 * Used by the build and Save (checkItems), the routes (title, slug) and the editor.
 */
import { isSlug } from './files.js';

export const FIELD_TYPES = [
  'text',
  'longtext',
  'number',
  'photo',
  'photos',
  'link',
  'choice',
  'boolean',
  'date',
];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isExternal = (s) => /^https?:\/\//.test(s);
const PHOTO = /^[\w-][\w./-]*\.(?:jpe?g|png|webp|avif|gif)$/i;
const LINK = /^(?:https?:\/\/|\/|mailto:)\S*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "linkLabel" / "link-label" -> "Link label". */
export const labelOf = (key) => {
  const s = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** A field's type from all of its values (the same for every item, so the editor is stable). */
function inferType(values) {
  if (!values.length) return null;
  if (values.every((v) => typeof v === 'boolean')) return { type: 'boolean' };
  if (values.every((v) => typeof v === 'number')) return { type: 'number', width: 'half' };
  if (values.every((v) => Array.isArray(v)))
    return values.flat().every((p) => isObject(p) && typeof p.src === 'string')
      ? { type: 'photos' }
      : null;
  if (!values.every((v) => typeof v === 'string')) return null;
  const filled = values.filter(Boolean);
  if (filled.length && filled.every((v) => PHOTO.test(v))) return { type: 'photo' };
  if (filled.some((v) => v.includes('\n') || v.length > 80)) return { type: 'longtext' };
  if (filled.every((v) => v.length <= 24)) return { type: 'text', width: 'half' };
  return { type: 'text' };
}

/**
 * The schema of a source without a schema file, from its items: every key in item order,
 * typed by all its values (numbers, booleans, photo lists, media paths, long or short text);
 * keys with mixed or other values (objects) are left out. The title is "name", else "title",
 * else the first text field; the slug is "slug" when the items have one.
 */
export function inferSchema(id, list) {
  const items = Array.isArray(list) ? list.filter(isObject) : [];
  const keys = [...new Set(items.flatMap((it) => Object.keys(it)))];
  const fields = keys.flatMap((key) => {
    const t = inferType(items.map((it) => it[key]).filter((v) => v !== undefined && v !== null));
    return t ? [{ key, label: labelOf(key), ...t }] : [];
  });
  const text = (k) => fields.some((f) => f.key === k && f.type === 'text');
  return {
    label: labelOf(id),
    title: ['name', 'title'].find(text) ?? fields.find((f) => f.type === 'text')?.key ?? '',
    slug: text('slug') ? 'slug' : '',
    fields,
  };
}

const inferred = new WeakMap();

/**
 * The schema of source `id` in a render context or content ({ sources, schemas }): its
 * schema file, else inferred from its items (remembered per list).
 */
export function schemaOf(content, id) {
  const own = content?.schemas?.[id];
  if (isObject(own)) return own;
  const list = content?.sources?.[id];
  if (!Array.isArray(list)) return inferSchema(id, []);
  if (!inferred.has(list)) inferred.set(list, inferSchema(id, list));
  return inferred.get(list);
}

/** An item's name: its title field (string or number), else undefined. */
export const itemTitle = (item, schema) => {
  const v = schema?.title ? item?.[schema.title] : undefined;
  return v === undefined || v === null || v === '' ? undefined : String(v);
};

/** Problems with a schema file itself ([] when fine). */
export function checkSchema(s) {
  if (!isObject(s)) return ['must be an object'];
  const out = [];
  if (s.label !== undefined && typeof s.label !== 'string') out.push('"label" must be a string');
  if (!Array.isArray(s.fields)) return [...out, '"fields" must be a list'];
  const keys = new Set();
  s.fields.forEach((f, i) => {
    const name = `field ${i + 1}${typeof f?.key === 'string' ? ` ("${f.key}")` : ''}`;
    const bad = (msg) => out.push(`${name}: ${msg}`);
    if (!isObject(f)) return bad('must be an object');
    if (typeof f.key !== 'string' || !f.key) bad('needs a "key"');
    else if (keys.has(f.key)) bad('another field has this key');
    keys.add(f.key);
    if (!FIELD_TYPES.includes(f.type)) bad(`"type" must be one of ${FIELD_TYPES.join(', ')}`);
    if (f.label !== undefined && typeof f.label !== 'string') bad('"label" must be a string');
    if (f.help !== undefined && typeof f.help !== 'string') bad('"help" must be a string');
    if (f.width !== undefined && f.width !== 'half') bad('"width" can only be "half"');
    for (const k of ['required', 'list'])
      if (f[k] !== undefined && typeof f[k] !== 'boolean') bad(`"${k}" must be true or false`);
    if (f.type === 'choice' && !(Array.isArray(f.options) && f.options.length))
      bad('a choice needs "options", a list of values');
    else if (f.options !== undefined && !f.options.every?.((o) => typeof o === 'string'))
      bad('"options" must be a list of strings');
  });
  for (const k of ['title', 'slug'])
    if (s[k] !== undefined && s[k] !== '' && !keys.has(s[k]))
      out.push(`"${k}" must be the key of one of its fields`);
  if (typeof s.title !== 'string' || !s.title) out.push('"title" must name a field');
  return out;
}

const empty = (v) => v === undefined || v === null || v === '';

/** Problems with one value of a field (its type), [] when fine. */
function checkValue(f, v, photoExists) {
  if (empty(v) && f.type !== 'photos') return [];
  const want = (what) => [`must be ${what}`];
  switch (f.type) {
    case 'number':
      return Number.isFinite(v) ? [] : want('a number');
    case 'boolean':
      return typeof v === 'boolean' ? [] : want('true or false');
    case 'photos': {
      if (v === undefined) return [];
      if (!Array.isArray(v) || !v.every((p) => isObject(p) && typeof p.src === 'string'))
        return want('a list of photos ({ "src": … })');
      return v.flatMap((p, j) =>
        checkValue({ type: 'photo' }, p.src, photoExists).map((m) => `photo ${j + 1} ${m}`),
      );
    }
    default:
      if (typeof v !== 'string') return want('text');
  }
  if (f.type === 'link' && !LINK.test(v)) return want('a link (https://…, /path/ or mailto:…)');
  if (f.type === 'date' && !DATE.test(v)) return want('a date (YYYY-MM-DD)');
  if (f.type === 'choice' && !f.options?.includes(v))
    return want(`one of ${f.options?.join(', ')}`);
  if (f.type === 'photo' && photoExists && !isExternal(v) && !photoExists(v))
    return [`"${v}" is not a photo in media/ or content/settings/photos.json`];
  return [];
}

/**
 * Problems of a source's items against its schema ([] when fine): required values, types,
 * choice options, photos that exist (photoExists(key), when given), valid unique slugs.
 * "item 2 (Noor Vermeer): "Year" must be a number".
 */
export function checkItems(list, schema, { photoExists } = {}) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const slugs = new Set();
  list.forEach((item, i) => {
    if (!isObject(item)) return;
    const title = itemTitle(item, schema);
    const name = `item ${i + 1}${title ? ` (${title})` : ''}`;
    for (const f of schema.fields || []) {
      const v = item[f.key];
      const label = `"${f.label || labelOf(f.key)}"`;
      if (f.required && (f.type === 'photos' ? !v?.length : empty(v)))
        out.push(`${name}: ${label} is required`);
      out.push(...checkValue(f, v, photoExists).map((m) => `${name}: ${label} ${m}`));
    }
    const slug = schema.slug ? item[schema.slug] : undefined;
    if (empty(slug) || typeof slug !== 'string') return;
    if (!isSlug(slug)) out.push(`${name}: slug "${slug}" must be lowercase words with dashes`);
    else if (slugs.has(slug)) out.push(`${name}: another item has the slug "${slug}"`);
    slugs.add(slug);
  });
  return out;
}

/** Is `key` a known photo: in the media manifest or in photos.json (R2)? */
export const photoChecker = (media, photos) => (key) => !!(media?.[key] || photos?.[key]);

/**
 * Every source's problems against its schema, for the build: ["content/sources/people.json:
 * item 2 (…): …"]. content: loadContent's (sources, schemas, media, photos).
 */
export function checkSources(content) {
  const photoExists = photoChecker(content.media, content.photos);
  return Object.keys(content.sources || {}).flatMap((id) =>
    checkItems(content.sources[id], schemaOf(content, id), { photoExists }).map(
      (p) => `content/sources/${id}.json: ${p}`,
    ),
  );
}

/** A new item for a source: every schema field empty (text '', number 0 (a year: this year), false, []), a unique slug and title. */
export function newItemOf(schema, list = []) {
  const slugs = new Set(list.map((it) => it?.[schema.slug]));
  let n = list.length + 1;
  while (slugs.has(`new-item-${n}`)) n++;
  const blank = (f) =>
    f.type === 'number'
      ? f.key === 'year'
        ? new Date().getFullYear()
        : 0
      : f.type === 'boolean'
        ? false
        : f.type === 'photos'
          ? []
          : f.type === 'choice' && f.required
            ? f.options[0]
            : '';
  const item = Object.fromEntries((schema.fields || []).map((f) => [f.key, blank(f)]));
  if (schema.slug) item[schema.slug] = `new-item-${n}`;
  if (schema.title) item[schema.title] = `New item ${n}`;
  return item;
}
