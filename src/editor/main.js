/**
 * Visual editor (/edit/): the real site in an iframe + a side panel.
 *
 *   Browse  - use the site normally; overview of unsaved changes
 *   Content - click text in the preview to edit it (animations paused)
 *   Motion  - click an animated element to edit its preset / timing / trigger
 *
 * Edits only touch in-memory copies of content/*.json (see store.js).
 *   Save    - writes the changed files to content/ on disk (a draft: the preview and
 *             Browse show it, nothing leaves this machine)
 *   Publish - commits every saved content change in one commit and pushes it
 * Both go through the dev server (scripts/editor-server.mjs). The editor only exists
 * under `npm run dev`.
 *
 * The shell (layout, tabs, toolbar, footer) and the Content tab are Svelte: svelte/App.svelte
 * shows `ui` (svelte/ui.svelte.js); this file holds the logic and changes `ui`. Browse
 * (below) and Motion (ui/panel-motion.js) are not Svelte yet: they render into the panel
 * body element of App.svelte.
 */
import './styles/editor.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import { mount, unmount, flushSync } from 'svelte';
import App from './svelte/App.svelte';
import { ui } from './svelte/ui.svelte.js';
import { createLive } from './svelte/live.svelte.js';
import { createStore } from './store.js';
import * as source from './source.js';
import { createBridge } from './bridge.js';
import { labelFor } from './svelte/content-groups.js';
import { createMotionPanel } from './ui/panel-motion.js';
import { h, clear } from './ui/dom.js';
import { compile } from './lib/pointer.js';
import { MOD, plural } from './lib/format.js';
import { getRoutes } from '../site/routes.js';
import { ANIMATIONS, HOME, contentFromFiles } from '../site/files.js';
import { syncHomeSections } from './sections.js';

const store = createStore();
const live = createLive(store);
const bridge = createBridge({ store, labelFor: (p) => labelFor(store, p) });

// ---------------------------------------------------------------- layout
const root = document.getElementById('editor');
root.textContent = '';
const app = mount(App, {
  target: root,
  props: { live, bridge, actions: { setMode, pickTarget, save, publish: publishDialog } },
});
flushSync(); // render now: the panels below need the body
const body = app.panelBody();
const toasts = h('div', { class: 'ed-toasts' });
document.body.append(toasts);

