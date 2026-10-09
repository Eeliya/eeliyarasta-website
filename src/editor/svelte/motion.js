/**
 * The Motion tab's model: which fields each animation type has, and where a value comes from.
 * In the editor an "animation" is what animations.json (and the code here) calls a preset.
 * Every value lives at one of these layers of content/settings/animations.json:
 *   element -> elements["<path>|<target>|<n>"]   (only this element on this page)
 *   target  -> targets["<target>"]               (every element with that data-anim, "All")
 *   preset  -> presets["<animation>"]            (the animation's own values: the library)
 * A value is read from the first layer that has it: element, target, preset. There is no
 * global layer: each animation carries every value it uses.
 * The element view (AnimEditor.svelte) writes element / target, timing only (TIMING_KEYS);
 * the Animations sub-tab (AnimLibrary.svelte) writes the preset, every value.
 * Shown with MotionField.svelte. No DOM here.
 */ import { compile } from '../lib/pointer.js';

// Presets that work on any element; special ones (scatter, hero-title, hover-preview) need their markup.
export const GENERIC_TYPES = new Set(['reveal', 'split', 'scrub-words']);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (...objs) => {
  const out = {};
  for (const o of objs) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o))
      out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out;
};
export const dig = (obj, path) =>
  path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

const START = [
  'top bottom',
  'top 95%',
  'top 90%',
  'top 85%',
  'top 75%',
  'top center',
  'center center',
];
const END = ['bottom top', 'bottom center', 'bottom 60%', 'top 40%', 'center center', 'top top'];

export const F = {
  duration: {
    path: ['duration'],
    label: 'Duration (s)',
    kind: 'number',
    max: 4,
    step: 0.05,
  },
  delay: { path: ['delay'], label: 'Delay (s)', kind: 'number', max: 3, step: 0.05 },
  stagger: {
    path: ['stagger'],
    label: 'Stagger (s)',
    kind: 'number',
    max: 0.4,
    step: 0.005,
    hint: 'Delay between children / letters / lines',
  },
  ease: { path: ['ease'], label: 'Ease', kind: 'ease' },
  timing: {
    kind: 'pair',
    label: 'Duration (s) / ease',
    paths: [['duration'], ['ease']],
    max: 4,
    step: 0.05,
  },
  trigger: {
    path: ['trigger'],
    label: 'Plays',
    kind: 'segment',
    options: [
      ['load', 'On load'],
      ['scroll', 'On scroll'],
    ],
  },
  start: {
    path: ['start'],
    label: 'Scroll start',
    kind: 'text',
    suggestions: START,
    when: (s) => s.trigger === 'scroll',
    hint: '"<element edge> <viewport edge>", e.g. "top 85%"',
  },
  scrub: {
    path: ['scrub'],
    label: 'Scrub',
    kind: 'segment',
    options: [
      [false, 'Off'],
      [true, 'On'],
      [1, 'Smooth'],
    ],
    when: (s) => s.trigger === 'scroll',
    hint: 'Tie progress to the scroll position',
  },
  end: {
    path: ['end'],
    label: 'Scroll end',
    kind: 'text',
    suggestions: END,
    when: (s) => s.trigger === 'scroll' && s.scrub,
  },
  split: {
    path: ['split'],
    label: 'Split into',
    kind: 'segment',
    options: [
      ['chars', 'Chars'],
      ['words', 'Words'],
      ['lines', 'Lines'],
    ],
  },
  mask: {
    path: ['mask'],
    label: 'Mask',
    kind: 'segment',
    options: [
      [false, 'None'],
      ['chars', 'Chars'],
      ['words', 'Words'],
      ['lines', 'Lines'],
    ],
  },
};
const n = (path, label, max, step, unit = '', min = 0) => ({
  path,
  label,
  kind: 'number',
  min,
  max,
  step,
  unit,
});

