/**
 * What the Content tab shows: the editable texts of the page in the preview (or of the
 * Menu / Footer), grouped by section. Plain functions over the store and the preview;
 * ContentPanel.svelte renders the result.
 */
import { parse } from '../lib/pointer.js';
import { NAV, SITE, TEMPLATE, pageIdOf, sourceIdOf } from '../../site/files.js';
import { pointer } from '../../site/helpers.js';
import { labelOf } from '../../site/schemas.js';
import { SECTION_TYPES } from '../../site/sections/index.js';
import { previewFile } from '../sections.js';
import { WIDGETS, itemName, schemaFor } from './source-items.js';

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

/** Lists in content/sources/ (people, places, projects, ...). */
export const isSource = (file) => sourceIdOf(file) !== null;

/** "pages/index.json#/sections/0/title" -> { file: 'pages/index.json', ptr: '/sections/0/title' } */
export function splitEdit(edit) {
  const i = edit.indexOf('#');
  return { file: edit.slice(0, i), ptr: edit.slice(i + 1) };
}

/** The page shown in the preview ('home', 'people', ...), from its router view. */
export const previewPage = (bridge) =>
  bridge.doc?.querySelector('[data-router-view]')?.dataset.page;

/**
 * Human label for a pointer, e.g. sources/people.json#/0/name -> "Noor Vermeer / Name": a
 * source item by its name and its field by the schema's label.
 */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (isSource(file) && /^\d+$/.test(parts[0])) {
    const schema = schemaFor(store, file);
    const item = store.current[file]?.[parts[0]];
    const name = item ? itemName(item, schema) : `#${Number(parts[0]) + 1}`;
    const field = schema.fields.find((f) => f.key === parts[1]);
    return [name, field?.label ?? parts[1], ...parts.slice(2)].filter(Boolean).join(' / ');
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(' / ');
}

/** Labels of the texts outside sections: a template's shared labels, the footer, the menu. */
const LABELS = {
  section: 'Back link',
  next: 'Next link',
  label: 'Label',
  cta: 'Call to action',
  note: 'Note',
  toTop: 'Back to top',
  email: 'Email',
  location: 'Location',
  menu: 'Menu button',
  close: 'Close button',
  clock: 'Clock label',
  handle: 'Handle',
};

/**
 * A field's label: a source field's from its schema, else a known text's (LABELS), else its
 * key made readable; a photo in a list (".../photos/1/src") is "Photo 2".
 */
function fieldLabel(store, f) {
  const parts = parse(f.ptr);
  // a menu label: "Item 2", "Item 2 › 1" (a dropdown link), "Item 2: all link"
  if (f.file === NAV) {
    const [, i, key, j] = parts;
    const item = `Item ${Number(i) + 1}`;
    return key === 'children'
      ? `${item} › ${Number(j) + 1}`
      : key === 'all'
        ? `${item}: all link`
        : item;
  }
  if (f.type === 'image' && parts.at(-1) === 'src' && /^\d+$/.test(parts.at(-2)))
    return `Photo ${Number(parts.at(-2)) + 1}`;
  const key = parts.at(-1);
  if (f.file === SITE && parts[0] === 'social') return `Social ${Number(parts[1]) + 1} ${key}`;
  if (parts.at(-3) === 'columns') return `${labelOf(parts.at(-2))} column title`;
  return LABELS[key] ?? labelOf(key);
}

/**
 * A preview field as the panel shows it: its label, and for a source item's field what its
 * schema says (widget, half width, help, choices).
 */
function described(store, f) {
  const parts = parse(f.ptr);
  const own = isSource(f.file) && parts.length === 2 && /^\d+$/.test(parts[0]);
  const sf = own && schemaFor(store, f.file).fields.find((x) => x.key === parts[1]);
  if (!sf) return { ...f, label: fieldLabel(store, f) };
  return {
    ...f,
    label: sf.label || labelOf(sf.key),
    type: WIDGETS[sf.type] || f.type,
    half: sf.width === 'half',
    help: sf.help || '',
    ...(sf.options ? { options: sf.options.map((o) => [o, o]) } : {}),
  };
}

const TRANSITION = { id: 'transition', title: 'Page transition', name: 'Curtain' };

/** The sections of page file `file` (its "sections" list). */
export function sectionsOf(store, file) {
  const list = store.current[file]?.sections;
  return Array.isArray(list) ? list : [];
}

