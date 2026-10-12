/**
 * Bindings: a block's field can show a value of a source item instead of its own.
 *
 *   "title": "Models"                       custom: the block's own value
 *   "title": { "bind": "name" }             the item's whole value (any field type: a photo,
 *                                           a link, a list of photos), when the types fit
 *   "title": { "bind": "count", "format": "{value} photos" }
 *                                           a text around the value ({value}; text fields only,
 *                                           an empty value leaves the whole field empty)
 *
 * The item: a block's own `item: { source, id }`, else the item of a [slug] page
 * (route.album). A binding without an item, or to a field the item's source doesn't have,
 * renders empty, and the build warns (bindingProblems). Values are escaped by the blocks as before: the
 * resolver only swaps values (resolveBlock, applied to every block before it renders).
 *
 * Which fields can bind: every field of a block type (src/site/blocks/index.js) and its
 * config's text fields (links); a list of { src } binds to a photos field as a whole; in a list
 * of objects, each text subkey can be bound. BIND_TYPES says which
 * source field types (src/site/schemas.js) fit each block field type.
 */
import { schemaOf } from '../schemas.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** { "bind": "<field>" } */
export const isBinding = (v) => isObject(v) && typeof v.bind === 'string';

/** A value that comes from the item: { bind }. */
export const isBound = isBinding;

/** Block field types -> the source field types (schemas.js) that fit a { bind }. */
export const BIND_TYPES = {
  text: ['text', 'choice', 'number', 'date', 'link'],
  words: ['text', 'choice'],
  block: ['longtext', 'text', 'choice', 'number', 'date'],
  number: ['number'],
  image: ['photo'],
  link: ['link'],
  photos: ['photos'],
};
/** Block field types whose binding can have a format. */
export const FORMAT_TYPES = ['text', 'words', 'block', 'link'];

/** The bound value in its format ("{value} photos"); empty stays empty. */
const formatted = (v, format) =>
  typeof format !== 'string' || v === undefined || v === null || v === ''
    ? v
    : format.replaceAll('{value}', typeof v === 'object' ? '' : String(v));

/**
 * The bind type of a field definition: its type, 'link' for a config text field (an href),
 * 'photos' for a list of { src } objects; null when it can't bind as a whole (other lists).
 */
export function bindTypeOf(def, { config = false } = {}) {
  if (!def) return null;
  if (config) return def.type === 'text' ? 'link' : null;
  if (!def.list) return def.type || 'text';
  const subs = isObject(def.list) ? Object.keys(def.list) : [];
  return subs.includes('src') && subs.every((k) => ['src', 'credit'].includes(k)) ? 'photos' : null;
}

/** The item a block shows: { item, source } (item null when there is none or it is missing). */
export function itemOf(ctx, route, block) {
  const ref = block?.item;
  if (isObject(ref) && ref.source) {
    const list = Array.isArray(ctx.sources?.[ref.source]) ? ctx.sources[ref.source] : [];
    const item = list.find((it) => it?.id === ref.id) || null;
    return { item, source: ref.source };
  }
  if (route?.album) return { item: route.album, source: route.kind };
  return { item: null, source: null };
}

/** The field keys of a source (its schema), null without a source. */
export const keysOf = (ctx, source) =>
  source ? new Set((schemaOf(ctx, source)?.fields || []).map((f) => f.key)) : null;

const empty = (def) => (def?.list ? [] : def?.type === 'number' ? undefined : '');

/**
 * `value` of a field (def: its registry definition) with the item's values in it. keys: the
 * fields the item's source has (its schema), when known; onwarn(message) for a binding
 * without an item or to a field the source doesn't have (the build reports those from
 * bindingProblems, so rendering passes none). at: where, for the messages.
 */
export function resolve(
  value,
  { item, keys, def, at = '', onwarn = () => {}, placeholders = false } = {},
) {
  const warn = (msg) => onwarn(at ? `${at}: ${msg}` : msg);
  // what can't be filled: '' on the site, {{name}} in the editor's preview (dimmed there)
  const text = ['text', 'words', 'block'].includes(def?.type || 'text') && !def?.list;
  const missing = (name) => (placeholders && text ? `{{${name}}}` : empty(def));
  if (isBinding(value)) {
    if (!item)
      return (warn(`{ "bind": "${value.bind}" } has no item to show`), missing(value.bind));
    if (keys && !keys.has(value.bind) && !(value.bind in item))
      return (warn(`the item has no field "${value.bind}"`), missing(value.bind));
    return formatted(item[value.bind], value.format) ?? empty(def);
  }
  if (Array.isArray(value) && isObject(def?.list))
    return value.map((entry) =>
      isObject(entry)
        ? Object.fromEntries(
            Object.entries(entry).map(([k, v]) => {
              const sub = def.list[k];
              const type = isObject(sub) ? sub.type : sub;
              return [k, resolve(v, { item, keys, def: { type }, at, onwarn, placeholders })];
            }),
          )
        : entry,
    );
  return value;
}

