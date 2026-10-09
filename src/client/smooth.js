/**
 * Smooth scrolling via GSAP ScrollSmoother, unless animations.json "smoothScroll" is false
 * or the visitor prefers reduced motion; touch scrolling stays native (smoothTouch: false).
 * Without it the page scrolls natively. Everything here and every ScrollTrigger (reveals,
 * parallax) works either way: they read the window's scroll position.
 */
import { ScrollSmoother, ScrollTrigger, reducedMotion } from './lib/env.js';
import { config } from './anim/engine.js';

let smoother = null;

const wanted = () => config.smoothScroll !== false && !reducedMotion();
/** Native scroll behavior for an animated scroll: none for reduced motion. */
const behavior = () => (reducedMotion() ? 'instant' : 'smooth');
/** Space kept above an element scrolled to, for the fixed header. */
const OFFSET = 120;

export function initSmooth() {
  if (!wanted()) return null;
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

/** Turn smooth scrolling on or off to match the config (editor preview), at the same position. */
export function syncSmooth() {
  if (wanted() === !!smoother) return;
  const y = smoother ? smoother.scrollTop() : window.scrollY;
  if (smoother) {
    smoother.kill();
    smoother = null;
  } else initSmooth();
  if (smoother) smoother.scrollTop(y);
  else window.scrollTo(0, y);
  ScrollTrigger.refresh();
}

export function scrollToTop(instant = true) {
  if (smoother) smoother.scrollTo(0, !instant);
  else window.scrollTo({ top: 0, behavior: instant ? 'instant' : behavior() });
}

export function scrollToEl(el) {
  if (!el) return;
  if (smoother) smoother.scrollTo(el, true, `top ${OFFSET}px`);
  else
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - OFFSET,
      behavior: behavior(),
    });
}

export function lockScroll(locked) {
  if (smoother) smoother.paused(locked);
  document.documentElement.classList.toggle('is-locked', locked);
}

export function refresh() {
  ScrollTrigger.refresh();
}
