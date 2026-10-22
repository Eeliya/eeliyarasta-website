/**
 * Client entry. The HTML is already prerendered; this file only adds behaviour:
 * menu, router, and per-page mounting (animations + modules).
 */
import './styles/main.scss';
import { gsap, ScrollTrigger } from './lib/env.js';
import {
  mount as mountAnimations,
  config as animationConfig,
  resolve as resolveAnimation,
  resolveWidget as resolveWidgetAnimation,
  setConfig,
  pageKey,
} from './anim/engine.js';
import { flags } from './anim/flags.js';
import { initRouter, navigate, replayCurtain, setPageCurtains } from './router.js';
import { initMenu, updateActiveNav } from './ui/menu.js';
import { initClock, updateClocks } from './ui/clock.js';
import { applyAccent } from './theme.js';
import { album } from './modules/album.js';
import { projects } from './modules/projects.js';
import { cards, imageFade } from './modules/misc.js';
import { contactForms } from './modules/form.js';
import { watchRows } from './modules/rows.js';
import { anchors } from './modules/anchors.js';
import { backdrop } from './modules/backdrop.js';
import { fitText } from './modules/fit.js';

const pageModules = [imageFade, album, projects, cards, contactForms, anchors, fitText];
// the footer's widgets: the modules of widgets it can have (no album, project list or anchors:
// those are the page's, once)
const footerModules = [imageFade, cards, contactForms, fitText];
// Editor hooks (see connectEditor below); always empty on the public site.
const hooks = { beforeMount: new Set(), afterMount: new Set() };
let current = null;
let frozen = false;

/** Move [data-portal] elements (fixed UI) out of the view, so page transitions leave them be. */
function movePortals(view) {
  const portal = document.getElementById('portal');
  view.querySelectorAll('[data-portal]').forEach((el) => portal.appendChild(el));
  return portal;
}

/**
 * Put the page's backdrop (rendered in the view, or given) in its own fixed layer #backdrop,
 * in place of the last one (none: empty), and run it; the view mounted again keeps its own.
 * Returns its cleanup.
 */
const backdrops = new WeakMap(); // view -> its backdrop layer, once moved out of it
function showBackdrop(view, el = view.querySelector('[data-backdrop]') ?? backdrops.get(view)) {
  backdrops.set(view, el || null);
  document.getElementById('backdrop').replaceChildren(...(el ? [el] : []));
  return backdrop(el);
}

/** The footer (settings/footer.json's sections): under every page, outside the view. */
const footerEl = () => document.querySelector('[data-footer]');

const noop = { revert() {} };
// the footer's animations go with each page's: they start (and are measured) on that page
const startAnimations = (view, portal) =>
  frozen ? noop : mountAnimations(view, { extraRoots: [portal, footerEl()].filter(Boolean) });

function mount(view, { first = false } = {}) {
  const portal = movePortals(view);
  hooks.beforeMount.forEach((fn) => fn(view));
  applyAccent(view.dataset.accent, { instant: first });
  updateActiveNav(location.pathname);
  updateClocks();
  document.documentElement.dataset.page = view.dataset.page;
  // real rows first (modules/rows.js): animations measure the page as it is laid out
  const onchange = () => keepScroll(() => ScrollTrigger.refresh());
  const foot = footerEl();
  const rows = watchRows(view, { onchange });
  const footRows = foot ? watchRows(foot, { onchange }) : null;
  const anim = startAnimations(view, portal);
  const cleanups = [
    ...pageModules.map((m) => m(view)),
    ...(foot ? footerModules.map((m) => m(foot)) : []),
  ].filter(Boolean);
  current = {
    view,
    portal,
    anim,
    rows: {
      reflow: () =>
        [rows, footRows]
          .filter(Boolean)
          .map((r) => r.reflow())
          .some(Boolean),
      stop: () => [rows, footRows].forEach((r) => r?.stop()),
    },
    backdrop: showBackdrop(view),
    revert() {
      this.rows.stop();
      this.backdrop?.();
      cleanups.forEach((fn) => fn());
      this.anim.revert();
      portal.replaceChildren();
    },
  };
  requestAnimationFrame(() => keepScroll(() => ScrollTrigger.refresh()));
  hooks.afterMount.forEach((fn) => fn(view));
  window.dispatchEvent(new Event('router:navigated'));
}

function unmount() {
  current?.revert();
  current = null;
}

/** Revert and re-run only the animations of the current page (modules stay mounted). */
function remountAnimations() {
  if (!current) return;
  current.anim.revert();
  current.anim = startAnimations(current.view, current.portal);
  ScrollTrigger.refresh();
}

