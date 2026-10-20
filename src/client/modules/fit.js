/**
 * Fit to block (src/site/layout/type.js: scale.fit, a block of fixed height): its text as
 * large as fits the block's box, as --tkf on the block (the scaled text's factor,
 * _layout.scss). Worked out on load and whenever the block resizes or its text changes
 * (fonts loading, the editor's typing): at most once a frame, a binary search of a few
 * measurements.
 */
const FIT = '.blk--fit';
const MIN = 0.05;
const MAX = 20;

/** Does the block's content fit its box at its current --tkf? */
function fits(el, body) {
  return body.scrollHeight <= el.clientHeight + 0.5 && body.scrollWidth <= el.clientWidth + 0.5;
}

/** The largest --tkf (2 decimals) at which the block's text fits. */
export function fitOne(el) {
  const body = el.querySelector('.text__body') || el.firstElementChild;
  if (!body || !el.clientHeight) return;
  let lo = MIN;
  let hi = MAX;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    el.style.setProperty('--tkf', mid.toFixed(3));
    if (fits(el, body)) lo = mid;
    else hi = mid;
  }
  el.style.setProperty('--tkf', (Math.floor(lo * 100) / 100).toFixed(2));
}

export function fitText(view) {
  let raf = 0;
  const dirty = new Set();
  const run = () => {
    raf = 0;
    for (const el of dirty) if (el.isConnected && el.matches(FIT)) fitOne(el);
    dirty.clear();
  };
  const queue = (el) => {
    dirty.add(el);
    if (!raf) raf = requestAnimationFrame(run);
  };
  const ro = new ResizeObserver((entries) => entries.forEach((e) => queue(e.target)));
  // the blocks a fit turns on later (the editor's toolbar) and the text typed in them
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const el = t?.closest?.(FIT);
      if (el) queue(el);
      if (m.type === 'attributes' && t?.matches?.('.blk')) {
        if (t.matches(FIT)) {
          ro.observe(t);
          queue(t);
        } else if (t.style.getPropertyValue('--tkf')) t.style.removeProperty('--tkf');
      }
    }
  });
  const watch = () => view.querySelectorAll(FIT).forEach((el) => (ro.observe(el), queue(el)));
  watch();
  mo.observe(view, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  document.fonts?.ready.then(watch);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
  };
}
