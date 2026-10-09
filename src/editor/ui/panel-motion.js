/**
 * Motion panel: pick an animated element (click it in the preview or in the list),
 * then edit its preset and parameters. Every value can be written at one of three
 * scopes, all inside content/settings/animations.json:
 *   This element -> elements["<path>|<target>|<n>"]   (only this element on this page)
 *   Target       -> targets["<target>"]               (every element with that data-anim)
 *   Preset       -> presets["<preset>"]               (every target using the preset)
 */
import { h, clear } from './dom.js';
import { ANIMATIONS } from '../../site/files.js';
import { compile } from '../lib/pointer.js';
import { numberField, textField, segmentField, customField, pairField } from './fields.js';
import { easeField } from './ease.js';
import { pageTransitionGroup } from './panel-curtain.js';

const FILE = ANIMATIONS;
// Presets that work on any element; special ones (scatter, hero-title, hover-preview) need their markup.
const GENERIC_TYPES = new Set(['reveal', 'split', 'scrub-words']);

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
const dig = (obj, path) =>
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

const F = {
  duration: {
    path: ['duration'],
    label: 'Duration',
    kind: 'number',
    max: 4,
    step: 0.05,
    unit: 's',
  },
  delay: { path: ['delay'], label: 'Delay', kind: 'number', max: 3, step: 0.05, unit: 's' },
  stagger: {
    path: ['stagger'],
    label: 'Stagger',
    kind: 'number',
    max: 0.4,
    step: 0.005,
    unit: 's',
    hint: 'Delay between children / letters / lines',
  },
  ease: { path: ['ease'], label: 'Ease', kind: 'ease' },
  timing: {
    kind: 'pair',
    label: 'Duration / ease',
    paths: [['duration'], ['ease']],
    max: 4,
    step: 0.05,
    unit: 's',
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

const PROPS = {
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

const TIMING = ['Timing', [F.timing, F.delay, F.stagger]];
const TRIGGER = ['Trigger', [F.trigger, F.start, F.scrub, F.end]];
const GROUPS = {
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
          label: 'Duration / ease',
          paths: [
            ['intro', 'duration'],
            ['intro', 'ease'],
          ],
          max: 4,
          step: 0.05,
          unit: 's',
        },
        n(['intro', 'stagger'], 'Stagger', 0.4, 0.005, 's'),
        n(['intro', 'delay'], 'Delay', 2, 0.05, 's'),
        n(['intro', 'fromScale'], 'From scale', 1.5, 0.01),
      ],
    ],
    [
      'Drift',
      [
        n(['drift', 'amplitude'], 'Amplitude', 60, 1, 'px'),
        n(['drift', 'rotation'], 'Rotation', 15, 0.1, '°'),
        n(['drift', 'minDuration'], 'Min duration', 20, 0.5, 's'),
        n(['drift', 'maxDuration'], 'Max duration', 20, 0.5, 's'),
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
        n(['glide'], 'Glide between rows', 1.5, 0.01, 's'),
      ],
    ],
  ],
};

