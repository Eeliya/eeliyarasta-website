/**
 * Visual editor (/edit/): the real site in an iframe + a glass side panel.
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
 */
import './styles/editor.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import { createStore } from './store.js';
import * as source from './source.js';
import { createBridge } from './bridge.js';
import { createTextPanel, labelFor } from './ui/panel-text.js';
import { createMotionPanel } from './ui/panel-motion.js';
import { createPageMenu } from './ui/page-menu.js';
import { h, clear } from './ui/dom.js';
import { compile } from './lib/pointer.js';
import { getRoutes } from '../site/routes.js';
import { ANIMATIONS, HOME, contentFromFiles } from '../site/files.js';
import { syncHomeSections } from './sections.js';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const store = createStore();
const faIcon = (name) => h('i', { class: 'fa-solid ' + name, 'aria-hidden': 'true' });
const state = {
  mode: 'browse',
  lastEdit: 'text',
  loaded: null,
  viewport: 'desktop',
  saving: false,
  publishing: false,
  pub: null,
  target: { kind: 'page', path: '/', title: 'Home' },
  /** Home sections the preview can't show until it re-renders (see sections.js). */
  staleSections: new Set(),
};

// ---------------------------------------------------------------- layout
const app = document.getElementById('editor');
const iframe = h('iframe', { class: 'ed-frame', title: 'Site preview' });
const frameWrap = h('div', { class: 'ed-frame-wrap' }, iframe);
const stage = h('main', { class: 'ed-stage' }, frameWrap);
const body = h('div', { class: 'ed-body' });
const modeBtns = {};
const modes = h(
  'nav',
  { class: 'seg ed-modes', 'aria-label': 'Mode' },
  [
    ['browse', 'Browse'],
    ['text', 'Content'],
    ['motion', 'Motion'],
  ].map(
    ([m, label]) =>
      (modeBtns[m] = h(
        'button',
        { type: 'button', class: 'seg__btn', dataset: { mode: m }, onclick: () => setMode(m) },
        label,
      )),
  ),
);
const pageMenu = createPageMenu({
  onChange: (item) => {
    state.target = item;
    if (item.kind === 'page') bridge.navigate(item.path);
    renderBody(true);
    renderChrome();
  },
});
const vpIcon = faIcon('fa-desktop');
const vpBtn = h(
  'button',
  {
    type: 'button',
    class: 'icon-btn',
    title: 'Toggle mobile viewport',
    onclick: () => toggleViewport(),
  },
  vpIcon,
);
const undoBtn = h(
  'button',
  { type: 'button', class: 'icon-btn', title: `Undo (${MOD}+Z)`, onclick: () => store.undo() },
  faIcon('fa-rotate-left'),
);
const redoBtn = h(
  'button',
  {
    type: 'button',
    class: 'icon-btn',
    title: `Redo (${MOD}+Shift+Z)`,
    onclick: () => store.redo(),
  },
  faIcon('fa-rotate-right'),
);
const sourceLine = h('span', { class: 'ed-source' });
const status = h('div', { class: 'ed-status', role: 'status', 'aria-live': 'polite' });
const pending = h('div', { class: 'ed-pending' });
const saveBtn = h(
  'button',
  { type: 'button', class: 'btn-ghost ed-save', onclick: () => save() },
  'Save',
);
const publishBtn = h(
  'button',
  { type: 'button', class: 'btn-primary ed-publish', onclick: () => publishDialog() },
  'Publish',
);
const panel = h(
  'aside',
  { class: 'ed-panel' },
  h(
    'header',
    { class: 'ed-head' },
    h('div', { class: 'ed-brand' }, h('span', { class: 'ed-logo' }, 'Editor'), sourceLine),
    modes,
    h('div', { class: 'ed-bar' }, pageMenu.el, vpBtn, undoBtn, redoBtn),
  ),
  body,
  h(
    'footer',
    { class: 'ed-foot' },
    pending,
    status,
    h('div', { class: 'ed-foot__row' }, saveBtn, publishBtn),
  ),
);
const toasts = h('div', { class: 'ed-toasts' });
clear(app, stage, panel, toasts);

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
const setStatus = (text) => (status.textContent = text);

