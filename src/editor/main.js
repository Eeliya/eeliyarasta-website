/**
 * Visual editor (/edit/): the real site in an iframe + a glass side panel.
 *
 *   Browse  - use the site normally; overview of unsaved changes
 *   Text    - click text in the preview to edit it (animations paused)
 *   Motion  - click an animated element to edit its preset / timing / trigger
 *
 * Edits only touch in-memory copies of content/*.json (see store.js). Saving writes
 * them to disk through the dev server. The editor only exists under `npm run dev`.
 */
import './styles/editor.scss';
import config from './config.js';
import { createStore } from './store.js';
import * as source from './source.js';
import { createBridge } from './bridge.js';
import { createTextPanel, labelFor } from './ui/panel-text.js';
import { createMotionPanel } from './ui/panel-motion.js';
import { h, clear } from './ui/dom.js';
import { compile } from './lib/pointer.js';
import { getRoutes } from '../site/routes.js';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const store = createStore();
const state = { mode: 'browse', lastEdit: 'text', loaded: null, viewport: 'desktop', saving: false };

// ---------------------------------------------------------------- layout
const app = document.getElementById('editor');
const iframe = h('iframe', { class: 'ed-frame', title: 'Site preview' });
const frameWrap = h('div', { class: 'ed-frame-wrap' }, iframe);
const stage = h('main', { class: 'ed-stage' }, frameWrap);
const body = h('div', { class: 'ed-body' });
const modeBtns = {};
const modes = h('nav', { class: 'seg ed-modes', 'aria-label': 'Mode' },
  [['browse', 'Browse'], ['text', 'Text'], ['motion', 'Motion']].map(([m, label]) =>
    (modeBtns[m] = h('button', { type: 'button', class: 'seg__btn', dataset: { mode: m }, onclick: () => setMode(m) }, label))),
);
const pageSelect = h('select', { class: 'ed-page', 'aria-label': 'Page', onchange: () => bridge.navigate(pageSelect.value) });
const vpBtn = h('button', { type: 'button', class: 'icon-btn', title: 'Toggle mobile viewport', onclick: () => toggleViewport() }, '▭');
const undoBtn = h('button', { type: 'button', class: 'icon-btn', title: `Undo (${MOD}+Z)`, onclick: () => store.undo() }, '↶');
const redoBtn = h('button', { type: 'button', class: 'icon-btn', title: `Redo (${MOD}+Shift+Z)`, onclick: () => store.redo() }, '↷');
const sourceLine = h('span', { class: 'ed-source' });
const status = h('div', { class: 'ed-status', role: 'status', 'aria-live': 'polite' });
const account = h('div', { class: 'ed-account' });
const saveBtn = h('button', { type: 'button', class: 'btn-primary ed-save', onclick: () => save() }, 'Save');
const panel = h('aside', { class: 'ed-panel' },
  h('header', { class: 'ed-head' },
    h('div', { class: 'ed-brand' }, h('span', { class: 'ed-logo' }, 'Editor'), sourceLine),
    modes,
    h('div', { class: 'ed-bar' }, pageSelect, vpBtn, undoBtn, redoBtn),
  ),
  body,
  h('footer', { class: 'ed-foot' }, status, h('div', { class: 'ed-foot__row' }, account, saveBtn)),
);
const toasts = h('div', { class: 'ed-toasts' });
clear(app, stage, panel, toasts);

// ---------------------------------------------------------------- helpers
function toast(content, { kind = 'info', timeout = 5000 } = {}) {
  const el = h('div', { class: ['toast', `toast--${kind}`] }, content, h('button', { type: 'button', class: 'toast__x', 'aria-label': 'Dismiss', onclick: () => el.remove() }, '×'));
  toasts.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}
const setStatus = (text) => (status.textContent = text);

function contentForRoutes() {
  const c = store.current;
  return { site: c['site.json'], home: c['home.json'], people: c['people.json'], places: c['places.json'], projects: c['projects.json'] };
}

function renderPages() {
  const path = bridge.path() || new URLSearchParams(location.search).get('path') || '/';
  const routes = getRoutes(contentForRoutes()).filter((r) => r.page !== 'notFound');
  clear(pageSelect, routes.map((r) => h('option', { value: r.path, selected: r.path === path }, `${r.path}  ${r.title.split('|')[0].trim()}`)));
}

