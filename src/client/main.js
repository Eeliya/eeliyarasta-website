/**
 * Client entry. The HTML is already prerendered; this file only adds behaviour:
 * smooth scroll, cursor, menu, router, and per-page mounting (animations + modules).
 */
import './styles/main.scss';
import { ScrollTrigger } from './lib/env.js';
import { mount as mountAnimations, config as animationConfig, resolve as resolveAnimation } from './anim/engine.js';
import { initSmooth } from './smooth.js';
import { initRouter } from './router.js';
import { initMenu, updateActiveNav } from './ui/menu.js';
import { initCursor, resetCursor } from './ui/cursor.js';
import { initClock, updateClocks } from './ui/clock.js';
import { applyAccent } from './theme.js';
import { album } from './modules/album.js';
import { projects } from './modules/projects.js';
import { cards, toTop, imageFade } from './modules/misc.js';

const pageModules = [imageFade, album, projects, cards, toTop];
let current = null;

/** Move [data-portal] elements (fixed UI) out of the smooth-scroll content. */
function movePortals(view) {
  const portal = document.getElementById('portal');
  view.querySelectorAll('[data-portal]').forEach((el) => portal.appendChild(el));
  return portal;
}

function mount(view, { first = false } = {}) {
  const portal = movePortals(view);
  applyAccent(view.dataset.accent, { instant: first });
  updateActiveNav(location.pathname);
  updateClocks();
  document.documentElement.dataset.page = view.dataset.page;
  const anim = mountAnimations(view, { extraRoots: [portal] });
  const cleanups = pageModules.map((m) => m(view)).filter(Boolean);
  current = {
    revert() {
      cleanups.forEach((fn) => fn());
      anim.revert();
      portal.replaceChildren();
    },
  };
  requestAnimationFrame(() => ScrollTrigger.refresh());
  window.dispatchEvent(new Event('router:navigated'));
}

function unmount() {
  current?.revert();
  current = null;
  resetCursor();
}

async function start() {
  initSmooth();
  initMenu();
  initCursor();
  initClock();
  initRouter({ mount, unmount, prepare: movePortals });
  // Wait for web fonts so text splitting measures the real glyphs (max 1.5s).
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  mount(document.querySelector('[data-router-view]'), { first: true });
  document.documentElement.classList.remove('anim-pending');
}

start();

// Expose the animation config for the future visual editor / debugging.
window.__site = {
  animations: animationConfig,
  resolve: resolveAnimation,
  remount() {
    const view = document.querySelector('[data-router-view]');
    unmount();
    mount(view);
  },
};
