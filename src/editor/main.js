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
import {
  ANIMATIONS,
  REDIRECTS,
  TEMPLATE,
  contentFromFiles,
  pageFile,
  pageIdOf,
  sourceIdOf,
} from '../site/files.js';
import {
  itemMoves,
  moveLinks,
  moveRedirects,
  pruneRedirects,
  redirectsOf,
  sitePaths,
} from '../site/redirects.js';
import { compile } from './lib/pointer.js';
import { markRendered, previewFile, swapSections, syncLayout } from './layout-sync.js';
import { placeBlock } from './layout-ops.js';
import { createOverlay } from './overlay.js';
import { restoreUi, restorePlace } from './svelte/persist.js';

const store = createStore();
const live = createLive(store);
connectMedia(live); // photo URLs read site.json's mediaUrl from it
const bridge = createBridge({ store, labelFor: (p) => labelFor(store, p) });
// the preview's layout overlay (Arrange, Grid; overlay.js): blockAt and placeBlock below
const overlay = createOverlay({
  ui,
  onpick(id) {
    ui.block = id;
    ui.blockTab = 'layout';
  },
  onplace(id, pos) {
    const b = blockAt(id);
    if (b) placeBlock(store, b.file, b.at, b.j, pos);
  },
  blockOf(id) {
    const b = blockAt(id);
    return b && store.current[b.file].sections[b.at].blocks[b.j];
  },
});

restoreUi(bridge, live); // the tab, sections, ...: from the URL and sessionStorage (svelte/persist.js)

