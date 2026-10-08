/**
 * Animation engine: reads content/animations.json (the single source of truth)
 * and wires every [data-anim="<target id>"] element in a view.
 *
 *   spec = defaults ⟵ presets[target.preset] ⟵ targets[id] ⟵ data-anim-options (JSON, optional)
 *
 * Each preset has a `type` handled by ./types.js. Everything is created inside a
 * gsap.context so a page's tweens, ScrollTriggers, SplitTexts and listeners are
 * reverted in one call when the router leaves the page.
 *
 * The future visual editor only needs to: list targets on the page (data-anim),
 * edit config.targets[id] / config.presets, call engine.mount() again and commit
 * the JSON back to GitHub.
 */
import config from '../../../content/animations.json';
import { gsap, reducedMotion } from '../lib/env.js';
import { types } from './types.js';

const merge = (...objs) => {
  const out = {};
  for (const o of objs) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? merge(out[k], v) : v;
    }
  }
  return out;
};

export function resolve(id, el) {
  const target = config.targets[id];
  if (!target) {
    console.warn(`[anim] no target "${id}" in content/animations.json`);
    return null;
  }
  const preset = config.presets[target.preset];
  if (!preset) {
    console.warn(`[anim] target "${id}" uses unknown preset "${target.preset}"`);
    return null;
  }
  let inline = null;
  if (el?.dataset.animOptions) {
    try { inline = JSON.parse(el.dataset.animOptions); } catch { /* ignore */ }
  }
  const { preset: _p, ...overrides } = target;
  return merge(config.defaults, preset, overrides, inline, { id, preset: target.preset });
}

/**
 * Mount all animations inside `root` (and optional extra roots such as the portal layer).
 * Returns { ctx, revert() }; revert() undoes every tween, trigger, split and listener.
 */
export function mount(root, { extraRoots = [] } = {}) {
  const reduce = reducedMotion();
  const els = [root, ...extraRoots].flatMap((r) => [...r.querySelectorAll('[data-anim]')]);
  const cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  const ctx = gsap.context(() => {
    for (const el of els) {
      const spec = resolve(el.dataset.anim, el);
      const run = spec && types[spec.type];
      // Un-hide first (html.anim-pending hides [data-anim]); the type's from-state
      // renders synchronously in the same frame, so nothing flashes.
      el.style.visibility = 'inherit';
      if (!run) continue;
      try {
        run(el, spec, { reduce, onCleanup });
      } catch (err) {
        console.error(`[anim] ${spec.id} failed`, err);
      }
    }
  }, root);
  return {
    ctx,
    revert() {
      cleanups.splice(0).forEach((fn) => fn());
      ctx.revert();
    },
  };
}

export const transitions = config.transitions;
export const interactions = config.interactions || {};
export { config };
