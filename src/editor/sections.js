/**
 * Home sections in the preview: keeps the rendered page in step with the ordered
 * pages/home.json "sections" list while editing, without a reload.
 *
 * Every rendered section carries data-section="s<index>" and data-section-kind
 * ("intro", "projects", "grid:<source>"). On each change the preview's section elements
 * are matched to the list by kind, moved into list order, their data-edit pointers and
 * numbers (01), (02), … rewritten, and on/off + grid layout applied. A section whose kind
 * isn't on the page yet (e.g. a grid switched to another source) can't be shown until the
 * page is rendered again: it is reported as stale and the preview reloads after Save.
 */
import { HOME } from '../site/files.js';

const kindOf = (s) => (s?.type === 'grid' ? `grid:${s.config?.source || 'people'}` : s?.type);
const pad = (n) => String(n).padStart(2, '0');

/** Grid containers and the modifier class their "even" layout uses. */
const LAYOUT_CLASSES = [
  ['.tiles', 'tiles--even'],
  ['.placecards', 'placecards--even'],
];

/**
 * Sync the preview's home sections with the store.
 * Returns { stale, moved, rewired }: stale = indexes the preview can't show until it is
 * re-rendered; moved = elements were reordered; rewired = data-edit pointers changed (the
 * caller should re-apply texts).
 */
export function syncHomeSections(doc, store) {
  const result = { stale: new Set(), moved: false, rewired: false };
  const view = doc?.querySelector('[data-router-view]');
  const sections = store.current[HOME]?.sections;
  if (!view || view.dataset.page !== 'home' || !Array.isArray(sections)) return result;
  const els = [...view.querySelectorAll('[data-section-kind]')];
  if (!els.length) return result;

  const parent = els[0].parentNode;
  const anchor = els.at(-1).nextSibling;
  const pool = [...els];
  const placed = [];
  sections.forEach((s, i) => {
    const j = pool.findIndex((el) => el.dataset.sectionKind === kindOf(s));
    if (j < 0) return result.stale.add(i);
    placed.push({ el: pool.splice(j, 1)[0], i, s });
  });
  // Sections no longer in the list (or showing an old source) stay hidden.
  for (const el of pool) el.hidden = true;

  // Order: only touch the DOM when it differs.
  const order = placed.map((p) => p.el);
  const current = els.filter((el) => order.includes(el));
  if (order.some((el, k) => current[k] !== el)) {
    for (const el of order) parent.insertBefore(el, anchor);
    result.moved = true;
  }

  let number = 0;
  for (const { el, i, s } of placed) {
    const from = el.dataset.section.slice(1);
    if (from !== String(i)) {
      const before = `${HOME}#/sections/${from}/`;
      const after = `${HOME}#/sections/${i}/`;
      for (const node of el.querySelectorAll('[data-edit]')) {
        if (node.dataset.edit.startsWith(before))
          node.dataset.edit = after + node.dataset.edit.slice(before.length);
      }
      el.dataset.section = `s${i}`;
      result.rewired = true;
    }
    const on = s.config?.enabled !== false;
    el.hidden = !on;
    if (s.type !== 'intro' && on) number++;
    const label = el.querySelector('.section__label');
    const text = label?.firstChild;
    if (text?.nodeType === 3) text.textContent = `(${pad(number)}) `;
    for (const [sel, cls] of LAYOUT_CLASSES)
      el.querySelector(sel)?.classList.toggle(cls, s.config?.layout === 'even');
  }
  return result;
}
