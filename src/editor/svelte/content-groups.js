/**
 * What the Content tab shows: the editable texts of the page in the preview (or of the
 * Menu / Footer), grouped by section. Plain functions over the store and the preview;
 * ContentPanel.svelte renders the result.
 */
import { parse } from '../lib/pointer.js';
import { SITE, TEMPLATE, pageIdOf, sourceIdOf } from '../../site/files.js';
import { pointer } from '../../site/helpers.js';
import { SECTION_TYPES } from '../../site/sections/index.js';
import { previewFile } from '../sections.js';

/** site.json values edited in the Settings tab: [key, label, field type]. */
export const SITE_SETTINGS = [
  ['name', 'Site name', 'text'],
  ['title', 'Home page title', 'text'],
  ['description', 'Description (meta tags)', 'block'],
  ['url', 'Site URL (canonical links)', 'text'],
  ['accent', 'Accent color', 'text'],
  ['timezone', 'Time zone of the clock (e.g. Europe/Amsterdam)', 'text'],
  ['ogImage', 'Share image (pages without a photo of their own)', 'image'],
  ['jobTitle', 'Job title (for search engines)', 'text'],
  ['country', 'Country code (for search engines, e.g. NL)', 'text'],
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

/** Human label for a pointer, e.g. sources/people.json#/0/name -> "Noor Vermeer / name". */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (isSource(file) && /^\d+$/.test(parts[0])) {
    const item = store.current[file]?.[parts[0]];
    const name = item?.name || item?.title || `#${Number(parts[0]) + 1}`;
    return [name, ...parts.slice(1)].join(' / ');
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(' / ');
}

const titleCase = (s) =>
  String(s || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** A field's label: the last part of its pointer; a photo in a list (".../photos/1/src") is "photo 2". */
function fieldLabel(store, f) {
  const parts = parse(f.ptr);
  if (f.type === 'image' && parts.at(-1) === 'src' && /^\d+$/.test(parts.at(-2)))
    return `photo ${Number(parts.at(-2)) + 1}`;
  return labelFor(store, f).split(' / ').pop();
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
  const field = (path, type, label) => {
    const ptr = pointer(['sections', at, ...path]);
    return { edit: `${file}#${ptr}`, file, ptr, type: type || 'text', label };
  };
  return (t.fields || []).map((f) => {
    if (!f.list) return field([f.key], f.type, f.label);
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
        ? (subs.find(([, type]) => type === 'image')?.[0] ?? null)
        : f.list === 'image'
          ? ''
          : null,
      items: items.map((_, j) =>
        subs
          ? subs.map(([sub, type]) =>
              field([f.key, j, sub], type, sub === 'src' ? 'Photo' : titleCase(sub)),
            )
          : [field([f.key, j], f.list, `${f.label} ${j + 1}`)],
      ),
    };
  });
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
      title: pageId.endsWith(TEMPLATE) ? 'Item pages' : titleCase(pageId),
    };
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
      title: item?.name || item?.title || `#${Number(parts[0]) + 1}`,
    };
  }
  return { id: 'content', title: 'Content' };
}

/** Menu / Footer fields, known up front (the preview may not show them all). */
const MENU = [
  'home',
  'photography',
  'people',
  'places',
  'projects',
  'about',
  'allPhotography',
  'allProjects',
  'menu',
  'close',
  'clock',
];
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
  ...[0, 1, 2, 3, 4].map((i) => [`/footer/columns/index/links/${i}/label`, 'text']),
  ...[0, 1, 2].flatMap((i) => [
    [`/social/${i}/label`, 'text'],
    [`/social/${i}/handle`, 'text'],
  ]),
];

/** The fields to edit for `target`: { edit, file, ptr, type }. */
function fieldsOf(store, bridge, target) {
  if (target.kind === 'component') {
    const list = target.id === 'menu' ? MENU.map((key) => [`/nav/${key}`, 'text']) : FOOTER;
    return list
      .map(([ptr, type]) => ({ edit: `${SITE}#${ptr}`, file: SITE, ptr, type }))
      .filter(
        (f) => store.get(f.file, f.ptr) !== undefined || store.getBase(f.file, f.ptr) !== undefined,
      );
  }
  // Page content only: the header and footer texts are edited under Menu / Footer.
  const shared = ['nav', 'footer', 'social', 'email', 'location'];
  return bridge
    .editFields()
    .map(({ edit, file, ptr, type }) => ({ edit, file, ptr, type }))
    .filter((f) => f.file !== SITE || !shared.includes(parse(f.ptr)[0]))
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
    if (group) add(group).fields.push({ ...f, label: fieldLabel(store, f) });
    else {
      // a section's text its type doesn't list (e.g. a photo credit): added to its group
      const g = groups.get(`s${parse(f.ptr)[1]}`);
      if (g && f.file === g.file && !allFields(g).some((x) => x.edit === f.edit))
        g.fields.push({ ...f, label: fieldLabel(store, f) });
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
  return [...groups.values()];
}
