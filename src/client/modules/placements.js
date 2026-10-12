// Unused in content as of 2026-10-12 (no block sets `place`): a deletion candidate.
/**
 * Block placements that CSS can't do alone (src/client/styles/_layout.scss has the rest):
 *   pinned          .blk--pinned (above 760px) / .blk--m-pinned (phones): pinned with
 *                   ScrollTrigger from when its top reaches --stick-top (below the header, as
 *                   sticky blocks) until its section's end
 *                   has scrolled up to its bottom (no spacing added: the section is its range).
 *                   Not with prefers-reduced-motion: it stays in the flow then.
 *   sticky centred  .blk--sticky.blk--v-center: its height as --bh, to centre it on screen.
 */
import { gsap, ScrollTrigger } from '../lib/env.js';

const DESKTOP = '(min-width: 761px)';
const PHONE = '(max-width: 760px)';

/** --stick-top in px (a calc() of the header's height and --edge, so resolved by a probe). */
function offsetOf() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;top:var(--stick-top)';
  document.body.append(probe);
  const top = parseFloat(getComputedStyle(probe).top) || 0;
  probe.remove();
  return top;
}

function pins(view, selector) {
  const triggers = [...view.querySelectorAll(selector)].map((el) => {
    const sec = el.closest('.sec') || el.parentElement;
    return ScrollTrigger.create({
      trigger: el,
      pin: true,
      pinSpacing: false,
      start: () => `top top+=${offsetOf()}`,
      endTrigger: sec,
      end: () => `bottom top+=${offsetOf() + el.offsetHeight}`,
      invalidateOnRefresh: true,
    });
  });
  // the pin's spacer takes the block's place in the grid
  view.querySelectorAll(selector).forEach((el) => {
    const spacer = el.parentElement;
    if (!spacer?.classList.contains('pin-spacer')) return;
    const cs = getComputedStyle(el);
    spacer.style.gridColumn = cs.gridColumn;
    spacer.style.gridRow = cs.gridRow;
    spacer.style.alignSelf = 'start';
    spacer.style.zIndex = cs.zIndex;
  });
  return () => triggers.forEach((t) => t.kill(true));
}

export function placements(view) {
  const mm = gsap.matchMedia();
  mm.add(`${DESKTOP} and (prefers-reduced-motion: no-preference)`, () =>
    pins(view, '.blk--pinned'),
  );
  mm.add(`${PHONE} and (prefers-reduced-motion: no-preference)`, () =>
    pins(view, '.blk--m-pinned'),
  );
  const centred = [
    ...view.querySelectorAll('.blk--sticky.blk--v-center, .blk--m-sticky.blk--m-v-center'),
  ];
  const ro = centred.length
    ? new ResizeObserver((entries) =>
        entries.forEach((e) => e.target.style.setProperty('--bh', `${e.target.offsetHeight}px`)),
      )
    : null;
  centred.forEach((el) => ro.observe(el));
  return () => {
    mm.revert();
    ro?.disconnect();
  };
}
