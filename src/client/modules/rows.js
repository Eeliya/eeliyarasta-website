/**
 * Real rows (src/site/layout/flow.js): measures every block of the view's sections and sets
 * where it sits and how many rows it spans now, as --fr / --frs on the block and --frows on
 * the section (_layout.scss reads them over the stored --r / --rs / --rows, or on the phone
 * grid --mr / --mrs / --mrows). The stored area is what the page renders with before this
 * runs (and without JS).
 *
 * Measured: a block's height as its content makes it (`.sec--measure` lets every block be as
 * tall as its content for that read), or an aspect block's width × ratio. Run again when the
 * window resizes (at once, so the new layout is in the same frame), when a block's content
 * changes size (images, fonts, the editor's edits; on the next frame) and on reflow() (the
 * editor after it changed a layout). Sections stacking on phones have no rows: nothing is set.
 *
 * A screen (or aspect) section is at least so tall: a block that fits in it doesn't make it
 * taller by rounding up to a whole row, and when its rows come within a row of its height
 * they share it out (--ffill: 1fr, every row still the same height), so a screen-high block
 * fills a screen exactly.
 */
import { flowRows, rowsFor } from '../../site/layout/flow.js';

const PHONE = '(max-width: 760px)';
const VARS = ['--fr', '--frs'];
const SECTION_VARS = ['--frows', '--ffill'];

/** The blocks of a section: its children, a pinned one inside its pin's spacer. */
const blocksOf = (sec) =>
  [...sec.children].flatMap((n) =>
    n.classList.contains('pin-spacer')
      ? [...n.children].filter((k) => k.matches('.blk'))
      : n.matches('.blk')
        ? [n]
        : [],
  );

const int = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** A block's stored area on the layout that applies (the phone's: null when it has none). */
function areaOf(el, phone) {
  const s = el.style;
  if (phone) {
    if (!s.getPropertyValue('--mr')) return null;
    return {
      col: int(s.getPropertyValue('--mc'), 1),
      span: int(s.getPropertyValue('--ms'), 12),
      row: int(s.getPropertyValue('--mr'), 1),
      rows: int(s.getPropertyValue('--mrs'), 1),
    };
  }
  return {
    col: int(s.getPropertyValue('--c'), 1),
    span: int(s.getPropertyValue('--s'), 24),
    row: int(s.getPropertyValue('--r'), 1),
    rows: int(s.getPropertyValue('--rs'), 1),
  };
}

function set(el, name, value) {
  if (el.style.getPropertyValue(name) === String(value)) return false;
  el.style.setProperty(name, value);
  return true;
}

function clear(sec) {
  let changed = false;
  for (const el of blocksOf(sec))
    for (const v of VARS)
      if (el.style.getPropertyValue(v)) {
        el.style.removeProperty(v);
        changed = true;
      }
  for (const v of SECTION_VARS)
    if (sec.style.getPropertyValue(v)) {
      sec.style.removeProperty(v);
      changed = true;
    }
  return changed;
}

/** The height a screen or aspect section has at least, inside its padding (else Infinity). */
function minHeightOf(sec, cs) {
  const screen = sec.classList.contains('sec--screen');
  const ratio = sec.classList.contains('sec--aspect')
    ? sec.style.getPropertyValue('--sar').split('/').map(Number)
    : null;
  if (!screen && !(ratio?.[0] > 0 && ratio[1] > 0)) return Infinity;
  const min = screen ? parseFloat(cs.minHeight) || 0 : (sec.clientWidth * ratio[1]) / ratio[0];
  return min - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}

/** Flow one section; true when something moved. */
export function flowSection(sec, phone = matchMedia(PHONE).matches) {
  if (document.documentElement.hasAttribute('data-flow-hold')) return false;
  if (sec.hidden || (phone && !sec.classList.contains('sec--mgrid'))) return clear(sec);
  const cs = getComputedStyle(sec);
  const row = parseFloat(cs.getPropertyValue('--grid-row')) || 8;
  const avail = minHeightOf(sec, cs);
  const cap = Math.floor(avail / row + 0.01);
  const items = [];
  const els = new Map();
  sec.classList.add('sec--measure');
  for (const el of blocksOf(sec)) {
    const area = areaOf(el, phone);
    if (!area || el.hidden) continue;
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed') continue; // fixed, fullscreen: not in the grid
    const id = el.dataset.block || `b${els.size}`;
    const kind = el.classList.contains('blk--aspect')
      ? 'aspect'
      : el.classList.contains('blk--auto')
        ? 'auto'
        : 'rows';
    // a sticky block reaches to its section's end: it keeps its rows
    const h = pos === 'sticky' ? null : el.getBoundingClientRect().height;
    let fit = h === null ? null : rowsFor(h, row);
    // it fits the screen (section): not taller than the rows the screen holds
    if (fit !== null && h <= avail + 0.5) fit = Math.min(fit, Math.max(1, cap - area.row + 1));
    const need = fit === null ? null : kind === 'rows' ? Math.max(area.rows, fit) : fit;
    items.push({ id, ...area, need });
    els.set(id, el);
  }
  sec.classList.remove('sec--measure');
  const stored = parseInt(sec.style.getPropertyValue(phone ? '--mrows' : '--rows'), 10) || 1;
  const { rows, at } = flowRows(items, stored);
  let changed = set(sec, '--frows', rows);
  const fill = Number.isFinite(avail) && rows * row > avail - row && rows * row <= avail + 0.5;
  if (fill) changed = set(sec, '--ffill', '1fr') || changed;
  else if (sec.style.getPropertyValue('--ffill')) {
    sec.style.removeProperty('--ffill');
    changed = true;
  }
  for (const [id, el] of els) {
    const a = at[id];
    changed = set(el, '--fr', a.row) | set(el, '--frs', a.rows) || changed;
    const spacer = el.parentElement;
    if (spacer?.classList.contains('pin-spacer'))
      spacer.style.gridRow = `${a.row} / span ${a.rows}`;
  }
  return changed;
}

/** Flow every section of `root`; true when something moved. */
export function flowAll(root = document) {
  const phone = matchMedia(PHONE).matches;
  let changed = false;
  for (const sec of root.querySelectorAll('.sec')) changed = flowSection(sec, phone) || changed;
  return changed;
}

/**
 * Keep the view's sections flowed while it is mounted. onchange: called after a change that
 * wasn't a window resize (ScrollTrigger.refresh: positions moved). Returns { reflow, stop }.
 */
export function watchRows(view, { onchange = () => {} } = {}) {
  let raf = 0;
  const later = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (flowAll(view)) onchange();
    });
  };
  const ro = new ResizeObserver(later);
  const observe = () => {
    ro.disconnect();
    for (const sec of view.querySelectorAll('.sec')) {
      ro.observe(sec);
      for (const el of blocksOf(sec)) for (const k of el.children) ro.observe(k);
    }
  };
  // at once (the new layout in the same frame), and again on the next frame, after any
  // viewport-relative size has settled
  const onresize = () => {
    flowAll(view);
    later();
  };
  flowAll(view);
  observe();
  window.addEventListener('resize', onresize);
  document.fonts?.ready.then(later);
  return {
    /** The editor changed sections: flow them now (and watch their new blocks). */
    reflow() {
      const changed = flowAll(view);
      observe();
      return changed;
    },
    stop() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', onresize);
    },
  };
}
