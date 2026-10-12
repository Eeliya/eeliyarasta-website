/**
 * The page's sections in the preview, kept in step with its file while editing, without a
 * reload. The page's <main> names its file (data-page-file); every section element its id
 * (data-sec) and every block element its id (data-block): src/site/layout/index.js.
 *
 * On each change of the file, syncLayout applies what the preview can show by itself: the
 * sections' name (their id), height, width, rows and on/off (their classes and CSS variables) and the
 * blocks' places, sizes, links, text scale, placements, phone areas, layers, on/off and motion (data-motion,
 * src/site/layout/motion.js: those blocks' animations play again). What needs the site's templates (a section added or
 * copied, a block's content or config changed after a structure edit, a section whose index
 * moved, so its editor markers point elsewhere) it reports: the editor fetches those
 * sections' HTML from the dev server (POST /__editor/render) and swaps them in (swapSections).
 */
import {
  blockClass,
  blockLinks,
  blockVars,
  headingNumbers,
  sectionAnchor,
  sectionClass,
  sectionVars,
} from '../site/layout/index.js';
import { kindOf } from '../site/blocks/index.js';

/**
 * A block's motion attributes as the site renders them:
 * [data-motion, data-motion-options, data-anim-parts].
 */
function motionOf(b) {
  const m = b?.motion;
  if (!m || typeof m !== 'object') return [null, null, null];
  const { anim, parts, ...timing } = m;
  const own = parts && typeof parts === 'object' ? JSON.stringify(parts) : null;
  if (typeof anim !== 'string') return [null, null, own];
  return [anim, Object.keys(timing).length ? JSON.stringify(timing) : null, own];
}

/** Set (or remove) an attribute; true when it changed. */
function setAttr(node, name, value) {
  if (node.getAttribute(name) === value) return false;
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
  return true;
}

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

// placements the site's script sets up (src/client/modules/placements.js)
const SCRIPTED = /pinned|v-center/;

/**
 * Apply a section's layout (and its blocks') to its element. True when a block's placement
 * changed in a way the site's script handles (a pin): the view needs mounting again. Blocks
 * whose motion changed are added to `moved` (their animation plays again).
 */
function applyLayout(el, s, moved = []) {
  el.className = sectionClass(s);
  // its anchor: its name's slug (a name changed: the id with it)
  const anchor = sectionAnchor(s);
  if (anchor) el.id = anchor;
  else el.removeAttribute('id');
  // (the rows the site's rows.js worked out stay until it flows the section again)
  const kept = ['--frows', '--ffill']
    .map((v) => [v, el.style.getPropertyValue(v)])
    .filter(([, x]) => x)
    .map(([v, x]) => `;${v}:${x}`)
    .join('');
  el.style.cssText = sectionVars(s) + kept;
  el.hidden = s.enabled === false;
  let remount = false;
  for (const b of s.blocks || []) {
    // (a pinned block sits in the pin's spacer)
    const node = el.querySelector(`[data-block="${b?.id}"]`);
    if (!node || node.closest('[data-sec]') !== el) continue;
    const cls = blockClass(b);
    if (node.className !== cls && (SCRIPTED.test(node.className) || SCRIPTED.test(cls)))
      remount = true;
    node.className = cls;
    const kept = ['--bh', '--fr', '--frs']
      .map((v) => [v, node.style.getPropertyValue(v)])
      .filter(([, x]) => x)
      .map(([v, x]) => `;${v}:${x}`)
      .join('');
    node.style.cssText = blockVars(b) + kept;
    node.hidden = b.config?.enabled === false;
    for (const [name, value] of Object.entries(blockLinks(b))) setAttr(node, name, value);
    const [anim, options, parts] = motionOf(b);
    // its parts' animations are mounted with the view's: mount again
    if (setAttr(node, 'data-anim-parts', parts)) remount = true;
    const a = setAttr(node, 'data-motion', anim);
    if (setAttr(node, 'data-motion-options', options) || a) moved.push(node);
  }
  return remount;
}

/**
 * Sync the preview's sections with the store's file: order, layout, removed sections.
 * Returns the ids of the sections to render again (`structure`: also those whose content
 * changed; otherwise only missing ones, e.g. a section added in another tab is not), with
 * `remount` set when a pin changed (the view's modules need mounting again) and `motion`: the
 * block elements whose motion changed.
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
  stale.motion = [];
  sections.forEach((s, at) => {
    const el = els.get(s?.id);
    if (el && applyLayout(el, s, stale.motion)) stale.remount = true;
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
