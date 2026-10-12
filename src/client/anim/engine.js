/**
 * Animation engine: reads content/en/settings/animations.json (the single source of truth)
 * and wires every block with motion ([data-motion], src/site/layout/motion.js) and every
 * [data-anim="<target id>"] element in a view.
 *
 * A block: spec = presets[data-motion] ⟵ data-motion-options (the block's own timing). It
 * plays on the block's content: its children, or the animation's `children` inside it, never
 * on the block's element itself (that one may be sticky, fixed or pinned). Scroll positions
 * are measured on what moves (a reveal: its first target; a split: each target; scroll: the
 * block), or on the block's section when the block is placed (sticky / fixed / fullscreen /
 * pinned: its own box doesn't scroll by).
 *
 * An element (parts of a block type with their own markup: the hero's photos and title,
 * album parts, the project preview; and the footer):
 *
 *   spec = presets[preset] ⟵ targets[id] ⟵ elements[key] ⟵ data-anim-options (JSON, optional)
 *
 * `key` is a stable per-element id assigned at mount time: "<path>|<target id>|<n>"
 * (n = index among elements with that target on the page), e.g. "/about/|about.headline|0".
 * config.elements[key] may override any value, including `preset`, for that one element,
 * so the visual editor can re-style a single element without touching templates.
 *
 * Each preset has a `type` handled by ./types.js. Everything is created inside a
 * gsap.context so a page's tweens, ScrollTriggers, SplitTexts and listeners are
 * reverted in one call when the router leaves the page.
 *
 * The visual editor (src/editor) edits a copy of this JSON, pushes it in with
 * setConfig() and re-mounts; see window.__site in ../main.js.
 */
import config from '../../../content/en/settings/animations.json';
import { gsap, reducedMotion } from '../lib/env.js';
import { types } from './types.js';

const merge = (...objs) => {
  const out = {};
  for (const o of objs) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o)) {
      out[k] =
        v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object'
          ? merge(out[k], v)
          : v;
    }
  }
  return out;
};

/** Page part of element keys: always with a trailing slash. */
export const pageKey = (pathname = location.pathname) =>
  pathname.endsWith('/') || pathname.endsWith('.html') ? pathname : pathname + '/';

export function resolve(id, el) {
  const target = config.targets[id];
  if (!target) {
    console.warn(`[anim] no target "${id}" in content/en/settings/animations.json`);
    return null;
  }
  const key = el?.dataset.animKey;
  const own = (key && config.elements?.[key]) || {};
  const presetName = own.preset || target.preset;
  const preset = config.presets[presetName];
  if (!preset) {
    console.warn(`[anim] "${key || id}" uses unknown preset "${presetName}"`);
    return null;
  }
  let inline = null;
  if (el?.dataset.animOptions) {
    try {
      inline = JSON.parse(el.dataset.animOptions);
    } catch {
      /* ignore */
    }
  }
  // target and own may name a preset: that was resolved above, the rest overrides it
  return merge(preset, target, own, inline, {
    id,
    key,
    preset: presetName,
  });
}

const parse = (json) => {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
};

/** A block's animation spec: its animation, then its own timing; null when unknown. */
export function resolveBlock(el) {
  const name = el.dataset.motion;
  const preset = config.presets[name];
  if (!preset) {
    console.warn(`[anim] a block uses unknown animation "${name}"`);
    return null;
  }
  return merge(preset, parse(el.dataset.motionOptions), { id: name, preset: name, block: true });
}

/** Is a block held in place (its own box doesn't scroll with the page)? */
function isPlaced(el) {
  const pos = getComputedStyle(el).position;
  return (
    pos === 'sticky' ||
    pos === 'fixed' ||
    el.matches('.blk--pinned, .blk--m-pinned') ||
    !!el.closest('.pin-spacer')
  );
}

/** What a block's animation moves, and what its scroll positions are measured on. */
function blockTargets(el, spec) {
  const targets = spec.children ? [...el.querySelectorAll(spec.children)] : [...el.children];
  // placed: its section; else each type measures its targets (or the block)
  return { targets, trigger: isPlaced(el) ? el.closest('.sec') || el : undefined };
}

/** Stamp every [data-anim] element with its stable key (see header). */
function assignKeys(els, page = pageKey()) {
  const seen = {};
  for (const el of els) {
    const id = el.dataset.anim;
    seen[id] = (seen[id] ?? -1) + 1;
    el.dataset.animKey = `${page}|${id}|${seen[id]}`;
  }
}

/**
 * Replace the config in place (keeps object identities, e.g. `transitions`,
 * which other modules imported). Used by the visual editor's live preview.
 */
export function setConfig(next) {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const assign = (target, src) => {
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const [k, v] of Object.entries(src)) {
      if (isObj(v) && isObj(target[k])) assign(target[k], v);
      else target[k] = isObj(v) || Array.isArray(v) ? structuredClone(v) : v;
    }
  };
  assign(config, next);
}

/** Run one element's (or block's) animation in its own context: { el, revert() }. */
function play(el, reduce) {
  const block = el.dataset.motion !== undefined;
  if (!block && el.dataset.anim === undefined) return { el, revert() {} }; // its motion is gone
  const spec = block ? resolveBlock(el) : resolve(el.dataset.anim, el);
  const run = spec && types[spec.type];
  // Un-hide first (html.anim-pending hides [data-anim]); the type's from-state
  // renders synchronously in the same frame, so nothing flashes.
  const visibility = el.style.visibility;
  if (!block) el.style.visibility = 'inherit';
  const cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  const ctx = gsap.context(() => {
    if (!run) return;
    try {
      run(el, spec, { reduce, onCleanup, ...(block && blockTargets(el, spec)) });
    } catch (err) {
      console.error(`[anim] ${spec.id} failed`, err);
    }
  }, el);
  return {
    el,
    revert() {
      cleanups.splice(0).forEach((fn) => fn());
      ctx.revert();
      if (!block) el.style.visibility = visibility;
    },
  };
}

/**
 * Mount all animations inside `root` (and optional extra roots such as the portal layer).
 * Returns { revert(), replay(el) }: revert() undoes every tween, trigger, split and listener;
 * replay(el) plays one block's or element's animation again (false when it has none).
 */
export function mount(root, { extraRoots = [] } = {}) {
  const reduce = reducedMotion();
  const roots = [root, ...extraRoots];
  const els = roots.flatMap((r) => [...r.querySelectorAll('[data-anim]')]);
  assignKeys(els);
  const blocks = roots.flatMap((r) => [...r.querySelectorAll('[data-motion]')]);
  // blocks first: a part inside a block is measured with the block's from-state in place
  const running = [...blocks, ...els].map((el) => play(el, reduce));
  return {
    revert() {
      running.splice(0).forEach((r) => r.revert());
    },
    replay(el) {
      const at = running.findIndex((r) => r.el === el);
      if (at < 0) return false;
      running[at].revert();
      running[at] = play(el, reduce);
      return true;
    },
  };
}

export const transitions = config.transitions;
export const interactions = config.interactions || {};
export { config };
