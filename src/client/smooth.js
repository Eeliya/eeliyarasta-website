/** Optional smooth scrolling via GSAP ScrollSmoother (off for reduced motion and touch). */
import { ScrollSmoother, ScrollTrigger, reducedMotion } from './lib/env.js';

let smoother = null;

export function initSmooth() {
  if (reducedMotion()) return null;
  smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.1,
    smoothTouch: false,
    effects: false,
    normalizeScroll: false,
  });
  return smoother;
}

export const getSmoother = () => smoother;

export function scrollToTop(instant = true) {
  if (smoother) smoother.scrollTo(0, !instant);
  else window.scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
}

export function scrollToEl(el) {
  if (!el) return;
  if (smoother) smoother.scrollTo(el, true, 'top 120px');
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function lockScroll(locked) {
  if (smoother) smoother.paused(locked);
  document.documentElement.classList.toggle('is-locked', locked);
}

export function refresh() {
  ScrollTrigger.refresh();
}