/** A short name for section s: its first text (label, title, ...), at most 40 characters. */
function nameOf(s) {
  const text = [s?.label, s?.title, s?.headline, s?.crumb, s?.caption].find(
    (v) => typeof v === 'string' && v.trim(),
  );
  const line = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return line.length > 40 ? `${line.slice(0, 39)}…` : line;
}

/**
 * The fields of section `at` from its type's registry entry: [{ edit, file, ptr, type, label }].
 * A list field is one entry { list: true, edit, file, ptr, label, item, photo, items }: items
 * holds each item's fields ([[field, ...], ...]), item a new item, photo the subkey of a
 * photo item ('' for a list of photos, null for none) so Add can open the Media window.
 */
function registryFields(file, at, s, t) {
  // a list item's subkey type can be { type, label, options } (src/site/sections/index.js)
  const field = (path, type, label) => {
    const ptr = pointer(['sections', at, ...path]);
    const def = type && typeof type === 'object' ? type : { type };
    return {
      edit: `${file}#${ptr}`,
      file,
      ptr,
      type: def.type || 'text',
      label: def.label || label,
      half: def.width === 'half',
      ...(def.options ? { options: def.options } : {}),
    };
  };
  return (t.fields || []).map((f) => {
    if (!f.list) return field([f.key], f, f.label);
    const items = Array.isArray(s[f.key]) ? s[f.key] : [];
    const subs = typeof f.list === 'string' ? null : Object.entries(f.list);
    const ptr = pointer(['sections', at, f.key]);
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
              field([f.key, j, sub], type, sub === 'src' ? 'Photo' : labelOf(sub)),
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

/**
 * Group for section `at` of page file `file`: id "s<at>", titled by its type, named by its
 * text, with its on/off toggle, settings (config) and its type's fields.
 */
function sectionGroup(store, file, at) {
  const s = sectionsOf(store, file)[at];
  const t = SECTION_TYPES[s?.type];
  const sources = Object.keys(store.current).map(sourceIdOf).filter(Boolean).sort();
  return {
    id: `s${at}`,
    key: `text:${file}#s${at}`,
    index: at,
    file,
    icon: t?.icon || 'question',
    title: t?.label || `Unknown type "${s?.type}"`,
    name: nameOf(s),
    toggle: { file, ptr: `/sections/${at}/config/enabled` },
    config: (t?.config || []).map((c) => ({
      ...c,
      ptr: `/sections/${at}/config/${c.key}`,
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
    fields: t ? registryFields(file, at, s, t) : [],
  };
}

/** Which group a preview field belongs to: { id, title }; null for a section's own fields. */
export function groupFor(store, { file, ptr }, page) {
  const parts = parse(ptr);
  const pageId = pageIdOf(file);
  if (pageId !== null) {
    if (parts[0] === 'curtain') return TRANSITION;
    if (parts[0] === 'sections') return null; // in its section's group
    // people/[slug]: the labels every item page shares (section, next)
    return {
      id: 'page-body',
      title: pageId.endsWith(TEMPLATE) ? 'Item pages' : labelOf(pageId),
    };
  }
  if (file === NAV) {
    if (parts[0] === 'header') return { id: 'nav', title: 'Navigation labels' };
    if (parts[0] === 'footer') return { id: 'footer', title: 'Footer' };
  }
  if (file === SITE) {
    if (parts[0] === 'nav') return { id: 'nav', title: 'Navigation labels' };
    if (parts[0] === 'footer') return { id: 'footer', title: 'Footer' };
    if (parts[0] === 'social') return { id: 'social', title: 'Social links' };
    if (parts[0] === 'email' || parts[0] === 'location') return { id: 'footer', title: 'Footer' };
  }
  if (isSource(file) && /^\d+$/.test(parts[0])) {
    // List items shown on the home page are edited in the Sources modal, not in a group.
    if (page === 'home')
      return { id: `source:${sourceIdOf(file)}`, title: `${sourceIdOf(file)}.json` };
    const item = store.current[file]?.[parts[0]];
    return {
      id: `${file}-${parts[0]}`,
      title: item ? itemName(item, schemaFor(store, file)) : `#${Number(parts[0]) + 1}`,
    };
  }
  return { id: 'content', title: 'Content' };
}

/**
 * Menu / Footer fields, known up front (the preview may not show them all): the labels of
 * the menus in nav.json (their links and order are edited in Settings > Menu), and the
 * header and footer texts of site.json. [file, pointer, type]
 */
function componentFields(store, id) {
  const nav = store.current[NAV] || {};
  const labels = (menu) =>
    (Array.isArray(nav[menu]) ? nav[menu] : []).flatMap((item, i) => [
      [NAV, `/${menu}/${i}/label`, 'text'],
      ...(item?.all !== undefined ? [[NAV, `/${menu}/${i}/all`, 'text']] : []),
      ...(Array.isArray(item?.children) ? item.children : []).map((_, j) => [
        NAV,
        `/${menu}/${i}/children/${j}/label`,
        'text',
      ]),
    ]);
  if (id === 'menu')
    return [
      ...labels('header'),
      ...['menu', 'close', 'clock'].map((k) => [SITE, `/nav/${k}`, 'text']),
    ];
  return [
    ...FOOTER.map(([ptr, type]) => [SITE, ptr, type]),
    ...labels('footer'),
    ...[0, 1, 2].flatMap((i) => [
      [SITE, `/social/${i}/label`, 'text'],
      [SITE, `/social/${i}/handle`, 'text'],
    ]),
  ];
}
const FOOTER = [
  ['/footer/label', 'text'],
  ['/footer/cta', 'block'],
  ['/footer/note', 'text'],
  ['/footer/toTop', 'text'],
  ['/footer/columns/social/title', 'text'],
  ['/footer/columns/index/title', 'text'],
  ['/footer/columns/contact/title', 'text'],
  ['/footer/columns/time/title', 'text'],
  ['/email', 'text'],
  ['/location', 'text'],
];

/** The fields to edit for `target`: { edit, file, ptr, type }. */
function fieldsOf(store, bridge, target) {
  if (target.kind === 'component') {
    return componentFields(store, target.id)
      .map(([file, ptr, type]) => ({ edit: `${file}#${ptr}`, file, ptr, type }))
      .filter(
        (f) => store.get(f.file, f.ptr) !== undefined || store.getBase(f.file, f.ptr) !== undefined,
      );
  }
  // Page content only: the header and footer texts are edited under Menu / Footer.
  const shared = ['nav', 'footer', 'social', 'email', 'location'];
  return bridge
    .editFields()
    .map(({ edit, file, ptr, type }) => ({ edit, file, ptr, type }))
    .filter((f) => f.file !== NAV && (f.file !== SITE || !shared.includes(parse(f.ptr)[0])))
    .filter((f) => !f.ptr.endsWith('/enabled')); // on/off flags have their own toggle
}

/**
 * The Content tab's groups for `target`, in panel order: the page's sections (in list order),
 * then the other texts in the preview (list items, the shared labels of item pages), then the
 * page transition.
 * [{ id, title, name?, index?, file?, icon?, toggle?, config?, fields: [{ edit, file, ptr, type, label }] }]
 */
export function contentGroups(store, bridge, target) {
  const page = previewPage(bridge);
  const file = target.kind === 'page' ? previewFile(bridge.doc) : '';
  const groups = new Map();
  const add = (group) => {
    if (!groups.has(group.id)) groups.set(group.id, { fields: [], ...group });
    return groups.get(group.id);
  };

  // Every section, even the ones without text (they still have a toggle and settings).
  sectionsOf(store, file).forEach((_, i) => add(sectionGroup(store, file, i)));

  for (const f of fieldsOf(store, bridge, target)) {
    const group = groupFor(store, f, page);
    if (group?.id.startsWith('source:')) continue;
    if (group) add(group).fields.push(described(store, f));
    else {
      // a section's text its type doesn't list (e.g. a photo credit): added to its group
      const g = groups.get(`s${parse(f.ptr)[1]}`);
      if (g && f.file === g.file && !allFields(g).some((x) => x.edit === f.edit))
        g.fields.push(described(store, f));
    }
  }

  // The page transition text is an attribute of the page, not a [data-edit] element.
  const curtain = bridge.doc?.querySelector('[data-router-view]')?.dataset.curtainEdit;
  if (target.kind === 'page' && curtain) {
    add(TRANSITION).fields.push({
      edit: curtain,
      ...splitEdit(curtain),
      type: 'text',
      label: 'Curtain text',
      placeholder: 'Leave empty to hide the label',
    });
  }
  // A group whose fields all come from one source file names it once, in its bar.
  for (const g of groups.values()) {
    const files = new Set(allFields(g).map((f) => f.file));
    const [only] = files;
    if (files.size === 1 && isSource(only)) g.source = only;
  }
  return [...groups.values()];
}
