/**
 * Navigation. Everything opens on CLICK (never hover):
 *  - desktop: glass dropdowns under "Photography" and "Projects"
 *  - mobile:  full-screen glass menu behind the "Menu" button
 * Esc, outside click and route changes close them.
 *
 * Animation (GSAP): one timeline per panel. The panel fades in and slides down by `y`
 * as a whole (no per-item stagger); closing plays the same timeline in reverse, so
 * clicking again mid-animation just turns it around smoothly. Timing lives in
 * content/settings/animations.json -> transitions.menu ({ open: { duration, ease, y }, close: { duration } });
 * the close ease is the mirror of the open ease. Reduced motion: a short opacity fade only.
 *
 * Glass blur: in Chrome, opacity < 1 on an element makes it a "backdrop root", which
 * switches off the backdrop-filter of the glass ::before inside it until the fade ends
 * (the blur "pops in"). So the panel itself is never faded: its glass surface fades via
 * --glass-alpha (opacity of the ::before, which owns the backdrop-filter, see _glass.scss),
 * its content fades via its children, and it moves with a transform (not a backdrop root).
 */
import { gsap, reducedMotion } from '../lib/env.js';
import { transitions } from '../anim/engine.js';
import { lockScroll } from '../smooth.js';

const DEFAULTS = { open: { duration: 0.45, ease: 'expo.out' }, close: { duration: 0.3 } };
const timing = () => {
  const m = transitions.menu || {};
  return { open: { ...DEFAULTS.open, ...m.open }, close: { ...DEFAULTS.close, ...m.close } };
};

/**
 * Interrupt-safe show/hide of one panel.
 *  el     - element toggled with `hidden`
 *  panel  - the glass element that slides and fades (often el itself)
 *  dim    - optional overlay whose background fades in (mobile menu)
 *  yScale - multiplier for the configured y offset
 */
function createReveal({ toggle, el, panel, dim = null, yScale = 1 }) {
  let tl = null;
  let isOpen = false;
  const finish = () => {
    el.hidden = true;
  };

  function build() {
    const { open } = timing();
    const reduce = reducedMotion();
    const vars = reduce
      ? { duration: Math.min(0.2, open.duration), ease: 'none' }
      : { duration: open.duration, ease: open.ease };
    tl?.kill();
    tl = gsap.timeline({ paused: true, onReverseComplete: finish });
    if (!reduce) tl.fromTo(panel, { y: -(Number(open.y) || 0) * yScale }, { y: 0, ...vars }, 0);
    const menuItemDefault = transitions.menuItem;
    // tl.fromTo(toggle , { ...menuItemDefault.close }, { ...menuItemDefault.open, ...vars }, 0);
    tl.fromTo(panel, { '--glass-alpha': 0 }, { '--glass-alpha': 1, ...vars }, 0);
    tl.fromTo([...panel.children], { opacity: 0 }, { opacity: 1, ...vars }, 0);
    if (dim)
      tl.fromTo(
        dim,
        { backgroundColor: 'rgba(0, 0, 0, 0)' },
        { backgroundColor: 'rgba(0, 0, 0, 0.35)', ...vars },
        0,
      );
  }

  return {
    el,
    get open() {
      return isOpen;
    },
    show() {
      if (isOpen) return;
      isOpen = true;
      el.hidden = false;
      // Fully closed: rebuild, so edited timing and reduced-motion changes apply.
      if (!tl || tl.progress() === 0) build();
      tl.timeScale(1).play();
    },
    hide(instant = false) {
      if (!isOpen) return;
      isOpen = false;
      const { close } = timing();
      const duration = reducedMotion() ? Math.min(0.2, close.duration) : close.duration;
      if (!tl || instant || !duration || tl.progress() === 0) {
        tl?.pause(0);
        finish();
        return;
      }
      // Reverse from wherever it is now, at the speed that makes a full close take `duration`.
      tl.timeScale(tl.duration() / duration).reverse();
    },
  };
}

// ---------------------------------------------------------------- desktop dropdowns
const dropdowns = new Map(); // toggle -> reveal
let openToggle = null;

function dropdownFor(toggle) {
  if (!dropdowns.has(toggle)) {
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    console.log(toggle);
    dropdowns.set(toggle, createReveal({ toggle, el: panel, panel }));
  }
  return dropdowns.get(toggle);
}

function showDropdown(toggle) {
  // Switching between dropdowns: the other one goes away at once (they share one spot).
  if (openToggle && openToggle !== toggle) hideDropdown({ instant: true });
  openToggle = toggle;
  toggle.setAttribute('aria-expanded', 'true');
  dropdownFor(toggle).show();
}

function hideDropdown({ instant = false, focusToggle = false } = {}) {
  if (!openToggle) return;
  const toggle = openToggle;
  openToggle = null;
  toggle.setAttribute('aria-expanded', 'false');
  const reveal = dropdownFor(toggle);
  // Don't leave keyboard focus inside a panel that is being hidden.
  if (focusToggle || reveal.el.contains(document.activeElement)) toggle.focus();
  reveal.hide(instant);
}

// ---------------------------------------------------------------- mobile menu
let mobile = null;

function setMobile(open, { focusToggle = false } = {}) {
  const menu = document.querySelector('[data-mobile-menu]');
  const btn = document.querySelector('[data-menu-toggle]');
  if (!menu || !btn) return;
  mobile ||= createReveal({
    el: menu,
    panel: menu.querySelector('.mmenu__panel'),
    dim: menu,
    yScale: 2,
  });
  if (open === mobile.open) return;
  btn.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('menu-open', open);
  const label = btn.querySelector('.menu-toggle__label');
  const textEl = label?.querySelector('span') || label;
  if (textEl) {
    if (open) {
      label.dataset.closedText = textEl.textContent;
      textEl.textContent = label.dataset.openLabel || 'Close';
    } else {
      textEl.textContent = label.dataset.closedText || 'Menu';
    }
  }
  lockScroll(open);
  if (open) {
    mobile.show();
  } else {
    if (focusToggle || menu.contains(document.activeElement)) btn.focus();
    mobile.hide();
  }
}

export function closeMenus() {
  hideDropdown();
  setMobile(false);
}

export function initMenu() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openToggle === toggle) hideDropdown();
      else showDropdown(toggle);
    });
  });
  document
    .querySelector('[data-menu-toggle]')
    ?.addEventListener('click', () => setMobile(!mobile?.open));
  document.addEventListener('click', (e) => {
    if (openToggle && !dropdownFor(openToggle).el.contains(e.target)) hideDropdown();
    // Mobile: a click on the dimmed area around the panel closes the menu.
    if (mobile?.open && e.target.matches?.('[data-mobile-menu]')) setMobile(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openToggle) hideDropdown({ focusToggle: true });
    if (mobile?.open) setMobile(false, { focusToggle: true });
  });
  window
    .matchMedia('(min-width: 900px)')
    .addEventListener('change', (m) => m.matches && setMobile(false));
}

/** Highlight the nav item for the current path. */
export function updateActiveNav(pathname) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.nav === pathname);
    if (a.dataset.nav === pathname) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-nav-section]').forEach((b) => {
    const active = b.dataset.navSection.split(',').some((p) => pathname.startsWith(p));
    b.classList.toggle('is-active', active);
  });
}
