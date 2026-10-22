/**
 * Links between widgets (src/site/layout/flow.js resolves them): widgets are free by default,
 * each where it was placed on the grid, overlapping when they meet. A widget can follow
 * another: its top at the other one's bottom plus a gap in cells (negative: they overlap),
 *
 *   "link": { "to": "b-7qpa", "gap": 2 }            (desktop)
 *   "phone": { ..., "link": { "to": "b-7qpa", "gap": -1 } }   (the phone grid's)
 *
 * so it moves when the widget it follows grows or shrinks (its content at another width).
 * One widget it follows (its leader), any number following one widget, chains; never a loop,
 * never a widget of another section. A widget without a phone area of its own (it shows its
 * desktop area halved, grid.js phoneAreaOf) follows its desktop link there too, the gap
 * halved; one with a phone area has only its own phone link.
 */
import { baseOf, hasMobileArea, phoneOf } from './grid.js';
import { isObject } from '../is.js';

/** A link as stored, checked for shape only: { to, gap } or null. */
const linkShape = (l) =>
  isObject(l) && typeof l.to === 'string' && l.to && Number.isInteger(l.gap ?? 0)
    ? { to: l.to, gap: l.gap ?? 0 }
    : null;

/** Half a gap, for the phone grid (rounded half away from zero, so -3 -> -2 like 3 -> 2). */
const halfGap = (g) => Math.sign(g) * Math.round(Math.abs(g) / 2);

/** The link a widget follows on the desktop grid, or on the phone grid (`phone`); null: free. */
export function linkOf(b, phone = false) {
  if (!phone) return linkShape(baseOf(b).link);
  if (hasMobileArea(phoneOf(b))) return linkShape(phoneOf(b).link);
  const l = linkShape(baseOf(b).link);
  return l && { to: l.to, gap: halfGap(l.gap) };
}

/**
 * Would widget `id` following `to` make a loop (or follow itself)? widgets: the section's,
 * phone: the phone grid's links. Follows the leaders from `to` up; a loop met there that
 * doesn't reach `id` is not this link's (and stops the walk).
 */
export function makesLoop(widgets, id, to, phone = false) {
  const byId = new Map((widgets || []).map((b) => [b?.id, b]));
  const seen = new Set();
  for (let at = to; at; at = linkOf(byId.get(at), phone)?.to) {
    if (at === id) return true;
    if (seen.has(at)) return false;
    seen.add(at);
  }
  return false;
}

/**
 * Problems of a section's links (desktop and phone): a link to a widget that isn't in this
 * section (another section's: `elsewhere`, the page's other widget ids), a widget following
 * itself, a loop.
 */
export function linkProblems(widgets, elsewhere = new Set()) {
  const list = Array.isArray(widgets) ? widgets : [];
  const ids = new Set(list.map((b) => b?.id));
  const out = [];
  for (const [phone, key] of [
    [false, 'layout.base.link'],
    [true, 'layout.phone.link'],
  ]) {
    for (const b of list) {
      const raw = phone ? phoneOf(b)?.link : baseOf(b).link;
      if (raw === undefined) continue;
      const l = linkShape(raw);
      const name = `widget "${b?.id}" ${key}`;
      if (!l) out.push(`${name} must be { "to": "<widget id>", "gap": <whole number of cells> }`);
      else if (l.to === b.id) out.push(`${name} can't follow the widget itself`);
      else if (!ids.has(l.to))
        out.push(
          elsewhere.has(l.to)
            ? `${name} follows "${l.to}" of another section (links stay in their section)`
            : `${name} follows "${l.to}", which isn't on the page`,
        );
    }
    // loops (each reported once, by its first widget)
    const byId = new Map(list.map((b) => [b?.id, b]));
    const reported = new Set();
    for (const b of list) {
      const path = [];
      const on = new Set();
      for (let at = b?.id; at && byId.has(at); at = linkOf(byId.get(at), phone)?.to) {
        if (on.has(at)) {
          const loop = path.slice(path.indexOf(at));
          // a phone loop of desktop links only is the desktop's (reported there)
          const own = !phone || loop.some((x) => hasMobileArea(phoneOf(byId.get(x))));
          if (loop.length > 1 && own && !loop.some((x) => reported.has(x))) {
            loop.forEach((x) => reported.add(x));
            out.push(`${phone ? 'phone ' : ''}links make a loop: ${[...loop, at].join(' -> ')}`);
          }
          break;
        }
        on.add(at);
        path.push(at);
      }
    }
  }
  return out;
}
