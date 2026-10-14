/**
 * Bridge between the editor and the real site running in a same-origin iframe.
 *
 * The site calls window.parent.__siteEditor.connect(api, win) at startup (see
 * src/client/main.js), before it mounts the first page. From then on the editor:
 *  - pushes the edited settings/animations.json into the preview and re-mounts animations,
 *  - re-applies edited text to every [data-edit] element whenever a page mounts,
 *  - Content mode ('text'): a double click turns a [data-edit] element into an inline editor
 *    until it loses focus (a single click picks its block: overlay.js); a double-clicked
 *    photo (data-edit-type="image") or bound value opens its field in the panel. Links,
 *    buttons and forms don't act on clicks (Alt+click does),
 *  - lets you hover/click blocks ([data-block]) and [data-anim] parts to select them (Motion
 *    mode: the innermost one under the pointer),
 *  - a bound value ([data-bound], src/site/layout/bindings.js) is not typed in the preview:
 *    its field in the panel shows the binding.
 */
import { withDraft } from './source.js';
import { splitEdit, words } from '../site/helpers.js';
import { ANIMATIONS } from '../site/files.js';
import { imageSrcset, imageUrl } from './svelte/media.svelte.js';
import { T } from './ui-tokens.js';

const INJECTED_CSS = `
html.__ed-text [data-edit], html.__ed-text [data-bound] { outline-offset: 3px; border-radius: ${T.radiusXs}; pointer-events: auto; }
html.__ed-text [data-edit]:hover { outline: 1px dashed rgb(255 255 255 / .5); }
html.__ed-text [data-bound]:hover { outline: 1px dotted rgb(255 255 255 / .5); }
html.__ed-text [data-edit][contenteditable] { outline: 1.5px solid ${T.accent}; caret-color: ${T.accent}; cursor: text !important; }
html.__ed-text [data-edit].__ed-invalid { outline-color: ${T.error} !important; }
html.__ed-text [data-block], html.__ed-text [data-block] *:not([contenteditable], [contenteditable] *) { cursor: default !important; }
[data-bound-missing] { opacity: .4; }
html.__ed-text .hero__title { z-index: 5; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer]):not([data-ed-open]) *, :is(html.__ed-text, html.__ed-motion):has([data-ed-open]) [data-router-view] * { pointer-events: none !important; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer]):not([data-ed-open]) { cursor: pointer; pointer-events: auto; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer]):not([data-ed-open]):hover { outline: 1px dashed rgb(255 255 255 / .6); outline-offset: -1px; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer])[data-ed-open] { outline: 2px solid ${T.accent}; outline-offset: -2px; }
:is(html.__ed-text, html.__ed-motion) [data-footer]:not(:has([data-sec])) { min-height: 96px; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer])::before { position: absolute; left: 8px; top: 8px; z-index: 30; padding: 4px 8px; border-radius: ${T.radiusSm}; font: 500 ${T.fsXs}/1 ${T.font}; letter-spacing: .04em; background: ${T.black}; color: ${T.white}; pointer-events: none; }
:is(html.__ed-text, html.__ed-motion) [data-footer]::before { content: 'Footer'; }
:is(html.__ed-text, html.__ed-motion) [data-header]:is(:hover, [data-ed-open])::before { content: 'Header'; top: auto; bottom: -28px; }
:is(html.__ed-text, html.__ed-motion) :is([data-header], [data-footer])[data-ed-open]::before { background: ${T.accent}; color: ${T.onAccent}; }
html.__ed-motion [data-anim], html.__ed-motion [data-anim] *, html.__ed-motion [data-block], html.__ed-motion [data-block] * { cursor: pointer !important; }
.__ed-box { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: ${T.radiusSm}; opacity: 0; transition: opacity .15s; left: 0; top: 0; }
.__ed-box.is-on { opacity: 1; }
.__ed-box--hover { border: 1px dashed rgb(255 255 255 / .6); }
.__ed-box--sel { border: 1.5px solid ${T.accent}; box-shadow: 0 0 0 4px color-mix(in srgb, ${T.accent} 14%, transparent), inset 0 0 0 9999px color-mix(in srgb, ${T.accent} 4%, transparent); }
.__ed-box span { position: absolute; left: -1.5px; bottom: 100%; margin-bottom: 4px; font: 500 ${T.fsXs}/1 ${T.font}; letter-spacing: .04em; padding: 4px 8px; border-radius: ${T.radiusSm}; white-space: nowrap; }
.__ed-box--hover span { background: ${T.black}; color: ${T.white}; border: 1px solid rgb(255 255 255 / .2); }
.__ed-box--sel span { background: ${T.accent}; color: ${T.onAccent}; }
.__ed-box.is-low span { bottom: auto; top: 100%; margin: 4px 0 0; }
`;

/** What Motion mode picks under the pointer: a data-anim part, else its block. */
const MOTION_PICK = '[data-anim], [data-block]';
/** What would act on a click (follow, open, send): off in Content mode. */
const ACTIVE = 'a, button, [role="button"], label, summary, input, select, textarea';

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The preview iframe is attached later: App.svelte calls bridge.attach(iframe) when it renders.
 */
