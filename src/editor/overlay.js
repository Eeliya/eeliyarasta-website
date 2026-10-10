/**
 * The layout overlay, drawn in the preview over the page (in its own Shadow DOM, so neither
 * the site's styles nor the editor's reach it):
 *
 *   Grid      every section's 24 columns and its rows, from the section's own computed grid
 *             (its real, uniform rows: src/site/layout/flow.js)
 *   Arrange   always on in the Content tab: a click picks a block (the block inspector opens),
 *             a drag moves it and the handles on its edges and corners resize it; a double
 *             click edits a text in place (bridge.js), the page's own clicks are off. A drag
 *             snaps to the columns and rows and shows its area live (the block's CSS
 *             variables); on release it is one edit, one undo step (onplace), which also stores
 *             where the section's other blocks are now (their real rows). Esc cancels.
 *             Below 760px (the mobile preview) a drag edits the block's phone area, on the
 *             phone grid of 12 columns: in a section whose blocks still stack, the first drag
 *             turns the stack into that grid, every block keeping the place it had (measured).
 *             An aspect or auto block's rows follow its width: only its sides resize.
 *
 * A block is where the site's rows.js put it (--fr / --frs: its stored row moved by the
 * blocks above that grew or shrank), so a drag starts from there; while it runs the page
 * holds its rows (data-flow-hold on <html>).
 *
 * The overlay follows the page with a frame loop while it shows something; it reads `ui`
 * (mode, grid, block) every frame, and the section metrics once per drag, so the grid
 * doesn't move under the pointer while the page reflows.
 */
import { COLS, MCOLS, hasMobileArea, placeOf, sizeOf } from '../site/layout/index.js';
import { rowsFor } from '../site/layout/flow.js';

const MOBILE = 760;
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const STYLE = `
:host { all: initial; }
.layer { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; font: 500 10px/1 'DM Mono', ui-monospace, monospace; }
.grid { position: absolute; display: grid; box-sizing: border-box; }
.col { grid-row: 1 / -1; background: #3cf; opacity: .08; }
.row { grid-column: 1 / -1; border-top: 1px solid #3cf; opacity: .25; }
.box { position: absolute; box-sizing: border-box; border-radius: 2px; }
.hover { border: 1px dashed #fff; opacity: .7; }
.sel { border: 2px solid #3cf; }
.sel.is-dragging { background: #3cf; background: rgb(51 204 255 / .08); }
.label { position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: 4px; background: #3cf; color: #000; white-space: nowrap; }
.handle { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; box-sizing: border-box; border: 2px solid #3cf; border-radius: 2px; background: #000; pointer-events: auto; }
.handle[data-h='n'], .handle[data-h='s'] { left: 50%; cursor: ns-resize; }
.handle[data-h='e'], .handle[data-h='w'] { top: 50%; cursor: ew-resize; }
.handle[data-h='n'], .handle[data-h='ne'], .handle[data-h='nw'] { top: 0; }
.handle[data-h='s'], .handle[data-h='se'], .handle[data-h='sw'] { top: 100%; }
.handle[data-h='w'], .handle[data-h='nw'], .handle[data-h='sw'] { left: 0; }
.handle[data-h='e'], .handle[data-h='ne'], .handle[data-h='se'] { left: 100%; }
.handle[data-h='ne'], .handle[data-h='sw'] { cursor: nesw-resize; }
.handle[data-h='nw'], .handle[data-h='se'] { cursor: nwse-resize; }
.sel.is-free .handle:not([data-h='e']):not([data-h='w']) { display: none; }
`;

/**
 * Where a stacking section's blocks are on the phone, as phone-grid areas (12 columns, rows of
 * the row height): { id: area }. Used to turn the stack into a grid without moving anything.
 */
export function stackAreas(sec, win) {
  const cs = win.getComputedStyle(sec);
  const row = parseFloat(cs.getPropertyValue('--grid-row')) || 8;
  const top = sec.getBoundingClientRect().top + parseFloat(cs.paddingTop);
  const out = {};
  for (const el of sec.querySelectorAll('[data-block]')) {
    if (el.closest('[data-sec]') !== sec) continue;
    const r = el.getBoundingClientRect();
    out[el.dataset.block] = {
      col: 1,
      span: MCOLS,
      row: Math.max(1, Math.round((r.top - top) / row) + 1),
      rows: rowsFor(r.height, row), // as the site's rows.js counts them
    };
  }
  return out;
}

