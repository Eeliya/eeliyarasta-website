/**
 * The editor's one sideways slide (ContentPanel's Sections panes, the pages list's levels,
 * the pages list and a page's view): 0.35s power2.out, the width of what slides; reduced
 * motion: none.
 *
 * Swapping a view for another (a pages list level for the next, the list for a page):
 *   const play = swapView(host, [old elements]);   // before the old view goes (a copy of it)
 *   …the new view renders…
 *   play([new elements], dir);   // dir 1: the new comes in from the right (going in), -1: back
 * The copy lies over the old view's place in `host` (positioned, clipping) and slides out
 * while the new one slides in: nothing moves but by transforms. A new swap in the same host
 * ends a running one at once.
 */
import { gsap } from 'gsap';

export const SLIDE = { duration: 0.35, ease: 'power2.out' };

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap(); // host → end the slide in it now

export function swapView(host, els) {
  running.get(host)?.();
  els = els.filter(Boolean);
  if (!host || !els.length || still()) return () => {};
  const h = host.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'absolute',
    inset: '0 auto auto 0',
    zIndex: '4',
    pointerEvents: 'none',
  });
  const scrolled = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const copy = el.cloneNode(true);
    for (const n of [copy, ...copy.querySelectorAll('[id]')]) n.removeAttribute('id');
    Object.assign(copy.style, {
      position: 'absolute',
      margin: '0',
      boxSizing: 'border-box',
      left: `${r.left - h.left - host.clientLeft + host.scrollLeft}px`,
      top: `${r.top - h.top - host.clientTop + host.scrollTop}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    ghost.append(copy);
    if (el.scrollTop) scrolled.push([copy, el.scrollTop]);
  }
  return (next, dir = 1) => {
    next = next.filter(Boolean);
    host.append(ghost);
    for (const [copy, top] of scrolled) copy.scrollTop = top;
    const w = host.clientWidth;
    const tl = gsap
      .timeline({ defaults: SLIDE, onComplete: () => end() })
      .to(ghost, { x: -dir * w }, 0)
      .fromTo(next, { x: dir * w }, { x: 0 }, 0);
    function end() {
      tl.kill();
      ghost.remove();
      gsap.set(next, { clearProps: 'transform' });
      running.delete(host);
    }
    running.set(host, end);
  };
}
