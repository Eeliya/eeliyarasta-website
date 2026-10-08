/**
 * Navigation. Everything opens on CLICK (never hover):
 *  - desktop: glass dropdowns under "Photography" and "Projects"
 *  - mobile:  full-screen glass menu behind the "Menu" button
 * Esc, outside click and route changes close them.
 */
import { gsap, reducedMotion } from '../lib/env.js';
import { transitions } from '../anim/engine.js';
import { lockScroll } from '../smooth.js';

let openDropdown = null;
let mobileOpen = false;
const t = () => transitions.menu;

function showDropdown(toggle) {
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  if (openDropdown && openDropdown.toggle !== toggle) hideDropdown(true);
  toggle.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  openDropdown = { toggle, panel };
  if (reducedMotion()) return;
  gsap.killTweensOf([panel, ...panel.querySelectorAll('li, .dropdown__head, .dropdown__all')]);
  gsap.fromTo(panel, { autoAlpha: 0, y: -10, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: t().open.duration, ease: t().open.ease });
  gsap.fromTo(panel.querySelectorAll('li, .dropdown__head, .dropdown__all'), { autoAlpha: 0, y: 10 }, {
    autoAlpha: 1, y: 0, duration: t().open.duration, ease: t().open.ease, stagger: t().open.stagger, delay: 0.05,
  });
}

function hideDropdown(instant = false) {
  if (!openDropdown) return;
  const { toggle, panel } = openDropdown;
  openDropdown = null;
  toggle.setAttribute('aria-expanded', 'false');
  if (instant || reducedMotion()) {
    gsap.killTweensOf(panel);
    panel.hidden = true;
    return;
  }
  gsap.to(panel, { autoAlpha: 0, y: -6, duration: t().close.duration, ease: t().close.ease, onComplete: () => (panel.hidden = true) });
}

function setMobile(open) {
  const menu = document.querySelector('[data-mobile-menu]');
  const btn = document.querySelector('[data-menu-toggle]');
  if (!menu || open === mobileOpen) return;
  mobileOpen = open;
  btn.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('menu-open', open);
  const label = btn.querySelector('.menu-toggle__label');
  label.textContent = open ? 'Close' : 'Menu';
  lockScroll(open);
  const items = menu.querySelectorAll('[data-mm-item]');
  if (open) {
    menu.hidden = false;
    if (reducedMotion()) return;
    gsap.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    gsap.fromTo(menu.querySelector('.mmenu__panel'), { clipPath: 'inset(0% 0% 100% 0% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 0.8, ease: 'expo.out', clearProps: 'clipPath' }); // clip-path would break the glass blur
    gsap.fromTo(items, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: t().open.duration * 1.4, ease: t().open.ease, stagger: t().open.stagger * 1.5, delay: 0.1 });
  } else {
    if (reducedMotion()) return void (menu.hidden = true);
    gsap.to(menu, { autoAlpha: 0, duration: t().close.duration, ease: t().close.ease, onComplete: () => (menu.hidden = true) });
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
      if (openDropdown?.toggle === toggle) hideDropdown();
      else showDropdown(toggle);
    });
  });
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => setMobile(!mobileOpen));
  document.addEventListener('click', (e) => {
    if (openDropdown && !openDropdown.panel.contains(e.target)) hideDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openDropdown) {
      const { toggle } = openDropdown;
      hideDropdown();
      toggle.focus();
    }
    if (mobileOpen) setMobile(false);
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (m) => m.matches && setMobile(false));
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
