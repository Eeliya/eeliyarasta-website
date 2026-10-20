/**
 * The block registry: what a block of each type shows and which fields the editor offers
 * for it. Blocks sit in the sections of a page (src/site/layout/index.js places them):
 *
 *   { "id": "b-k3x9", "type": "grid", "label": "People", "title": "Models",
 *     "source": { "mode": "all", "from": "people" },
 *     "layout": { "base": { "col": 1, "span": 120, "row": 1 } } }
 *
 * The block's own content (texts, photos) sits next to its type, the items it shows under
 * "source" (../layout/source.js); how it works (its look, on/off) is under "config"; where it sits is the layout's (id, layout, z,
 * size: layout keys, never a field key). A type:
 *
 *   type      its name in the content
 *   label     its name in the editor; icon: a Font Awesome icon name (no "fa-")
 *   line      one line on what it is, under its name in the editor's Add block modal
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
 *                     | 'text' | 'boolean'; every block also has config.enabled (on/off)
 *   defaults  a new block of this type (Add block)
 *   check(block)  optional: more problems than the fields' types (src/site/validate.js)
 *   list      a list block: it shows all its source's items (its source: All / From URL /
 *             None), not one (Item / From URL / None): ../layout/source.js
 *   item      it needs an item (its source's first): without one it is skipped
 *   render(block, ctx, b)  its HTML, one root element. b: { id, file, number, ed, source,
 *             items, item, index, indexOf }: the block's id, the page file, its number among
 *             the page's numbered headings, ed(field or path, type), the editor marker of one
 *             of its fields, and what its source shows (blockItems, ../layout/source.js)
 */
import { hero, grid, projects } from './home.js';
import { albums, panels, about } from './pages.js';
import { album } from './album.js';
import { text, photo, button } from './basic.js';
import { form } from './form.js';

/** Every block type, in the order the editor offers them. */
export const BLOCK_TYPES = Object.fromEntries(
  [text, photo, button, form, hero, grid, albums, panels, projects, about, album].map((t) => [
    t.type,
    t,
  ]),
);

/**
 * What the preview can't show without rendering the block again: its type, content and
 * config, but not on/off, where it sits, its size, link, text scale or motion (the
 * editor applies those).
 */
export function kindOf(block) {
  // eslint-disable-next-line no-unused-vars
  const { layout, z, size, aspect, motion, scale, config, ...rest } = block || {};
  const { enabled, ...settings } = config || {}; // eslint-disable-line no-unused-vars
  return JSON.stringify([rest, settings]);
}