/**
 * Where the blocks of a section are now, as the site's rows.js placed them: { id: area }
 * (the phone grid's on the phone; blocks it didn't place keep their stored area).
 */
export function flowAreas(sec, phone, blockOf) {
  const out = {};
  for (const el of sec.querySelectorAll('[data-block]')) {
    if (el.closest('[data-sec]') !== sec) continue;
    const b = blockOf(el.dataset.block);
    if (!b) continue;
    const stored = phone
      ? hasMobileArea(b.mobile)
        ? placeOf(b.mobile, MCOLS)
        : null
      : placeOf(b.pos);
    if (!stored) continue;
    const row = parseInt(el.style.getPropertyValue('--fr'), 10);
    const rows = parseInt(el.style.getPropertyValue('--frs'), 10);
    out[el.dataset.block] = { ...stored, ...(row > 0 && rows > 0 ? { row, rows } : {}) };
  }
  return out;
}

/** The page-relative rect of an element. */
function rectOf(el, win) {
  const r = el.getBoundingClientRect();
  return { x: r.left + win.scrollX, y: r.top + win.scrollY, w: r.width, h: r.height };
}

const px = (v) => v.split(' ').map(parseFloat).filter(Number.isFinite);

/**
 * A section's grid lines in page coordinates: cols[k] / colEnds[k] the left / right edge of
 * column k + 1; rows likewise, extended past the last track by rows of `row` px.
 */
function linesOf(sec, win) {
  const cs = win.getComputedStyle(sec);
  const r = rectOf(sec, win);
  const gap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const row = parseFloat(cs.getPropertyValue('--grid-row')) || 8;
  const lines = (start, sizes, g) => {
    const starts = [];
    const ends = [];
    let at = start;
    for (const size of sizes) {
      starts.push(at);
      ends.push(at + size);
      at += size + g;
    }
    return { starts, ends };
  };
  const x0 = r.x + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
  const y0 = r.y + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
  const cols = lines(x0, px(cs.gridTemplateColumns), gap);
  const rows = lines(y0, px(cs.gridTemplateRows), rowGap);
  return { cols, rows, row, rowGap };
}

/** The 1-based index of the line in `starts` (or `ends`) nearest to `v`; past the end in steps of `step`. */
function nearest(list, v, step) {
  let best = 0;
  list.forEach((p, i) => {
    if (Math.abs(p - v) < Math.abs(list[best] - v)) best = i;
  });
  const last = list.at(-1);
  if (step && v > last + step / 2) return list.length + Math.round((v - last) / step);
  return best + 1;
}

/**
 * onpick(id): a block was clicked; onplace(id, pos, { mobile, stack, flow, rows }): a drag
 * ended with the block at `pos` (mobile: its phone area; stack: the areas of a stacking
 * section's blocks it turned into a grid; flow: where the section's blocks are now, { id:
 * area }, and rows: its rows now); blockOf(id): the stored block (null when it isn't on the
 * page).
 */
