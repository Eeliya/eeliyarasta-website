/**
 * Bridge between the editor and the real site running in a same-origin iframe.
 *
 * The site calls window.parent.__siteEditor.connect(api, win) at startup (see
 * src/client/main.js), before it mounts the first page. From then on the editor:
 *  - pushes the edited settings/animations.json into the preview and re-mounts animations,
 *  - re-applies edited text to every [data-edit] element whenever a page mounts,
 *  - turns [data-edit] elements into inline editors (Text mode),
 *  - lets you hover/click [data-anim] elements to select them (Motion mode).
 */
import { parse } from './lib/pointer.js';
import { words } from '../site/helpers.js';
import { ANIMATIONS } from '../site/files.js';

const INJECTED_CSS = `
html.__ed-text [data-edit] { outline: 1px dashed rgb(255 255 255 / .22); outline-offset: 3px; border-radius: 2px; cursor: text !important; }
html.__ed-text [data-edit]:hover { outline-color: rgb(255 255 255 / .6); }
html.__ed-text [data-edit]:focus { outline: 1.5px solid #9fd3ff; outline-offset: 3px; caret-color: #9fd3ff; }
html.__ed-text [data-edit].__ed-invalid { outline-color: #ff8a7a !important; }
html.__ed-text [data-edit] { pointer-events: auto; }
html.__ed-text .hero__title { z-index: 5; }
html.__ed-motion [data-anim], html.__ed-motion [data-anim] * { cursor: pointer !important; }
.__ed-box { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 4px; opacity: 0; transition: opacity .15s; left: 0; top: 0; }
.__ed-box.is-on { opacity: 1; }
.__ed-box--hover { border: 1px dashed rgb(255 255 255 / .6); }
.__ed-box--sel { border: 1.5px solid #9fd3ff; box-shadow: 0 0 0 4px rgb(159 211 255 / .14), inset 0 0 0 9999px rgb(159 211 255 / .04); }
.__ed-box span { position: absolute; left: -1.5px; bottom: 100%; margin-bottom: 5px; font: 500 10px/1 'DM Mono', ui-monospace, monospace; letter-spacing: .04em; padding: 5px 7px; border-radius: 4px; white-space: nowrap; }
.__ed-box--hover span { background: rgb(20 20 20 / .85); color: #fff; border: 1px solid rgb(255 255 255 / .2); }
.__ed-box--sel span { background: #9fd3ff; color: #000; }
.__ed-box.is-low span { bottom: auto; top: 100%; margin: 5px 0 0; }
`;

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const parseEdit = (attr) => {
  const i = attr.indexOf('#');
  return { file: attr.slice(0, i), ptr: attr.slice(i + 1) };
};

/**
 * The preview iframe is attached later: App.svelte calls bridge.attach(iframe) when it renders.
 */
