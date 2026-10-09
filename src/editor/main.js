/**
 * Visual editor (/edit/): the real site in an iframe + a side panel.
 *
 *   Browse  - use the site normally; overview of unsaved changes
 *   Content - click text in the preview to edit it (animations paused)
 *   Motion  - click an animated element to edit its preset / timing / trigger
 *   Settings - site-wide values: site name and meta, the global page-transition curtain
 *
 * Edits only touch in-memory copies of content/*.json (see store.js).
 *   Save    - writes the changed files to content/ on disk (a draft: the preview and
 *             Browse show it, nothing leaves this machine)
 *   Publish - commits every saved content change in one commit and pushes it
 *             (svelte/PublishDialog.svelte)
 * Both go through the dev server (scripts/editor-server.mjs). The editor only exists
 * under `npm run dev`.
 *
 * The whole UI is Svelte: svelte/App.svelte shows `ui` (svelte/ui.svelte.js) and has the
 * keyboard shortcuts. This file mounts it and holds the glue: the preview (bridge.js) and
 * store (store.js) events, saving and loading the content.
 */
import './styles/editor.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import { mount } from 'svelte';
import App from './svelte/App.svelte';
import { ui } from './svelte/ui.svelte.js';
import { toast } from './svelte/toasts.svelte.js';
import { createLive } from './svelte/live.svelte.js';
import { createStore } from './store.js';
import * as source from './source.js';
import { createBridge } from './bridge.js';
import { labelFor, SITE_SETTINGS } from './svelte/content-groups.js';
import { plural } from './lib/format.js';
import { getRoutes, curtainOverrides } from '../site/routes.js';
import { ANIMATIONS, HOME, SITE, contentFromFiles } from '../site/files.js';
import { syncHomeSections } from './sections.js';

const store = createStore();
const live = createLive(store);
const bridge = createBridge({ store, labelFor: (p) => labelFor(store, p) });

const root = document.getElementById('editor');
root.textContent = '';
mount(App, {
  target: root,
  props: { live, bridge, actions: { setMode, pickTarget, save, refreshStatus } },
});

// ---------------------------------------------------------------- ui
/** The preview's router gets the draft per-page curtains: they apply to the next page change. */
function pushCurtains() {
  bridge.api?.setPageCurtains?.(curtainOverrides(getRoutes(contentFromFiles(store.current))));
}

/** The page menu: every page of the site (404 included: it has its own file), then Menu and Footer. */
function updatePages() {
  const path = bridge.path() || new URLSearchParams(location.search).get('path') || '/';
  const routes = getRoutes(contentFromFiles(store.current));
  ui.pages = [
    ...routes.map((r) => ({ kind: 'page', path: r.path, title: r.title.split('|')[0].trim() })),
    { kind: 'component', id: 'menu', title: 'Menu' },
    { kind: 'component', id: 'footer', title: 'Footer' },
  ];
  // Menu / Footer stay picked; otherwise follow the page shown in the preview.
  if (ui.target?.kind !== 'component')
    ui.target = ui.pages.find((i) => i.kind === 'page' && i.path === path) || ui.pages[0];
}

/** The page menu picked a page (navigate the preview) or a component (Menu, Footer). */
function pickTarget(item) {
  ui.target = item;
  if (item.kind === 'page') bridge.navigate(item.path);
}

/** Saved-but-unpublished content changes (ui.pub), from /__editor/status. */
async function refreshStatus() {
  try {
    ui.pub = await source.status();
  } catch (err) {
    ui.pub = { error: err.message, files: [], ahead: 0 };
  }
}

/** A pick in the preview (bridge 'select') -> ui.anim for the Motion tab. */
function pickAnim(sel) {
  if (sel?.kind !== 'anim') return null;
  const { el } = sel;
  const key = el.dataset.animKey;
  // Edits go to the element if it already has overrides, otherwise to every element of its target.
  const scope = store.current[ANIMATIONS].elements?.[key] ? 'element' : 'target';
  return { el, id: el.dataset.anim, key, scope };
}

function setMode(mode) {
  ui.mode = mode;
  if (mode === 'text' || mode === 'motion') ui.lastEdit = mode;
  // Settings has nothing to pick in the preview: it behaves like Browse there.
  bridge.setMode(mode === 'settings' ? 'browse' : mode);
  if (mode === 'motion') ui.anim = null;
}

