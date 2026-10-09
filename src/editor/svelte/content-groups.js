/**
 * What the Content tab shows: the editable texts of the page in the preview (or of the
 * Menu / Footer), grouped by section. Plain functions over the store and the preview;
 * ContentPanel.svelte renders the result.
 */
import { parse } from '../lib/pointer.js';
import { SITE, HOME, pageIdOf, sourceIdOf } from '../../site/files.js';

/** site.json values edited in the Settings tab: [key, label, field type]. */
export const SITE_SETTINGS = [
  ['name', 'Site name', 'text'],
  ['title', 'Home page title', 'text'],
  ['description', 'Description (meta tags)', 'block'],
  ['url', 'Site URL (canonical links)', 'text'],
  ['accent', 'Accent color', 'text'],
  ['camera', 'Camera (footer)', 'text'],
];

/** Lists in content/sources/ (people, places, projects, ...). */
export const isSource = (file) => sourceIdOf(file) !== null;

/** "pages/home.json#/hero/title" -> { file: 'pages/home.json', ptr: '/hero/title' } */
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

/** Home sections (pages/home.json "sections", an ordered list). */
export function homeSections(store) {
  const list = store.current[HOME]?.sections;
  return Array.isArray(list) ? list : [];
}

const HERO = { id: 'hero', title: 'Hero', toggle: { file: HOME, ptr: '/hero/enabled' } };
const TRANSITION = { id: 'transition', title: 'Page transition', name: 'Curtain' };
const PAGE_HEAD = { id: 'page-head', title: 'Page heading' };
/** Page-file fields shown in the page heading (pages/<id>.json). */
const HEADING = ['crumb', 'title', 'intro', 'cta'];

/** Group for home section `i`: id "s<i>", titled by its label, with its on/off toggle. */
function sectionGroup(store, i) {
  const section = homeSections(store)[i];
  return {
    id: `s${i}`,
    index: i,
    title: section?.label || titleCase(section?.type || `Section ${i + 1}`),
    toggle: { file: HOME, ptr: `/sections/${i}/config/enabled` },
    grid: gridOptions(store, i),
  };
}

/** A grid section's settings (config.source, config.layout), or null for other sections. */
function gridOptions(store, i) {
  const section = homeSections(store)[i];
  if (section?.type !== 'grid') return null;
  const source = section.config?.source || 'people';
  const sources = Object.keys(store.current).map(sourceIdOf).filter(Boolean).sort();
  const missing = !sources.includes(source);
  return {
    source,
    layout: section.config?.layout === 'even' ? 'even' : 'staggered',
    sources: missing ? [source, ...sources] : sources,
    missing,
  };
}

/** Which group a field belongs to: { id, title, index?, toggle?, grid? }. */
export function groupFor(store, { file, ptr }, page) {
  const parts = parse(ptr);
  if (file === HOME) {
    if (parts[0] === 'hero') return HERO;
    if (parts[0] === 'sections' && /^\d+$/.test(parts[1] || ''))
      return sectionGroup(store, Number(parts[1]));
  }
  const pageId = pageIdOf(file);
  if (pageId !== null) {
    if (parts[0] === 'curtain') return TRANSITION;
    // Any other page: its heading, then the rest of its own copy (e.g. the About text).
    if (file !== HOME)
      return HEADING.includes(parts[0]) ? PAGE_HEAD : { id: 'page-body', title: titleCase(pageId) };
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
  if (page === 'home') return { id: 'other', title: 'Other' };
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
];
const FOOTER = [
  ['/footer/label', 'text'],
  ['/footer/cta', 'block'],
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
 * The Content tab's groups for `target`, in panel order:
 * [{ id, title, index?, toggle?, grid?, fields: [{ edit, file, ptr, type, label }] }]
 */
export function contentGroups(store, bridge, target) {
  const page = previewPage(bridge);
  const isHome = target.kind === 'page' && (target.path === '/' || page === 'home');
  const groups = new Map();
  const add = (group) => {
    if (!groups.has(group.id)) groups.set(group.id, { ...group, fields: [] });
    return groups.get(group.id);
  };

  // Home: the hero and every section, even the ones without text (they still have a toggle).
  if (isHome) [HERO, ...homeSections(store).map((_, i) => sectionGroup(store, i))].forEach(add);

  for (const f of fieldsOf(store, bridge, target)) {
    const group = groupFor(store, f, page);
    if (group.id.startsWith('source:')) continue;
    add(group).fields.push({ ...f, label: fieldLabel(store, f) });
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

  // Home keeps the section order with the transition last; other pages keep document order.
  if (!isHome) return [...groups.values()];
  const order = ['hero', ...homeSections(store).map((_, i) => `s${i}`), 'transition'];
  return [...groups.values()].sort((a, b) => rank(order, a.id) - rank(order, b.id));
}

const rank = (order, id) => (order.includes(id) ? order.indexOf(id) : order.length);