const contentForRoutes = () => contentFromFiles(store.current);

function renderPages() {
  const path = bridge.path() || new URLSearchParams(location.search).get('path') || '/';
  const routes = getRoutes(contentForRoutes()).filter((r) => r.page !== 'notFound');
  const items = [
    ...routes.map((r) => ({
      kind: 'page',
      path: r.path,
      title: r.title.split('|')[0].trim(),
    })),
    { kind: 'component', id: 'menu', title: 'Menu' },
    { kind: 'component', id: 'footer', title: 'Footer' },
  ];
  const selectedPath = state.target?.kind === 'page' ? state.target.path : path;
  pageMenu.setItems(items, { path: state.target?.kind === 'component' ? null : selectedPath });
  if (state.target?.kind === 'component') {
    pageMenu.setValue(state.target, { silent: true });
  } else {
    state.target = items.find((i) => i.kind === 'page' && i.path === path) || items[0];
  }
}

function countChanges() {
  return store.dirtyFiles().reduce((n, f) => n + store.changes(f).length, 0);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Saved-but-unpublished content changes, from the last /__editor/status. */
const pubFiles = () => state.pub?.files || [];
const pubChanges = () => pubFiles().reduce((n, f) => n + (f.changes || 1), 0);

function renderChrome() {
  for (const [m, b] of Object.entries(modeBtns)) b.classList.toggle('is-active', m === state.mode);
  undoBtn.disabled = !store.canUndo();
  redoBtn.disabled = !store.canRedo();
  const n = countChanges();
  saveBtn.disabled = !n || state.saving || state.publishing;
  saveBtn.textContent = state.saving ? 'Saving…' : `Save${n ? ` · ${n}` : ''}`;
  saveBtn.title = `Write the changes to content/*.json as a draft (${MOD}+S)`;
  const files = pubFiles();
  const ahead = state.pub?.ahead || 0;
  publishBtn.disabled = state.publishing || (!files.length && !ahead && !n);
  publishBtn.textContent = state.publishing
    ? 'Publishing…'
    : `Publish${files.length ? ` · ${pubChanges()}` : ''}`;
  publishBtn.title = `Commit all saved content changes in one commit and push to ${state.pub?.branch ? `origin/${state.pub.branch}` : 'GitHub'}`;
  sourceLine.textContent = 'dev · local files';
  sourceLine.dataset.kind = 'dev';
  renderPending();
  document.title = `${n ? '● ' : ''}Editor · Eeliya Rasta`;
}

/** Footer line: what Publish would send. */
function renderPending() {
  const pub = state.pub;
  const files = pubFiles();
  const ahead = pub?.ahead || 0;
  pending.dataset.kind = files.length || ahead ? 'pending' : 'clean';
  if (!pub)
    return clear(pending, h('span', { class: 'muted' }, 'Checking for unpublished changes…'));
  if (pub.error)
    return clear(pending, h('span', { class: 'muted' }, `Publish unavailable: ${pub.error}`));
  clear(
    pending,
    h('i', { class: 'ed-pending__dot' }),
    files.length
      ? h(
          'span',
          {},
          h('b', { class: 'ed-pending__count' }, plural(pubChanges(), 'saved change')),
          ` not published · ${plural(files.length, 'file')}`,
        )
      : h('span', { class: 'muted' }, 'Everything saved is published'),
    ahead ? h('span', { class: 'muted' }, ` · ${plural(ahead, 'commit')} not pushed`) : null,
  );
}

async function refreshPublishStatus() {
  try {
    state.pub = await source.status();
  } catch (err) {
    state.pub = { error: err.message, files: [], ahead: 0 };
  }
  renderChrome();
  if (state.mode === 'browse') renderOverview();
}

// ---------------------------------------------------------------- bridge + panels
const bridge = createBridge({ iframe, store, labelFor: (p) => labelFor(store, p) });
const textPanel = createTextPanel({
  store,
  bridge,
  root: body,
  getTarget: () => state.target,
  getStaleSections: () => state.staleSections,
});
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
  const ahead = state.pub?.ahead || 0;
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
          `${plural(ahead, 'commit')} on ${state.pub.branch} not pushed yet; Publish pushes ${ahead === 1 ? 'it' : 'them'} too.`,
        )
      : null,
    files.length || ahead
      ? h('button', { type: 'button', class: 'link', onclick: () => publishDialog() }, 'Publish…')
      : null,
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
  vpIcon.className =
    'fa-solid ' + (state.viewport === 'mobile' ? 'fa-mobile-screen-button' : 'fa-desktop');
}

