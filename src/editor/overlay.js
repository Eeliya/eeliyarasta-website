/**
 * The layout overlay, drawn in the preview over the page (in its own Shadow DOM, so neither
 * the site's styles nor the editor's reach it):
 *
 *   Grid      the square cells (120 columns, the phone grid's 60, and its rows, all one
 *             --cell: src/site/layout/flow.js) of the selected block's section only, while a
 *             block is selected (and so while it is dragged or resized), from the section's
 *             own computed grid: faint white lines, every 5th a little stronger. Nothing
 *             selected: no grid
 *   Arrange   always on in the Content tab: a click picks a block (the block inspector opens),
 *             a click on empty space (no block, handle, circle or link line) or Esc (main /
 *             App.svelte) drops the selection (the panel shows the sections again),
 *             a drag moves it and the handles on its edges and corners resize it; a double
 *             click edits a text in place (bridge.js), the page's own clicks are off. A drag
 *             snaps to the cells and shows its area live (the block's CSS variables, and the
 *             blocks that follow it move along); on release it is one edit, one undo step
 *             (onplace), which also stores where the section's other blocks are now (their
 *             real rows). A linked block dragged up or down keeps its link: its gap changes.
 *             Esc cancels. Below 760px (the mobile preview) a drag edits the block's phone
 *             area, on the phone grid of 60 columns (a block without one shows its desktop
 *             area halved: that is where the drag starts). An aspect or auto block's rows
 *             follow its width: only its sides resize.
 *   Links     the selected and the hovered block show a circle above their top edge and one
 *             below their bottom edge. Dragging a block's top circle onto another block's
 *             bottom circle (in its section; blocks that would make a loop show none) links
 *             it: it follows that block, keeping where it is (the gap: the rows between them
 *             now, negative when they overlap); dropped anywhere else, a linked block is free
 *             again (onlink). A line joins every leader's bottom to its followers' tops; a
 *             click on one selects that link, Delete or Backspace removes it. The phone
 *             preview shows and edits the phone links.
 *   Rows      a Custom height section shows a line on its bottom edge (the hovered section's,
 *             or the selected block's): dragged up or down it sets the section's rows, in
 *             whole cells, never fewer than its content needs, the count shown live; on
 *             release one undo step (onrows). On the phone preview it sets the section's own
 *             phone rows (mobile.rows.min; without them: half the desktop rows, rounded up).
 *             A block dragged or resized past a Custom section's bottom: on release its rows
 *             become the content's (onplace's rows), so moving it back up leaves empty rows.
 *
 * A block is where the site's rows.js put it (--fr / --frs: a linked block below its leader,
 * auto and aspect blocks the rows they need), so a drag starts from there; while it runs the
 * page holds its rows (data-flow-hold on <html>).
 *
 * The overlay follows the page with a frame loop while it shows something; it reads `ui`
 * (mode, block, link) every frame, and the section metrics once per drag, so the grid
 * doesn't move under the pointer while the page reflows.
 */
import { COLS, MAX_MIN_ROWS, MCOLS, makesLoop, sizeOf } from '../site/layout/index.js';
import { resolveRows } from '../site/layout/flow.js';
import {
  flowAreas,
  linesOf,
  linkOfEl as linkAttr,
  nearest,
  rectOf,
  tracksOf,
} from '../site/layout/geometry.js';
import { PHONE_MAX } from '../site/layout/grid.js';
import { T } from './ui-tokens.js';

const MOBILE = PHONE_MAX;
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
/** How far a link circle sits outside its block's edge, px (clear of the n / s handles). */
const DOT = 12;
/** How near the pointer must come to a bottom circle to drop a link on it, px. */
const REACH = 24;
const SVG = 'http://www.w3.org/2000/svg';
/** The room a section's name tag needs above its top edge, px; less: the tag goes inside. */
const TAG_ROOM = 24;

