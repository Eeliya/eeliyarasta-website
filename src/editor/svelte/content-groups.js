/**
 * What the Content tab shows: the editable texts of the page in the preview (or of the
 * footer's blocks), grouped by block (a page's sections hold blocks, src/site/layout/). Plain
 * functions over the store and the preview; ContentPanel.svelte renders the result.
 */
import { parse } from '../lib/pointer.js';
import { sourceIdOf } from '../../site/files.js';
import { pointer } from '../../site/helpers.js';
import { labelOf } from '../../site/schemas.js';
import { BLOCK_TYPES } from '../../site/blocks/index.js';
import { bindTypeOf } from '../../site/layout/bindings.js';
import { targetFile } from '../layout-sync.js';
import { itemName, schemaFor } from './source-items.js';

/** site.json values edited in the Settings tab: [key, label, field type]. */
export const SITE_SETTINGS = [
  ['name', 'Site name', 'text'],
  ['accent', 'Accent color', 'text'],
  ['timezone', 'Time zone of the clock (e.g. Europe/Amsterdam)', 'text'],
  ['jobTitle', 'Job title (for search engines)', 'text'],
  ['country', 'Country code (for search engines, e.g. NL)', 'text'],
];

/** site.json search and share defaults (src/site/seo.js), Settings > SEO. robots is a Select. */
export const SEO_SETTINGS = [
  ['title', 'Home page title (in full)', 'text'],
  ['titleTemplate', 'Title of other pages: {page} is the page, {site} the site name', 'text'],
  ['description', 'Description (pages without their own)', 'block'],
  ['ogImage', 'Share image (pages without their own)', 'image'],
  ['url', 'Site URL (canonical links, og:url, sitemap.xml)', 'text'],
  ['lang', 'Language (<html lang>, e.g. en)', 'text'],
];

/** Lists in content/en/sources/ (people, places, projects, ...). */
export const isSource = (file) => sourceIdOf(file) !== null;

/** Pointer parts into an item of a source file: ["items", "2", ...]. */
const isItemPtr = (file, parts) => isSource(file) && parts[0] === 'items' && /^\d+$/.test(parts[1]);

/** "pages/index.json#/sections/0/blocks/0/title" -> { file: 'pages/index.json', ptr: '/sections/0/blocks/0/title' } */
export function splitEdit(edit) {
  const i = edit.indexOf('#');
  return { file: edit.slice(0, i), ptr: edit.slice(i + 1) };
}

/**
 * Human label for a pointer, e.g. sources/people.json#/items/0/name -> "Noor Vermeer / Name": a
 * source item by its name and its field by the schema's label.
 */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (isItemPtr(file, parts)) {
    const schema = schemaFor(store, file);
    const item = store.current[file]?.items?.[parts[1]];
    const name = item ? itemName(item, schema) : `#${Number(parts[1]) + 1}`;
    const field = schema.fields.find((f) => f.key === parts[2]);
    return [name, field?.label ?? parts[2], ...parts.slice(3)].filter(Boolean).join(' / ');
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(' / ');
}

/**
 * A field's label: its key made readable; a photo in a list (".../photos/1/src") is "Photo 2",
 * a column's title "<Name> column title".
 */
function fieldLabel(f) {
  const parts = parse(f.ptr);
  if (f.type === 'image' && parts.at(-1) === 'src' && /^\d+$/.test(parts.at(-2)))
    return `Photo ${Number(parts.at(-2)) + 1}`;
  if (f.type === 'image' && parts.at(-2) === 'images' && /^\d+$/.test(parts.at(-1)))
    return `Photo ${Number(parts.at(-1)) + 1}`;
  if (parts.at(-3) === 'columns') return `${labelOf(parts.at(-2))} column title`;
  return labelOf(parts.at(-1));
}

/** A preview field as the panel shows it: with its label. */
const described = (f) => ({ ...f, label: fieldLabel(f) });

/** The sections of page file `file` (its "sections" list). */
function sectionsOf(store, file) {
  const list = store.current[file]?.sections;
  return Array.isArray(list) ? list : [];
}

/** A short name for block b: its first text (label, title, eyebrow, caption), at most 40 characters. */
export function nameOf(s) {
  const text = [s?.label, s?.title, s?.eyebrow, s?.caption].find(
    (v) => typeof v === 'string' && v.trim(),
  );
  const line = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return line.length > 40 ? `${line.slice(0, 39)}…` : line;
}

/**
 * The fields of a block from its type's registry entry: [{ edit, file, ptr, type, label }].
 * base: the block's path in its file (['sections', 0, 'blocks', 1]).
 * A list field is one entry { list: true, edit, file, ptr, label, item, photo, items }: items
 * holds each item's fields ([[field, ...], ...]), item a new item, photo the subkey of a
 * photo item ('' for a list of photos, null for none) so Add can open the Media window.
 */