bridge.on('connect', () => {
  bridge.setMode(state.mode);
  renderBody();
});
/**
 * Keep the preview's home sections in list order (reorder, on/off, layout) after edits.
 * Returns true when data-edit pointers moved, so texts must be re-applied.
 */
function syncSections() {
  const r = syncHomeSections(bridge.doc, store);
  state.staleSections = r.stale;
  if (r.moved) bridge.api?.ScrollTrigger?.refresh();
  return r.rewired;
}

bridge.on('navigate', (path) => {
  if (syncSections()) bridge.applyTexts({ force: true });
  const url = new URL(location.href);
  url.searchParams.set('path', path);
  history.replaceState(null, '', url);
  // Keep Menu/Footer selection; only sync target when browsing pages.
  if (state.target?.kind !== 'component') {
    state.target = { kind: 'page', path, title: path === '/' ? 'Home' : path };
  }
  renderPages();
  if (state.mode === 'motion') motionPanel.select(null);
  else renderBody();
});
bridge.on('select', (sel) => {
  if (state.mode === 'motion') motionPanel.select(sel);
  else if (sel?.kind === 'text') textPanel.focusField(sel.el.dataset.edit);
  else textPanel.focusField(null);
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
  if (state.mode === 'text')
    src === 'panel' || (src && src.nodeType === 1) ? textPanel.update() : textPanel.render();
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

async function saveDev({ quiet = false } = {}) {
  const dirty = store.dirtyFiles();
  // Items added to or deleted from a list only show in the preview once it re-renders.
  const listsChanged = dirty.some(
    (f) => Array.isArray(store.base[f]) && store.base[f].length !== store.current[f]?.length,
  );
  state.saving = true;
  renderChrome();
  try {
    await source.saveDev(Object.fromEntries(dirty.map((f) => [f, store.current[f]])));
    store.markSaved(dirty);
    // A section the preview couldn't show yet (e.g. a grid with a new source): re-render it.
    if ((listsChanged || state.staleSections?.size) && bridge.path()) bridge.load(bridge.path());
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
    setStatus(
      `Saved ${dirty.length} file${dirty.length > 1 ? 's' : ''} · ${new Date().toLocaleTimeString()}`,
    );
    return true;
  } catch (err) {
    toast(`Save failed: ${err.message}`, { kind: 'error', timeout: 0 });
    return false;
  } finally {
    state.saving = false;
    renderChrome();
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
  if (state.publishing || document.querySelector('.modal')) return;
  await refreshPublishStatus();
  const pub = state.pub || { files: [], ahead: 0 };
  if (pub.error) return toast(`Can't publish: ${pub.error}`, { kind: 'error', timeout: 0 });
  const dirty = store.dirtyFiles();
  const n = countChanges();

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
    state.publishing = true;
    renderChrome();
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
      state.publishing = false;
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
    setStatus(`Published ${res.short} · ${new Date().toLocaleTimeString()}`);
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
    setStatus(err.committed ? `Commit ${err.short} not pushed` : 'Publish failed');
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
  refreshPublishStatus();
  window.addEventListener('focus', () => !state.publishing && refreshPublishStatus());
  bridge.load(new URLSearchParams(location.search).get('path') || '/');
}

boot();