const STYLE = `
:host { all: initial; }
.layer { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; font: 500 ${T.fsXs}/1 ${T.font}; }
.grid { position: absolute; box-sizing: border-box; }
.cells { position: absolute; background-image: linear-gradient(to right, rgb(255 255 255 / .12) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / .12) 1px, transparent 1px), linear-gradient(to right, rgb(255 255 255 / .06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / .06) 1px, transparent 1px); box-shadow: inset -1px -1px 0 rgb(255 255 255 / .12); }
.box { position: absolute; box-sizing: border-box; border-radius: ${T.radiusXs}; }
.hover { border: 1px dashed ${T.white}; opacity: .7; }
.peek { border-radius: 0; border: 1px solid ${T.peekLine}; }
.peek .tag { position: absolute; left: -1px; bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: rgb(255 255 255 / .9); color: ${T.black}; white-space: nowrap; }
.peek.is-inside .tag { left: 4px; top: 4px; bottom: auto; margin: 0; }
.dim { position: absolute; background: rgb(0 0 0 / .4); }
.sel { border: 2px solid ${T.accent}; }
.sel.is-dragging { background: ${T.accent}; background: rgb(${T.accentRgb} / .08); }
.label { position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: ${T.accent}; color: ${T.black}; white-space: nowrap; }
.handle { position: absolute; width: 12px; height: 12px; translate: -50% -50%; box-sizing: border-box; border: 2px solid ${T.accent}; border-radius: ${T.radiusXs}; background: ${T.black}; pointer-events: auto; }
.handle[data-h='n'], .handle[data-h='s'] { left: 50%; cursor: ns-resize; }
.handle[data-h='e'], .handle[data-h='w'] { top: 50%; cursor: ew-resize; }
.handle[data-h='n'], .handle[data-h='ne'], .handle[data-h='nw'] { top: 0; }
.handle[data-h='s'], .handle[data-h='se'], .handle[data-h='sw'] { top: 100%; }
.handle[data-h='w'], .handle[data-h='nw'], .handle[data-h='sw'] { left: 0; }
.handle[data-h='e'], .handle[data-h='ne'], .handle[data-h='se'] { left: 100%; }
.handle[data-h='ne'], .handle[data-h='sw'] { cursor: nesw-resize; }
.handle[data-h='nw'], .handle[data-h='se'] { cursor: nwse-resize; }
.sel.is-free .handle:not([data-h='e']):not([data-h='w']) { display: none; }
.dot { position: absolute; left: 50%; width: 12px; height: 12px; translate: -50% -50%; box-sizing: border-box; border: 2px solid ${T.accent}; border-radius: 50%; background: ${T.black}; pointer-events: auto; }
.dot[data-dot='top'] { top: -${DOT}px; cursor: grab; }
.dot[data-dot='bottom'] { top: calc(100% + ${DOT}px); }
.dot.is-linked { background: ${T.accent}; }
.hover .dot { opacity: 1; }
.sel.is-dragging .dot, .is-linking .box .dot { display: none; }
.target { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; box-sizing: border-box; border: 2px solid ${T.accent}; border-radius: 50%; background: ${T.black}; }
.target.is-near { background: ${T.accent}; box-shadow: 0 0 0 4px rgb(${T.accentRgb} / .35); }
.secrow { position: absolute; height: 12px; translate: 0 -50%; pointer-events: auto; cursor: row-resize; }
.secrow::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 0; border-top: 2px solid rgb(255 255 255 / .75); translate: 0 -50%; box-shadow: 0 0 0 1px rgb(0 0 0 / .35); }
.secrow::after { content: ''; position: absolute; left: 50%; top: 50%; width: 36px; height: 8px; translate: -50% -50%; box-sizing: border-box; border-radius: ${T.radiusSm}; background: ${T.white}; box-shadow: 0 0 0 1px rgb(0 0 0 / .45); }
.secrow:hover::before, .secrow.is-dragging::before { border-top-color: ${T.white}; }
.secrow .count { position: absolute; left: calc(50% + 28px); bottom: 100%; margin-bottom: 4px; padding: 4px 8px; border-radius: ${T.radiusSm}; background: ${T.white}; color: ${T.black}; white-space: nowrap; }
.secrow:not(.is-dragging) .count { display: none; }
svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.link { fill: none; stroke: ${T.accent}; stroke-width: 2; }
.link.is-sel { stroke: ${T.white}; stroke-width: 3; }
.link.is-temp { stroke-dasharray: 4 4; }
.hit { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
.gap { fill: ${T.accent}; font: 500 ${T.fsXs} ${T.font}; paint-order: stroke; stroke: ${T.black}; stroke-width: 3px; }
`;