// ---------------------------------------------------------------- preview events
bridge.on('connect', () => {
  bridge.setMode(ui.mode === 'settings' ? 'browse' : ui.mode);
  pushCurtains();
  ui.previewVersion++;
});

/**
 * Keep the preview's home sections in list order (reorder, on/off, layout) after edits.
 * Returns true when data-edit pointers moved, so texts must be re-applied.
 */
function syncSections() {
  const r = syncHomeSections(bridge.doc, store);
  ui.staleSections = [...r.stale];
  if (r.moved) bridge.api?.ScrollTrigger?.refresh();
  return r.rewired;
}

bridge.on('navigate', (path) => {
  if (syncSections()) bridge.applyTexts({ force: true });
  const url = new URL(location.href);
  url.searchParams.set('path', path);
  history.replaceState(null, '', url);
  // Keep Menu/Footer selection; only sync target when browsing pages.
  if (ui.target?.kind !== 'component') {
    ui.target = { kind: 'page', path, title: path === '/' ? 'Home' : path };
  }
  updatePages();
  ui.previewVersion++;
  ui.anim = null;
});
bridge.on('select', (sel) => {
  if (ui.mode === 'motion') ui.anim = pickAnim(sel);
  else ui.selection = sel?.kind === 'text' ? { edit: sel.el.dataset.edit } : null;
});
bridge.on('textFocus', (edit) => (ui.selection = { edit }));

// ---------------------------------------------------------------- store events
let animTimer = 0;
store.on(({ files, source: src }) => {
  // After a save the files on disk caught up with us: nothing changes in the preview.
  if (src === 'saved') return;
  const textChanged = files.some((f) => f !== ANIMATIONS);
  const rewired = files.includes(HOME) && syncSections();
  if (textChanged) {
    pushCurtains();
    const fromPreview = src && src.nodeType === 1;
    bridge.applyTexts({
      skip: fromPreview ? src : null,
      force: rewired || ['undo', 'redo', 'rebase', 'discard'].includes(src),
    });
  }
  if (files.includes(ANIMATIONS)) {
    clearTimeout(animTimer);
    animTimer = setTimeout(() => bridge.updateAnimations(store.current[ANIMATIONS]), 180);
  }
  if (textChanged && src !== 'panel' && !(src && src.nodeType === 1)) updatePages();
});

// ---------------------------------------------------------------- saving
/**
 * Write the changed files to content/ (a draft). quiet: no toast (the publish dialog saves
 * first and shows its own result). Returns false when it failed.
 */
async function save({ quiet = false } = {}) {
  const dirty = store.dirtyFiles();
  if (!dirty.length) return true;
  if (ui.saving) return false;
  // Items added to or deleted from a list only show in the preview once it re-renders.
  const listsChanged = dirty.some(
    (f) => Array.isArray(store.base[f]) && store.base[f].length !== store.current[f]?.length,
  );
  // Site settings (name, title, ...) are only in the rendered pages.
  const settingsChanged = SITE_SETTINGS.some(
    ([key]) => store.base[SITE]?.[key] !== store.current[SITE]?.[key],
  );
  ui.saving = true;
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    // A section the preview couldn't show yet (e.g. a grid with a new source) or new site
    // settings: re-render the page.
    if ((listsChanged || settingsChanged || ui.staleSections.length) && bridge.path())
      bridge.load(bridge.path());
    if (!quiet) toast('Saved', { kind: 'ok', files: dirty, note: '(draft, not published)' });
    ui.status = `Saved ${plural(dirty.length, 'file')} · ${new Date().toLocaleTimeString()}`;
    return true;
  } catch (err) {
    toast(`Save failed: ${err.message}`, { kind: 'error', timeout: 0 });
    return false;
  } finally {
    ui.saving = false;
    refreshStatus();
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  ui.status = 'Loading content…';
  let loaded;
  try {
    loaded = await source.load();
  } catch (err) {
    ui.loadError = err.message; // App shows it instead of the editor
    return;
  }
  store.load(loaded.files);
  ui.status = `Content: ${loaded.from}`;
  updatePages();
  refreshStatus();
  window.addEventListener('focus', () => !ui.publishing && refreshStatus());
  bridge.load(new URLSearchParams(location.search).get('path') || '/');
}

boot();
