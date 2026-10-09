/**
 * Visual editor (/edit/): the real site in an iframe + a side panel.
 *
 *   Browse  - use the site normally; overview of unsaved changes
 *   Content - click text in the preview to edit it (animations paused)
 *   Motion  - click an animated element to edit its animation / timing / trigger
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
import { connectMedia } from './svelte/media.svelte.js';
import { createStore } from './store.js';
import * as source from './source.js';
import { createBridge } from './bridge.js';
import { labelFor } from './svelte/content-groups.js';
import { plural } from './lib/format.js';
import { getRoutes, curtainOverrides, pathOfId } from '../site/routes.js';
import { ANIMATIONS, HOME, TEMPLATE, contentFromFiles, pageFile, pageIdOf } from '../site/files.js';
import { syncHomeSections } from './sections.js';
import { restoreUi, restorePlace } from './svelte/persist.js';

const store = createStore();
const live = createLive(store);
connectMedia(live); // photo URLs read site.json's mediaUrl from it
const bridge = createBridge({ store, labelFor: (p) => labelFor(store, p) });

restoreUi(bridge, live); // the tab, sections, ...: from the URL and sessionStorage (svelte/persist.js)

const root = document.getElementById('editor');
root.textContent = '';
mount(App, {
  target: root,
  props: { live, bridge, actions: { setMode, pickTarget, save, refreshStatus, pagesOp } },
});

// ---------------------------------------------------------------- ui
/** The preview's router gets the draft per-page curtains: they apply to the next page change. */
function pushCurtains() {
  bridge.api?.setPageCurtains?.(curtainOverrides(getRoutes(contentFromFiles(store.current))));
}

/**
 * Page menu entries, grouped by folder: "/people/" holds the people page and the pages in its
 * folder. A [slug] template is one entry ({ template, items }) for all its item pages.
 */
function pageEntries(routes) {
  const ids = Object.keys(store.current).map(pageIdOf).filter(Boolean);
  const folders = new Set(ids.map((id) => id.slice(0, Math.max(0, id.lastIndexOf('/')))));
  const groupOf = (id) => {
    const folder = folders.has(id) ? id : id.slice(0, Math.max(0, id.lastIndexOf('/')));
    return folder ? `/${folder}/` : 'Pages';
  };
  const entries = [];
  const templates = new Map();
  const template = (id, section) => {
    if (!templates.has(id)) {
      const entry = {
        kind: 'page',
        template: id,
        path: `/${id}`,
        title: `${section || 'Item'} item`,
        group: groupOf(id),
        items: [],
      };
      templates.set(id, entry);
      entries.push(entry);
    }
    return templates.get(id);
  };
  for (const r of routes) {
    if (r.template)
      template(r.id, r.section).items.push({ path: r.path, title: r.album?.name || r.slug });
    else
      entries.push({
        kind: 'page',
        path: r.path,
        title: r.title.split('|')[0].trim(),
        group: groupOf(r.id),
      });
  }
  // a template whose source has no items yet has no pages, but is still a page to pick
  for (const id of ids)
    if (id.endsWith(TEMPLATE)) template(id, store.current[pageFile(id)]?.section);
  return entries;
}

/** The page menu: every page of the site (404 included: it has its own file), then Menu and Footer. */
function updatePages() {
  const path = bridge.path() || new URLSearchParams(location.search).get('path') || '/';
  const routes = getRoutes(contentFromFiles(store.current));
  ui.pages = [
    ...pageEntries(routes),
    { kind: 'component', id: 'menu', title: 'Menu' },
    { kind: 'component', id: 'footer', title: 'Footer' },
  ];
  // Menu / Footer stay picked; otherwise follow the page shown in the preview.
  // (a template page: the template's entry)
  const shows = (i) => i.path === path || i.items?.some((it) => it.path === path);
  if (ui.target?.kind !== 'component')
    ui.target = ui.pages.find((i) => i.kind === 'page' && shows(i)) || ui.pages[0];
}