export function createBridge({ store, labelFor }) {
  const handlers = { connect: [], navigate: [], select: [], key: [], textFocus: [] };
  const emit = (name, ...args) => handlers[name].forEach((fn) => fn(...args));
  let iframe = null;
  let api = null;
  let win = null;
  let doc = null;
  let mode = 'browse';
  let hoverEl = null;
  let selected = null; // { el, kind }
  let boxes = null;
  let raf = 0;
  let plaintext = true;
  let applied = new WeakMap(); // element -> value it currently shows
  let restore = null; // after a reload(): puts scroll and selection back once mounted

  const bridge = {
    get api() {
      return api;
    },
    get doc() {
      return doc;
    },
    get mode() {
      return mode;
    },
    get selected() {
      return selected;
    },
    on(name, fn) {
      handlers[name].push(fn);
    },
    path: () => (win ? win.location.pathname : null),

    /** Use `el` as the preview (an attachment: {@attach bridge.attach} in App.svelte). */
    attach(el) {
      iframe = el;
      // A full navigation inside the frame to a non-site page (e.g. /edit/ itself): go home.
      iframe.addEventListener('load', () => {
        try {
          const cw = iframe.contentWindow;
          if (cw && cw.location.pathname.startsWith('/edit')) iframe.src = '/';
        } catch {
          /* cross-origin or frame not ready */
        }
      });
    },

    load(path) {
      iframe.src = path;
    },
    /** Reload the preview page (a fresh render from disk) at the same scroll and selection. */
    reload() {
      if (!api) {
        iframe.src = iframe.src; // not connected yet: load it again
        return;
      }
      const y = api.scrollTop();
      const view = doc.querySelector('[data-router-view]');
      const sel = selected && {
        kind: selected.kind,
        edit: selected.el.dataset.edit,
        anim: [...view.querySelectorAll('[data-anim]')].indexOf(selected.el),
      };
      restore = () => {
        api.scrollTop(y);
        if (!sel) return;
        const el = sel.edit
          ? doc.querySelector(`[data-edit="${CSS.escape(sel.edit)}"]`)
          : doc.querySelectorAll('[data-router-view] [data-anim]')[sel.anim];
        if (el) bridge.select(el, sel.kind);
      };
      win.location.reload();
      // The old page is going away: no calls into it until the new one connects. Its document
      // stays readable meanwhile, so the panels keep their fields (no "waiting" flash).
      api = win = null;
    },
    navigate(path) {
      if (api && win.location.pathname !== path) api.navigate(path);
      else if (!api) iframe.src = path;
    },

    setMode(next) {
      mode = next;
      if (!doc) return;
      doc.documentElement.classList.toggle('__ed-text', mode === 'text');
      doc.documentElement.classList.toggle('__ed-motion', mode === 'motion');
      // Freeze first: reverting split-text animations re-creates their inner elements,
      // which would drop contenteditable from editable text inside them (page titles, hero name).
      if (api) {
        if (mode === 'text') api.freeze();
        else api.unfreeze();
      }
      setEditable(mode === 'text');
      hoverEl = null;
      bridge.select(null);
      loop();
    },

    /** Unique [data-edit] fields on the current page, in document order. */
    editFields() {
      if (!doc) return [];
      const seen = new Map();
      for (const el of doc.querySelectorAll('[data-edit]')) {
        const edit = el.dataset.edit;
        if (!seen.has(edit))
          seen.set(edit, {
            edit,
            ...parseEdit(edit),
            type: el.dataset.editType || 'text',
            els: [],
          });
        seen.get(edit).els.push(el);
      }
      return [...seen.values()];
    },

    /** [data-anim] elements on the current page (view + portal). */
    animElements() {
      if (!doc) return [];
      return [...doc.querySelectorAll('[data-router-view] [data-anim], #portal [data-anim]')].map(
        (el) => ({
          el,
          id: el.dataset.anim,
          key: el.dataset.animKey,
        }),
      );
    },

    /**
     * Write the store's text values into the preview. `applied` remembers what each
     * element shows, so unrelated changes don't touch (or re-animate) the page.
     */
    applyTexts({ force = false, skip = null, plain = false } = {}) {
      if (!doc) return;
      const pending = [];
      for (const el of doc.querySelectorAll('[data-edit]')) {
        const { file, ptr } = parseEdit(el.dataset.edit);
        const value = store.get(file, ptr);
        if (value === undefined || value === null) continue;
        if (el === skip) {
          applied.set(el, value);
          continue;
        }
        if (!force && (el === doc.activeElement || applied.get(el) === value)) continue;
        pending.push([el, value]);
      }
      // Keep the page-transition label on <main> in sync with the draft content.
      const view = doc.querySelector('[data-router-view]');
      if (view?.dataset.curtainEdit) {
        const { file, ptr } = parseEdit(view.dataset.curtainEdit);
        const curtainVal = store.get(file, ptr);
        if (curtainVal !== undefined && curtainVal !== null)
          view.setAttribute('data-curtain', String(curtainVal));
      }

      if (!pending.length) return;
      const run = () => {
        for (const [el, value] of pending) {
          applied.set(el, value);
          if (el.dataset.editType === 'block') {
            const html = escText(value).replace(/\r?\n/g, '<br>');
            if (el.innerHTML !== html) el.innerHTML = html;
          } else if (el.dataset.editType === 'words') {
            const html = words(value);
            if (el.innerHTML !== html) el.innerHTML = html;
          } else if (el.textContent !== String(value)) el.textContent = String(value);
        }
      };
      // Outside Text mode, split-text animations own the DOM: revert, write, re-mount.
      if (!plain && mode !== 'text' && api) {
        api.freeze();
        run();
        api.unfreeze();
      } else run();
    },

    updateAnimations(cfg, { replay = true } = {}) {
      if (!api) return;
      api.setAnimations(cfg);
      if (replay && mode !== 'text')
        bridge.replay(selected?.kind === 'anim' ? selected.el : null, { scroll: false });
    },

    /** Re-run the page's animations, optionally bringing `el` into view first. */
    replay(el, { scroll = true } = {}) {
      if (!api) return;
      if (el && scroll) {
        const r = el.getBoundingClientRect();
        const vh = win.innerHeight;
        if (r.bottom < 0 || r.top > vh * 0.8)
          api.scrollTo(el, { smooth: false, position: 'center center' });
      }
      // (api is null again if a save reloads the preview in between)
      requestAnimationFrame(() => requestAnimationFrame(() => api?.remount()));
    },

    /** Scroll helper: 0 = element just entering the viewport, 1 = just left it. */
    scrubTo(el, p) {
      if (!api) return;
      const { start, end, max } = api.scrollRange(el);
      api.scrollTop(Math.max(0, Math.min(max, start + (end - start) * p)));
    },
    scrubProgress(el) {
      if (!api) return 0;
      const { start, end } = api.scrollRange(el);
      return end > start ? Math.max(0, Math.min(1, (api.scrollTop() - start) / (end - start))) : 0;
    },

    select(el, kind = mode === 'text' ? 'text' : 'anim') {
      selected = el ? { el, kind } : null;
      emit('select', selected);
      loop();
    },
    setHover(el) {
      hoverEl = el;
      loop();
    },
    reveal(el) {
      if (!el || !api) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 60 || r.top > win.innerHeight - 60)
        api.scrollTo(el, { smooth: true, position: 'center center' });
    },
    focusEdit(edit) {
      const el = doc?.querySelector(`[data-edit="${CSS.escape(edit)}"]`);
      if (!el) return;
      bridge.reveal(el);
      bridge.select(el, 'text');
    },
  };

  function setEditable(on) {
    for (const el of doc.querySelectorAll('[data-edit]')) {
      if (on) {
        el.setAttribute('contenteditable', plaintext ? 'plaintext-only' : 'true');
        el.setAttribute('spellcheck', 'true');
        el.closest('a')?.setAttribute('draggable', 'false');
      } else {
        el.removeAttribute('contenteditable');
        el.classList.remove('__ed-invalid');
      }
    }
  }

  function readValue(el) {
    const type = el.dataset.editType || 'text';
    if (type === 'block') return el.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    if (type === 'words') {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      return text || undefined; // the name can't be empty
    }
    const text = el.textContent.replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' ');
    if (type === 'number') {
      const n = Number(text.trim());
      return text.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
    return text;
  }

  function boxLabel(el, kind) {
    if (kind === 'text') return labelFor?.(parseEdit(el.dataset.edit)) || el.dataset.edit;
    return `${el.dataset.anim} · ${api?.resolve(el.dataset.anim, el)?.preset || '?'}`;
  }

  function placeBox(box, el, kind) {
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    const on = !!r && (r.width > 0 || r.height > 0) && mode !== 'browse';
    box.classList.toggle('is-on', on);
    if (!on) return;
    box.style.transform = `translate(${r.left - 4}px, ${r.top - 4}px)`;
    box.style.width = `${r.width + 8}px`;
    box.style.height = `${r.height + 8}px`;
    box.classList.toggle('is-low', r.top < 30);
    const label = boxLabel(el, kind);
    if (box.firstChild.textContent !== label) box.firstChild.textContent = label;
  }

  function loop() {
    if (raf || !boxes) return;
    const tick = () => {
      raf = 0;
      if (!boxes?.hover.isConnected) return;
      const sameAsSel = selected && hoverEl === selected.el;
      placeBox(boxes.hover, sameAsSel ? null : hoverEl, mode === 'text' ? 'text' : 'anim');
      placeBox(boxes.sel, selected?.el, selected?.kind);
      if (mode !== 'browse') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  const isShortcut = (e) =>
    ((e.metaKey || e.ctrlKey) && /^[sezy]$/i.test(e.key)) || e.key === 'Escape';

  function attachListeners() {
    const style = doc.createElement('style');
    style.id = '__ed-style';
    style.textContent = INJECTED_CSS;
    doc.head.append(style);
    const mk = (cls) => {
      const b = doc.createElement('div');
      b.className = `__ed-box ${cls}`;
      b.append(doc.createElement('span'));
      doc.documentElement.append(b);
      return b;
    };
    boxes = { hover: mk('__ed-box--hover'), sel: mk('__ed-box--sel') };

    const probe = doc.createElement('div');
    try {
      probe.contentEditable = 'plaintext-only';
    } catch {
      /* unsupported */
    }
    plaintext = probe.contentEditable === 'plaintext-only';

    doc.addEventListener(
      'pointermove',
      (e) => {
        if (mode === 'browse') return;
        const t = e.target instanceof win.Element ? e.target : null;
        hoverEl = t?.closest(mode === 'text' ? '[data-edit]' : '[data-anim]') || null;
      },
      { passive: true },
    );
    doc.documentElement.addEventListener('pointerleave', () => (hoverEl = null));

    // Clicks: in edit modes, clicks on editable / animated elements select instead of
    // navigating. Hold Alt to click through.
    win.addEventListener(
      'click',
      (e) => {
        if (mode === 'browse' || e.altKey) return;
        const t = e.target instanceof win.Element ? e.target : null;
        const hit = t?.closest(mode === 'text' ? '[data-edit]' : '[data-anim]');
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'motion') bridge.select(hit, 'anim');
      },
      true,
    );

    doc.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-edit]');
      if (mode !== 'text' || !el) return;
      // Word-split text (hero name) is edited as plain text and re-split on blur.
      if (el.dataset.editType === 'words') {
        const { file, ptr } = parseEdit(el.dataset.edit);
        el.textContent = String(store.get(file, ptr) ?? el.textContent.replace(/\s+/g, ' ').trim());
        const sel = win.getSelection();
        sel.selectAllChildren(el);
        sel.collapseToEnd();
      }
      bridge.select(el, 'text');
      emit('textFocus', el.dataset.edit);
      // Focus can scroll the smooth-scroll wrapper behind ScrollSmoother's back (e.g. Tab
      // to an off-screen field): make sure the field ends up visible.
      setTimeout(() => bridge.reveal(el), 50);
    });

    doc.addEventListener('focusout', (e) => {
      const el = e.target.closest?.('[data-edit-type="words"]');
      if (!el) return;
      const { file, ptr } = parseEdit(el.dataset.edit);
      const value = store.get(file, ptr);
      if (value === undefined || value === null) return;
      el.classList.remove('__ed-invalid');
      el.innerHTML = words(value);
      applied.set(el, value);
    });

    doc.addEventListener('input', (e) => {
      const el = e.target.closest?.('[data-edit]');
      if (mode !== 'text' || !el) return;
      const value = readValue(el);
      el.classList.toggle('__ed-invalid', value === undefined);
      if (value === undefined) return;
      const { file, ptr } = parseEdit(el.dataset.edit);
      store.set(file, ptr, value, { key: `text:${el.dataset.edit}`, source: el });
    });

    doc.addEventListener(
      'keydown',
      (e) => {
        const el = e.target.closest?.('[contenteditable][data-edit]');
        if (el) {
          if (e.key === 'Enter' && el.dataset.editType !== 'block') {
            e.preventDefault();
            el.blur();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            doc.execCommand('insertLineBreak');
            return;
          }
          if (e.key === 'Escape') {
            el.blur();
          }
          e.stopPropagation(); // keep site shortcuts (album arrows, menu) out of typing
        }
        if (isShortcut(e)) emit('key', e);
      },
      true,
    );

    if (!plaintext) {
      doc.addEventListener('paste', (e) => {
        if (!e.target.closest?.('[contenteditable][data-edit]')) return;
        e.preventDefault();
        doc.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      });
    }
  }

  // Called by the site (src/client/main.js) before its first mount.
  window.__siteEditor = {
    connect(siteApi, siteWin) {
      api = siteApi;
      win = siteWin;
      applied = new WeakMap();
      doc = siteWin.document;
      boxes = null;
      raf = 0;
      selected = null;
      hoverEl = null;
      api.setAnimations(store.current[ANIMATIONS]);
      if (mode === 'text') api.freeze();
      api.hooks.beforeMount.add(() => bridge.applyTexts({ force: true, plain: true }));
      api.hooks.afterMount.add(() => {
        doc.documentElement.classList.toggle('__ed-text', mode === 'text');
        doc.documentElement.classList.toggle('__ed-motion', mode === 'motion');
        if (mode === 'text') setEditable(true);
        bridge.select(null);
        emit('navigate', win.location.pathname);
        restore?.();
        restore = null;
        loop();
      });
      attachListeners();
      emit('connect', api);
    },
  };

  bridge.parsePtr = parse;
  return bridge;
}
