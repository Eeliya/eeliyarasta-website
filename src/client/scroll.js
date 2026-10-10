/**
 * Scrolling helpers. The page scrolls natively; every ScrollTrigger (reveals, parallax)
 * reads the window's scroll position. Reduced motion jumps instead of gliding.
 */
import { ScrollTrigger, reducedMotion } from './lib/env.js';

/** Native scroll behavior for an animated scroll: none for reduced motion. */
const behavior = () => (reducedMotion() ? 'instant' : 'smooth');
/** Space kept above an element scrolled to, for the fixed header. */
const OFFSET = 120;

export function scrollToTop(instant = true) {
  window.scrollTo({ top: 0, behavior: instant ? 'instant' : behavior() });
}

export function scrollToEl(el) {
  if (!el) return;
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - OFFSET,
    behavior: behavior(),
  });
}

export function lockScroll(locked) {
  document.documentElement.classList.toggle('is-locked', locked);
}

export function refresh() {
  ScrollTrigger.refresh();
}