const root = document.getElementById('editor');
root.textContent = '';
mount(App, {
  target: root,
  props: {
    live,
    bridge,
    actions: { setMode, pickTarget, save, refreshStatus, pagesOp, arrange, showGrid, editMotion },
  },
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
    if (r.template) template(r.id, r.section).items.push({ path: r.path, title: r.name });
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
    { kind: 'component', id: 'menu', title: 'Menu', path: '---' },
    { kind: 'component', id: 'footer', title: 'Footer', path: '---' },
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
    // links and redirects.json the op kept up to date: unsaved edits there stay on top
    const dirty = store.dirtyFiles();
    const changed = (res.changed || []).filter((f) => !res.created.includes(f));
    store.files(
      Object.fromEntries(changed.filter((f) => !dirty.includes(f)).map((f) => [f, files[f]])),
    );
    store.rebase(
      Object.fromEntries(changed.filter((f) => dirty.includes(f)).map((f) => [f, files[f]])),
    );
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return null;
  }
  refreshStatus();
  movedToast(res);
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

/**
 * What a page op or Save did to links and redirects (src/site/redirects.js): links updated,
 * redirects added, links left pointing at a deleted page, redirects removed because their
 * path is a page (again).
 */
function movedToast({ links = 0, added = [], broken = 0, pruned = [] }) {
  const done = [
    links && `${plural(links, 'link')} updated`,
    added.length && `${plural(added.length, 'redirect')} added (Settings > Redirects)`,
  ].filter(Boolean);
  if (done.length) toast(done.join(', '), { kind: 'ok', files: added.length ? [REDIRECTS] : [] });
  if (broken)
    toast(`${plural(broken, 'link')} still point at the deleted page`, {
      kind: 'info',
      timeout: 10000,
    });
  if (pruned.length)
    toast(
      `Removed ${plural(pruned.length, 'redirect')} from a page that exists: ${pruned.map((r) => r.from).join(', ')}`,
      { kind: 'info', timeout: 10000, files: [REDIRECTS] },
    );
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

/** The preview's mode: Settings has nothing to pick, Arrange drags blocks: both browse. */
const previewMode = () => (ui.mode === 'settings' || ui.arrange ? 'browse' : ui.mode);

function setMode(mode) {
  ui.mode = mode;
  if (mode === 'text' || mode === 'motion') ui.lastEdit = mode;
  if (mode !== 'text') ui.arrange = false;
  bridge.setMode(previewMode());
  overlay.refresh();
  if (mode === 'motion') ui.anim = null;
}

// ---------------------------------------------------------------- layout overlay
/** Where block `id` is in the preview's page file: { file, at, j }, or null. */
function blockAt(id) {
  const file = previewFile(bridge.doc);
  const list = store.current[file]?.sections || [];
  for (const [at, s] of list.entries()) {
    const j = (s.blocks || []).findIndex((b) => b.id === id);
    if (j >= 0) return { file, at, j };
  }
  return null;
}


/** Content tab: drag and resize blocks in the preview (the page's own clicks are off). */
function arrange(on) {
  ui.arrange = on;
  bridge.setMode(previewMode());
  overlay.refresh();
}

/** Content tab: show the sections' columns and rows in the preview. */
function showGrid(on) {
  ui.grid = on;
  overlay.refresh();
}

/** Open an animated element of the preview in the Motion tab. */
function editMotion(el) {
  setMode('motion');
  ui.anim = pickAnim({ kind: 'anim', el });
  bridge.select(el, 'anim');
}

// ---------------------------------------------------------------- preview events
bridge.on('connect', () => {
  bridge.setMode(previewMode());
  overlay.attach(bridge.doc.defaultView);
  pushCurtains();
  ui.previewVersion++;
});

/**
 * Keep the preview's sections in step with the page file after an edit: their order and
 * layout at once, and the sections a structure edit changed rendered again by the dev server
 * and swapped in (src/editor/layout-sync.js). One render at a time, in order.
 */
let rendering = Promise.resolve();
function syncSections({ structure = false } = {}) {
  const stale = syncLayout(bridge.doc, store, { structure });
  bridge.api?.ScrollTrigger?.refresh();
  if (!stale.length) return;
  rendering = rendering.then(async () => {
    const file = previewFile(bridge.doc);
    const path = bridge.path();
    try {
      const { html } = await source.render({ path, file, data: store.current[file], ids: stale });
      if (previewFile(bridge.doc) !== file || bridge.path() !== path) return;
      swapSections(bridge.doc, store, html);
      bridge.api?.remountView();
    } catch (err) {
      toast(`Preview: ${err.message}`, { kind: 'error' });
    }
  });
}

bridge.on('navigate', (path) => {
  ui.path = path;
  markRendered(bridge.doc, store);
  syncSections();
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
// The preview renders the unsaved edits: the dev server gets them after every change
// (POST /__editor/draft; {} once saved), so pages the preview loads show them. A structure
// change (a list item added or removed, a menu item moved) renders the preview again right
// away, at the same scroll and selection; one of the page's own sections only swaps the
// sections it touched (syncSections).
let draftTimer = 0;
let refreshPending = false;
function pushDraft({ refresh = false } = {}) {
  refreshPending ||= refresh;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(async () => {
    const reload = refreshPending;
    refreshPending = false;
    try {
      await source.draft(Object.fromEntries(store.dirtyFiles().map((f) => [f, store.current[f]])));
    } catch (err) {
      toast(`Preview: ${err.message}`, { kind: 'error' });
    }
    if (reload && bridge.path()) bridge.reload();
  }, 250);
}

let animTimer = 0;
store.on(({ files, source: src, structure }) => {
  const page = previewFile(bridge.doc);
  if (files.some((f) => f !== ANIMATIONS))
    pushDraft({ refresh: structure && files.some((f) => f !== page) });
  // After a save the files on disk caught up with us: nothing changes in the preview.
  if (src === 'saved') return;
  const textChanged = files.some((f) => f !== ANIMATIONS);
  if (files.includes(page)) syncSections({ structure });
  if (textChanged) {
    pushCurtains();
    const fromPreview = src && src.nodeType === 1;
    bridge.applyTexts({
      skip: fromPreview ? src : null,
      force: ['undo', 'redo', 'rebase', 'discard'].includes(src),
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
/**
 * Before a Save: item pages whose path changed (a slug or name edited in a source) get a
 * redirect from the old path, and links to it follow. One undo step. Returns what changed.
 */
function followItems() {
  if (!store.dirtyFiles().some(sourceIdOf) || !store.current[REDIRECTS]) return null;
  const moves = itemMoves(store.base, store.current);
  if (!moves.size) return null;
  const { edits } = moveLinks(store.current, moves);
  const moved = moveRedirects(redirectsOf(store.current), moves);
  const { list, pruned } = pruneRedirects(moved.list, sitePaths(store.current));
  store.batch(
    () => {
      for (const e of edits) store.set(e.file, compile(e.parts), e.value);
      store.set(REDIRECTS, '', list);
    },
    { source: 'panel' },
  );
  return { links: edits.length, added: moved.added, pruned, moves };
}

async function save({ quiet = false } = {}) {
  const followed = ui.saving ? null : followItems();
  const dirty = store.dirtyFiles();
  if (!dirty.length) return true;
  if (ui.saving) return false;
  ui.saving = true;
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    // Re-render the preview from the saved files (new list items, site settings, a grid's new
    // source...). Only the preview reloads, at the same scroll and selection; the editor stays.
    // the preview's item page moved (its slug changed): show it at its new path
    const moved = followed?.moves.get(ui.path);
    if (moved) bridge.navigate(moved);
    else if (bridge.path()) bridge.reload();
    if (!quiet) toast('Saved', { kind: 'ok', files: dirty, note: '(draft, not published)' });
    if (followed) movedToast(followed);
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
