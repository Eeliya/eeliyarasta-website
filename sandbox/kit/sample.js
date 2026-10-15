/**
 * Sample data for mocks: a page with six sections of real block types, the page menu's items,
 * and a live editor state (the real store and live.svelte.js) holding the page, for the real
 * components that read it (SectionSettings, …).
 */
import { createStore } from '../../src/editor/store.js';
import { createLive } from '../../src/editor/svelte/live.svelte.js';
import { BLOCK_TYPES } from '../../src/site/blocks/index.js';

export const FILE = 'pages/index.json';

/** A block: block('b-1', 'grid', 'People'), for your own sampleLive([...]) pages. */
export const block = (id, type, title) => ({ id, type, ...(title && { title }) });
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

/**
 * Ready-made pages for section-card mocks (pass the name to sampleLive). `at` is the index:
 *   short   0 unnamed (intro) · 1 "Work" (grid People, button)
 *   full    0 unnamed (intro) · 1 "Work" (grid People, button) · 2 "Albums" (albums) ·
 *           3 a very long name (projects, grid Places) · 4 unnamed (projects, button)
 *   states  0 "Work" (grid People, button) · 1 "Contact", switched off (button) · 2 unnamed, no blocks
 */
const LONG = 'Selected portrait and editorial work from the last three years';
export const samplePage = {
  short: [
    { id: 's-1', blocks: [block('b-1', 'intro')] },
    { id: 's-2', name: 'Work', blocks: [block('b-2', 'grid', 'People'), block('b-3', 'button')] },
  ],
  full: [
    { id: 's-1', blocks: [block('b-1', 'intro')] },
    { id: 's-2', name: 'Work', blocks: [block('b-2', 'grid', 'People'), block('b-3', 'button')] },
    { id: 's-3', name: 'Albums', blocks: [block('b-4', 'albums', 'Albums')] },
    {
      id: 's-4',
      name: LONG,
      blocks: [block('b-5', 'projects', 'Things I build'), block('b-6', 'grid', 'Places')],
    },
    { id: 's-5', blocks: [block('b-7', 'projects', 'Side projects'), block('b-8', 'button')] },
  ],
  states: [
    { id: 's-1', name: 'Work', blocks: [block('b-1', 'grid', 'People'), block('b-2', 'button')] },
    { id: 's-2', name: 'Contact', enabled: false, blocks: [block('b-3', 'button')] },
    { id: 's-3', blocks: [] },
  ],
};

/**
 * A live editor state with a sample page loaded (a fresh one each call): sampleLive() the
 * six-section SECTIONS, sampleLive('short' | 'full' | 'states') a samplePage, or
 * sampleLive([...sections]) your own.
 */
export function sampleLive(sections = SECTIONS) {
  if (typeof sections === 'string') {
    if (!samplePage[sections]) throw new Error(`No samplePage "${sections}"`);
    sections = samplePage[sections];
  }
  const store = createStore();
  store.load({ [FILE]: { title: 'Home', sections: structuredClone(sections) } });
  return createLive(store);
}
