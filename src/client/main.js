/**
 * Client entry. The HTML is already prerendered; this file only adds behaviour:
 * smooth scroll, menu, router, and per-page mounting (animations + modules).
 */
import './styles/main.scss';
import { gsap, ScrollTrigger } from './lib/env.js';
import {
  mount as mountAnimations,
  config as animationConfig,
  resolve as resolveAnimation,
  setConfig,
  pageKey,
} from './anim/engine.js';
import { flags } from './anim/flags.js';
import { initSmooth, getSmoother } from './smooth.js';
import { initRouter, navigate, replayCurtain, setPageCurtains } from './router.js';
import { initMenu, updateActiveNav } from './ui/menu.js';
import { initClock, updateClocks } from './ui/clock.js';
import { applyAccent } from './theme.js';
import { album } from './modules/album.js';
import { projects } from './modules/projects.js';
import { cards, toTop, imageFade } from './modules/misc.js';

const pageModules = [imageFade, album, projects, cards, toTop];
// Editor hooks (see connectEditor below); always empty on the public site.
const hooks = { beforeMount: new Set(), afterMount: new Set() };
let current = null;
let frozen = false;

/** Move [data-portal] elements (fixed UI) out of the smooth-scroll content. */
function movePortals(view) {
  const portal = document.getElementById('portal');
  view.querySelectorAll('[data-portal]').forEach((el) => portal.appendChild(el));
  return portal;
}

const noop = { revert() {} };
const startAnimations = (view, portal) =>
  frozen ? noop : mountAnimations(view, { extraRoots: [portal] });

function mount(view, { first = false } = {}) {
  const portal = movePortals(view);
  hooks.beforeMount.forEach((fn) => fn(view));
  applyAccent(view.dataset.accent, { instant: first });
  updateActiveNav(location.pathname);
  updateClocks();
  document.documentElement.dataset.page = view.dataset.page;
  const anim = startAnimations(view, portal);
  const cleanups = pageModules.map((m) => m(view)).filter(Boolean);
  current = {
    view,
    portal,
    anim,
    revert() {
      cleanups.forEach((fn) => fn());
      this.anim.revert();
      portal.replaceChildren();
    },
  };
  requestAnimationFrame(() => ScrollTrigger.refresh());
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

/**
 * Dev only (`npm run dev`): connect to the visual editor (src/editor), which loads
 * the site in a same-origin iframe at /edit/. `import.meta.env.DEV` is false in
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
    replayCurtain: (label) => replayCurtain(label),
    /** Pages with their own curtain or none, from the editor's draft content. */
    setPageCurtains,
    getSmoother,
    view: () => current?.view || null,
    /** Replace the animation config (in place) with an edited copy. */
    setAnimations: (next) => setConfig(next),
    remount: remountAnimations,
    /** Stop all animations and show the page in its final, static state (for text editing). */
    freeze() {
      frozen = true;
      remountAnimations();
    },
    unfreeze() {
      frozen = false;
      remountAnimations();
    },
    scrollTo(target, { smooth = true, position = 'center center' } = {}) {
      const s = getSmoother();
      if (s) return s.scrollTo(target, smooth, position);
      if (typeof target === 'number')
        window.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'instant' });
      else target?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'center' });
    },
    scrollTop(y) {
      const s = getSmoother();
      if (y === undefined) return s ? s.scrollTop() : window.scrollY;
      if (s) s.scrollTop(y);
      else window.scrollTo(0, y);
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
      location.href = `/edit/?path=${encodeURIComponent(location.pathname)}`;
    }
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
  initSmooth();
  initMenu();
  initClock();
  initRouter({ mount, unmount, prepare: movePortals });
  // Wait for web fonts so text splitting measures the real glyphs (max 1.5s).
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  mount(document.querySelector('[data-router-view]'), { first: true });
  document.documentElement.classList.remove('anim-pending');
}

start();
