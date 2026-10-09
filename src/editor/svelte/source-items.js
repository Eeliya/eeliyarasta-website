/**
 * Plain helpers for the Sources modal (SourcesModal.svelte): which keys of an item are
 * fields, how a new item looks, the slug format.
 */

const SKIP_KEYS = new Set(['slug', 'cover']);
const BLOCK_KEYS = new Set(['summary', 'description', 'note']);

export const itemName = (item) => item?.name || item?.title || 'Untitled';
export const itemMeta = (item) => item?.location || item?.kind || item?.slug || '';
export const pad = (i) => String(i + 1).padStart(2, '0');

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const field = (file, i, path, label, type) => {
  const ptr = `/${i}${path.map((k) => `/${String(k).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('')}`;
  return { key: path.join('.'), label, path, edit: `${file}#${ptr}`, ptr, type };
};

/**
 * The editable fields of one item: its top-level text and number values, "image" (a
 * project's photo) and the src of every photo in "images" (an album's): { key, label, path,
 * edit, ptr, type }.
 */
export function itemFields(file, item, i) {
  return Object.entries(item || {}).flatMap(([key, v]) => {
    if (key === 'images' && Array.isArray(v))
      return v.map((_, j) => field(file, i, [key, j, 'src'], `photo ${j + 1}`, 'image'));
    if (SKIP_KEYS.has(key) || (typeof v !== 'string' && typeof v !== 'number')) return [];
    const type =
      key === 'image'
        ? 'image'
        : typeof v === 'number'
          ? 'number'
          : BLOCK_KEYS.has(key) || String(v).length > 60
            ? 'block'
            : 'text';
    return [field(file, i, [key], key, type)];
  });
}

/** The value at `path` in `item` (a field's path from itemFields). */
export const valueAt = (item, path) => path.reduce((v, k) => v?.[k], item);

/** An empty value shaped like `value` (strings "", lists [], numbers 0, year = this year). */
function blankLike(value, key) {
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blankLike(v, k)]));
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return key === 'year' ? new Date().getFullYear() : 0;
  if (typeof value === 'boolean') return false;
  return value ?? null;
}

/** A new item for `list`: same shape as the first item, unique slug new-item-N. */
export function newItem(list) {
  const slugs = new Set(list.map((it) => it?.slug));
  let n = list.length + 1;
  while (slugs.has(`new-item-${n}`)) n++;
  const item = blankLike(list[0] || { slug: '', name: '' });
  delete item.curtain; // no curtain text: the transition falls back to the item's name
  delete item.transition; // the global curtain
  item.slug = `new-item-${n}`;
  if ('title' in item && !('name' in item)) item.title = `New item ${n}`;
  else item.name = `New item ${n}`;
  return item;
}