// ---------------------------------------------------------------- helpers
function toast(content, { kind = 'info', timeout = 5000 } = {}) {
  const el = h(
    'div',
    { class: ['toast', `toast--${kind}`] },
    content,
    h(
      'button',
      { type: 'button', class: 'toast__x', 'aria-label': 'Dismiss', onclick: () => el.remove() },
      '×',
    ),
  );
  toasts.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

/** The page menu: every page of the site, then the Menu and Footer components. */
function updatePages() {
  const path = bridge.path() || new URLSearchParams(location.search).get('path') || '/';
  const routes = getRoutes(contentFromFiles(store.current)).filter((r) => r.page !== 'notFound');
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
  renderBody(true);
}

/** Saved-but-unpublished content changes, from the last /__editor/status. */
const pubFiles = () => ui.pub?.files || [];

async function refreshPublishStatus() {
  try {
    ui.pub = await source.status();
  } catch (err) {
    ui.pub = { error: err.message, files: [], ahead: 0 };
  }
  if (ui.mode === 'browse') renderOverview();
}

// ---------------------------------------------------------------- panels
const motionPanel = createMotionPanel({ store, bridge, root: body, toast });
function renderOverview() {
  const dirty = store.dirtyFiles();
  clear(
    body,
    h(
      'section',
      { class: 'grp' },
      h('h4', { class: 'grp__title' }, 'How it works'),
      h(
        'ul',
        { class: 'help' },
        h('li', {}, h('b', {}, 'Content'), ' — click any outlined text in the preview and type.'),
        h(
          'li',
          {},
          h('b', {}, 'Motion'),
          ' — click an animated element to change its preset, timing, ease and scroll trigger. Changes replay live.',
        ),
        h(
          'li',
          {},
          'Browse navigates like the real site. In the edit modes, hold Alt to click through links.',
        ),
        h(
          'li',
          {},
          h('b', {}, 'Save'),
          ' writes content/*.json on this machine: a draft you can check in Browse. Nothing is pushed.',
        ),
        h(
          'li',
          {},
          h('b', {}, 'Publish'),
          ' commits all saved content changes in one commit and pushes them to GitHub.',
        ),
      ),
      h(
        'p',
        { class: 'kbd-list' },
        h('span', {}, h('kbd', {}, `${MOD}+E`), ' edit mode'),
        h('span', {}, h('kbd', {}, `${MOD}+S`), ' save'),
        h('span', {}, h('kbd', {}, `${MOD}+Z`), ' undo'),
        h('span', {}, h('kbd', {}, 'Esc'), ' deselect'),
        h('span', {}, h('kbd', {}, `${MOD}+Shift+E`), ' exit to live page'),
      ),
    ),
    h(
      'section',
      { class: 'grp' },
      h('h4', { class: 'grp__title' }, `Unsaved changes${dirty.length ? '' : ': none'}`),
      dirty.map((f) =>
        h(
          'details',
          { class: 'chg', open: true },
          h(
            'summary',
            {},
            h('code', {}, `content/${f}`),
            h('span', { class: 'muted' }, ` · ${store.changes(f).length}`),
          ),
          h(
            'ul',
            {},
            store
              .changes(f)
              .slice(0, 40)
              .map((op) => {
                const ptr = compile(op.path);
                return h(
                  'li',
                  {},
                  h(
                    'span',
                    { class: 'chg__path' },
                    f === ANIMATIONS ? op.path.join(' › ') : labelFor(store, { file: f, ptr }),
                  ),
                  h(
                    'span',
                    { class: 'chg__val' },
                    op.value === undefined ? '(removed)' : JSON.stringify(op.value).slice(0, 80),
                  ),
                );
              }),
          ),
        ),
      ),
      dirty.length
        ? h(
            'button',
            {
              type: 'button',
              class: 'link link--danger',
              onclick: () => confirm('Discard all unsaved changes?') && store.discard(),
            },
            'Discard all changes',
          )
        : null,
    ),
    renderUnpublished(),
    h(
      'section',
      { class: 'grp' },
      h('h4', { class: 'grp__title' }, 'Later'),
      h(
        'p',
        { class: 'hint' },
        'Swapping and reordering album photos will be added here; for now edit content/sources/*.json and media/ by hand.',
      ),
    ),
  );
}

function fileLine(f) {
  return h(
    'li',
    { class: 'pfile' },
    h(
      'span',
      { class: ['pfile__st', `is-${f.status}`] },
      f.status === 'new' ? 'A' : f.status === 'deleted' ? 'D' : 'M',
    ),
    h('code', {}, f.path),
    h('span', { class: 'muted' }, ` · ${plural(f.changes || 1, 'change')}`),
    f.added !== undefined
      ? h(
          'span',
          { class: 'pfile__stat' },
          h('span', { class: 'add' }, `+${f.added}`),
          ' ',
          h('span', { class: 'del' }, `−${f.removed}`),
        )
      : null,
  );
}

function renderUnpublished() {
  const files = pubFiles();
  const ahead = ui.pub?.ahead || 0;
  return h(
    'section',
    { class: 'grp' },
    h(
      'h4',
      { class: 'grp__title' },
      `Saved, not published${files.length || ahead ? '' : ': none'}`,
    ),
    files.length ? h('ul', { class: 'files' }, files.map(fileLine)) : null,
    ahead
      ? h(
          'p',
          { class: 'hint' },
          `${plural(ahead, 'commit')} on ${ui.pub.branch} not pushed yet; Publish pushes ${ahead === 1 ? 'it' : 'them'} too.`,
        )
      : null,
    files.length || ahead
      ? h('button', { type: 'button', class: 'link', onclick: () => publishDialog() }, 'Publish…')
      : null,
  );
}

/** Re-render the panel that is not Svelte yet (Content is Svelte and follows by itself). */
function renderBody(force = true) {
  if (ui.mode === 'motion') motionPanel.refresh(force);
  else if (ui.mode === 'browse') renderOverview();
}

function setMode(mode) {
  ui.mode = mode;
  if (mode !== 'browse') ui.lastEdit = mode;
  bridge.setMode(mode);
  if (mode === 'motion') motionPanel.select(null);
  renderBody();
}

bridge.on('connect', () => {
  bridge.setMode(ui.mode);
  ui.previewVersion++;
  renderBody();
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
  if (ui.mode === 'motion') motionPanel.select(null);
  else renderBody();
});
bridge.on('select', (sel) => {
  if (ui.mode === 'motion') motionPanel.select(sel);
  else ui.selection = sel?.kind === 'text' ? { edit: sel.el.dataset.edit } : null;
});
bridge.on('textFocus', (edit) => (ui.selection = { edit }));
bridge.on('key', (e) => onKey(e));

let animTimer = 0;
store.on(({ files, source: src }) => {
  if (src === 'saved') {
    // The source caught up with us: nothing changes in the preview.
    if (ui.mode === 'browse') renderOverview();
    return;
  }
  const textChanged = files.some((f) => f !== ANIMATIONS);
  const rewired = files.includes(HOME) && syncSections();
  if (textChanged) {
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
  if (ui.mode === 'motion') motionPanel.refresh(src !== 'motion');
  else if (ui.mode === 'browse') renderOverview();
  if (textChanged && src !== 'panel' && !(src && src.nodeType === 1)) updatePages();
});

// ---------------------------------------------------------------- saving
async function save() {
  if (ui.saving || !store.dirtyFiles().length) return;
  return saveDev();
}

async function saveDev({ quiet = false } = {}) {
  const dirty = store.dirtyFiles();
  // Items added to or deleted from a list only show in the preview once it re-renders.
  const listsChanged = dirty.some(
    (f) => Array.isArray(store.base[f]) && store.base[f].length !== store.current[f]?.length,
  );
  ui.saving = true;
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    // A section the preview couldn't show yet (e.g. a grid with a new source): re-render it.
    if ((listsChanged || ui.staleSections.length) && bridge.path()) bridge.load(bridge.path());
    if (!quiet)
      toast(
        h(
          'span',
          {},
          'Saved ',
          dirty.map((f) => h('code', {}, `content/${f}`)).flatMap((c, i) => (i ? [', ', c] : [c])),
          ' (draft, not published)',
        ),
        { kind: 'ok' },
      );
    ui.status = `Saved ${plural(dirty.length, 'file')} · ${new Date().toLocaleTimeString()}`;
    return true;
  } catch (err) {
    toast(`Save failed: ${err.message}`, { kind: 'error', timeout: 0 });
    return false;
  } finally {
    ui.saving = false;
    refreshPublishStatus();
  }
}

function modal(title, ...children) {
  const close = () => wrap.remove();
  const wrap = h(
    'div',
    { class: 'modal', onclick: (e) => e.target === wrap && close() },
    h(
      'div',
      { class: 'modal__box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h3', { class: 'modal__title' }, title),
      ...children,
    ),
  );
  document.body.append(wrap);
  wrap.close = close;
  return wrap;
}
// ---------------------------------------------------------------- publish
const defaultMessage = (names) =>
  names.length
    ? `Content: update ${names.map((n) => n.replace(/^.*\//, '').replace(/\.json$/, '')).join(', ')} (visual editor)`
    : '';

/**
 * Publish dialog: lists what will be committed (saved content files, plus unsaved edits
 * if "save first" is ticked), takes a commit message, then commit + push via the dev server.
 */
async function publishDialog() {
  if (ui.publishing || document.querySelector('.modal')) return;
  await refreshPublishStatus();
  const pub = ui.pub || { files: [], ahead: 0 };
  if (pub.error) return toast(`Can't publish: ${pub.error}`, { kind: 'error', timeout: 0 });
  const dirty = store.dirtyFiles();
  const n = live.changes;

  const saveFirst = h('input', { type: 'checkbox', checked: dirty.length > 0 });
  const msg = h('textarea', { class: 'tf__input', rows: 3, spellcheck: true });
  const list = h('ul', { class: 'files' });
  const result = h('div', { class: 'pub-result', hidden: true });
  const go = h('button', { type: 'button', class: 'btn-primary' }, 'Publish');
  const cancel = h('button', { type: 'button', class: 'link', onclick: () => m.close() }, 'Cancel');
  const msgWrap = h('div', {}, h('label', { class: 'tf__label' }, 'Commit message'), msg);

  const willCommit = () => {
    const names = new Set(pub.files.map((f) => f.name));
    if (saveFirst.checked) dirty.forEach((f) => names.add(f));
    return [...names].sort();
  };
  let touched = false;
  msg.addEventListener('input', () => (touched = true));
  const renderList = () => {
    const unsaved = saveFirst.checked
      ? dirty.filter((f) => !pub.files.some((p) => p.name === f))
      : [];
    clear(
      list,
      pub.files.map((f) => {
        const li = fileLine(f);
        if (saveFirst.checked && dirty.includes(f.name))
          li.append(
            h(
              'span',
              { class: 'muted' },
              ` + ${plural(store.changes(f.name).length, 'unsaved change')}`,
            ),
          );
        return li;
      }),
      unsaved.map((f) =>
        h(
          'li',
          { class: 'pfile' },
          h('span', { class: 'pfile__st is-modified' }, 'M'),
          h('code', {}, `content/${f}`),
          h(
            'span',
            { class: 'muted' },
            ` · ${plural(store.changes(f).length, 'change')} · unsaved, saved first`,
          ),
        ),
      ),
    );
    const names = willCommit();
    list.hidden = !names.length;
    msgWrap.hidden = !names.length;
    if (!touched) msg.value = defaultMessage(names);
    go.disabled = !names.length && !pub.ahead;
    go.textContent = names.length ? 'Publish' : `Push ${plural(pub.ahead, 'commit')}`;
  };
  saveFirst.addEventListener('change', renderList);

  const branch = pub.branch || 'main';
  const m = modal(
    'Publish to GitHub',
    h(
      'p',
      { class: 'hint' },
      'Commits the saved content changes in ',
      h('b', {}, 'one commit'),
      ' and runs ',
      h('code', {}, `git push origin ${branch}`),
      '. Only files in ',
      h('code', {}, 'content/'),
      ' are committed.',
    ),
    dirty.length
      ? h(
          'label',
          { class: 'pub-save' },
          saveFirst,
          h(
            'span',
            {},
            `Save my ${plural(n, 'unsaved edit')} first and include ${n === 1 ? 'it' : 'them'}`,
          ),
        )
      : null,
    list,
    pub.ahead
      ? h(
          'div',
          { class: 'pub-ahead' },
          h(
            'p',
            { class: 'hint' },
            `Also pushes ${plural(pub.ahead, 'earlier commit')} not on ${pub.upstream || `origin/${branch}`} yet:`,
          ),
          h(
            'ul',
            { class: 'commits' },
            (pub.unpushed || []).map((c) => h('li', {}, h('code', {}, c.hash), ' ', c.subject)),
          ),
        )
      : null,
    msgWrap,
    result,
    h('div', { class: 'modal__actions' }, cancel, go),
  );
  renderList();
  if (!msgWrap.hidden) {
    msg.focus();
    msg.select();
  }

  go.onclick = async () => {
    const names = willCommit();
    const message = msg.value.trim();
    if (names.length && !message) return msg.focus();
    go.disabled = true;
    result.hidden = true;
    ui.publishing = true;
    try {
      if (saveFirst.checked && store.dirtyFiles().length) {
        go.textContent = 'Saving…';
        if (!(await saveDev({ quiet: true })))
          throw Object.assign(
            new Error('Saving the unsaved edits failed, nothing was published.'),
            { phase: 'save' },
          );
      }
      go.textContent = 'Publishing…';
      const res = await source.publish(message);
      showPublished(res);
    } catch (err) {
      showPublishError(err);
    } finally {
      ui.publishing = false;
      await refreshPublishStatus();
    }
  };

  function showPublished(res) {
    clear(
      result,
      h(
        'p',
        { class: 'pub-ok' },
        '✓ Published ',
        h(
          'a',
          { href: res.url, target: '_blank', rel: 'noopener' },
          h('code', {}, res.short),
          ' ↗',
        ),
        ` to origin/${res.branch}`,
      ),
      h(
        'p',
        { class: 'hint' },
        h('a', { href: res.url, target: '_blank', rel: 'noopener', class: 'pub-url' }, res.url),
      ),
      res.files?.length
        ? h('p', { class: 'hint' }, `Committed: ${res.files.join(', ')}`)
        : h(
            'p',
            { class: 'hint' },
            'Pushed the earlier commits; there were no new content changes.',
          ),
    );
    result.hidden = false;
    result.dataset.kind = 'ok';
    [list, msgWrap, m.querySelector('.pub-save'), m.querySelector('.pub-ahead')].forEach(
      (el) => el && (el.hidden = true),
    );
    go.hidden = true;
    cancel.textContent = 'Close';
    toast(
      h(
        'span',
        {},
        `Published ${res.short} `,
        h('a', { href: res.url, target: '_blank', rel: 'noopener' }, 'View commit ↗'),
      ),
      { kind: 'ok', timeout: 0 },
    );
    ui.status = `Published ${res.short} · ${new Date().toLocaleTimeString()}`;
  }

  function showPublishError(err) {
    clear(
      result,
      h(
        'p',
        { class: 'error' },
        err.committed ? `Committed locally as ${err.short}, but the push failed.` : err.message,
      ),
      err.committed
        ? h(
            'p',
            { class: 'hint' },
            `${err.error}. The commit stays on your machine; Publish again to retry the push.`,
          )
        : null,
      err.hint ? h('p', { class: 'pub-hint' }, err.hint) : null,
      err.output ? h('pre', { class: 'pub-out' }, err.output) : null,
    );
    result.hidden = false;
    result.dataset.kind = 'error';
    if (err.committed) {
      list.hidden = true;
      msgWrap.hidden = true;
      saveFirst.checked = false;
      m.querySelector('.pub-save')?.setAttribute('hidden', '');
      go.textContent = 'Retry push';
      touched = false;
      pub.files = [];
      pub.ahead = Math.max(1, pub.ahead || 0);
    } else go.textContent = 'Try again';
    go.disabled = false;
    ui.status = err.committed ? `Commit ${err.short} not pushed` : 'Publish failed';
  }
}

// ---------------------------------------------------------------- keyboard
function onKey(e) {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  const inField =
    e.target instanceof Element &&
    e.target.matches?.('input, textarea, select') &&
    e.target.ownerDocument === document;
  if (mod && k === 's') {
    e.preventDefault();
    save();
  } else if (mod && k === 'e' && e.shiftKey) {
    e.preventDefault();
    location.href = bridge.path() || '/';
  } else if (mod && k === 'e') {
    e.preventDefault();
    setMode(ui.mode === 'browse' ? ui.lastEdit : 'browse');
  } else if (mod && (k === 'z' || k === 'y') && !inField) {
    e.preventDefault();
    if (k === 'y' || e.shiftKey) store.redo();
    else store.undo();
  } else if (e.key === 'Escape') {
    const open = document.querySelector('.modal, dialog[open]');
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
  ui.status = 'Loading content…';
  let loaded;
  try {
    loaded = await source.load();
  } catch (err) {
    unmount(app);
    root.append(h('p', { class: 'ed-boot' }, `Could not load content: ${err.message}`));
    return;
  }
  store.load(loaded.files);
  ui.status = `Content: ${loaded.from}`;
  updatePages();
  renderBody();
  refreshPublishStatus();
  window.addEventListener('focus', () => !ui.publishing && refreshPublishStatus());
  bridge.load(new URLSearchParams(location.search).get('path') || '/');
}

boot();
