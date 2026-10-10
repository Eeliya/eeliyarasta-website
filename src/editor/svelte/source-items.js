/**
 * Plain helpers for source items (the Source Explorer, SourcesModal.svelte, and the Content
 * tab): the source's schema (src/site/schemas.js), an item's name and list line, its fields
 * for the editor, a new item, the slug format.
 */
import { pointer } from '../../site/helpers.js';
import { schemaFile, sourceIdOf } from '../../site/files.js';
import { itemTitle, newItemOf, schemaOf } from '../../site/schemas.js';

/** The editor's field widget (Field.svelte type) for a schema field type. */
export const WIDGETS = {
  text: 'text',
  longtext: 'block',
  number: 'number',
  photo: 'image',
  link: 'text',
  date: 'date',
  choice: 'select',
  boolean: 'boolean',
};

/** The schema of a source file ("sources/people.json") in the store: its schema file, else inferred. */
export function schemaFor(store, file) {
  const id = sourceIdOf(file);
  const data = (f) => store.current[f];
  return schemaOf({ sources: { [id]: data(file) }, schemas: { [id]: data(schemaFile(id)) } }, id);
}

export const itemName = (item, schema) => itemTitle(item, schema) || 'Untitled';

/** The line under an item's name in lists: its "list" fields, else its slug. */
export const itemMeta = (item, schema) =>
  (schema.fields || [])
    .filter((f) => f.list && item?.[f.key] !== undefined && item[f.key] !== '')
    .map((f) => item[f.key])
    .join(' · ') ||
  (schema.slug ? item?.[schema.slug] : '') ||
  '';

export const pad = (i) => String(i + 1).padStart(2, '0');

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * What the editor shows for schema field `f` (a value at `path` in item i of `file`):
 * { key, label, path, edit, ptr, type (a widget), half, help, options ([[value, label]]) }.
 */
export function fieldOf(file, i, path, f, label = f.label) {
  const ptr = pointer([i, ...path]);
  return {
    key: path.join('.'),
    label,
    path,
    edit: `${file}#${ptr}`,
    ptr,
    type: WIDGETS[f.type] || 'text',
    half: f.width === 'half',
    help: f.help || '',
    placeholder: f.type === 'link' ? 'https://…' : '',
    ...(f.options ? { options: f.options.map((o) => [o, o]) } : {}),
  };
}

/**
 * The editable fields of one item, from the schema, except the slug (its own input): every
 * photo of a photos field is one field ("Photo 2").
 */
export function itemFields(file, item, i, schema) {
  return (schema.fields || []).flatMap((f) => {
    if (f.key === schema.slug) return [];
    if (f.type !== 'photos') return [fieldOf(file, i, [f.key], f)];
    const list = Array.isArray(item?.[f.key]) ? item[f.key] : [];
    return list.map((_, j) =>
      fieldOf(file, i, [f.key, j, 'src'], { ...f, type: 'photo' }, `Photo ${j + 1}`),
    );
  });
}

/** The value at `path` in `item` (a field's path from itemFields). */
export const valueAt = (item, path) => path.reduce((v, k) => v?.[k], item);

/** A new item for `list`: the schema's fields empty, a unique slug new-item-N. */
export const newItem = (list, schema) => newItemOf(schema, list);

/**
 * Halves that share a row: of the fields in order, a half next to another half pairs with it;
 * a lone half takes the whole row. Returns the edits of the paired halves.
 */
export function pairedHalves(fields) {
  const out = new Set();
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i].half || !fields[i + 1]?.half) continue;
    out.add(fields[i].edit).add(fields[i + 1].edit);
    i++;
  }
  return out;
}
