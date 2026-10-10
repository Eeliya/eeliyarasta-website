/**
 * The section registry: every page is an ordered list of typed sections, "sections" in its
 * file (content/pages/<page>/index.json, or the [slug].json of a template page):
 *
 *   { "type": "grid", "label": "People", "title": "Models", "config": { "source": "people" } }
 *
 * The section's own content (texts, photos) sits next to its type; how it works (which
 * source it pulls, its layout, on/off) is under "config". The build renders the list in
 * order; the editor reads the same registry to show each section's fields and settings and
 * to offer "Add section". A type:
 *
 *   type      its name in the content
 *   label     its name in the editor; icon: a Font Awesome icon name (no "fa-")
 *   fields    its content fields for the editor: [{ key, label, type?, list? }]
 *               type: 'text' (default) | 'block' (multi-line) | 'words' | 'number' | 'image'
 *               list: the field is a list: a type for a list of values ('block'), or
 *                     { subkey: type } for a list of objects ({ title: 'text' })
 *   config    its settings: [{ key, label, type, options?, empty? }]
 *               type: 'source' (a content/sources file) | 'select' (options [[value, label]])
 *                     | 'text' | 'boolean'; every section also has config.enabled (on/off)
 *   defaults  a new section of this type (Add section)
 *   numbered  counts in the (01), (02) numbering of section heads (a function of the
 *             section when it depends on it)
 *   item      shows the item of a [slug] page (ctx.route.album): only on those pages
 *   render(section, ctx, sec)  its HTML. sec: { at, file, number, attrs, ed }: its index,
 *             the page file, its number (01), the attributes for its root element (editor
 *             markers, hidden when off) and ed(field or path, type), the editor marker of
 *             one of its fields
 *
 * An unknown type is skipped with a warning.
 */
import { esc, ed, editable, warnOnce } from '../helpers.js';
import { hero, intro, grid, projects } from './home.js';
import { heading, albums, panels, about } from './pages.js';
import { album } from './album.js';
import { text, photo, button } from './basic.js';

/** Every section type, in the order the editor offers them. */
export const SECTION_TYPES = Object.fromEntries(
  [heading, text, photo, button, hero, intro, grid, albums, panels, projects, about, album].map(
    (t) => [t.type, t],
  ),
);

/**
 * What the preview can't change without rendering again: the type and its config, except
 * on/off and layout (the editor's preview sync applies those itself, src/editor/sections.js).
 */
export function kindOf(s) {
  const { enabled, layout, ...rest } = s?.config || {}; // eslint-disable-line no-unused-vars
  const keys = Object.keys(rest).sort();
  return `${s?.type}${keys.map((k) => `|${k}=${rest[k]}`).join('')}`;
}

/** Does section `s` count in the (01), (02) numbering? */
export const isNumbered = (s) => {
  const n = SECTION_TYPES[s?.type]?.numbered;
  return typeof n === 'function' ? n(s) : !!n;
};

/** A new section of `type`: its defaults, on. */
export const newSection = (type) => {
  const { config = {}, ...rest } = structuredClone(SECTION_TYPES[type].defaults || {});
  return { type, ...rest, config: { enabled: true, ...config } };
};

/** The sections of a page file, rendered in order. route: the page's route (route.album on [slug] pages). */
export function renderSections(ctx, route, file, sections) {
  let number = 0;
  return (Array.isArray(sections) ? sections : [])
    .map((s, at) => {
      const t = SECTION_TYPES[s?.type];
      if (!t) {
        warnOnce(
          `content/${file}: unknown section type "${s?.type}" (sections/${at}): skipped`,
          'sections',
        );
        return '';
      }
      if (t.item && !route.album) {
        warnOnce(
          `content/${file}: a "${t.type}" section only works on a [slug] page: skipped`,
          'sections',
        );
        return '';
      }
      const on = s.config?.enabled !== false;
      if (on && isNumbered(s)) number++;
      const sec = {
        at,
        file,
        number,
        attrs: `${editable ? ` data-section="s${at}" data-section-kind="${esc(kindOf(s))}"` : ''}${on ? '' : ' hidden'}`,
        ed: (path, type) => ed(file, ['sections', at, ...[path].flat()], type),
      };
      return t.render(s, ctx, sec);
    })
    .join('');
}
