/**
 * Links between blocks (src/site/layout/flow.js resolves them): blocks are free by default,
 * each where it was placed on the grid, overlapping when they meet. A block can follow
 * another: its top at the other one's bottom plus a gap in cells (negative: they overlap),
 *
 *   "link": { "to": "b-7qpa", "gap": 2 }            (desktop)
 *   "phone": { ..., "link": { "to": "b-7qpa", "gap": -1 } }   (the phone grid's)
 *
 * so it moves when the block it follows grows or shrinks (its content at another width).
 * One block it follows (its leader), any number following one block, chains; never a loop,
 * never a block of another section. A block without a phone area of its own (it shows its
 * desktop area halved, grid.js phoneAreaOf) follows its desktop link there too, the gap
 * halved; one with a phone area has only its own phone link.
 */
import { hasMobileArea } from './grid.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A link as stored, checked for shape only: { to, gap } or null. */
const linkShape = (l) =>
  isObject(l) && typeof l.to === 'string' && l.to && Number.isInteger(l.gap ?? 0)
    ? { to: l.to, gap: l.gap ?? 0 }
    : null;

/** Half a gap, for the phone grid (rounded half away from zero, so -3 -> -2 like 3 -> 2). */
export const halfGap = (g) => Math.sign(g) * Math.round(Math.abs(g) / 2);

/** The link a block follows on the desktop grid, or on the phone grid (`phone`); null: free. */
export function linkOf(b, phone = false) {
  if (!phone) return linkShape(b?.link);
  if (hasMobileArea(b?.phone)) return linkShape(b.phone.link);
  const l = linkShape(b?.link);
  return l && { to: l.to, gap: halfGap(l.gap) };
}

/**
 * Would block `id` following `to` make a loop (or follow itself)? blocks: the section's,
 * phone: the phone grid's links. Follows the leaders from `to` up; a loop met there that
 * doesn't reach `id` is not this link's (and stops the walk).
 */
export function makesLoop(blocks, id, to, phone = false) {
  const byId = new Map((blocks || []).map((b) => [b?.id, b]));
  const seen = new Set();
  for (let at = to; at; at = linkOf(byId.get(at), phone)?.to) {
    if (at === id) return true;
    if (seen.has(at)) return false;
    seen.add(at);
  }
  return false;
}

/**
 * Problems of a section's links (desktop and phone): a link to a block that isn't in this
 * section (another section's: `elsewhere`, the page's other block ids), a block following
 * itself, a loop.
 */
export function linkProblems(blocks, elsewhere = new Set()) {
  const list = Array.isArray(blocks) ? blocks : [];
  const ids = new Set(list.map((b) => b?.id));
  const out = [];
  for (const [phone, key] of [
    [false, 'link'],
    [true, 'phone.link'],
  ]) {
    for (const b of list) {
      const raw = phone ? b?.phone?.link : b?.link;
      if (raw === undefined) continue;
      const l = linkShape(raw);
      const name = `block "${b?.id}" ${key}`;
      if (!l) out.push(`${name} must be { "to": "<block id>", "gap": <whole number of cells> }`);
      else if (l.to === b.id) out.push(`${name} can't follow the block itself`);
      else if (!ids.has(l.to))
        out.push(
          elsewhere.has(l.to)
            ? `${name} follows "${l.to}" of another section (links stay in their section)`
            : `${name} follows "${l.to}", which isn't on the page`,
        );
    }
    // loops (each reported once, by its first block)
    const byId = new Map(list.map((b) => [b?.id, b]));
    const reported = new Set();
    for (const b of list) {
      const path = [];
      const on = new Set();
      for (let at = b?.id; at && byId.has(at); at = linkOf(byId.get(at), phone)?.to) {
        if (on.has(at)) {
          const loop = path.slice(path.indexOf(at));
          // a phone loop of desktop links only is the desktop's (reported there)
          const own = !phone || loop.some((x) => hasMobileArea(byId.get(x)?.phone));
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
