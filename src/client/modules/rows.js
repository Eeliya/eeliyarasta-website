/**
 * The square grid's cell: every section's content width is measured and --cell (width / 120,
 * the phone grid's / 60; floored to 1/64px, cellOf) set on it, before its rows are worked
 * out, on load and whenever the section resizes (ResizeObserver, window resize; both
 * rAF-throttled: at most one flow per frame). A column and a row are both --cell: the cells are square.
 *
 * Real rows (src/site/layout/flow.js): measures every block of the view's sections and sets
 * where it sits and how many rows it spans now, as --fr / --frs on the block and --frows on
 * the section (_layout.scss reads them over the stored --r / --rs / --rows, or on the phone
 * grid --mr / --mrs / --mrows). The stored area is what the page renders with before this
 * runs (and without JS).
 *
 * Measured: an auto block's height as its content makes it (`.sec--measure` lets every block
 * be as tall as its content for that read), or an aspect block's width × ratio; a fixed-rows
 * block keeps its rows. Then the links (src/site/layout/links.js, data-link / data-mlink on
 * the block: "<leader id> <gap>") are resolved in their order: a follower's first row is its
 * leader's last row now + 1 + its gap; a free block stays at its stored row. Run again when
 * the window resizes (on the next frame, at most once a frame while dragging), when a block's
 * content changes size (images, fonts, the editor's edits; on the next frame) and on reflow()
 * (the editor after it changed a layout).
 *
 * A section with a minimum height (a third, half or all of the screen: sec--h-*) is at least so
 * tall: a block that fits in it doesn't make it taller by rounding up to a whole row (it gets
 * the whole rows that fit; rows stay square, so a screen-high block's rows may be up to a cell
 * short of the screen, its content still is).
 */
import { resolveRows, rowsFor } from '../../site/layout/flow.js';
import { COLS, MCOLS, PHONE_MQ, cellOf } from '../../site/layout/grid.js';

const PHONE = PHONE_MQ;
const VARS = ['--fr', '--frs'];
const SECTION_VARS = ['--frows'];

/** The blocks of a section: its children. */
const blocksOf = (sec) => [...sec.children].filter((n) => n.matches('.blk'));

const int = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** A block's stored area on the layout that applies (the phone grid's, or the desktop's). */
function areaOf(el, phone) {
  const s = el.style;
  if (phone) {
    return {
      col: int(s.getPropertyValue('--mc'), 1),
      span: int(s.getPropertyValue('--ms'), MCOLS),
      row: int(s.getPropertyValue('--mr'), 1),
      rows: int(s.getPropertyValue('--mrs'), 1),
    };
  }
  return {
    col: int(s.getPropertyValue('--c'), 1),
    span: int(s.getPropertyValue('--s'), COLS),
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

/** The link a block's element follows on this grid: { to, gap } or null (free). */
function linkOfEl(el, phone) {
  const v = phone ? el.dataset.mlink : el.dataset.link;
  const m = v && /^(\S+)\s+(-?\d+)$/.exec(v);
  return m ? { to: m[1], gap: Number(m[2]) } : null;
}

/** A section's content width now (its used width inside padding and border; 0 when hidden). */
function widthOf(cs) {
  let width = parseFloat(cs.width) || 0; // its used width (not transformed, not rounded)
  if (cs.boxSizing === 'border-box')
    width -=
      parseFloat(cs.paddingLeft) +
      parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) +
      parseFloat(cs.borderRightWidth);
  return width;
}

/** The height a section has at least (its min-height), inside its padding (else Infinity). */
function minHeightOf(sec, cs) {
  const min = parseFloat(cs.minHeight); // 'auto' (fit): NaN
  if (!(min > 0)) return Infinity;
  return min - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}

/** A section's blocks as they measure now (inside .sec--measure): the items resolveRows takes. */
function readSection(sec, phone, row) {
  const cs = getComputedStyle(sec);
  const avail = minHeightOf(sec, cs);
  const cap = Math.floor(avail / row + 0.01);
  const items = [];
  const els = new Map();
  for (const el of blocksOf(sec)) {
    if (el.hidden) continue;
    const area = areaOf(el, phone);
    const id = el.dataset.block || `b${els.size}`;
    const kind = el.classList.contains('blk--aspect')
      ? 'aspect'
      : el.classList.contains('blk--auto')
        ? 'auto'
        : 'rows';
    const h = el.getBoundingClientRect().height;
    let fit = rowsFor(h, row);
    // it fits the section's minimum height: not taller than the rows that holds
    if (h <= avail + 0.5) fit = Math.min(fit, Math.max(1, cap - area.row + 1));
    // fixed rows: its own, whatever its content
    const need = kind === 'rows' ? null : fit;
    items.push({ id, ...area, need, link: linkOfEl(el, phone) });
    els.set(id, el);
  }
  return { items, els };
}

/** Write a section's resolved rows; true when something moved. */
function writeSection(sec, phone, { items, els }) {
  // a custom height: exactly its rows, or its content's when that needs more (the empty rows
  // below its last block don't stack on top of a grown block's)
  const min = parseInt(sec.style.getPropertyValue(phone ? '--mminrows' : '--minrows'), 10) || 0;
  const stored = min
    ? 1
    : parseInt(sec.style.getPropertyValue(phone ? '--mrows' : '--rows'), 10) || 1;
  const resolved = resolveRows(items, stored);
  const { at } = resolved;
  let changed = set(sec, '--frows', Math.max(resolved.rows, min));
  for (const [id, el] of els) {
    const a = at[id];
    if (set(el, '--fr', a.row)) changed = true;
    if (set(el, '--frs', a.rows)) changed = true;
  }
  return changed;
}

/**
 * Flow every section of `root`; true when something moved. In passes, so the page is laid out
 * about once, not once per section: read every width, write every --cell; measure every block
 * (all sections in .sec--measure at once); write every row.
 */
function flowAll(root = document) {
  if (document.documentElement.hasAttribute('data-flow-hold')) return false;
  const phone = matchMedia(PHONE).matches;
  let changed = false;
  const secs = [];
  for (const sec of root.querySelectorAll('.sec')) {
    if (sec.hidden) changed = clear(sec) || changed;
    else secs.push({ sec });
  }
  // 1. cells: read every width, then write
  for (const s of secs) s.cell = cellOf(widthOf(getComputedStyle(s.sec)), phone ? MCOLS : COLS);
  for (const s of secs) if (s.cell && set(s.sec, '--cell', `${s.cell}px`)) changed = true;
  // 2. measure: every section's blocks as tall as their content, read in one go
  for (const s of secs) s.sec.classList.add('sec--measure');
  for (const s of secs) {
    // no width now (hidden by an ancestor): its last cell, else a guess (it measures 0 anyway)
    const row = s.cell || parseFloat(getComputedStyle(s.sec).getPropertyValue('--cell')) || 8;
    s.read = readSection(s.sec, phone, row);
  }
  for (const s of secs) s.sec.classList.remove('sec--measure');
  // 3. write the rows
  for (const s of secs) if (writeSection(s.sec, phone, s.read)) changed = true;
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
  // throttled: at most one flow per frame while the window is resized; the last resize event's
  // frame flows the final size
  const onresize = later;
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