function countChanges() {
  return store.dirtyFiles().reduce((n, f) => n + store.changes(f).length, 0);
}

function renderChrome() {
  for (const [m, b] of Object.entries(modeBtns)) b.classList.toggle('is-active', m === state.mode);
  undoBtn.disabled = !store.canUndo();
  redoBtn.disabled = !store.canRedo();
  const n = countChanges();
  saveBtn.disabled = !n || state.saving;
  saveBtn.textContent = state.saving ? 'Saving…' : `Save${n ? ` · ${n}` : ''}`;
  saveBtn.title = `Write content/*.json (${MOD}+S)`;
  sourceLine.textContent = 'dev · local files';
  sourceLine.dataset.kind = 'dev';
  clear(account, h('span', { class: 'muted' }, 'Saves write to ', h('code', {}, 'content/')));
  document.title = `${n ? '● ' : ''}Editor · Eeliya Rasta`;
}

// ---------------------------------------------------------------- bridge + panels
const bridge = createBridge({ iframe, store, labelFor: (p) => labelFor(store, p) });
const textPanel = createTextPanel({ store, bridge, root: body });
const motionPanel = createMotionPanel({ store, bridge, root: body, toast });

function renderOverview() {
  const dirty = store.dirtyFiles();
  clear(body,
    h('section', { class: 'grp' },
      h('h4', { class: 'grp__title' }, 'How it works'),
      h('ul', { class: 'help' },
        h('li', {}, h('b', {}, 'Text'), ' — click any outlined text in the preview and type.'),
        h('li', {}, h('b', {}, 'Motion'), ' — click an animated element to change its preset, timing, ease and scroll trigger. Changes replay live.'),
        h('li', {}, 'Browse navigates like the real site. In the edit modes, hold Alt to click through links.'),
        h('li', {}, 'Saving writes content/*.json on this machine (commit with git as usual).'),
      ),
      h('p', { class: 'kbd-list' },
        h('span', {}, h('kbd', {}, `${MOD}+E`), ' edit mode'),
        h('span', {}, h('kbd', {}, `${MOD}+S`), ' save'),
        h('span', {}, h('kbd', {}, `${MOD}+Z`), ' undo'),
        h('span', {}, h('kbd', {}, 'Esc'), ' deselect'),
        h('span', {}, h('kbd', {}, `${MOD}+Shift+E`), ' exit to live page'),
      ),
    ),
    h('section', { class: 'grp' },
      h('h4', { class: 'grp__title' }, `Unsaved changes${dirty.length ? '' : ': none'}`),
      dirty.map((f) => h('details', { class: 'chg', open: true },
        h('summary', {}, h('code', {}, `content/${f}`), h('span', { class: 'muted' }, ` · ${store.changes(f).length}`)),
        h('ul', {}, store.changes(f).slice(0, 40).map((op) => {
          const ptr = compile(op.path);
          return h('li', {}, h('span', { class: 'chg__path' }, f === 'animations.json' ? op.path.join(' › ') : labelFor(store, { file: f, ptr })),
            h('span', { class: 'chg__val' }, op.value === undefined ? '(removed)' : JSON.stringify(op.value).slice(0, 80)));
        })),
      )),
      dirty.length ? h('button', { type: 'button', class: 'link link--danger', onclick: () => confirm('Discard all unsaved changes?') && store.discard() }, 'Discard all changes') : null,
    ),
    h('section', { class: 'grp' },
      h('h4', { class: 'grp__title' }, 'Later'),
      h('p', { class: 'hint' }, 'Swapping and reordering album photos will be added here; for now edit people.json / places.json and media/ by hand.'),
    ),
  );
}

function renderBody(force = true) {
  if (state.mode === 'text') textPanel.render();
  else if (state.mode === 'motion') motionPanel.refresh(force);
  else renderOverview();
}

function setMode(mode) {
  state.mode = mode;
  if (mode !== 'browse') state.lastEdit = mode;
  bridge.setMode(mode);
  if (mode === 'motion') motionPanel.select(null);
  renderBody();
  renderChrome();
}

function toggleViewport() {
  state.viewport = state.viewport === 'desktop' ? 'mobile' : 'desktop';
  stage.classList.toggle('is-mobile', state.viewport === 'mobile');
  vpBtn.textContent = state.viewport === 'mobile' ? '▯' : '▭';
}

