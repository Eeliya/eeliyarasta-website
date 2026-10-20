/**
 * Fit to block (src/site/layout/type.js: scale.fit, a block of fixed height): its text as
 * large as fits the block's box, as --tkf on the block (the scaled text's factor,
 * _layout.scss). Worked out on load and whenever the block resizes or its text changes
 * (fonts loading, the editor's typing): at most once a frame, a binary search of a few
 * measurements, starting near its last fit, and nothing when its text and box are the same.
 */
const FIT = '.blk--fit';
const MIN = 0.05;
const MAX = 20;

/** Does the block's content fit its box at its current --tkf? (width too: long words) */
function fits(el, body) {
  return body.scrollHeight <= el.clientHeight + 0.5 && body.scrollWidth <= el.clientWidth + 0.5;
}

/**
 * The largest factor k (MIN..MAX, within 1%) for which fitsAt(k) holds, by a geometric binary
 * search; `guess` (the last fit's) narrows it to a few measurements when little changed.
 */
export function searchFit(fitsAt, guess) {
  let lo = MIN;
  let hi = MAX;
  if (guess) {
    const a = Math.max(MIN, guess / 1.5);
    const b = Math.min(MAX, guess * 1.5);
    if (fitsAt(a)) {
      lo = a;
      if (!fitsAt(b)) hi = b;
      else lo = b;
    } else hi = a;
  }
  while (hi / lo > 1.01) {
    const mid = Math.sqrt(lo * hi);
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 100) / 100 || MIN;
}

// a block's last fit: what it was measured with (its text, its box) and its factor
const cache = new WeakMap();

/** The largest --tkf (2 decimals) at which the block's text fits; only when it changed. */
export function fitOne(el) {
  const body = el.querySelector('.text__body') || el.firstElementChild;
  if (!body || !el.clientHeight) return;
  const key = `${el.clientWidth}x${el.clientHeight}|${body.innerHTML}`;
  const last = cache.get(el);
  if (last?.key === key && el.style.getPropertyValue('--tkf')) return;
  const k = searchFit((t) => {
    el.style.setProperty('--tkf', t.toFixed(3));
    return fits(el, body);
  }, last?.k);
  el.style.setProperty('--tkf', k.toFixed(2));
  cache.set(el, { key, k });
}

export function fitText(view) {
  let raf = 0;
  const dirty = new Set();
  const run = () => {
    raf = 0;
    for (const el of dirty) {
      if (el.isConnected && el.matches(FIT)) fitOne(el);
      else if (!el.isConnected) ro.unobserve(el); // gone (a section rendered again)
    }
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
      // removed fitted blocks: no longer observed
      for (const n of m.removedNodes || [])
        if (n.nodeType === 1) {
          if (n.matches(FIT)) ro.unobserve(n);
          n.querySelectorAll?.(FIT).forEach((b) => ro.unobserve(b));
        }
      if (m.type === 'attributes' && t?.matches?.('.blk')) {
        if (t.matches(FIT)) {
          ro.observe(t);
          queue(t);
        } else if (t.style.getPropertyValue('--tkf')) t.style.removeProperty('--tkf');
      }
    }
  });
  // (fonts loaded: every block measured again, its text and box the same or not)
  const watch = (again) =>
    view.querySelectorAll(FIT).forEach((el) => {
      if (again) cache.delete(el);
      ro.observe(el);
      queue(el);
    });
  watch();
  mo.observe(view, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  document.fonts?.ready.then(() => watch(true));
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    mo.disconnect();
  };
}