/**
 * The page menu picked a page (navigate the preview), a template (one of its item pages:
 * `path`, else the one shown, else the first) or a component (Menu, Footer).
 */
function pickTarget(item, path) {
  ui.target = item;
  if (item.kind !== 'page') return;
  const items = item.items;
  const to = !items
    ? item.path
    : path || (items.some((i) => i.path === ui.path) ? ui.path : items[0]?.path);
  if (to) bridge.navigate(to);
  else toast(`${item.path} has no pages: its source has no items`, { kind: 'error' });
}

/**
 * The Pages window: add, rename or delete pages on disk (source.pagesOp), then take the new
 * and removed files into the store, update the page menu and show the page. Moving or
 * deleting a page with unsaved edits needs a Save or Discard first. Resolves to the server's
 * answer ({ id, created, removed }), or null when nothing happened.
 */
async function pagesOp(body) {
  const touched = body.id
    ? Object.keys(store.current).filter(
        (f) => f === pageFile(body.id) || f.startsWith(`pages/${body.id}/`),
      )
    : [];
  const dirty = store.dirtyFiles().filter((f) => touched.includes(f));
  if (dirty.length && ['rename', 'delete'].includes(body.op)) {
    toast('Save or discard the unsaved changes first', { kind: 'error', files: dirty });
    return null;
  }
  let res;
  try {
    res = await source.pagesOp(body);
    const { files } = await source.load();
    store.files(Object.fromEntries(res.created.map((f) => [f, files[f]])), res.removed);
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return null;
  }
  refreshStatus();
  // Show the new page, follow a renamed one, leave a deleted one.
  const shown = ui.path;
  const oldPath = body.id && pathOfId(body.id);
  const routes = getRoutes(contentFromFiles(store.current));
  let to = null;
  if (body.op === 'add') to = pathOfId(res.id);
  else if (body.op === 'template') to = routes.find((r) => r.id === res.id)?.path;
  else if (body.op === 'rename' && shown.startsWith(oldPath))
    to = pathOfId(res.id) + shown.slice(oldPath.length);
  else if (body.op === 'delete' && shown.startsWith(oldPath))
    to = pathOfId(res.id).replace(/[^/]+\/$/, '');
  if (to) bridge.navigate(to);
  return res;
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
  ui.path = path;
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
// After the handlers above: the selection and scroll from before a refresh.
bridge.on('navigate', restorePlace);

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
  ui.saving = true;
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    // Re-render the preview from the saved files (new list items, site settings, a grid's new
    // source...). Only the preview reloads, at the same scroll and selection; the editor stays.
    if (bridge.path()) bridge.reload();
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

// ---------------------------------------------------------------- changes on disk
/**
 * The dev server reports content/, media and template changes as "site:changed"
 * (scripts/vite-plugin-static-site.mjs) instead of reloading the editor. Our own saves
 * already reloaded the preview. Anything else (the IDE, a git checkout, new media):
 * content files on disk become the base with unsaved edits kept on top (store.rebase),
 * then the preview reloads. A burst of changes is handled once.
 */
let diskTimer = 0;
let diskContent = false;
function onDiskChange({ content, external }) {
  if (!external) return;
  diskContent ||= content;
  clearTimeout(diskTimer);
  diskTimer = setTimeout(async () => {
    const reloadStore = diskContent;
    diskContent = false;
    if (reloadStore) {
      try {
        const moved = store.rebase((await source.load()).files);
        if (moved.length)
          toast('Changed on disk', { files: moved, note: 'unsaved edits kept on top' });
        refreshStatus();
      } catch (err) {
        toast(`Could not reload content: ${err.message}`, { kind: 'error' });
      }
    }
    if (bridge.path()) bridge.reload();
  }, 200);
}
import.meta.hot?.on('site:changed', onDiskChange);

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