export const PROPS = {
  y: { label: 'Distance Y', min: -200, max: 200, step: 1, unit: 'px', neutral: 0, init: 40 },
  x: { label: 'Distance X', min: -200, max: 200, step: 1, unit: 'px', neutral: 0, init: 40 },
  yPercent: {
    label: 'Distance Y %',
    min: -150,
    max: 150,
    step: 1,
    unit: '%',
    neutral: 0,
    init: 100,
  },
  xPercent: {
    label: 'Distance X %',
    min: -150,
    max: 150,
    step: 1,
    unit: '%',
    neutral: 0,
    init: 100,
  },
  scale: { label: 'Scale', min: 0, max: 2, step: 0.01, neutral: 1, init: 0.9 },
  rotate: { label: 'Rotation', min: -45, max: 45, step: 0.5, unit: '°', neutral: 0, init: 6 },
  autoAlpha: { label: 'Opacity', min: 0, max: 1, step: 0.01, neutral: 1, init: 0 },
  opacity: { label: 'Opacity (raw)', min: 0, max: 1, step: 0.01, neutral: 1, init: 0 },
  clipPath: {
    label: 'Clip path',
    text: true,
    neutral: 'inset(0% 0% 0% 0%)',
    init: 'inset(100% 0% 0% 0%)',
    suggestions: [
      'inset(100% 0% 0% 0%)',
      'inset(0% 0% 100% 0%)',
      'inset(0% 100% 0% 0%)',
      'inset(30% 0% 0% 0%)',
      'inset(0% 0% 0% 0%)',
    ],
  },
  filter: {
    label: 'Filter',
    text: true,
    neutral: 'blur(0px)',
    init: 'blur(12px)',
    suggestions: ['blur(12px)', 'blur(0px)'],
  },
};

export const TIMING = ['Timing', [F.timing, F.delay, F.stagger]];
const TRIGGER = ['Trigger', [F.trigger, F.start, F.scrub, F.end]];
export const GROUPS = {
  reveal: [TIMING, TRIGGER, 'from', 'to'],
  split: [['Split', [F.split, F.mask]], TIMING, TRIGGER, 'from', 'to'],
  'scrub-words': [
    [
      'Scroll',
      [
        n(['fromOpacity'], 'Dim words opacity', 1, 0.01),
        { ...F.start, when: null },
        { ...F.end, when: null },
      ],
    ],
  ],
  parallax: [
    [
      'Parallax',
      [
        n(['speed'], 'Speed', 40, 1, '%'),
        {
          ...F.scrub,
          options: [
            [true, 'On'],
            [0.5, 'Smooth .5'],
            [1.5, 'Smooth 1.5'],
          ],
          when: null,
        },
      ],
    ],
  ],
  scatter: [
    [
      'Intro burst',
      [
        {
          kind: 'pair',
          label: 'Duration (s) / ease',
          paths: [
            ['intro', 'duration'],
            ['intro', 'ease'],
          ],
          max: 4,
          step: 0.05,
        },
        n(['intro', 'stagger'], 'Stagger (s)', 0.4, 0.005),
        n(['intro', 'delay'], 'Delay (s)', 2, 0.05),
        n(['intro', 'fromScale'], 'From scale', 1.5, 0.01),
      ],
    ],
    [
      'Drift',
      [
        n(['drift', 'amplitude'], 'Amplitude', 60, 1, 'px'),
        n(['drift', 'rotation'], 'Rotation', 15, 0.1, '°'),
        n(['drift', 'minDuration'], 'Min duration (s)', 20, 0.5),
        n(['drift', 'maxDuration'], 'Max duration (s)', 20, 0.5),
      ],
    ],
    ['Scroll', [n(['scroll', 'distance'], 'Fly-off distance', 150, 1, '%vh')]],
  ],
  'hero-title': [
    TIMING,
    'from',
    'to',
    [
      'On scroll',
      [
        n(['scroll', 'scale'], 'End scale', 1.5, 0.01),
        n(['scroll', 'autoAlpha'], 'End opacity', 1, 0.01),
      ],
    ],
  ],
  'hover-preview': [
    [
      'Preview',
      [
        n(['x'], 'Position across the list', 100, 1, '%'),
        n(['glide'], 'Glide between rows (s)', 1.5, 0.01),
      ],
    ],
  ],
};

/**
 * Timing: what an element, or every element with its data-anim name, can set for itself in the
 * element view, each field with a Custom switch (off: inherit). A field is timing when the last key
 * of its path is here, so ['intro', 'duration'] (scatter) is timing and ['drift', 'minDuration']
 * is not. Every other value says what the animation does (start / end state, distances, ...):
 * read-only in the element view, edited in the Animations library only.
 * Add or remove a key here to move fields between the two.
 */