export function createOverlay({ ui, onpick, onplace, blockOf }) {
  let doc = null;
  let win = null;
  let root = null; // the shadow root's layer
  let raf = 0;
  let drag = null;
  let hover = null;
  let gridKey = '';
  const els = {};

  const arranging = () => ui.mode === 'text';
  const shown = () => doc && (arranging() || ui.grid);
  const mobile = () => win.innerWidth <= MOBILE;
  const blockEl = (id) => (id ? doc.querySelector(`[data-block="${CSS.escape(id)}"]`) : null);

  function build() {
    const host = doc.createElement('div');
    host.id = '__ed-layout';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${STYLE}</style><div class="layer"><div class="grids"></div><div class="box hover" hidden></div><div class="box sel" hidden><span class="label"></span>${HANDLES.map((h) => `<i class="handle" data-h="${h}"></i>`).join('')}</div></div>`;
    root = shadow.querySelector('.layer');
    els.grids = root.querySelector('.grids');
    els.hover = root.querySelector('.hover');
    els.sel = root.querySelector('.sel');
    els.label = root.querySelector('.label');
    shadow.addEventListener('pointerdown', (e) => {
      const h = e.target.dataset?.h;
      if (h && ui.block) start(e, blockEl(ui.block), h);
    });
    doc.body.appendChild(host);
    return host;
  }

  const place = (box, r) => {
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    box.style.width = `${r.w}px`;
    box.style.height = `${r.h}px`;
  };

  /** The sections' grids: rebuilt when a section's size or tracks change. */
  function drawGrids() {
    const secs = ui.grid ? [...doc.querySelectorAll('[data-sec]:not([hidden])')] : [];
    const info = secs.map((sec) => {
      const cs = win.getComputedStyle(sec);
      return { sec, cs, r: rectOf(sec, win) };
    });
    const key = info
      .map(({ cs, r }) => [r.x, r.y, r.w, r.h, cs.gridTemplateColumns, cs.gridTemplateRows].join())
      .join('|');
    if (key === gridKey) return;
    gridKey = key;
    els.grids.replaceChildren(
      ...info.map(({ cs, r }) => {
        const g = doc.createElement('div');
        g.className = 'grid';
        place(g, r);
        g.style.padding = cs.padding;
        g.style.gridTemplateColumns = cs.gridTemplateColumns;
        g.style.gridTemplateRows = cs.gridTemplateRows;
        g.style.columnGap = cs.columnGap;
        g.style.rowGap = cs.rowGap;
        const n = px(cs.gridTemplateRows).length;
        const cols = px(cs.gridTemplateColumns).length;
        g.innerHTML =
          '<i class="col"></i>'.repeat(cols) +
          Array.from({ length: n }, (_, i) => `<i class="row" style="grid-row:${i + 1}"></i>`).join(
            '',
          );
        return g;
      }),
    );
  }

  const labelOf = (b) => `${mobile() ? 'phone · ' : ''}${b?.type || 'block'}`;

  function frame() {
    raf = 0;
    if (!root?.isConnected) return;
    drawGrids();
    const arrange = arranging();
    const sel = arrange ? blockEl(ui.block) : null;
    els.sel.hidden = !sel;
    if (sel) {
      place(els.sel, rectOf(sel, win));
      const b = blockOf(ui.block);
      els.sel.classList.toggle('is-free', sizeOf(b) !== 'rows');
      els.label.textContent = labelOf(b);
    }
    const h = arrange && hover !== sel ? hover : null;
    els.hover.hidden = !h;
    if (h) place(els.hover, rectOf(h, win));
    if (shown()) raf = win.requestAnimationFrame(frame);
  }

  /** A drag of block `el`: move (h empty) or a resize by handle `h`. */
  function start(e, el, h = '') {
    const id = el?.dataset.block;
    const stored = blockOf(id);
    if (!stored) return;
    e.preventDefault();
    e.stopPropagation();
    const sec = el.closest('[data-sec]');
    const phone = mobile();
    // a stacking section on the phone: shown as the grid it becomes, the blocks where they are
    const stack = phone && !sec.classList.contains('sec--mgrid') ? stackAreas(sec, win) : null;
    const saved = new Map(
      [sec, ...sec.querySelectorAll('[data-block]')].map((n) => [n, n.style.cssText]),
    );
    // where the section's blocks are now (stored with the drag), then hold them there
    const flow = stack ? null : flowAreas(sec, phone, blockOf);
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    doc.documentElement.setAttribute('data-flow-hold', '');
    const savedClass = sec.className;
    if (stack) {
      sec.classList.add('sec--mgrid');
      let rows = 1;
      for (const [bid, a] of Object.entries(stack)) {
        const n = sec.querySelector(`[data-block="${CSS.escape(bid)}"]`);
        setArea(n.style, a, true);
        rows = Math.max(rows, a.row + a.rows - 1);
      }
      sec.style.setProperty('--mrows', rows);
    }
    const from = stack ? stack[id] : flow[id];
    drag = {
      id,
      el,
      sec,
      h,
      from,
      pos: from,
      x: e.clientX,
      y: e.clientY,
      phone,
      stack,
      saved,
      savedClass,
      cols: phone ? MCOLS : COLS,
      lines: linesOf(sec, win),
      flow,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
    };
    els.sel.classList.add('is-dragging');
    win.addEventListener('pointermove', move, true);
    win.addEventListener('pointerup', end, true);
    win.addEventListener('keydown', cancel, true);
  }

  function move(e) {
    const { lines, from, h } = drag;
    const { cols, rows, row, rowGap } = lines;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const step = row + rowGap;
    const colStart = cols.starts[from.col - 1];
    const colEnd = cols.ends[from.col + from.span - 2];
    const rowStart =
      rows.starts[from.row - 1] ?? rows.ends.at(-1) + (from.row - rows.starts.length) * step;
    const rowEnd =
      rows.ends[from.row + from.rows - 2] ??
      rows.ends.at(-1) + (from.row + from.rows - 1 - rows.ends.length) * step;
    let { col, span, row: r, rows: n } = from;
    const free = sizeOf(blockOf(drag.id)) !== 'rows';
    if (!h) {
      col = Math.min(Math.max(1, nearest(cols.starts, colStart + dx)), drag.cols - span + 1);
      r = Math.max(1, nearest(rows.starts, rowStart + dy, step));
    }
    if (h.includes('e')) span = Math.max(1, nearest(cols.ends, colEnd + dx) - col + 1);
    if (h.includes('w')) {
      const end = from.col + from.span - 1;
      col = Math.min(nearest(cols.starts, colStart + dx), end);
      span = end - col + 1;
    }
    if (h.includes('s') && !free) n = Math.max(1, nearest(rows.ends, rowEnd + dy, step) - r + 1);
    if (h.includes('n') && !free) {
      const end = from.row + from.rows - 1;
      r = Math.min(Math.max(1, nearest(rows.starts, rowStart + dy, step)), end);
      n = end - r + 1;
    }
    drag.pos = { col, span: Math.min(span, drag.cols - col + 1), row: r, rows: n };
    show(drag.pos);
  }

  /** An area as a block's CSS variables (desktop, or the phone's; and where it is now). */
  function setArea(s, p, phone) {
    s.setProperty(phone ? '--mc' : '--c', p.col);
    s.setProperty(phone ? '--ms' : '--s', p.span);
    s.setProperty(phone ? '--mr' : '--r', p.row);
    s.setProperty(phone ? '--mrs' : '--rs', p.rows);
    s.setProperty('--fr', p.row);
    s.setProperty('--frs', p.rows);
  }

  /** Show `pos` on the block (and grow the section's rows to hold it) without storing it. */
  function show(p) {
    setArea(drag.el.style, p, drag.phone);
    drag.sec.style.setProperty('--frows', Math.max(drag.rows, p.row + p.rows - 1));
  }

  function stop() {
    doc.documentElement.removeAttribute('data-flow-hold');
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', end, true);
    win.removeEventListener('keydown', cancel, true);
    els.sel.classList.remove('is-dragging');
  }

  /** The section and its blocks as they were before the drag. */
  function restore() {
    for (const [n, css] of drag.saved) n.style.cssText = css;
    drag.sec.className = drag.savedClass;
  }

  function end() {
    const { id, from, pos, phone, stack, flow, rows } = drag;
    const moved = ['col', 'span', 'row', 'rows'].some((k) => pos[k] !== from[k]);
    if (!moved) restore(); // a click changes nothing
    stop();
    drag = null;
    if (moved) onplace(id, pos, { mobile: phone, stack: stack || {}, flow: flow || {}, rows });
  }

  function cancel(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restore();
    stop();
    drag = null;
  }

  // Arrange: clicks pick and drag blocks; the page's own clicks (links, buttons) are off. A
  // text being edited in place (contenteditable, bridge.js) keeps its clicks (the caret).
  const editing = (t) => !!t.closest?.('[contenteditable]');
  function onpointerdown(e) {
    if (!arranging() || e.button !== 0 || e.altKey || editing(e.target)) return;
    const el = e.target.closest?.('[data-block]');
    if (!el) return;
    if (doc.activeElement?.isContentEditable) doc.activeElement.blur(); // ends an edit
    onpick(el.dataset.block);
    start(e, el);
  }
  const swallow = (e) => {
    if (!arranging() || e.altKey || editing(e.target)) return;
    if (e.target.closest?.('[data-block]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  function onpointerover(e) {
    hover = arranging() ? e.target.closest?.('[data-block]') || null : null;
  }

  return {
    /** The preview loaded a document. */
    attach(siteWin) {
      win = siteWin;
      doc = siteWin.document;
      gridKey = '';
      build();
      doc.addEventListener('pointerdown', onpointerdown, true);
      doc.addEventListener('mousedown', swallow, true);
      doc.addEventListener('click', swallow, true);
      doc.addEventListener('pointerover', onpointerover, true);
      this.refresh();
    },
    /** ui.mode, ui.grid or ui.block changed: show or hide what they ask for. */
    refresh() {
      if (!doc || !root) return;
      gridKey = '';
      if (!ui.grid) els.grids.replaceChildren();
      if (!raf) raf = win.requestAnimationFrame(frame);
    },
  };
}
