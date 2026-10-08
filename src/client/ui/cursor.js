/**
 * Custom cursor label: a small dot follows the pointer; over any [data-cursor]
 * element it morphs into a glass pill showing that label ("View · Noor Vermeer").
 * Desktop (fine pointer) only; the native cursor stays everywhere else.
 */
import { gsap, finePointer, reducedMotion } from '../lib/env.js';
import { interactions } from '../anim/engine.js';

export function initCursor() {
  const el = document.querySelector('.cursor');
  if (!el || !finePointer()) return;
  const label = el.querySelector('.cursor__label');
  const follow = reducedMotion() ? 0 : interactions.cursor?.follow ?? 0.18;
  const xTo = gsap.quickTo(el, 'x', { duration: follow, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: follow, ease: 'power3' });
  let current = null;
  document.documentElement.classList.add('has-cursor');

  window.addEventListener('pointermove', (e) => {
    if (!el.classList.contains('is-visible')) {
      gsap.set(el, { x: e.clientX, y: e.clientY });
      el.classList.add('is-visible');
    }
    xTo(e.clientX);
    yTo(e.clientY);
    const target = e.target.closest?.('[data-cursor]');
    if (target !== current) {
      current = target;
      if (target) {
        label.textContent = target.dataset.cursor;
        el.classList.add('is-label');
      } else {
        el.classList.remove('is-label');
      }
    }
  }, { passive: true });

  document.addEventListener('pointerleave', () => el.classList.remove('is-visible'));
  window.addEventListener('blur', () => el.classList.remove('is-visible'));
}

/** Reset label state (after page swaps). */
export function resetCursor() {
  document.querySelector('.cursor')?.classList.remove('is-label');
}