bridge.on('connect', () => {
  bridge.setMode(state.mode);
  renderBody();
});
bridge.on('navigate', (path) => {
  const url = new URL(location.href);
  url.searchParams.set('path', path);
  history.replaceState(null, '', url);
  renderPages();
  if (state.mode === 'motion') motionPanel.select(null);
  else renderBody();
});
bridge.on('select', (sel) => {
  if (state.mode === 'motion') motionPanel.select(sel);
  else if (sel?.kind === 'text') textPanel.focusField(sel.el.dataset.edit);
});
bridge.on('textFocus', (edit) => textPanel.focusField(edit));
bridge.on('key', (e) => onKey(e));

let animTimer = 0;
store.on(({ files, source: src }) => {
  if (src === 'saved') {
    // The source caught up with us: nothing changes in the preview.
    if (state.mode === 'browse') renderOverview();
    else if (state.mode === 'text') textPanel.update();
    return renderChrome();
  }
  const textChanged = files.some((f) => f !== 'animations.json');
  if (textChanged) {
    const fromPreview = src && src.nodeType === 1;
    bridge.applyTexts({ skip: fromPreview ? src : null, force: ['undo', 'redo', 'rebase', 'discard'].includes(src) });
  }
  if (files.includes('animations.json')) {
    clearTimeout(animTimer);
    animTimer = setTimeout(() => bridge.updateAnimations(store.current['animations.json']), 180);
  }
  if (state.mode === 'text') src === 'panel' || (src && src.nodeType === 1) ? textPanel.update() : textPanel.render();
  else if (state.mode === 'motion') motionPanel.refresh(src !== 'motion');
  else renderOverview();
  if (textChanged && src !== 'panel' && !(src && src.nodeType === 1)) renderPages();
  renderChrome();
});

// ---------------------------------------------------------------- saving
async function save() {
  if (state.saving || !store.dirtyFiles().length) return;
  return saveDev();
}

async function saveDev() {
  const dirty = store.dirtyFiles();
  state.saving = true;
  renderChrome();
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    toast(h('span', {}, 'Saved ', dirty.map((f) => h('code', {}, `content/${f}`)).flatMap((c, i) => (i ? [', ', c] : [c]))), { kind: 'ok' });
    setStatus(`Saved ${dirty.length} file${dirty.length > 1 ? 's' : ''} · ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    toast(`Save failed: ${err.message}`, { kind: 'error', timeout: 0 });
  } finally {
    state.saving = false;
    renderChrome();
  }
}

function modal(title, ...children) {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal', onclick: (e) => e.target === wrap && close() },
    h('div', { class: 'modal__box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h3', { class: 'modal__title' }, title), ...children));
  document.body.append(wrap);
  wrap.close = close;
  return wrap;
}

// ---------------------------------------------------------------- keyboard
function onKey(e) {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  const inField = e.target instanceof Element && e.target.matches?.('input, textarea, select') && e.target.ownerDocument === document;
  if (mod && k === 's') {
    e.preventDefault();
    save();
  } else if (mod && k === 'e' && e.shiftKey) {
    e.preventDefault();
    location.href = bridge.path() || '/';
  } else if (mod && k === 'e') {
    e.preventDefault();
    setMode(state.mode === 'browse' ? state.lastEdit : 'browse');
  } else if (mod && (k === 'z' || k === 'y') && !inField) {
    e.preventDefault();
    if (k === 'y' || e.shiftKey) store.redo();
    else store.undo();
  } else if (e.key === 'Escape') {
    const open = document.querySelector('.modal');
    if (open) open.close();
    else if (bridge.selected) bridge.select(null);
  }
}
window.addEventListener('keydown', onKey);
window.addEventListener('beforeunload', (e) => {
  if (store.dirtyFiles().length) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------- boot
async function boot() {
  setStatus('Loading content…');
  try {
    state.loaded = await source.load();
  } catch (err) {
    clear(app, h('p', { class: 'ed-boot' }, `Could not load content: ${err.message}`));
    return;
  }
  store.load(state.loaded.files);
  setStatus(`Content: ${state.loaded.from}`);
  renderPages();
  renderChrome();
  renderBody();
  bridge.load(new URLSearchParams(location.search).get('path') || '/');
}

boot();