/**
 * onpick(id): a block was clicked; onplace(id, pos, { mobile, flow, rows }): a drag ended with
 * the block at `pos` (mobile: its phone area; flow: where the section's blocks are now, { id:
 * area }, and rows: the rows its content needs now); onlink(id, to, gap, { mobile }): block `id` follows `to`
 * with `gap` cells between them (to null: it is free again); blockOf(id): the stored block
 * (null when it isn't on the page); secNameOf(id): a section's name for its tag ("Section N"
 * without one); onrows(secId, rows, { mobile }): a Custom section's bottom
 * edge was dragged to `rows` (the phone's rows when mobile).
 */
export function createOverlay({
  ui,
  onpick,
  onplace,
  onlink = () => {},
  onrows = () => {},
  blockOf,
  secNameOf = () => '',
}) {
  let doc = null;
  let win = null;
  let root = null; // the shadow root's layer
  let raf = 0;
  let drag = null;
  let linking = null;
  let hover = null;
  let hoverSec = null;
  let sizing = null; // a section's bottom edge being dragged
  let gridKey = '';
  const els = {};

  const arranging = () => ui.mode === 'text';
  const shown = () => doc && arranging();
  const mobile = () => win.innerWidth <= MOBILE;
  const blockEl = (id) => (id ? doc.querySelector(`[data-block="${CSS.escape(id)}"]`) : null);
  const secOf = (el) => el?.closest('[data-sec]');
  /** Is a section editable now: the footer's while it is open, the page's while no site part is. */
  const live = (sec) =>
    !doc.querySelector('[data-header][data-ed-open]') &&
    !!sec.closest('[data-footer]') === !!doc.querySelector('[data-footer][data-ed-open]');
  const secById = (id) => doc.querySelector(`[data-sec="${CSS.escape(id)}"]:not([hidden])`);
  /** The section under the pointer in the preview: its row in the Content tab shows it. */
  const peekAt = (sec) => {
    const id = sec?.dataset.sec;
    if (id) {
      if (ui.peek?.id !== id || ui.peek.from !== 'preview') ui.peek = { id, from: 'preview' };
    } else if (ui.peek?.from === 'preview') ui.peek = null;
  };
  const unpeek = () => peekAt(null);
  /** The block elements of a section (not a nested section's). */
  const blocksIn = (sec) =>
    [...sec.querySelectorAll('[data-block]')].filter((n) => secOf(n) === sec);
  /** The link a block element follows on the grid shown: { to, gap } or null. */
  const linkOfEl = (el) => linkAttr(el, mobile());

  function build() {
    const host = doc.createElement('div');
    host.id = '__ed-layout';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;';
    const shadow = host.attachShadow({ mode: 'open' });
    const dots = '<i class="dot" data-dot="top"></i><i class="dot" data-dot="bottom"></i>';
    shadow.innerHTML = `<style>${STYLE}</style><div class="layer"><div class="grids"></div><svg class="links" xmlns="${SVG}"></svg><div class="dims"></div><div class="box peek" hidden><span class="tag"></span></div><div class="secrow" hidden><span class="count"></span></div><div class="box hover" hidden>${dots}</div><div class="box sel" hidden><span class="label"></span>${HANDLES.map((h) => `<i class="handle" data-h="${h}"></i>`).join('')}${dots}</div><div class="targets"></div></div>`;
    root = shadow.querySelector('.layer');
    els.grids = root.querySelector('.grids');
    els.links = root.querySelector('.links');
    els.hover = root.querySelector('.hover');
    els.peek = root.querySelector('.peek');
    els.tag = root.querySelector('.tag');
    els.dims = root.querySelector('.dims');
    els.sel = root.querySelector('.sel');
    els.label = root.querySelector('.label');
    els.targets = root.querySelector('.targets');
    els.secrow = root.querySelector('.secrow');
    els.count = root.querySelector('.count');
    shadow.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest?.('.secrow')) return startRows(e);
      const h = e.target.dataset?.h;
      if (h && ui.block) return start(e, blockEl(ui.block), h);
      const dot = e.target.dataset?.dot;
      if (dot === 'top') {
        const el = e.target.closest('.sel') ? blockEl(ui.block) : hover;
        if (el) {
          onpick(el.dataset.block);
          startLink(e, el);
        }
        return;
      }
      const link = e.target.dataset?.link;
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        ui.link = link;
        if (!raf) raf = win.requestAnimationFrame(frame);
      }
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

  /**
   * The grid of the selected (or dragged) block's section, none without one: rebuilt when that
   * section, its size or its tracks change.
   */
  function drawGrids() {
    const sec = arranging() ? drag?.sec || secOf(blockEl(ui.block)) : null;
    const secs = sec && !sec.hidden ? [sec] : [];
    const info = secs.map((sec) => {
      const cs = win.getComputedStyle(sec);
      return { sec, cs, r: rectOf(sec, win) };
    });
    const key = info
      .map(({ sec, cs, r }) =>
        [sec.dataset.sec, r.x, r.y, r.w, r.h, cs.gridTemplateColumns, cs.gridTemplateRows].join(),
      )
      .join('|');
    if (`${secs.length}:${key}` === gridKey) return;
    gridKey = `${secs.length}:${key}`;
    els.grids.replaceChildren(
      ...info.map(({ cs, r }) => {
        const g = doc.createElement('div');
        g.className = 'grid';
        place(g, r);
        // the cells: the tracks as they are laid out (centred in the content box: the few px
        // a whole number of cells leaves over), a line every cell and a stronger one every 5th
        const t = tracksOf(cs, r);
        const cell = t.cols[0] || 8;
        const c = doc.createElement('div');
        c.className = 'cells';
        place(c, t);
        c.style.backgroundSize = `${cell * 5}px ${cell * 5}px, ${cell * 5}px ${cell * 5}px, ${cell}px ${cell}px, ${cell}px ${cell}px`;
        g.append(c);
        return g;
      }),
    );
  }

  /** A link's line from a leader's bottom circle to a follower's top circle (page px). */
  const curve = (x1, y1, x2, y2) => {
    const k = Math.max(16, Math.abs(y2 - y1) / 2);
    return `M${x1} ${y1}C${x1} ${y1 + k} ${x2} ${y2 - k} ${x2} ${y2}`;
  };
  const bottomDot = (r) => [r.x + r.w / 2, r.y + r.h + DOT];
  const topDot = (r) => [r.x + r.w / 2, r.y - DOT];

  /** The links of the shown sections as lines (and the one being dragged). */
  function drawLinks() {
    const parts = [];
    const h = doc.documentElement;
    els.links.setAttribute('width', h.scrollWidth);
    els.links.setAttribute('height', h.scrollHeight);
    if (arranging())
      for (const sec of doc.querySelectorAll('[data-sec]:not([hidden])'))
        for (const el of live(sec) ? blocksIn(sec) : []) {
          const l = linkOfEl(el);
          if (!l || el.hidden || linking?.el === el) continue;
          const lead = blocksIn(sec).find((n) => n.dataset.block === l.to);
          if (!lead || lead.hidden) continue;
          const [x1, y1] = bottomDot(rectOf(lead, win));
          const [x2, y2] = topDot(rectOf(el, win));
          const id = el.dataset.block;
          const d = curve(x1, y1, x2, y2);
          const near = [ui.block, ui.link].includes(id) || ui.block === l.to;
          parts.push(
            `<path class="link${ui.link === id ? ' is-sel' : ''}" d="${d}"/>` +
              `<path class="hit" data-link="${id}" d="${d}"/>` +
              (near
                ? `<text class="gap" x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 + 3}">gap ${l.gap}</text>`
                : ''),
          );
        }
    if (linking?.to)
      parts.push(`<path class="link is-temp" d="${curve(...linking.to, ...linking.from)}"/>`);
    const html = parts.join('');
    if (els.links.innerHTML !== html) els.links.innerHTML = html;
  }

  const labelOf = (b, el) => {
    const l = el && linkOfEl(el);
    return `${mobile() ? 'phone · ' : ''}${b?.type || 'block'}${l ? ` · follows, gap ${l.gap}` : ''}`;
  };

  /** The top circle shows filled when the block follows another. */
  function dotsOf(box, el) {
    box.querySelector('[data-dot="top"]').classList.toggle('is-linked', !!(el && linkOfEl(el)));
  }

  /**
   * The section card hovered in the Content tab (`sec`, null: none): a soft white 1px line on
   * its section and its name in a tag above its top edge, left (just inside it when there is
   * no room above, e.g. the first section); the page's other sections dimmed to 60% by dark
   * boxes over them. All on this layer: the page's own styles don't change (no reflow).
   */
  function drawPeek(sec) {
    els.peek.hidden = !sec;
    const others = sec
      ? [...doc.querySelectorAll('[data-sec]:not([hidden])')].filter(
          (s) => s !== sec && live(s) && !s.parentElement.closest('[data-sec]'),
        )
      : [];
    const dims = els.dims.children;
    while (dims.length > others.length) dims[dims.length - 1].remove();
    while (dims.length < others.length) els.dims.append(doc.createElement('div'));
    others.forEach((s, i) => {
      dims[i].className = 'dim';
      place(dims[i], rectOf(s, win));
    });
    if (!sec) return;
    const r = rectOf(sec, win);
    place(els.peek, r);
    els.peek.classList.toggle('is-inside', r.y - win.scrollY < TAG_ROOM);
    const name = secNameOf(sec.dataset.sec);
    els.tag.hidden = !name;
    if (els.tag.textContent !== name) els.tag.textContent = name;
  }

  function frame() {
    raf = 0;
    if (!root?.isConnected) return;
    drawGrids();
    drawLinks();
    const arrange = arranging();
    root.classList.toggle('is-linking', !!linking);
    const sel = arrange ? blockEl(ui.block) : null;
    els.sel.hidden = !sel;
    if (sel) {
      place(els.sel, rectOf(sel, win));
      const b = blockOf(ui.block);
      els.sel.classList.toggle('is-free', sizeOf(b) !== 'rows');
      els.label.textContent = drag?.label ?? labelOf(b, sel);
      dotsOf(els.sel, sel);
    }
    // the section card hovered in the Content tab: its section (under the block boxes)
    const p = arrange && !drag && ui.peek?.from === 'panel' ? secById(ui.peek.id) : null;
    drawPeek(p);
    // a Custom section's bottom edge: the one being dragged, hovered, or the selected block's
    const rs =
      arrange && !drag && !linking
        ? sizing?.sec || customOf(hoverSec) || customOf(secOf(sel))
        : null;
    els.secrow.hidden = !rs;
    if (rs) {
      const r = rectOf(rs, win);
      place(els.secrow, { x: r.x, y: r.y + r.h, w: r.w, h: 12 });
      els.secrow.classList.toggle('is-dragging', !!sizing);
      if (sizing) els.count.textContent = `${sizing.phone ? 'phone · ' : ''}${sizing.rows} rows`;
    }
    const h = arrange && hover !== sel && !drag ? hover : null;
    els.hover.hidden = !h;
    if (h) {
      place(els.hover, rectOf(h, win));
      dotsOf(els.hover, h);
    }
    if (shown()) raf = win.requestAnimationFrame(frame);
  }

  /** A drag of block `el`: move (h empty) or a resize by handle `h`. */
  function start(e, el, h = '') {
    const id = el?.dataset.block;
    const stored = blockOf(id);
    if (!stored) return;
    e.preventDefault();
    e.stopPropagation();
    ui.link = null;
    const sec = secOf(el);
    const phone = mobile();
    const saved = new Map([sec, ...blocksIn(sec)].map((n) => [n, n.style.cssText]));
    // where the section's blocks are now (stored with the drag), then hold them there
    const flow = flowAreas(sec, phone, blockOf);
    const rows = Number(sec.style.getPropertyValue('--frows')) || 0;
    doc.documentElement.setAttribute('data-flow-hold', '');
    const from = flow[id];
    // the section's blocks and links, to move the blocks that follow this one along
    const items = blocksIn(sec)
      .filter((n) => flow[n.dataset.block])
      .map((n) => ({
        id: n.dataset.block,
        el: n,
        ...flow[n.dataset.block],
        link: n === el ? null : linkOfEl(n),
      }));
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
      saved,
      cols: phone ? MCOLS : COLS,
      lines: linesOf(sec, win),
      flow,
      items,
      link: linkOfEl(el),
      label: null,
      rows: rows || Number(sec.style.getPropertyValue(phone ? '--mrows' : '--rows')) || 1,
      // a Custom section keeps its rows (never fewer: its blocks move inside them)
      min: minOf(sec, phone),
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

  /**
   * Show `pos` on the block without storing it: the blocks that follow it move along, the
   * section's rows grow to hold them, and a linked block's label shows its gap.
   */
  function show(p) {
    setArea(drag.el.style, p, drag.phone);
    const items = drag.items.map((it) => (it.id === drag.id ? { ...it, ...p } : it));
    const { rows, at } = resolveRows(items, 1);
    for (const it of drag.items)
      if (it.id !== drag.id && at[it.id]) it.el.style.setProperty('--fr', at[it.id].row);
    // its content's rows (a Custom section grows to them on release: onplace's rows)
    drag.content = Math.max(rows, p.row + p.rows - 1);
    drag.sec.style.setProperty('--frows', Math.max(drag.min, drag.rows, drag.content));
    if (drag.link) {
      const lead = at[drag.link.to];
      if (lead) drag.label = `${drag.phone ? 'phone · ' : ''}gap ${p.row - (lead.row + lead.rows)}`;
    }
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
  }

  function end() {
    const { id, from, pos, phone, flow } = drag;
    const rows = drag.content || 0;
    const moved = ['col', 'span', 'row', 'rows'].some((k) => pos[k] !== from[k]);
    if (!moved) restore(); // a click changes nothing
    stop();
    drag = null;
    if (moved) onplace(id, pos, { mobile: phone, flow, rows });
  }

  function cancel(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    restore();
    stop();
    drag = null;
  }

  // ---- a Custom section's rows: its bottom edge dragged

  /** A section's own rows (Custom height; the phone's on the phone), 0 for any other. */
  function minOf(sec, phone) {
    return parseInt(sec?.style.getPropertyValue(phone ? '--mminrows' : '--minrows'), 10) || 0;
  }
  // custom on the grid shown (the phone's height on the phone: its --mminrows)
  const customOf = (sec) => (sec && !sec.hidden && minOf(sec, mobile()) ? sec : null);

  function startRows(e) {
    const sec = customOf(hoverSec) || customOf(secOf(blockEl(ui.block)));
    if (!sec || drag || linking) return;
    e.preventDefault();
    e.stopPropagation();
    const phone = mobile();
    const flow = flowAreas(sec, phone, blockOf);
    // the rows its content needs: down to its lowest block, as rows.js placed them
    const content = Math.max(1, ...Object.values(flow).map((a) => a.row + a.rows - 1));
    const rows = Number(sec.style.getPropertyValue('--frows')) || minOf(sec, phone) || content;
    const lines = linesOf(sec, win);
    doc.documentElement.setAttribute('data-flow-hold', '');
    sizing = {
      sec,
      phone,
      content,
      from: rows,
      rows,
      y: e.clientY,
      step: lines.row + lines.rowGap,
      saved: [sec.style.cssText, phone ? '--mminrows' : '--minrows'],
      max: phone ? Math.ceil(MAX_MIN_ROWS / 2) : MAX_MIN_ROWS,
    };
    ui.secRows = { id: sec.dataset.sec, rows, phone };
    win.addEventListener('pointermove', moveRows, true);
    win.addEventListener('pointerup', endRows, true);
    win.addEventListener('keydown', cancelRows, true);
    if (!raf) raf = win.requestAnimationFrame(frame);
  }

  function moveRows(e) {
    const s = sizing;
    const n = Math.min(s.max, Math.max(s.content, Math.round(s.from + (e.clientY - s.y) / s.step)));
    if (n === s.rows) return;
    s.rows = n;
    s.sec.style.setProperty('--frows', n);
    s.sec.style.setProperty(s.saved[1], n);
    ui.secRows = { id: s.sec.dataset.sec, rows: n, phone: s.phone };
  }

  function stopRows() {
    doc.documentElement.removeAttribute('data-flow-hold');
    win.removeEventListener('pointermove', moveRows, true);
    win.removeEventListener('pointerup', endRows, true);
    win.removeEventListener('keydown', cancelRows, true);
    sizing = null;
    ui.secRows = null;
  }

  function endRows() {
    const { sec, rows, from, phone } = sizing;
    if (rows === from) sec.style.cssText = sizing.saved[0];
    stopRows();
    if (rows !== from) onrows(sec.dataset.sec, rows, { mobile: phone });
  }

  function cancelRows(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    sizing.sec.style.cssText = sizing.saved[0];
    stopRows();
  }

  // ---- links: a drag from a block's top circle to another block's bottom circle

  /** Start dragging block `el`'s top circle: the blocks it may follow show bottom circles. */
  function startLink(e, el) {
    e.preventDefault();
    e.stopPropagation();
    ui.link = null;
    const id = el.dataset.block;
    const sec = secOf(el);
    const phone = mobile();
    const blocks = blocksIn(sec)
      .map((n) => blockOf(n.dataset.block))
      .filter(Boolean);
    const targets = blocksIn(sec)
      .filter((n) => n !== el && !n.hidden && !makesLoop(blocks, id, n.dataset.block, phone))
      .map((n) => {
        const [x, y] = bottomDot(rectOf(n, win));
        const dot = doc.createElement('i');
        dot.className = 'target';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        return { id: n.dataset.block, x, y, dot };
      });
    els.targets.replaceChildren(...targets.map((t) => t.dot));
    linking = { el, id, sec, phone, targets, near: null, from: topDot(rectOf(el, win)), to: null };
    win.addEventListener('pointermove', moveLink, true);
    win.addEventListener('pointerup', endLink, true);
    win.addEventListener('keydown', cancelLink, true);
    if (!raf) raf = win.requestAnimationFrame(frame);
  }

  function moveLink(e) {
    const p = [e.clientX + win.scrollX, e.clientY + win.scrollY];
    let near = null;
    let best = REACH;
    for (const t of linking.targets) {
      const d = Math.hypot(t.x - p[0], t.y - p[1]);
      if (d <= best) {
        best = d;
        near = t;
      }
    }
    for (const t of linking.targets) t.dot.classList.toggle('is-near', t === near);
    linking.near = near;
    linking.to = near ? [near.x, near.y] : p;
  }

  function stopLink() {
    win.removeEventListener('pointermove', moveLink, true);
    win.removeEventListener('pointerup', endLink, true);
    win.removeEventListener('keydown', cancelLink, true);
    els.targets.replaceChildren();
    linking = null;
  }

  function endLink() {
    const { el, id, sec, phone, near } = linking;
    const was = linkOfEl(el);
    stopLink();
    if (near) {
      // it stays where it is: the gap is the rows between them now
      const flow = flowAreas(sec, phone, blockOf);
      const a = flow[near.id];
      const b = flow[id];
      if (a && b && (was?.to !== near.id || was.gap !== b.row - (a.row + a.rows)))
        onlink(id, near.id, b.row - (a.row + a.rows), { mobile: phone });
    } else if (was) onlink(id, null, 0, { mobile: phone, row: shownRow(el) }); // dropped off: free
  }

  // the row a block shows now (rows.js: --fr): an unlinked block stays there
  const shownRow = (el) => parseInt(el.style.getPropertyValue('--fr'), 10) || undefined;

  function cancelLink(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    stopLink();
  }

  /** Delete or Backspace with a link selected: that link removed. */
  function deleteLink() {
    const id = ui.link;
    if (!id) return false;
    ui.link = null;
    const el = blockEl(id);
    if (el && linkOfEl(el)) onlink(id, null, 0, { mobile: mobile(), row: shownRow(el) });
    return true;
  }
  function onkeydown(e) {
    if (!['Delete', 'Backspace'].includes(e.key) || !ui.link || editing(e.target)) return;
    if (e.target.closest?.('input, textarea, select')) return;
    e.preventDefault();
    deleteLink();
  }

  // Arrange: clicks pick and drag blocks; the page's own clicks (links, buttons) are off. A
  // text being edited in place (contenteditable, bridge.js) keeps its clicks (the caret).
  const editing = (t) => !!t.closest?.('[contenteditable]');
  function onpointerdown(e) {
    if (e.target.id === '__ed-layout') return; // the overlay's own (its shadow root handles it)
    if (!arranging() || e.button !== 0 || e.altKey || editing(e.target)) return;
    ui.link = null;
    const el = e.target.closest?.('[data-block]');
    // empty space: nothing selected (the panel shows the sections, the grid hides)
    if (!el) return void (ui.block && onpick(null));
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
    if (e.target.id === '__ed-layout') return; // over its circles: the block stays hovered
    hover = arranging() ? e.target.closest?.('[data-block]') || null : null;
    hoverSec = arranging() ? secOf(e.target) || null : null;
    if (e.target.id !== '__ed-layout') peekAt(arranging() ? secOf(e.target) : null);
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
      doc.documentElement.addEventListener('pointerleave', unpeek);
      doc.addEventListener('keydown', onkeydown, true);
      this.refresh();
    },
    /** ui.mode, ui.block or ui.link changed: show or hide what they ask for. */
    refresh() {
      if (!doc || !root) return;
      gridKey = '';
      if (!shown()) els.grids.replaceChildren();
      if (!raf) raf = win.requestAnimationFrame(frame);
    },
    /** The editor's Delete with a link selected (its focus outside the preview). */
    deleteLink,
  };
}