function registryFields(file, base, s, t) {
  // a list item's subkey type can be { type, label, options } (src/site/blocks/index.js).
  // bindType: what it can show of an item as a whole (src/site/layout/bindings.js; a list
  // item's text subkey binds as text, other list items can't, null); textual: a bound one
  // can have a format ("{value} photos")
  const field = (path, type, label, whole = false, sub = false) => {
    const ptr = pointer([...base, ...path]);
    const def = type && typeof type === 'object' ? type : { type };
    return {
      edit: `${file}#${ptr}`,
      file,
      ptr,
      type: def.type || 'text',
      label: def.label || label,
      half: def.width === 'half',
      ...(def.options ? { options: def.options } : {}),
      bindType: whole
        ? bindTypeOf(def)
        : sub && TEXT_TYPES.includes(def.type || 'text')
          ? def.type || 'text'
          : null,
      textual: TEXT_TYPES.includes(def.type || 'text'),
    };
  };
  return (t.fields || []).map((f) => {
    if (!f.list) return field([f.key], f, f.label, true);
    const items = Array.isArray(s[f.key]) ? s[f.key] : [];
    const subs = typeof f.list === 'string' ? null : Object.entries(f.list);
    const ptr = pointer([...base, f.key]);
    return {
      list: true,
      edit: `${file}#${ptr}`,
      file,
      ptr,
      label: f.label,
      item: f.item ?? (subs ? Object.fromEntries(subs.map(([k]) => [k, ''])) : ''),
      photo: subs
        ? (subs.find(([, type]) => (type?.type ?? type) === 'image')?.[0] ?? null)
        : f.list === 'image'
          ? ''
          : null,
      items: items.map((_, j) =>
        subs
          ? subs.map(([sub, type]) =>
              field([f.key, j, sub], type, sub === 'src' ? 'Photo' : labelOf(sub), false, true),
            )
          : [field([f.key, j], f.list, `${f.label} ${j + 1}`)],
      ),
    };
  });
}

/**
 * A group's fields in panel order, the plain ones in runs (a run is laid out in rows) between
 * the lists: [{ list: field } | { fields: [field, ...] }].
 */
export function runsOf(fields) {
  const out = [];
  for (const f of fields) {
    if (f.list) out.push({ list: f });
    else if (out.at(-1)?.fields) out.at(-1).fields.push(f);
    else out.push({ fields: [f] });
  }
  return out;
}

/** Every field of a group, list items included. */
export const allFields = (g) => g.fields.flatMap((f) => (f.list ? f.items.flat() : [f]));

const TEXT_TYPES = ['text', 'words', 'block'];

/**
 * Group for block `j` of section `at` of page file `file`: id the block's, titled by its
 * type, named by its text, with its on/off toggle, settings (config) and its type's fields.
 */
function blockGroup(store, file, at, j) {
  const s = sectionsOf(store, file)[at].blocks[j];
  const t = BLOCK_TYPES[s?.type];
  const sources = Object.keys(store.current).map(sourceIdOf).filter(Boolean).sort();
  const base = `/sections/${at}/blocks/${j}`;
  return {
    id: s.id,
    block: { at, j },
    file,
    icon: t?.icon || 'question',
    title: t?.label || `Unknown type "${s?.type}"`,
    name: nameOf(s),
    toggle: { file, ptr: `${base}/config/enabled` },
    config: (t?.config || []).map((c) => ({
      ...c,
      ptr: `${base}/config/${c.key}`,
      // a source list may be missing: it stays pickable, marked
      options:
        c.type === 'source'
          ? [
              ...(c.empty ? [['', c.empty]] : []),
              ...[...new Set([s.config?.[c.key], ...sources])]
                .filter(Boolean)
                .map((id) => [id, `${id}.json${sources.includes(id) ? '' : ' (missing)'}`]),
            ]
          : c.options,
    })),
    fields: t ? registryFields(file, ['sections', at, 'blocks', j], s, t) : [],
  };
}

/**
 * Which group a preview field belongs to: { id, title }; null for a block's own fields (a
 * page or the footer is only sections of blocks: any other text of theirs has no group).
 * A source list item's text (a name in a list block) is edited in the Sources modal:
 * "source:<id>", never a group of its own.
 */
export function groupFor(store, { file, ptr }) {
  return isItemPtr(file, parse(ptr))
    ? { id: `source:${sourceIdOf(file)}`, title: `${sourceIdOf(file)}.json` }
    : null;
}

/**
 * The preview's fields of `target`'s file (the page's or the footer's): { edit, file, ptr,
 * type }. The Header has none here (HeaderPart.svelte edits it).
 */
function fieldsOf(bridge, file) {
  if (!file) return [];
  return bridge
    .editFields()
    .map(({ edit, file, ptr, type }) => ({ edit, file, ptr, type }))
    .filter((f) => f.file === file && !f.ptr.endsWith('/enabled')); // on/off flags have their own toggle
}

/**
 * The Content tab's groups for `target`: the page's (or footer's) blocks, in section and
 * block order (`block`: { at, j }, where it is), each with its fields.
 * [{ id, title, name?, block?, file?, icon?, toggle?, config?, fields: [{ edit, file, ptr, type, label }] }]
 */
export function contentGroups(store, bridge, target) {
  const file = targetFile(target, bridge.doc);
  const groups = new Map();
  const add = (group) => {
    if (!groups.has(group.id)) groups.set(group.id, { fields: [], ...group });
    return groups.get(group.id);
  };

  // Every block, even the ones without text (they still have a toggle and settings).
  const at = {}; // block group ids by their place ("0/1")
  sectionsOf(store, file).forEach((s, i) =>
    (Array.isArray(s?.blocks) ? s.blocks : []).forEach((b, j) => {
      at[`${i}/${j}`] = add(blockGroup(store, file, i, j));
    }),
  );

  // a block's text its type doesn't list (e.g. a photo credit): added to its group
  for (const f of fieldsOf(bridge, file)) {
    const [, i, , j] = parse(f.ptr);
    const g = at[`${i}/${j}`];
    if (g && !allFields(g).some((x) => x.edit === f.edit)) g.fields.push(described(f));
  }
  return [...groups.values()];
}