export function createMotionPanel({ store, bridge, root, toast }) {
  let sel = null; // { el, id, key }
  let scope = 'target';
  let updaters = [];
  let signature = '';
  let scrubInput = null;

  const cfg = () => store.current[FILE];

  function model() {
    const c = cfg();
    const target = c.targets[sel.id] || {};
    const own = c.elements?.[sel.key] || {};
    const presetName = own.preset || target.preset;
    const preset = c.presets[presetName] || {};
    const strip = ({ preset: _p, ...rest }) => rest;
    const layers = { element: strip(own), target: strip(target), preset, defaults: c.defaults };
    const spec = merge(layers.defaults, layers.preset, layers.target, layers.element);
    return { c, target, own, presetName, preset, layers, spec, type: preset.type };
  }

  const layerPtr = (m, s = scope) =>
    s === 'element'
      ? `/elements${compile([sel.key])}`
      : s === 'target'
        ? `/targets${compile([sel.id])}`
        : `/presets${compile([m.presetName])}`;
  const keepFor = (s = scope) => (s === 'element' ? 1 : 2);
  const sourceOf = (m, path) =>
    ['element', 'target', 'preset', 'defaults'].find((l) => dig(m.layers[l], path) !== undefined) ||
    null;

  function setValue(path, value) {
    const m = model();
    store.set(FILE, layerPtr(m) + compile(path), value, {
      key: `anim:${scope}:${sel.key}:${path.join('.')}`,
      keep: keepFor(),
      source: 'motion',
    });
  }
  function resetValue(path) {
    const m = model();
    store.remove(FILE, layerPtr(m) + compile(path), { keep: keepFor(), source: 'motion' });
  }
  const meta = (m, path) => ({
    source: sourceOf(m, path),
    canReset: dig(m.layers[scope], path) !== undefined,
  });

  /** Duration + ease on one row (one badge / reset for both). */
  function makePair(def) {
    const [dp, ep] = def.paths;
    const f = pairField({
      label: def.label,
      hint: def.hint,
      min: def.min ?? 0,
      max: def.max,
      step: def.step,
      unit: def.unit,
      ease: easeField({
        gsap: bridge.api.gsap,
        value: 'none',
        compact: true,
        onChange: (v) => setValue(ep, v),
      }),
      onNumber: (v) => setValue(dp, v),
      onReset: () =>
        store.batch(
          () => {
            resetValue(dp);
            resetValue(ep);
          },
          { source: 'motion' },
        ),
    });
    updaters.push((m) => f.update([dig(m.spec, dp), dig(m.spec, ep)], [meta(m, dp), meta(m, ep)]));
    return f.el;
  }

  function makeField(def) {
    if (def.kind === 'pair') return makePair(def);
    const common = { label: def.label, hint: def.hint, onReset: () => resetValue(def.path) };
    const onChange = (v) => setValue(def.path, v);
    let f;
    if (def.kind === 'number')
      f = numberField({
        ...common,
        min: def.min ?? 0,
        max: def.max,
        step: def.step,
        unit: def.unit,
        onChange,
      });
    else if (def.kind === 'text')
      f = textField({ ...common, suggestions: def.suggestions, onChange });
    else if (def.kind === 'segment')
      f = segmentField({ ...common, options: def.options, onChange });
    else if (def.kind === 'ease')
      f = customField({
        ...common,
        control: easeField({ gsap: bridge.api.gsap, value: 'none', onChange }),
      });
    updaters.push((m) => f.update(dig(m.spec, def.path), meta(m, def.path)));
    return f.el;
  }

  function propsGroup(which, m) {
    const values = m.spec[which] || {};
    const rows = Object.keys(values).map((prop) => {
      const p = PROPS[prop] || {
        label: prop,
        min: -200,
        max: 200,
        step: 1,
        text: typeof values[prop] !== 'number',
      };
      const def = p.text
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
      return makeField(def);
    });
    const missing = Object.keys(PROPS).filter(
      (k) => !(k in values) && !(k === 'opacity' && 'autoAlpha' in values),
    );
    const add = h(
      'select',
      {
        class: 'f__add',
        onchange: () => {
          const prop = add.value;
          if (!prop) return;
          const other = which === 'from' ? 'to' : 'from';
          store.batch(
            () => {
              setValue([which, prop], which === 'from' ? PROPS[prop].init : PROPS[prop].neutral);
              // A from-value needs a matching to-value (and vice versa) or GSAP would only set it.
              if (dig(m.spec, [other, prop]) === undefined)
                setValue([other, prop], which === 'from' ? PROPS[prop].neutral : PROPS[prop].init);
            },
            { source: 'motion-structure' },
          );
        },
      },
      h('option', { value: '' }, '+ add property'),
      missing.map((k) => h('option', { value: k }, PROPS[k].label)),
    );
    return group(which === 'from' ? 'From (start state)' : 'To (end state)', [...rows, add]);
  }

  const group = (title, children) =>
    h('section', { class: 'grp' }, h('h4', { class: 'grp__title' }, title), children);

  function renderList() {
    const items = bridge.animElements();
    const els = cfg().elements || {};
    return h(
      'div',
      { class: 'mlist' },
      pageTransitionGroup(store, bridge),
      h(
        'p',
        { class: 'hint' },
        'Click an animated element in the preview, or pick one below. Hold Alt to click through to links.',
      ),
      items.length
        ? h(
            'ol',
            { class: 'mlist__items' },
            items.map(({ el, id, key }) => {
              const m = { own: els[key], target: cfg().targets[id] };
              const preset = m.own?.preset || m.target?.preset || '?';
              return h(
                'li',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'mlist__item',
                    onclick: () => {
                      bridge.reveal(el);
                      bridge.select(el, 'anim');
                    },
                    onpointerenter: () => bridge.setHover(el),
                    onpointerleave: () => bridge.setHover(null),
                  },
                  h(
                    'span',
                    { class: 'mlist__id' },
                    id,
                    m.own ? h('i', { class: 'dot', title: 'Has element overrides' }) : null,
                  ),
                  h('span', { class: 'mlist__preset' }, preset),
                ),
              );
            }),
          )
        : h('p', { class: 'hint' }, 'No animated elements on this page.'),
    );
  }

  function renderSelected() {
    updaters = [];
    const m = model();
    const sameTarget = bridge.animElements().filter((x) => x.id === sel.id).length;
    const usage = Object.values(m.c.targets).filter((t) => t.preset === m.presetName).length;
    const scopes = [
      ['element', 'This element', `Only this element on ${sel.key.split('|')[0]}`],
      [
        'target',
        `All “${sel.id}”`,
        `Every data-anim="${sel.id}" element on the site (${sameTarget} on this page)`,
      ],
      [
        'preset',
        `Preset “${m.presetName}”`,
        `The preset itself: used by ${usage} target${usage === 1 ? '' : 's'}`,
      ],
    ];
    const head = h(
      'div',
      { class: 'msel__head' },
      h(
        'button',
        { type: 'button', class: 'link', onclick: () => bridge.select(null) },
        '← All animations',
      ),
      h('h3', { class: 'msel__title' }, sel.id),
      h(
        'code',
        { class: 'msel__key', title: 'Stable element key used for element overrides' },
        sel.key,
      ),
    );
    const actions = h(
      'div',
      { class: 'msel__actions' },
      h(
        'button',
        { type: 'button', class: 'btn-ed', onclick: () => bridge.replay(sel.el) },
        h('i', { class: 'fa-solid fa-play', 'aria-hidden': 'true' }),
        ' Replay',
      ),
      scrubber(),
    );
    const scopeSeg = h(
      'div',
      { class: 'scope' },
      h(
        'div',
        { class: 'seg' },
        scopes.map(([s, label, title]) =>
          h(
            'button',
            {
              type: 'button',
              class: ['seg__btn', s === scope && 'is-active'],
              title,
              onclick: () => {
                scope = s;
                render(true);
              },
            },
            label,
          ),
        ),
      ),
      h('p', { class: 'hint' }, 'Edits apply to: ', scopes.find((s) => s[0] === scope)[2], '.'),
    );
    const presets = Object.entries(m.c.presets).filter(
      ([name, p]) => GENERIC_TYPES.has(p.type) || name === m.presetName,
    );
    const presetRow =
      scope === 'preset'
        ? h(
            'p',
            { class: 'hint' },
            `Type: ${m.type}. Changing values here affects every target that uses “${m.presetName}”.`,
          )
        : h(
            'div',
            { class: 'f' },
            h(
              'div',
              { class: 'f__top' },
              h('label', { class: 'f__label' }, 'Preset'),
              h(
                'span',
                { class: 'f__src', dataset: { src: m.own.preset ? 'element' : 'target' } },
                m.own.preset ? 'element' : 'target',
              ),
              scope === 'element' && m.own.preset
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'f__reset',
                      title: 'Use the target preset',
                      onclick: () =>
                        store.remove(FILE, `${layerPtr(m)}/preset`, {
                          keep: 1,
                          source: 'motion-structure',
                        }),
                    },
                    h('i', { class: 'fa-solid fa-rotate-left', 'aria-hidden': 'true' }),
                  )
                : null,
            ),
            h(
              'select',
              {
                class: 'f__select',
                onchange: (e) => {
                  const name = e.target.value;
                  if (scope === 'element' && name === m.target.preset)
                    store.remove(FILE, `${layerPtr(m)}/preset`, {
                      keep: 1,
                      source: 'motion-structure',
                    });
                  else
                    store.set(FILE, `${layerPtr(m)}/preset`, name, {
                      keep: keepFor(),
                      source: 'motion-structure',
                    });
                },
              },
              presets.map(([name, p]) =>
                h(
                  'option',
                  { value: name, selected: name === m.presetName },
                  `${name}  (${p.type})`,
                ),
              ),
            ),
          );

    const groups = (GROUPS[m.type] || [TIMING]).map((g) => {
      if (g === 'from' || g === 'to') return m.spec[g] ? propsGroup(g, m) : null;
      const [title, defs] = g;
      const visible = defs.filter((d) => !d.when || d.when(m.spec));
      return visible.length ? group(title, visible.map(makeField)) : null;
    });
    const resetAll =
      m.own && Object.keys(m.own).length
        ? h(
            'button',
            {
              type: 'button',
              class: 'link link--danger',
              onclick: () =>
                store.remove(FILE, `/elements${compile([sel.key])}`, {
                  keep: 1,
                  source: 'motion-structure',
                }),
            },
            'Remove all overrides of this element',
          )
        : null;
    signature = sig(m);
    const out = h('div', { class: 'msel' }, head, actions, scopeSeg, presetRow, groups, resetAll);
    updaters.forEach((u) => u(m));
    return out;
  }

  function scrubber() {
    const label = h('span', { class: 'scrub__val' }, '0%');
    scrubInput = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      step: 0.5,
      class: 'scrub__range',
      value: Math.round(bridge.scrubProgress(sel.el) * 100),
      oninput: (e) => {
        label.textContent = `${Math.round(e.target.value)}%`;
        bridge.scrubTo(sel.el, e.target.value / 100);
      },
    });
    label.textContent = `${Math.round(scrubInput.value)}%`;
    return h(
      'label',
      {
        class: 'scrub',
        title:
          'Scroll the page through this element (0% = entering at the bottom, 100% = leaving at the top)',
      },
      h('span', { class: 'scrub__label' }, 'Scroll'),
      scrubInput,
      label,
    );
  }

  const sig = (m) =>
    JSON.stringify([
      sel.key,
      scope,
      m.presetName,
      m.type,
      m.spec.trigger,
      !!m.spec.scrub,
      Object.keys(m.spec.from || {}),
      Object.keys(m.spec.to || {}),
      !!(m.own && Object.keys(m.own).length),
      !!m.own.preset,
    ]);

  function render(force = false) {
    if (!bridge.api) return clear(root, h('p', { class: 'hint' }, 'Waiting for the preview…'));
    if (!sel) {
      updaters = [];
      // Typing in a page-transition field or dragging its timeline: update in place (keeps focus and the drag).
      const active = document.activeElement;
      const ptg = root.querySelector('.ptg');
      if (
        ptg?.__update &&
        (ptg.__dragging || (active?.matches?.('[data-ptr]') && ptg.contains(active)))
      )
        return ptg.__update();
      const top = root.scrollTop;
      clear(root, renderList());
      root.scrollTop = top;
      return;
    }
    if (!force && sig(model()) === signature) {
      const m = model();
      return updaters.forEach((u) => u(m));
    }
    const top = root.scrollTop;
    clear(root, renderSelected());
    root.scrollTop = top;
  }

  return {
    select(selected) {
      if (selected?.kind === 'anim') {
        const { el } = selected;
        sel = { el, id: el.dataset.anim, key: el.dataset.animKey };
        // Default scope: element if it already has overrides, otherwise the target.
        scope = cfg().elements?.[sel.key] ? 'element' : 'target';
      } else sel = null;
      render(true);
    },
    refresh: (force) => render(force),
    get selection() {
      return sel;
    },
    toast,
  };
}
