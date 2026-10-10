/**
 * The page's sections in the preview, kept in step with its file while editing, without a
 * reload. The page's <main> names its file (data-page-file); every section element its id
 * (data-sec) and every block element its id (data-block): src/site/layout/index.js.
 *
 * On each change of the file, syncLayout applies what the preview can show by itself: the
 * sections' height, width, spacing, rows and on/off (their classes and CSS variables) and the
 * blocks' places, layers and on/off. What needs the site's templates (a section added or
 * copied, a block's content or config changed after a structure edit, a section whose index
 * moved, so its editor markers point elsewhere) it reports: the editor fetches those
 * sections' HTML from the dev server (POST /__editor/render) and swaps them in (swapSections).
 */
import { blockVars, headingNumbers, sectionClass, sectionVars } from '../site/layout/index.js';
import { kindOf } from '../site/blocks/index.js';

/** The page file of the page in the preview ("pages/about/index.json"), or ''. */
export const previewFile = (doc) =>
  doc?.querySelector('[data-router-view]')?.dataset.pageFile || '';

// What each section element was rendered from: its index and its blocks' content (kindOf).
const rendered = new WeakMap();
const keyOf = (s, at, numbers) =>
  JSON.stringify([at, (s?.blocks || []).map((b) => [b?.id, kindOf(b), numbers[b?.id] || 0])]);

/** The view's section elements by id. */
const sectionsIn = (view) =>
  new Map([...view.querySelectorAll('[data-sec]')].map((el) => [el.dataset.sec, el]));

/** After the page is rendered (a navigation, a reload): its sections show the store's file. */
export function markRendered(doc, store) {
  const view = doc?.querySelector('[data-router-view]');
  const sections = store.current[previewFile(doc)]?.sections;
  if (!view || !Array.isArray(sections)) return;
  const els = sectionsIn(view);
  const numbers = headingNumbers(sections);
  sections.forEach((s, at) => {
    const el = els.get(s?.id);
    if (el) rendered.set(el, keyOf(s, at, numbers));
  });
}

/** Apply a section's layout (and its blocks') to its element. */
function applyLayout(el, s) {
  el.className = sectionClass(s);
  el.style.cssText = sectionVars(s);
  el.hidden = s.enabled === false;
  for (const b of s.blocks || []) {
    const node = el.querySelector(`:scope > [data-block="${b?.id}"]`);
    if (!node) continue;
    node.style.cssText = blockVars(b);
    node.hidden = b.config?.enabled === false;
  }
}

/**
 * Sync the preview's sections with the store's file: order, layout, removed sections.
 * Returns the ids of the sections to render again (`structure`: also those whose content
 * changed; otherwise only missing ones, e.g. a section added in another tab is not).
 */
export function syncLayout(doc, store, { structure = false } = {}) {
  const view = doc?.querySelector('[data-router-view]');
  const sections = store.current[previewFile(doc)]?.sections;
  if (!view || !Array.isArray(sections)) return [];
  const els = sectionsIn(view);
  const ids = new Set(sections.map((s) => s?.id));
  for (const [id, el] of els) if (!ids.has(id)) el.remove();

  // Order: only touch the DOM when it differs (new sections come with their render).
  const order = sections.map((s) => els.get(s?.id)).filter(Boolean);
  const now = [...view.querySelectorAll(':scope > [data-sec]')];
  if (order.some((el, k) => now[k] !== el)) {
    const anchor = now.at(-1)?.nextSibling ?? null;
    for (const el of order) view.insertBefore(el, anchor);
  }

  const numbers = headingNumbers(sections);
  const stale = [];
  sections.forEach((s, at) => {
    const el = els.get(s?.id);
    if (el) applyLayout(el, s);
    if (!el || (structure && rendered.get(el) !== keyOf(s, at, numbers))) stale.push(s.id);
  });
  return stale;
}

/** Put freshly rendered sections ({ id: html }) into the preview, in the file's order. */
export function swapSections(doc, store, html) {
  const view = doc.querySelector('[data-router-view]');
  const sections = store.current[previewFile(doc)]?.sections || [];
  const numbers = headingNumbers(sections);
  const els = sectionsIn(view);
  let prev = null;
  sections.forEach((s, at) => {
    let el = els.get(s.id);
    if (html[s.id] !== undefined) {
      const tpl = doc.createElement('template');
      tpl.innerHTML = html[s.id];
      const next = tpl.content.firstElementChild;
      if (el) el.replaceWith(next);
      else if (prev) prev.after(next);
      else view.prepend(next);
      el = next;
      rendered.set(el, keyOf(s, at, numbers));
    }
    if (el) prev = el;
  });
}
