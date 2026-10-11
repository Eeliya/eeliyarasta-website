/**
 * Section anchors: a named section has its name's slug as its id (src/site/layout/index.js),
 * so /page/#our-people shows it, its top just below the fixed header (its scroll-margin-top,
 * _layout.scss).
 *
 * - Opened with the hash (a load, or a link from another page): the browser's own jump comes
 *   before modules/rows.js has laid the page out (and before fonts and images settle), so the
 *   section is kept at the top for a moment while the layout above it settles, until the
 *   reader scrolls themselves.
 * - A link to it on the same page (the router's router:hash, which stops the native jump) or
 *   back / forward between hashes: scrolls to it (gliding, or a jump with reduced motion).
 */
import { reducedMotion } from '../lib/env.js';

const SETTLE_MS = 2500;
const STOP = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/** The section the address's hash names, in `view`. */
function target(view) {
  let id = location.hash.slice(1);
  if (!id) return null;
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  return view.querySelector(`.sec[id="${CSS.escape(id)}"]`);
}

/** How far `el` is from where its anchor puts it (its top at its scroll-margin-top). */
const offset = (el) =>
  el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);

export function anchors(view) {
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    STOP.forEach((e) => window.removeEventListener(e, stop, true));
  };

  // opened with the hash: hold the section in place while the layout settles
  const settle = (el) => {
    const until = performance.now() + SETTLE_MS;
    STOP.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));
    const tick = () => {
      if (!el.isConnected || performance.now() > until) return stop();
      const d = offset(el);
      if (Math.abs(d) > 1) window.scrollTo({ top: window.scrollY + d, behavior: 'instant' });
      frame = requestAnimationFrame(tick);
    };
    tick();
  };
  const first = target(view);
  if (first) settle(first);

  // a link (or back / forward) to a section on this page
  const onHash = () => {
    stop();
    target(view)?.scrollIntoView({
      behavior: reducedMotion() ? 'instant' : 'smooth',
      block: 'start',
    });
  };
  window.addEventListener('router:hash', onHash);
  return () => {
    stop();
    window.removeEventListener('router:hash', onHash);
  };
}
