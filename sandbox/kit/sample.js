/**
 * Sample data for mocks: a page with six sections of real block types, the page menu's items,
 * and a live editor state (the real store and live.svelte.js) holding the page, for the real
 * components that read it (SectionSettings, …).
 */
import { createStore } from '../../src/editor/store.js';
import { createLive } from '../../src/editor/svelte/live.svelte.js';
import { BLOCK_TYPES } from '../../src/site/blocks/index.js';

export const FILE = 'pages/index.json';

const block = (id, type, title) => ({ id, type, ...(title && { title }) });
export const SECTIONS = [
  { id: 's-1', name: 'Eeliya Rasta', blocks: [block('b-1', 'hero')] },
  { id: 's-2', blocks: [block('b-2', 'intro')] },
  { id: 's-3', name: 'Work', blocks: [block('b-3', 'grid', 'People'), block('b-4', 'button')] },
  { id: 's-4', blocks: [block('b-5', 'albums', 'Albums')] },
  { id: 's-5', blocks: [block('b-6', 'projects', 'Things I build')] },
  {
    id: 's-6',
    blocks: [block('b-7', 'projects', 'Things I build'), block('b-8', 'grid', 'Places')],
  },
];

/** The page menu's items (PageMenu.svelte). */
export const PAGES = [
  { kind: 'page', path: '/', title: 'Eeliya Rasta: Photography & Projects', group: 'Pages' },
  { kind: 'page', path: '/about/', title: 'About', group: 'Pages' },
  { kind: 'page', path: '/projects/', title: 'Projects', group: 'Pages' },
  { kind: 'part', id: 'footer', title: 'Footer' },
];

/** A block's name in the editor (the registry's label). */
export const labelOf = (b) => BLOCK_TYPES[b.type]?.label || b.type;

/** A live editor state with the sample page loaded (a fresh one each call). */
export function sampleLive(sections = SECTIONS) {
  const store = createStore();
  store.load({ [FILE]: { title: 'Home', sections: structuredClone(sections) } });
  return createLive(store);
}
