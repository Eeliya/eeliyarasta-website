/**
 * Animation engine: reads content/animations.json (the single source of truth)
 * and wires every [data-anim="<target id>"] element in a view.
 *
 *   spec = defaults ⟵ presets[preset] ⟵ targets[id] ⟵ elements[key] ⟵ data-anim-options (JSON, optional)
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
import config from '../../../content/animations.json';
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
    console.warn(`[anim] no target "${id}" in content/animations.json`);
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
  const { preset: _p, ...overrides } = target;
  const { preset: _q, ...ownOverrides } = own;
  return merge(config.defaults, preset, overrides, ownOverrides, inline, {
    id,
    key,
    preset: presetName,
  });
}

/** Stamp every [data-anim] element with its stable key (see header). */
export function assignKeys(els, page = pageKey()) {
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

/**
 * Mount all animations inside `root` (and optional extra roots such as the portal layer).
 * Returns { ctx, revert() }; revert() undoes every tween, trigger, split and listener.
 */
export function mount(root, { extraRoots = [] } = {}) {
  const reduce = reducedMotion();
  const els = [root, ...extraRoots].flatMap((r) => [...r.querySelectorAll('[data-anim]')]);
  assignKeys(els);
  const cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  const visibility = els.map((el) => [el, el.style.visibility]);
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
      visibility.forEach(([el, v]) => (el.style.visibility = v));
    },
  };
}

export const transitions = config.transitions;
export const interactions = config.interactions || {};
export { config };