/** Run fn, then put the window back where it was scrolled (dev: the editor's refreshes). */
function keepScroll(fn) {
  const y = window.scrollY;
  fn();
  if (window.scrollY !== y) window.scrollTo(0, y);
}

/**
 * Dev only (`npm run dev`): connect to the visual editor (src/editor), which loads
 * the site in a same-origin iframe (the editor itself is any page with ?edit). `import.meta.env.DEV` is false in
 * production builds, so this function, the window.__site API and the editor
 * shortcut are dropped from the public bundle entirely.
 */
function connectEditor() {
  const api = {
    gsap,
    ScrollTrigger,
    animations: animationConfig,
    resolve: resolveAnimation,
    pageKey,
    hooks,
    navigate,
    /** Play the page-transition curtain over the current page (no navigation). */
    replayCurtain: (label, curtain) => replayCurtain(label, curtain),
    /** Pages with their own curtain or none, from the editor's draft content. */
    setPageCurtains,
    view: () => current?.view || null,
    /** Replace the animation config (in place) with an edited copy. */
    setAnimations: (next) => setConfig(next),
    remount: remountAnimations,
    resolveWidget: resolveWidgetAnimation,
    /** Play one widget's (or data-anim element's) animation again; false when it has none. */
    replay(el) {
      if (frozen || !current?.anim.replay?.(el)) return false;
      ScrollTrigger.refresh();
      return true;
    },
    /** The editor changed the layout of the view's sections: flow their rows again (rows.js). */
    reflow() {
      if (current?.rows.reflow()) keepScroll(() => ScrollTrigger.refresh());
    },
    /** ScrollTrigger.refresh, the scroll position kept (in the editor it could come back stale). */
    refresh: () => keepScroll(() => ScrollTrigger.refresh()),
    /** The editor changed the page's backdrop: its HTML ('' for none) in place of the old one. */
    setBackdrop(markup) {
      if (!current) return;
      current.backdrop?.();
      const tpl = document.createElement('template');
      tpl.innerHTML = markup || '';
      current.backdrop = showBackdrop(current.view, tpl.content.firstElementChild);
      keepScroll(() => ScrollTrigger.refresh());
    },
    /** The editor swapped sections of the view (src/editor/layout-sync.js): mount it again. */
    remountView() {
      if (!current) return;
      const { view } = current;
      current.revert();
      mount(view);
    },
    /** Stop all animations and show the page in its final, static state (for text editing). */
    freeze() {
      frozen = true;
      remountAnimations();
    },
    unfreeze() {
      frozen = false;
      remountAnimations();
    },
    scrollTo(target, { smooth = true } = {}) {
      if (typeof target === 'number')
        window.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'instant' });
      else target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'center' });
    },
    scrollTop(y) {
      if (y === undefined) return window.scrollY;
      window.scrollTo(0, y);
    },
    /** Scroll positions where `el` enters (top hits viewport bottom) and leaves (bottom hits top). */
    scrollRange(el) {
      const st = ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top' });
      const range = { start: st.start, end: st.end, max: ScrollTrigger.maxScroll(window) };
      st.kill();
      return range;
    },
  };
  window.__site = api;

  // Ctrl/Cmd + Shift + E opens the current page in the editor.
  window.addEventListener('keydown', (e) => {
    if (
      window.parent === window &&
      (e.metaKey || e.ctrlKey) &&
      e.shiftKey &&
      e.key.toLowerCase() === 'e'
    ) {
      e.preventDefault();
      location.href = `${location.pathname}?edit`; // the editor on this page (editor-url.js)
    }
  });

  // Content or templates changed on disk (scripts/vite-plugin-static-site.mjs): show the new
  // render. In the editor's preview the editor reloads the frame itself.
  import.meta.hot?.on('site:changed', () => {
    if (!flags.preview) location.reload();
  });

  try {
    const host = window.parent !== window ? window.parent.__siteEditor : null;
    if (!host) return;
    flags.preview = true;
    host.connect(api, window);
  } catch {
    /* not inside the editor (or cross-origin parent) */
  }
}

async function start() {
  if (import.meta.env.DEV) connectEditor();
  initMenu();
  initClock();
  initRouter({ mount, unmount, prepare: movePortals });
  // Wait for web fonts so text splitting measures the real glyphs (max 1.5s).
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  mount(document.querySelector('[data-router-view]'), { first: true });
  document.documentElement.classList.remove('anim-pending');
}

start();
