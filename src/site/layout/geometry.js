/**
 * Layout geometry shared by the site's rows.js and the editor's overlay: a widget element's
 * stored area and link, where rows.js placed it (--fr / --frs), and a section's grid tracks and
 * lines in page coordinates. Pure reads of elements and computed styles; no layout writes.
 */
import { COLS, MCOLS, baseOf, halfArea, phoneAreaOf, placeOf } from './grid.js';

export { halfArea, phoneAreaOf };

const int = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** A link attribute ("<leader id> <gap>", data-link / data-mlink) as { to, gap }, else null. */
export function parseLink(v) {
  const m = v && /^(\S+)\s+(-?\d+)$/.exec(v);
  return m ? { to: m[1], gap: Number(m[2]) } : null;
}

/** The link a widget's element follows on this grid: { to, gap } or null (free). */
export const linkOfEl = (el, phone) => parseLink(phone ? el.dataset.mlink : el.dataset.link);

/** A widget element's stored area on the layout that applies (the phone grid's, or the desktop's). */
export function areaOfEl(el, phone) {
  const s = el.style;
  const [c, sp, r, rs] = phone ? ['--mc', '--ms', '--mr', '--mrs'] : ['--c', '--s', '--r', '--rs'];
  return {
    col: int(s.getPropertyValue(c), 1),
    span: int(s.getPropertyValue(sp), phone ? MCOLS : COLS),
    row: int(s.getPropertyValue(r), 1),
    rows: int(s.getPropertyValue(rs), 1),
  };
}

/** A section's content width now (its used width inside padding and border; 0 when hidden). */
export function widthOf(cs) {
  let width = parseFloat(cs.width) || 0; // its used width (not transformed, not rounded)
  if (cs.boxSizing === 'border-box')
    width -=
      parseFloat(cs.paddingLeft) +
      parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) +
      parseFloat(cs.borderRightWidth);
  return width;
}

/**
 * Where the widgets of a section are now, as rows.js placed them (--fr / --frs over the stored
 * area): { id: area } (the phone grid's on the phone: a widget's own phone area, or its desktop
 * area halved). widgetOf(id): the widget's model.
 */
export function flowAreas(sec, phone, widgetOf) {
  const out = {};
  for (const el of sec.querySelectorAll('[data-widget]')) {
    if (el.closest('[data-sec]') !== sec) continue;
    const b = widgetOf(el.dataset.widget);
    if (!b) continue;
    const stored = phone ? phoneAreaOf(b) : placeOf(baseOf(b));
    const row = parseInt(el.style.getPropertyValue('--fr'), 10);
    const rows = parseInt(el.style.getPropertyValue('--frs'), 10);
    out[el.dataset.widget] = { ...stored, ...(row > 0 && rows > 0 ? { row, rows } : {}) };
  }
  return out;
}

/** The page-relative rect of an element. */
export function rectOf(el, win) {
  const r = el.getBoundingClientRect();
  return { x: r.left + win.scrollX, y: r.top + win.scrollY, w: r.width, h: r.height };
}

const px = (v) => v.split(' ').map(parseFloat).filter(Number.isFinite);

/** Where free space goes before the tracks: 0 (start), 0.5 (center) or 1 (end). */
const share = (v) => (/center/.test(v) ? 0.5 : /end/.test(v) ? 1 : 0);

/**
 * A section's tracks, relative to its border box: x, y their top left corner (the content box
 * corner, moved by the free space justify-content / align-content give before them: the
 * square grid centres its columns, a screen section its rows), w, h their size, and the sizes.
 */
export function tracksOf(cs, r) {
  const cols = px(cs.gridTemplateColumns);
  const rows = px(cs.gridTemplateRows);
  const sum = (l) => l.reduce((a, b) => a + b, 0);
  const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
  const pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
  const pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
  const pb = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  const gx = parseFloat(cs.columnGap) || 0;
  const gy = parseFloat(cs.rowGap) || 0;
  const w = sum(cols) + gx * Math.max(0, cols.length - 1);
  const h = sum(rows) + gy * Math.max(0, rows.length - 1);
  return {
    x: pl + Math.max(0, r.w - pl - pr - w) * share(cs.justifyContent),
    y: pt + Math.max(0, r.h - pt - pb - h) * share(cs.alignContent),
    w,
    h,
    cols,
    rows,
  };
}

/** Track edges from `start`: starts[k] / ends[k] of track k + 1, `gap` between tracks. */
export function edgesOf(start, sizes, gap) {
  const starts = [];
  const ends = [];
  let at = start;
  for (const size of sizes) {
    starts.push(at);
    ends.push(at + size);
    at += size + gap;
  }
  return { starts, ends };
}

/**
 * A section's grid lines in page coordinates: cols.starts[k] / cols.ends[k] the left / right
 * edge of column k + 1; rows likewise; row the cell (a row past the last track).
 */
export function linesOf(sec, win) {
  const cs = win.getComputedStyle(sec);
  const r = rectOf(sec, win);
  const gap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const row = parseFloat(cs.getPropertyValue('--cell')) || 8;
  const t = tracksOf(cs, r);
  const cols = edgesOf(r.x + t.x, t.cols, gap);
  const rows = edgesOf(r.y + t.y, t.rows, rowGap);
  return { cols, rows, row, rowGap };
}

/** The 1-based index of the line in `starts` (or `ends`) nearest to `v`; past the end in steps of `step`. */
export function nearest(list, v, step) {
  let best = 0;
  list.forEach((p, i) => {
    if (Math.abs(p - v) < Math.abs(list[best] - v)) best = i;
  });
  const last = list.at(-1);
  if (step && v > last + step / 2) return list.length + Math.round((v - last) / step);
  return best + 1;
}
