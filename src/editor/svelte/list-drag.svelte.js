/**
 * A list row dragged to another place (PhotoList, ListField, SectionsList's widgets): a press
 * on its handle moves SLACK px to be a drag; then the row lifts and follows the pointer and a
 * line shows where it lands (drag-target.js, on the rows as they were when it started, plus
 * how far the panel scrolled). Letting go at its own place moves nothing, Esc ends it before
 * anything else hears it (capture: a panel or dialog stays open), and a drop only lands when
 * the list is as it was at the start (an undo or redo under it: nothing moves).
 *
 *   const d = listDrag({ lists, ondrop, ...options });
 *   d.drag            the drag now ({ at, j, dy, moving, over: { at, to, line }, …info }) or null
 *   d.grab(e, info)   on the handle's pointerdown; info: { j, at? (default 0), …anything }
 *   d.dropAt(j, at)   the drop line's class on row j of list at ('' when not there)
 *
 * Options:
 *   lists()        the lists' rows now (rowsOf / listsOf below)
 *   ondrop(d)      it landed: d.over.at / d.over.to is where (d holds the grab's info)
 *   shape()        the list as a string; a drop needs the one from the start (default: none)
 *   scroller(e)    the element to find the scrolling panel from (default: the handle)
 *   grabbing       the page's cursor is a grabbing hand while it moves (.is-grabbing)
 *   edgeScroll     near the panel's top or bottom edge the panel scrolls
 *   swallowClick   the click that ends a drag is no click (the handle opens something)
 */
import { SLACK, dropTarget } from '../drag-target.js';

const EDGE = 32; // px from the panel's top or bottom where a drag scrolls it
const SPEED = 12; // px per frame at the very edge

/** One list's rows: `el`'s children matching `sel`, as list `at`. */
export function rowsOf(el, sel, at = 0) {
  const r = el.getBoundingClientRect();
  const rows = [...el.querySelectorAll(`:scope > ${sel}`)].map((row) => {
    const b = row.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom };
  });
  return { at, top: r.top, bottom: r.bottom, rows };
}

/** The panel that scrolls `el` (its nearest scrolling ancestor). */
export function scrollerOf(el) {
  for (let n = el.parentElement; n; n = n.parentElement)
    if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight)
      return n;
  return document.scrollingElement;
}

export function listDrag(opts) {
  let drag = $state(null);
  const shape = () => opts.shape?.() ?? '';

  function grab(e, info) {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection; a click still comes when it isn't a drag
    const scroller = scrollerOf(opts.scroller?.(e) ?? e.currentTarget);
    drag = {
      at: 0,
      ...info,
      y: e.clientY,
      py: e.clientY,
      dy: 0,
      moving: false,
      over: null,
      lists: opts.lists(),
      shape: shape(),
      scroller,
      top0: scroller.scrollTop,
      raf: 0,
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('keydown', escape, true);
    scroller.addEventListener('scroll', place);
  }
  function place() {
    if (!drag) return;
    const scrolled = drag.scroller.scrollTop - drag.top0;
    const dy = drag.py - drag.y + scrolled;
    if (!drag.moving && Math.abs(dy) < SLACK) return;
    if (!drag.moving && opts.grabbing) document.documentElement.classList.add('is-grabbing');
    drag.moving = true;
    drag.dy = dy;
    drag.over = dropTarget(drag.lists, drag, drag.py + scrolled);
  }
  function follow(e) {
    drag.py = e.clientY;
    place();
    if (opts.edgeScroll && drag.moving && !drag.raf) drag.raf = requestAnimationFrame(edge);
  }
  // near the panel's top or bottom edge: scroll it (faster the closer), every frame until away
  function edge() {
    if (!drag) return;
    drag.raf = 0;
    const s = drag.scroller;
    const r =
      s === document.scrollingElement ? { top: 0, bottom: innerHeight } : s.getBoundingClientRect();
    const v =
      drag.py < r.top + EDGE
        ? -Math.ceil(((r.top + EDGE - drag.py) / EDGE) * SPEED)
        : drag.py > r.bottom - EDGE
          ? Math.ceil(((drag.py - r.bottom + EDGE) / EDGE) * SPEED)
          : 0;
    if (!v) return;
    const before = s.scrollTop;
    s.scrollTop += Math.max(-SPEED, Math.min(SPEED, v));
    if (s.scrollTop !== before) drag.raf = requestAnimationFrame(edge);
  }
  function stop() {
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', drop);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', escape, true);
    document.documentElement.classList.remove('is-grabbing');
    const d = drag;
    if (d) {
      d.scroller.removeEventListener('scroll', place);
      cancelAnimationFrame(d.raf);
    }
    drag = null;
    if (d?.moving && opts.swallowClick) {
      // a drag isn't a click: the handle's click that follows is swallowed
      const swallow = (e) => (e.stopPropagation(), e.preventDefault());
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true));
    }
    return d;
  }
  const cancel = () => stop();
  function escape(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    stop();
  }
  function drop() {
    const d = stop();
    if (!d?.moving || !d.over || d.shape !== shape()) return;
    opts.ondrop(d);
  }

  // the list goes away mid-drag (its panel closed): no listeners left behind, nothing lands
  $effect(() => () => drag && stop());

  return {
    get drag() {
      return drag;
    },
    grab,
    dropAt: (j, at = 0) =>
      drag?.moving && drag.over?.at === at && drag.over.line.j === j
        ? `is-drop-${drag.over.line.side}`
        : '',
  };
}
