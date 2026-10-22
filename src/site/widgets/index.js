/**
 * The widget registry: what a widget of each type shows and which fields the editor offers
 * for it. Every widget, built in or the site's own, is a widget module: a folder whose
 * index.js default-exports its definition (below), with an optional style.scss (its look,
 * bundled into the site's stylesheet) and client.js (its behaviour on the page: a default
 * export `(el) => cleanup?`, run for every one of its elements, .wgt--<type>). The built-ins
 * are the folders here, always on; a site adds its own in site.config.mjs `widgets`
 * (scripts/site-widgets.mjs loads them; the browser gets them from virtual:site-widgets). Widgets sit in the sections of a page (src/site/layout/index.js places them):
 *
 *   { "id": "b-k3x9", "type": "grid", "label": "People", "title": "Models",
 *     "source": { "mode": "all", "from": "people" },
 *     "layout": { "base": { "col": 1, "span": 120, "row": 1 } } }
 *
 * The widget's own content (texts, photos) sits next to its type, the items it shows under
 * "source" (../layout/source.js); how it works (its look, on/off) is under "config"; where it sits is the layout's (id, layout, z,
 * size: layout keys, never a field key). A type:
 *
 *   type      its name in the content
 *   label     its name in the editor; icon: a Font Awesome icon name (no "fa-")
 *   line      one line on what it is, under its name in the editor's Add widget modal
 *   sketch    the modal's drawing of it: a type's name (album draws as 'photo')
 *   fields    its content fields for the editor: [{ key, label, type?, width?, list?, item? }]
 *               type: 'text' (default) | 'block' (multi-line) | 'words' | 'number' | 'image'
 *               width: 'half' shares a row with a half field next to it (short texts)
 *               list: the field is a list: a type for a list of values ('block'), or
 *                     { subkey: type } for a list of objects ({ title: 'text' }; a subkey
 *                     can also be 'source', a content/en/sources file, 'boolean' (a switch), or
 *                     { type, label, width?, options? }: a type with its label, 'select' with options
 *                     [[value, label]])
 *               item: a new item of the list (default: '' or the subkeys empty)
 *   config    its settings: [{ key, label, type, options?, empty? }]
 *               type: 'source' (a content/en/sources file) | 'select' (options [[value, label]])
 *                     | 'text' | 'boolean'; every widget also has config.enabled (on/off)
 *   defaults  a new widget of this type (Add widget)
 *   check(widget)  optional: more problems than the fields' types (src/site/validate.js)
 *   list      a list widget: it shows all its source's items (its source: All / From URL /
 *             None), not one (Item / From URL / None): ../layout/source.js
 *   item      it needs an item (its source's first): without one it is skipped
 *   render(widget, ctx, b)  its HTML, one root element. b: { id, file, number, ed, source,
 *             items, item, index, indexOf }: the widget's id, the page file, its number among
 *             the page's numbered headings, ed(field or path, type), the editor marker of one
 *             of its fields, and what its source shows (widgetItems, ../layout/source.js)
 */
import text from './text/index.js';
import photo from './photo/index.js';
import button from './button/index.js';
import form from './form/index.js';
import hero from './hero/index.js';
import grid from './grid/index.js';
import albums from './albums/index.js';
import panels from './panels/index.js';
import projects from './projects/index.js';
import about from './about/index.js';
import album from './album/index.js';

/** The built-in widgets, always on, in the order the editor offers them. */
export const BUILTIN_WIDGETS = Object.freeze([
  text,
  photo,
  button,
  form,
  hero,
  grid,
  albums,
  panels,
  projects,
  about,
  album,
]);

/**
 * Every widget type: the built-ins, then the site's own (registerWidgets, from site.config.mjs
 * `widgets`), by type. One object for the whole app: registering adds to it.
 */
export const WIDGET_TYPES = Object.fromEntries(BUILTIN_WIDGETS.map((t) => [t.type, t]));

const BUILTIN = new Set(BUILTIN_WIDGETS.map((t) => t.type));
const TYPE_NAME = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** What is wrong with a widget definition (a widget module's default export): messages. */
export function widgetProblems(def) {
  if (!isObj(def)) return ['its default export must be a widget definition (an object)'];
  const out = [];
  if (typeof def.type !== 'string' || !TYPE_NAME.test(def.type))
    out.push('"type" must be a name in lowercase letters, digits and "-" ("quote", "price-list")');
  if (typeof def.label !== 'string' || !def.label) out.push('"label" must be a text');
  if (typeof def.render !== 'function') out.push('"render" must be a function (widget, ctx, b)');
  if (def.fields !== undefined && !Array.isArray(def.fields)) out.push('"fields" must be a list');
  if (def.config !== undefined && !Array.isArray(def.config)) out.push('"config" must be a list');
  if (def.defaults !== undefined && !isObj(def.defaults)) out.push('"defaults" must be an object');
  for (const k of ['icon', 'line', 'sketch'])
    if (def[k] !== undefined && typeof def[k] !== 'string') out.push(`"${k}" must be a text`);
  return out;
}

/**
 * Add a site's own widgets (definitions) to WIDGET_TYPES, after the built-ins. A bad
 * definition or a built-in's type throws; the same type again replaces it (a reload).
 * `from`: where they come from, for the messages.
 */
export function registerWidgets(defs, from = 'site.config.mjs widgets') {
  for (const def of defs) {
    const problems = widgetProblems(def);
    const name = def?.type || '?';
    if (problems.length) throw new Error(`${from}: widget "${name}": ${problems.join('; ')}`);
    if (BUILTIN.has(def.type))
      throw new Error(`${from}: widget "${def.type}" is a built-in widget's type: use another`);
    WIDGET_TYPES[def.type] = def;
  }
  return WIDGET_TYPES;
}

/** Whether a type is one of the site's own (not built in). */
export const isCustomWidget = (type) => !!WIDGET_TYPES[type] && !BUILTIN.has(type);

/**
 * What the preview can't show without rendering the widget again: its type, content and
 * config, but not on/off, where it sits, its size, link, text scale or motion (the
 * editor applies those).
 */
export function kindOf(widget) {
  // eslint-disable-next-line no-unused-vars
  const { layout, z, size, aspect, motion, scale, config, ...rest } = widget || {};
  const { enabled, ...settings } = config || {}; // eslint-disable-line no-unused-vars
  return JSON.stringify([rest, settings]);
}
