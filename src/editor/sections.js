/**
 * Page sections in the preview: keeps the rendered page in step with its file's "sections"
 * list while editing, without a reload. The page's <main> names its file (data-page-file).
 *
 * Every rendered section carries data-section="s<index>" and data-section-kind (its type and
 * config, kindOf in src/site/sections/index.js). On each change the preview's section
 * elements are matched to the list by kind, moved into list order, their data-edit pointers
 * and numbers (01), (02), … rewritten, and on/off + layout applied. A section whose kind isn't
 * on the page yet (just added, or a grid switched to another source) can't be shown until the
 * page is rendered again: it is reported as stale and shows after Save (the preview reloads).
 */
import { isNumbered, kindOf } from '../site/sections/index.js';

const pad = (n) => String(n).padStart(2, '0');

/** Layouts the preview applies itself: [element, modifier class, config.layout value]. */
const LAYOUT_CLASSES = [
  ['.tiles', 'tiles--even', 'even'],
  ['.placecards', 'placecards--even', 'even'],
  ['.agrid', 'agrid--landscape', 'landscape'],
];

/** The page file of the page in the preview ("pages/about/index.json"), or ''. */
export const previewFile = (doc) =>
  doc?.querySelector('[data-router-view]')?.dataset.pageFile || '';

/**
 * Sync the preview's sections with the store.
 * Returns { stale, moved, rewired }: stale = indexes the preview can't show until it is
 * re-rendered; moved = elements were reordered; rewired = data-edit pointers changed (the
 * caller should re-apply texts).
 */
export function syncSections(doc, store) {
  const result = { stale: new Set(), moved: false, rewired: false };
  const view = doc?.querySelector('[data-router-view]');
  const file = previewFile(doc);
  const sections = store.current[file]?.sections;
  if (!view || !Array.isArray(sections)) return result;
  const els = [...view.querySelectorAll('[data-section-kind]')];

  const pool = [...els];
  const placed = [];
  let number = 0;
  sections.forEach((s, i) => {
    const on = s?.config?.enabled !== false;
    if (on && isNumbered(s)) number++;
    const j = pool.findIndex((el) => el.dataset.sectionKind === kindOf(s));
    if (j < 0) return result.stale.add(i);
    placed.push({ el: pool.splice(j, 1)[0], i, s, on, number });
  });
  // Sections no longer in the list (or showing an old source) stay hidden.
  for (const el of pool) el.hidden = true;
  if (!placed.length) return result;

  // Order: only touch the DOM when it differs.
  const order = placed.map((p) => p.el);
  const current = els.filter((el) => order.includes(el));
  if (order.some((el, k) => current[k] !== el)) {
    const anchor = els.at(-1).nextSibling;
    for (const el of order) els[0].parentNode.insertBefore(el, anchor);
    result.moved = true;
  }

  for (const { el, i, s, on, number } of placed) {
    const from = el.dataset.section.slice(1);
    if (from !== String(i)) {
      const before = `${file}#/sections/${from}/`;
      const after = `${file}#/sections/${i}/`;
      for (const node of el.querySelectorAll('[data-edit]')) {
        if (node.dataset.edit.startsWith(before))
          node.dataset.edit = after + node.dataset.edit.slice(before.length);
      }
      el.dataset.section = `s${i}`;
      result.rewired = true;
    }
    el.hidden = !on;
    const text = el.querySelector('.section__label')?.firstChild;
    if (text?.nodeType === 3) text.textContent = `(${pad(number)}) `;
    for (const [sel, cls, value] of LAYOUT_CLASSES) {
      const target = el.matches(sel) ? el : el.querySelector(sel);
      target?.classList.toggle(cls, s.config?.layout === value);
    }
  }
  return result;
}
