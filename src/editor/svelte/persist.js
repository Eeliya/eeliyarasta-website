/**
 * Keeps the editor where it was across a refresh, in two places:
 *
 *   The URL (shareable): /edit/?tab=motion&path=/people/
 *     tab     browse | content | motion | settings
 *     path    the page in the preview (main.js keeps it up to date)
 *     view    menu | footer, when the page menu shows one of those instead of a page
 *     source  + item: the Source Explorer, open on that file and item
 *             (&source=people&item=noor-vermeer; item is the slug, or the number without one)
 *     motion  animations: the Motion tab's Animations sub-tab (the list of animations)
 *     anim    that sub-tab, open on that animation (&anim=fade-up)
 *     pages   the Pages window, open on that page's folder (&pages=/people/; / is the root)
 *   sessionStorage (this browser tab only, survives a refresh): the finer things. Open/closed
 *     sections, the selected field or Motion element, the explorer's and library's lists,
 *     the panel and preview scroll.
 *
 * On load the URL wins; what it doesn't say comes from sessionStorage. Values that don't
 * exist (a bad tab, a deleted field, a renamed file) are skipped.
 *
 * The URL changes with history.replaceState, not pushState: a tab is a view of the same page,
 * so Back leaves the editor instead of stepping through tabs.
 *
 * main.js calls restoreUi() before the UI mounts and restorePlace() once the preview shows
 * the page; App.svelte calls writeUrl() whenever the tab, view, explorer, library or Pages
 * window changes.
 */
import { tick } from 'svelte';
import { ui } from './ui.svelte.js';
import { sourceIdOf } from '../../site/files.js';

const KEY = 'editor:ui';
// URL tab name -> ui.mode
const TABS = { browse: 'browse', content: 'text', motion: 'motion', settings: 'settings' };
const VIEWS = { menu: 'Menu', footer: 'Footer' };

let bridge, live; // the preview (../bridge.js) and the content (live.svelte.js)
let saved = null; // what to put back, until the preview shows the page

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

/** sessionStorage, then the URL's tab, view and explorer on top. */
function readState() {
  const state = readSession();
  const q = new URLSearchParams(location.search);
  if (q.has('tab')) state.mode = TABS[q.get('tab')] || 'browse';
  if (q.has('view'))
    state.component = VIEWS[q.get('view')] && {
      kind: 'component',
      id: q.get('view'),
      title: VIEWS[q.get('view')],
    };
  if (q.has('source')) {
    if (!q.has('tab')) state.mode = 'text'; // the explorer is in the Content tab
    state.explorer = { open: true, file: `sources/${q.get('source')}.json`, index: 0 };
    state.item = q.get('item');
  }
  if (q.has('pages'))
    state.pagesWin = { open: true, folder: q.get('pages').replace(/^\/+|\/+$/g, '') };
  if (q.get('motion') === 'animations' || q.has('anim')) {
    if (!q.has('tab')) state.mode = 'motion'; // the library is in the Motion tab
    state.library = { open: true, name: q.get('anim') || '' }; // an unknown name: the list
  } else if (q.get('tab') === 'motion') state.library = { open: false, name: '' };
  return state;
}

/** Put back the tab, view and sections, and save the rest when the page goes away. */
export function restoreUi(preview, content) {
  bridge = preview;
  live = content;
  saved = readState();
  if (Object.values(TABS).includes(saved.mode)) ui.mode = saved.mode;
  if (['text', 'motion'].includes(saved.lastEdit)) ui.lastEdit = saved.lastEdit;
  if (saved.component) ui.target = saved.component; // Menu or Footer (pages: ?path=)
  ui.sections = saved.sections || {};
  // the Motion tab's sub-tab: Elements, or Animations (ui.library.open) on an animation
  if (saved.library) ui.library = saved.library;
  if (saved.pagesWin) ui.pagesWin = saved.pagesWin; // PagesModal opens itself

  addEventListener('pagehide', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        mode: ui.mode,
        lastEdit: ui.lastEdit,
        component: ui.target?.kind === 'component' ? ui.target : null,
        sections: ui.sections,
        explorer: ui.explorer,
        library: ui.library,
        pagesWin: ui.pagesWin,
        path: bridge.path(),
        edit: ui.selection?.edit,
        anim: ui.anim?.key,
        panelY: document.querySelector('.ed-body')?.scrollTop || 0,
        previewY: bridge.api?.scrollTop() || 0,
      }),
    );
  });
}

/**
 * The preview shows the page (the first 'navigate'): open the explorer, and if it is the
 * same page as before the refresh, scroll it and pick what was picked.
 */
export async function restorePlace() {
  if (!saved) return;
  const { explorer, item, path, edit, anim, panelY, previewY } = saved;
  saved = null; // only after the refresh, not on later page changes

  // The explorer lives in the Content tab; SourcesModal opens itself when ui.explorer.open is set.
  if (explorer?.open && ui.mode === 'text') {
    const list = live.current(explorer.file);
    const at = Array.isArray(list) ? list.findIndex((it, i) => itemId(it, i) === item) : -1;
    ui.explorer = { ...explorer, index: at >= 0 ? at : explorer.index };
  }

  if (path !== bridge.path()) return;
  bridge.api.scrollTop(previewY);
  // Motion: the picked element; Content (and the others, for later): the selected field
  // (not on the Animations sub-tab: a pick goes to Elements)
  const motion = ui.mode === 'motion';
  if (motion && ui.library.open) return;
  const sel = motion
    ? anim && `[data-anim-key="${CSS.escape(anim)}"]`
    : edit && `[data-edit="${CSS.escape(edit)}"]`;
  const el = sel && bridge.doc.querySelector(sel);
  if (el && (motion || ui.mode === 'text')) bridge.select(el, motion ? 'anim' : 'text');
  // quiet: the Content panel doesn't scroll to the field, the panel scroll is put back below
  if (el && !motion) ui.selection = { edit, quiet: true };
  await tick();
  requestAnimationFrame(() => {
    const panel = document.querySelector('.ed-body');
    if (panel) panel.scrollTop = panelY;
  });
}

/** An explorer item in the URL: its slug, else its number (1, 2, ...). */
const itemId = (it, index) => it?.slug || String(index + 1);

/** Show the tab, view, open explorer item and library animation in the URL (App.svelte, in an $effect). */
export function writeUrl() {
  const url = new URL(location.href);
  const q = url.searchParams;
  const set = (key, value) => (value ? q.set(key, value) : q.delete(key));
  set(
    'tab',
    Object.keys(TABS).find((tab) => TABS[tab] === ui.mode),
  );
  set('view', ui.target?.kind === 'component' && ui.target.id);
  const { open, file, index } = ui.explorer;
  const list = open && file ? live.current(file) : null;
  set('source', list && sourceIdOf(file));
  set('item', Array.isArray(list) && list[index] && itemId(list[index], index));
  const library = ui.mode === 'motion' && ui.library.open;
  set('motion', library && 'animations');
  set('anim', library && ui.library.name);
  set('pages', ui.pagesWin.open && `/${ui.pagesWin.folder}/`.replace('//', '/'));
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}