export const TIMING_KEYS = new Set([
  'duration',
  'ease',
  'delay',
  'stagger',
  'trigger',
  'start',
  'end',
  'scrub',
]);
export const isTimingPath = (path) => TIMING_KEYS.has(path.at(-1));
export const isTiming = (def) => isTimingPath(def.paths ? def.paths[0] : def.path);

/**
 * The picked element's animation. cfg: animations.json, sel: { id, key }.
 * spec: the merged values; layers: each scope's own values (for the Custom switches).
 */
export function animModel(cfg, sel) {
  const target = cfg.targets[sel.id] || {};
  const own = cfg.elements?.[sel.key] || {};
  const presetName = own.preset || target.preset;
  const preset = cfg.presets[presetName] || {};
  const strip = ({ preset: _p, ...rest }) => rest;
  const layers = { element: strip(own), target: strip(target), preset };
  const spec = merge(layers.preset, layers.target, layers.element);
  return { target, own, presetName, preset, layers, spec, type: preset.type };
}

/** One animation (preset) on its own, for the Animations library. */
export function presetModel(cfg, name) {
  const preset = cfg.presets[name] || {};
  const layers = { element: {}, target: {}, preset };
  const spec = merge(preset);
  return { target: {}, own: {}, presetName: name, preset, layers, spec, type: preset.type };
}

/** The animation an element uses (items from bridge.animElements()): its own, else its target's. */
export const animationOf = (cfg, { id, key }) =>
  cfg.elements?.[key]?.preset || cfg.targets[id]?.preset;

/** Pointer of a scope's object in animations.json (sel is not needed for 'preset'). */
export const layerPtr = (m, sel, scope) =>
  scope === 'element'
    ? `/elements${compile([sel.key])}`
    : scope === 'target'
      ? `/targets${compile([sel.id])}`
      : `/presets${compile([m.presetName])}`;

/** How many path levels store.remove keeps when a scope's object gets empty. */
export const keepFor = (scope) => (scope === 'element' ? 1 : 2);

// The layers a scope inherits from, nearest first.
const BELOW = { element: ['target', 'preset'], target: ['preset'], preset: [] };
/** What a scope gets without a value of its own: [value, the layer it comes from or null]. */
export function inherited(m, scope, path) {
  const layer = BELOW[scope].find((l) => dig(m.layers[l], path) !== undefined) || null;
  return [layer && dig(m.layers[layer], path), layer];
}

/**
 * Non-timing values set on the element or its data-anim name: overrides from before the element
 * view became read-only for them. [{ scope: 'target' | 'element', path, value }]
 */
export function legacyOverrides(m) {
  const out = [];
  const walk = (scope, obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (isObj(v)) walk(scope, v, [...path, k]);
      else if (!isTimingPath([...path, k])) out.push({ scope, path: [...path, k], value: v });
    }
  };
  for (const scope of ['target', 'element']) walk(scope, m.layers[scope], []);
  return out;
}

/** A field's value as text, for read-only and inherited values. */
export function formatValue(def, value) {
  const unit = (v) => (v === undefined || v === '' ? '–' : `${v}${def.unit ? ' ' + def.unit : ''}`);
  if (def.kind === 'pair') return `${unit(value[0])} · ${value[1] ?? 'none'}`;
  if (def.kind === 'segment') {
    const v = JSON.stringify(value ?? def.options[0][0]);
    return def.options.find(([o]) => JSON.stringify(o) === v)?.[1] ?? String(value);
  }
  return unit(value);
}

/** The fields of a from / to group: one per property the animation has. */
export function propFields(which, values) {
  return Object.keys(values).map((prop) => {
    const p = PROPS[prop] || {
      label: prop,
      min: -200,
      max: 200,
      step: 1,
      text: typeof values[prop] !== 'number',
    };
    return p.text
      ? { path: [which, prop], label: p.label, kind: 'text', suggestions: p.suggestions || [] }
      : {
          path: [which, prop],
          label: p.label,
          kind: 'number',
          min: p.min,
          max: p.max,
          step: p.step,
          unit: p.unit,
        };
  });
}

/** Properties a from / to group can still add (opacity and autoAlpha exclude each other). */
export const missingProps = (values) =>
  Object.keys(PROPS).filter((k) => !(k in values) && !(k === 'opacity' && 'autoAlpha' in values));