export function createBridge({ store, labelFor }) {
  const handlers = { connect: [], navigate: [], select: [], key: [], textFocus: [], part: [] };
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
          if (cw && cw.location.pathname.startsWith('/edit')) iframe.src = withDraft('/');
        } catch {
          /* cross-origin or frame not ready */
        }
      });
    },

    load(path) {
      iframe.src = withDraft(path);
    },
    /** Reload the preview page (a fresh render from disk) at the same scroll and selection. */
    reload() {
      if (!api) {
        iframe.contentWindow?.location.reload(); // not connected yet: load it again
        return;
      }
      const y = api.scrollTop();
      const view = doc.querySelector('[data-router-view]');
      const sel = selected && {
        kind: selected.kind,
        edit: selected.el.dataset.edit ?? selected.el.dataset.bound,
        anim: [...view.querySelectorAll('[data-anim]')].indexOf(selected.el),
        block: selected.el.dataset.block,
      };
      restore = () => {
        api.scrollTop(y);
        if (!sel) return;
        const el = sel.edit
          ? doc.querySelector(
              `[data-edit="${CSS.escape(sel.edit)}"], [data-bound="${CSS.escape(sel.edit)}"]`,
            )
          : sel.block
            ? doc.querySelector(`[data-block="${CSS.escape(sel.block)}"]`)
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
      else if (!api) iframe.src = withDraft(path);
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
      if (mode !== 'text') endEdits();
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
            ...splitEdit(edit),
            type: el.dataset.editType || 'text',
            els: [],
          });
        seen.get(edit).els.push(el);
      }
      return [...seen.values()];
    },

    /** [data-anim] elements on the current page (view + portal + footer). */
    animElements() {
      if (!doc) return [];
      return [
        ...doc.querySelectorAll(
          '[data-router-view] [data-anim], #portal [data-anim], [data-footer] [data-anim]',
        ),
      ].map((el) => ({
        el,
        id: el.dataset.anim,
        key: el.dataset.animKey,
      }));
    },

    /**
     * Write the store's text values into the preview. `applied` remembers what each
     * element shows, so unrelated changes don't touch (or re-animate) the page.
     */
    applyTexts({ force = false, skip = null, plain = false } = {}) {
      if (!doc) return;
      const pending = [];
      for (const el of doc.querySelectorAll('[data-edit]')) {
        const { file, ptr } = splitEdit(el.dataset.edit);
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
        const { file, ptr } = splitEdit(view.dataset.curtainEdit);
        const curtainVal = store.get(file, ptr);
        if (curtainVal !== undefined && curtainVal !== null)
          view.setAttribute('data-curtain', String(curtainVal));
      }

      if (!pending.length) return;
      const run = () => {
        for (const [el, value] of pending) {
          applied.set(el, value);
          if (el.dataset.editType === 'image') {
            // a new photo: its URL and, for an R2 photo, its sizes (the sizes attribute stays)
            const url = imageUrl(value);
            if (el.getAttribute('src') !== url) {
              const srcset = imageSrcset(value);
              if (srcset) el.srcset = srcset;
              else el.removeAttribute('srcset');
              el.src = url;
            }
          } else if (el.dataset.editType === 'block') {
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

    /**
     * Play one block's (or data-anim element's) animation again, bringing it into view first;
     * every animation of the page when it has none of its own.
     */
    replayOne(el) {
      if (!api || !el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > win.innerHeight * 0.8) api.scrollTo(el, { smooth: false });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!api?.replay(el)) api?.remount();
        }),
      );
    },

    /** Re-run the page's animations, optionally bringing `el` into view first. */
    replay(el, { scroll = true } = {}) {
      if (!api) return;
      if (el && scroll) {
        const r = el.getBoundingClientRect();
        const vh = win.innerHeight;
        if (r.bottom < 0 || r.top > vh * 0.8) api.scrollTo(el, { smooth: false });
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
      if (r.bottom < 60 || r.top > win.innerHeight - 60) api.scrollTo(el, { smooth: true });
    },
    focusEdit(edit) {
      const el = doc?.querySelector(
        `[data-edit="${CSS.escape(edit)}"], [data-bound="${CSS.escape(edit)}"]`,
      );
      if (!el) return;
      bridge.reveal(el);
      bridge.select(el, 'text');
    },
  };

  /**
   * Edit a text in place (a double click in Content mode): editable until it loses focus,
   * the caret where it was clicked (x, y).
   */
  function startEdit(el, x, y) {
    el.setAttribute('contenteditable', plaintext ? 'plaintext-only' : 'true');
    el.setAttribute('spellcheck', 'true');
    el.closest('a')?.setAttribute('draggable', 'false');
    el.focus({ preventScroll: true });
    const range = x === undefined ? null : doc.caretRangeFromPoint?.(x, y);
    if (range && el.contains(range.startContainer)) {
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  function endEdit(el) {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('__ed-invalid');
  }
  const endEdits = () => doc?.querySelectorAll('[data-edit][contenteditable]').forEach(endEdit);

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
    if (kind === 'text') {
      // a bound value: its field's label, "from the item"
      const edit = el.dataset.edit ?? el.dataset.bound;
      const label = labelFor?.(splitEdit(edit)) || edit;
      return el.dataset.bound ? `${label} · from the item` : label;
    }
    if (el.dataset.anim === undefined) {
      const type = [...el.classList].find((c) => c.startsWith('blk--'))?.slice(5) || 'block';
      return `${type} · ${el.dataset.motion || 'no motion'}`;
    }
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
    // (its colours: ui-tokens.js, read from the editor's styles/_tokens.scss)
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
        // (Content mode: the overlay shows the block under the pointer, CSS the text)
        if (mode !== 'motion') return;
        const t = e.target instanceof win.Element ? e.target : null;
        hoverEl = t?.closest(MOTION_PICK) || null;
      },
      { passive: true },
    );
    doc.documentElement.addEventListener('pointerleave', () => (hoverEl = null));

    /** A text's (or photo's, bound value's) field opens in the panel. */
    const pickField = (hit) => {
      bridge.select(hit, 'text');
      emit('textFocus', hit.dataset.edit ?? hit.dataset.bound);
    };

    // Clicks: in edit modes, clicks select instead of navigating. In Content mode no link,
    // button or form acts (a click in a block picks it: overlay.js; outside the blocks it
    // picks the text's field); in Motion a click on an animated element picks it. Hold Alt
    // to click through.
    win.addEventListener(
      'click',
      (e) => {
        if (mode === 'browse' || e.altKey) return;
        const t = e.target instanceof win.Element ? e.target : null;
        // A site part (the header, the footer): a click on it (locked) opens it, picking
        // nothing in it yet; a click outside it (open) locks it again (the page is picked
        // from the next click)
        for (const [id, sel] of [
          ['header', '[data-header]'],
          ['footer', '[data-footer]'],
        ]) {
          const part = doc.querySelector(sel);
          const open = !!part?.hasAttribute('data-ed-open');
          if (part && (open ? !part.contains(t) : t === part)) {
            e.preventDefault();
            e.stopPropagation();
            emit('part', id, !open);
            return;
          }
        }
        if (mode === 'text') {
          if (t?.closest('[contenteditable]')) {
            if (t.closest('a, button')) e.preventDefault(); // the caret moves, nothing follows
            return;
          }
          const hit = t?.closest('[data-edit], [data-bound]');
          if (!hit && !t?.closest(ACTIVE)) return;
          e.preventDefault();
          e.stopPropagation();
          if (hit && !hit.closest('[data-block]')) pickField(hit);
          return;
        }
        const hit = t?.closest(MOTION_PICK);
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        bridge.select(hit, 'anim');
      },
      true,
    );
    // a form doesn't send, Enter in a field included
    doc.addEventListener(
      'submit',
      (e) => {
        if (mode === 'browse') return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    // Content mode: a double click edits a text in place; a photo or a bound value opens its
    // field in the panel.
    doc.addEventListener(
      'dblclick',
      (e) => {
        if (mode !== 'text' || e.altKey) return;
        const t = e.target instanceof win.Element ? e.target : null;
        const hit = t?.closest('[data-edit], [data-bound]');
        if (!hit || hit.isContentEditable) return;
        e.preventDefault();
        e.stopPropagation();
        if (hit.dataset.bound !== undefined || hit.dataset.editType === 'image') pickField(hit);
        else startEdit(hit, e.clientX, e.clientY);
      },
      true,
    );

    doc.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-edit]');
      if (mode !== 'text' || !el) return;
      // Word-split text (hero name) is edited as plain text and re-split on blur.
      if (el.dataset.editType === 'words') {
        const { file, ptr } = splitEdit(el.dataset.edit);
        el.textContent = String(store.get(file, ptr) ?? el.textContent.replace(/\s+/g, ' ').trim());
        const sel = win.getSelection();
        sel.selectAllChildren(el);
        sel.collapseToEnd();
      }
      bridge.select(el, 'text');
      emit('textFocus', el.dataset.edit);
      // Focus (e.g. Tab to an off-screen field) may leave the field under the header or at
      // an edge: center it.
      setTimeout(() => bridge.reveal(el), 50);
    });

    doc.addEventListener('focusout', (e) => {
      const edited = e.target.closest?.('[data-edit][contenteditable]');
      if (edited) endEdit(edited);
      const el = e.target.closest?.('[data-edit-type="words"]');
      if (!el) return;
      const { file, ptr } = splitEdit(el.dataset.edit);
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
      const { file, ptr } = splitEdit(el.dataset.edit);
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
            e.preventDefault();
            e.stopPropagation();
            el.blur(); // ends the edit (the block stays picked)
            return;
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

  return bridge;
}