/** Does `block` (or its config's links) hold any binding? */
const hasBindings = (block, t) =>
  [...(t?.fields || []).map((f) => block?.[f.key]), ...Object.values(block?.config || {})].some(
    (v) =>
      isBound(v) ||
      (Array.isArray(v) && v.some((e) => isObject(e) && Object.values(e).some(isBound))),
  );

/**
 * A block with its fields' and config links' bindings resolved for `item` (the block as it is
 * when nothing is bound, so blocks without bindings render exactly as before).
 */
export function resolveBlock(block, t, { item, source, ctx, at, placeholders = false }) {
  if (!hasBindings(block, t)) return block;
  const keys = keysOf(ctx, source);
  const out = { ...block };
  for (const f of t.fields || [])
    if (out[f.key] !== undefined)
      out[f.key] = resolve(out[f.key], { item, keys, def: f, at: `${at}/${f.key}`, placeholders });
  if (isObject(block.config)) {
    out.config = { ...block.config };
    for (const c of t.config || [])
      if (c.type === 'text' && out.config[c.key] !== undefined)
        out.config[c.key] = resolve(out.config[c.key], {
          item,
          keys,
          def: { type: 'link' },
          at: `${at}/config/${c.key}`,
        });
  }
  return out;
}

/**
 * The bound values of a block: [{ path, bind }] with each one's bind type
 * (bindTypeOf); path: from the block, e.g. ['title'] or ['config', 'href'] or ['meta', 0, 'value'].
 */
function bindingsOf(block, t) {
  const out = [];
  const add = (path, v, type) => {
    if (isBinding(v)) out.push({ path, bind: v.bind, type });
  };
  for (const f of t?.fields || []) {
    const v = block?.[f.key];
    add([f.key], v, bindTypeOf(f));
    if (Array.isArray(v) && isObject(f.list))
      v.forEach((e, i) =>
        Object.entries(isObject(e) ? e : {}).forEach(([k, sv]) => {
          const sub = f.list[k];
          add([f.key, i, k], sv, (isObject(sub) ? sub.type : sub) || 'text');
        }),
      );
  }
  for (const c of t?.config || [])
    add(['config', c.key], block?.config?.[c.key], bindTypeOf(c, { config: true }));
  return out;
}

/**
 * Schema-aware checks of every page's bindings (content: contentFromFiles()):
 * [{ level, message }]. 'error' (Save refuses, the build stops): a block's item source that
 * isn't a source, a { bind } to a field its source doesn't have or of a type that doesn't fit.
 * 'warn': a block's item that isn't in its source, a binding without an item (it renders
 * empty). files: only pages of these files (all: null).
 */
export function bindingProblems(content, { types, pageFile, files = null }) {
  const out = [];
  for (const [id, page] of Object.entries(content?.pages || {})) {
    const file = pageFile(id);
    if (files && !files.has(file)) continue;
    const pageSource = id.endsWith('[slug]') ? page?.template?.source : null;
    (Array.isArray(page?.sections) ? page.sections : []).forEach((s, at) =>
      (Array.isArray(s?.blocks) ? s.blocks : []).forEach((b, j) => {
        const t = types[b?.type];
        if (!t || !isObject(b)) return;
        const where = `content/en/${file} (sections/${at}/blocks/${j})`;
        const problem = (level, msg) => out.push({ level, message: `${where}: ${msg}` });
        let source = pageSource;
        if (isObject(b.item)) {
          source = b.item.source;
          const list = content.sources?.[source];
          if (!Array.isArray(list)) return problem('error', `item: "${source}" is not a source`);
          if (!list.some((it) => it?.id === b.item.id))
            problem('warn', `item: "${b.item.id}" is not in ${source}: its bound fields are empty`);
        }
        const uses = bindingsOf(b, t);
        if (!uses.length) return;
        if (!source)
          return problem(
            'warn',
            'has bound fields but no item (set one in its Content tab): they are empty',
          );
        const fields = schemaOf(content, source)?.fields || [];
        for (const u of uses) {
          const name = u.path.join('.');
          const f = fields.find((x) => x.key === u.bind);
          if (!f) problem('error', `${name}: ${source} has no field "${u.bind}"`);
          else if (!(BIND_TYPES[u.type] || []).includes(f.type))
            problem(
              'error',
              `${name}: ${source}.${u.bind} (${f.type}) doesn't fit a ${u.type || 'list'} field`,
            );
        }
      }),
    );
  }
  return out;
}
