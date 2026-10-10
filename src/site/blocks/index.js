/**
 * The block registry: what a block of each type shows and which fields the editor offers
 * for it. Blocks sit in the sections of a page (src/site/layout/index.js places them):
 *
 *   { "id": "b-k3x9", "type": "grid", "label": "People", "title": "Models",
 *     "config": { "source": "people" }, "pos": { "col": 1, "span": 24, "row": 1, "rows": 12 } }
 *
 * The block's own content (texts, photos) sits next to its type; how it works (which source
 * it pulls, its look, on/off) is under "config"; where it sits is the layout's (id, pos, z,
 * mobile: see LAYOUT_KEYS, never a field key). A type:
 *
 *   type      its name in the content
 *   label     its name in the editor; icon: a Font Awesome icon name (no "fa-")
 *   fields    its content fields for the editor: [{ key, label, type?, width?, list?, item? }]
 *               type: 'text' (default) | 'block' (multi-line) | 'words' | 'number' | 'image'
 *               width: 'half' shares a row with a half field next to it (short texts)
 *               list: the field is a list: a type for a list of values ('block'), or
 *                     { subkey: type } for a list of objects ({ title: 'text' }; a subkey
 *                     can also be 'source', a content/sources file, 'boolean' (a switch), or
 *                     { type, label, width?, options? }: a type with its label, 'select' with options
 *                     [[value, label]])
 *               item: a new item of the list (default: '' or the subkeys empty)
 *   config    its settings: [{ key, label, type, options?, empty? }]
 *               type: 'source' (a content/sources file) | 'select' (options [[value, label]])
 *                     | 'text' | 'boolean'; every block also has config.enabled (on/off)
 *   defaults  a new block of this type (Add block)
 *   check(block)  optional: more problems than the fields' types (src/site/validate.js)
 *   item      shows the item of a [slug] page (ctx.route.album): only on those pages
 *   render(block, ctx, b)  its HTML, one root element. b: { id, file, number, ed }: the
 *             block's id, the page file, its number among the page's numbered headings and
 *             ed(field or path, type), the editor marker of one of its fields
 */
import { hero, intro, grid, projects } from './home.js';
import { heading, albums, panels, about } from './pages.js';
import { album } from './album.js';
import { text, photo, button } from './basic.js';
import { form } from './form.js';

/** Every block type, in the order the editor offers them. */
export const BLOCK_TYPES = Object.fromEntries(
  [
    heading,
    text,
    photo,
    button,
    form,
    hero,
    intro,
    grid,
    albums,
    panels,
    projects,
    about,
    album,
  ].map((t) => [t.type, t]),
);

/** Keys of a block that belong to the layout, not to its type's content. */
export const LAYOUT_KEYS = ['id', 'type', 'config', 'pos', 'z', 'mobile'];

/**
 * What the preview can't show without rendering the block again: its type, content and
 * config, but not on/off or where it sits (the editor applies those itself).
 */
export function kindOf(block) {
  const { pos, z, mobile, config, ...rest } = block || {}; // eslint-disable-line no-unused-vars
  const { enabled, ...settings } = config || {}; // eslint-disable-line no-unused-vars
  return JSON.stringify([rest, settings]);
}
