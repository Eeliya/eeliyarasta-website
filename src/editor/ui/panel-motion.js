/**
 * Motion panel: pick an animated element (click it in the preview or in the list),
 * then edit its preset and parameters. Every value can be written at one of three
 * scopes, all inside content/animations.json:
 *   This element -> elements["<path>|<target>|<n>"]   (only this element on this page)
 *   Target       -> targets["<target>"]               (every element with that data-anim)
 *   Preset       -> presets["<preset>"]               (every target using the preset)
 */
import { h, clear } from './dom.js';
import { compile } from '../lib/pointer.js';
import { numberField, textField, segmentField, customField, pairField } from './fields.js';
import { easeField } from './ease.js';
import { normalizeCurtain, curtainPlan } from '../../client/anim/curtain.js';

const FILE = 'animations.json';
// Presets that work on any element; special ones (scatter, hero-title, hover-preview) need their markup.
const GENERIC_TYPES = new Set(['reveal', 'split', 'scrub-words']);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (...objs) => {
  const out = {};
  for (const o of objs) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out;
};
const dig = (obj, path) => path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

const START = ['top bottom', 'top 95%', 'top 90%', 'top 85%', 'top 75%', 'top center', 'center center'];
const END = ['bottom top', 'bottom center', 'bottom 60%', 'top 40%', 'center center', 'top top'];

const F = {
  duration: { path: ['duration'], label: 'Duration', kind: 'number', max: 4, step: 0.05, unit: 's' },
  delay: { path: ['delay'], label: 'Delay', kind: 'number', max: 3, step: 0.05, unit: 's' },
  stagger: { path: ['stagger'], label: 'Stagger', kind: 'number', max: 0.4, step: 0.005, unit: 's', hint: 'Delay between children / letters / lines' },
  ease: { path: ['ease'], label: 'Ease', kind: 'ease' },
  timing: { kind: 'pair', label: 'Duration / ease', paths: [['duration'], ['ease']], max: 4, step: 0.05, unit: 's' },
  trigger: { path: ['trigger'], label: 'Plays', kind: 'segment', options: [['load', 'On load'], ['scroll', 'On scroll']] },
  start: { path: ['start'], label: 'Scroll start', kind: 'text', suggestions: START, when: (s) => s.trigger === 'scroll', hint: '"<element edge> <viewport edge>", e.g. "top 85%"' },
  scrub: { path: ['scrub'], label: 'Scrub', kind: 'segment', options: [[false, 'Off'], [true, 'On'], [1, 'Smooth']], when: (s) => s.trigger === 'scroll', hint: 'Tie progress to the scroll position' },
  end: { path: ['end'], label: 'Scroll end', kind: 'text', suggestions: END, when: (s) => s.trigger === 'scroll' && s.scrub },
  split: { path: ['split'], label: 'Split into', kind: 'segment', options: [['chars', 'Chars'], ['words', 'Words'], ['lines', 'Lines']] },
  mask: { path: ['mask'], label: 'Mask', kind: 'segment', options: [[false, 'None'], ['chars', 'Chars'], ['words', 'Words'], ['lines', 'Lines']] },
};
const n = (path, label, max, step, unit = '', min = 0) => ({ path, label, kind: 'number', min, max, step, unit });

const PROPS = {
  y: { label: 'Distance Y', min: -200, max: 200, step: 1, unit: 'px', neutral: 0, init: 40 },
  x: { label: 'Distance X', min: -200, max: 200, step: 1, unit: 'px', neutral: 0, init: 40 },
  yPercent: { label: 'Distance Y %', min: -150, max: 150, step: 1, unit: '%', neutral: 0, init: 100 },
  xPercent: { label: 'Distance X %', min: -150, max: 150, step: 1, unit: '%', neutral: 0, init: 100 },
  scale: { label: 'Scale', min: 0, max: 2, step: 0.01, neutral: 1, init: 0.9 },
  rotate: { label: 'Rotation', min: -45, max: 45, step: 0.5, unit: '°', neutral: 0, init: 6 },
  autoAlpha: { label: 'Opacity', min: 0, max: 1, step: 0.01, neutral: 1, init: 0 },
  opacity: { label: 'Opacity (raw)', min: 0, max: 1, step: 0.01, neutral: 1, init: 0 },
  clipPath: { label: 'Clip path', text: true, neutral: 'inset(0% 0% 0% 0%)', init: 'inset(100% 0% 0% 0%)', suggestions: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 100% 0%)', 'inset(0% 100% 0% 0%)', 'inset(30% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] },
  filter: { label: 'Filter', text: true, neutral: 'blur(0px)', init: 'blur(12px)', suggestions: ['blur(12px)', 'blur(0px)'] },
};

const TIMING = ['Timing', [F.timing, F.delay, F.stagger]];
const TRIGGER = ['Trigger', [F.trigger, F.start, F.scrub, F.end]];
const GROUPS = {
  reveal: [TIMING, TRIGGER, 'from', 'to'],
  split: [['Split', [F.split, F.mask]], TIMING, TRIGGER, 'from', 'to'],
  'scrub-words': [['Scroll', [n(['fromOpacity'], 'Dim words opacity', 1, 0.01), { ...F.start, when: null }, { ...F.end, when: null }]]],
  parallax: [['Parallax', [n(['speed'], 'Speed', 40, 1, '%'), { ...F.scrub, options: [[true, 'On'], [0.5, 'Smooth .5'], [1.5, 'Smooth 1.5']], when: null }]]],
  scatter: [
    ['Intro burst', [{ kind: 'pair', label: 'Duration / ease', paths: [['intro', 'duration'], ['intro', 'ease']], max: 4, step: 0.05, unit: 's' }, n(['intro', 'stagger'], 'Stagger', 0.4, 0.005, 's'), n(['intro', 'delay'], 'Delay', 2, 0.05, 's'), n(['intro', 'fromScale'], 'From scale', 1.5, 0.01)]],
    ['Drift', [n(['drift', 'amplitude'], 'Amplitude', 60, 1, 'px'), n(['drift', 'rotation'], 'Rotation', 15, 0.1, '°'), n(['drift', 'minDuration'], 'Min duration', 20, 0.5, 's'), n(['drift', 'maxDuration'], 'Max duration', 20, 0.5, 's')]],
    ['Scroll', [n(['scroll', 'distance'], 'Fly-off distance', 150, 1, '%vh')]],
  ],
  'hero-title': [TIMING, 'from', 'to', ['On scroll', [n(['scroll', 'scale'], 'End scale', 1.5, 0.01), n(['scroll', 'autoAlpha'], 'End opacity', 1, 0.01)]]],
  'hover-preview': [['Preview', [n(['x'], 'Position across the list', 100, 1, '%'), n(['glide'], 'Glide between rows', 1.5, 0.01, 's')]]],
};

const CURTAIN = '/transitions/page/curtain';
const MAX_S = 4;
// Page transition rows, in the order things happen.
//   ['pair', rel, label]  duration + ease of one move, on one row
//   [rel, label, opts]    a single number
const CURTAIN_ROWS = [
  ['pair', '/in', 'Curtain in'],
  ['/textDelay', 'Text starts after curtain (s)', { hint: 'Counted from when the curtain starts coming in. 0 = with the curtain. Same as "Curtain in" = once it is closed.' }],
  ['pair', '/labelIn', 'Text in'],
  ['/hold', 'Text stays (s)', { hint: 'Fully visible. On pages without curtain text, the closed curtain stays this long.' }],
  ['pair', '/labelOut', 'Text out'],
  ['/afterText', 'Curtain leaves after text (s)', { min: -2, hint: 'Counted from when the text is fully gone. 0 = right away. Negative = the curtain starts leaving while the text is still going.' }],
  ['pair', '/out', 'Curtain out'],
];
/**
 * Drag handles on the timeline, in time order per row. at(p, cc) = where the handle sits (s);
 * value(x, p, cc) = the field value for the handle at x, using the plan from when the drag
 * started (none of these depend on their own field, so the maths stays stable while dragging).
 */
const HANDLES = [
  { row: 'c', ptr: '/in/duration', label: 'Curtain in', min: 0, at: (p) => p.closed, value: (x) => x },
  { row: 'c', ptr: '/afterText', label: 'Curtain leaves after text', min: -2, at: (p) => p.outAt, value: (x, p) => x - p.textGone },
  { row: 'c', ptr: '/out/duration', label: 'Curtain out', min: 0, at: (p) => p.outEnd, value: (x, p) => x - p.outAt },
  { row: 't', ptr: '/textDelay', label: 'Text starts after curtain', min: 0, at: (p) => p.textIn, value: (x) => x },
  { row: 't', ptr: '/labelIn/duration', label: 'Text in', min: 0, at: (p, cc) => p.textIn + cc.labelIn.duration, value: (x, p) => x - p.textIn },
  { row: 't', ptr: '/hold', label: 'Text stays', min: 0, at: (p) => p.textOut, value: (x, p, cc) => x - p.textIn - cc.labelIn.duration },
  { row: 't', ptr: '/labelOut/duration', label: 'Text out', min: 0, at: (p) => p.textGone, value: (x, p) => x - p.textOut },
];
const fmtS = (v) => String(Math.round(v * 100) / 100);
const clampS = (v, min) => Math.min(MAX_S, Math.max(min, Number(v.toFixed(2))));
const digRel = (obj, rel) => rel.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
const IDLE = 'Drag the bar ends to change the timing. Shift = 0.1s steps.';

/**
 * Two-row timeline of the curtain and the text (same maths as the router), with draggable
 * bar ends. Elements are built once and only re-laid out, so a drag survives store updates.
 */
function curtainTimeline({ effective, setField, onDrag }) {
  const bars = { c: [], t: [] };
  const handles = [];
  let total = 1;
  let drag = null;
  const readout = h('div', { class: 'ptl__readout' }, IDLE);
  const axis = h('div', { class: 'ptl__axis' });
  let axisFor = null;

  const near = (track, row, clientX, pointerType) => {
    const cc = effective();
    const p = curtainPlan(cc, true);
    const r = track.getBoundingClientRect();
    const px = clientX - r.left;
    const tol = pointerType === 'touch' ? 16 : 8;
    const hits = handles.filter((el) => el.__def.row === row)
      .map((el) => ({ el, d: Math.abs((el.__def.at(p, cc) / total) * r.width - px) }))
      .filter((c) => c.d <= tol);
    if (!hits.length) return null;
    const best = Math.min(...hits.map((c) => c.d));
    return { list: hits.filter((c) => c.d - best < 2).map((c) => c.el), p, cc };
  };
  const show = (def, v) => {
    readout.textContent = def.label + ': ' + fmtS(v) + 's';
    readout.classList.add('is-on');
  };
  const idle = () => {
    readout.textContent = IDLE;
    readout.classList.remove('is-on');
  };
  const begin = (el) => {
    drag.el = el;
    el.classList.add('is-active');
    show(el.__def, digRel(drag.cc0, el.__def.ptr) ?? 0);
  };

  function track(row, name) {
    const barsEl = h('div', { class: 'ptl__bars' });
    for (let i = 0; i < 3; i++) {
      const bar = h('i', { class: ['ptl__bar', i === 1 ? 'is-hold' : 'is-move', row === 't' && 'is-text'] });
      bars[row].push(bar);
      barsEl.append(bar);
    }
    const el = h('div', { class: 'ptl__track' }, h('div', { class: 'ptl__grid' }), barsEl);
    for (const def of HANDLES.filter((d) => d.row === row)) {
      const hd = h('button', {
        type: 'button', class: 'ptl__handle', title: def.label + ' (drag, or arrow keys)', 'aria-label': def.label, dataset: { ptr: CURTAIN + def.ptr },
        onkeydown: (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const cur = digRel(effective(), def.ptr) ?? 0;
          const v = clampS(cur + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01), def.min);
          setField(def.ptr, v);
          show(def, v);
        },
        onblur: () => !drag && idle(),
      });
      hd.__def = def;
      handles.push(hd);
      el.append(hd);
    }
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const hit = near(el, row, e.clientX, e.pointerType);
      if (!hit) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, track: el, x0: e.clientX, list: hit.list, el: null, p0: hit.p, cc0: hit.cc };
      root.classList.add('is-dragging');
      onDrag(true);
      if (hit.list.length === 1) begin(hit.list[0]);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) {
        el.style.cursor = near(el, row, e.clientX, e.pointerType) ? 'ew-resize' : '';
        return;
      }
      if (e.pointerId !== drag.id) return;
      if (!drag.el) {
        // Several ends on the same spot: the drag direction decides (right = the later one).
        const dx = e.clientX - drag.x0;
        if (Math.abs(dx) < 3) return;
        begin(dx > 0 ? drag.list.at(-1) : drag.list[0]);
      }
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * total;
      const def = drag.el.__def;
      const step = e.shiftKey ? 0.1 : 0.01;
      const v = clampS(Math.round(def.value(x, drag.p0, drag.cc0) / step) * step, def.min);
      setField(def.ptr, v);
      show(def, v);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.el?.classList.remove('is-active');
      drag = null;
      root.classList.remove('is-dragging');
      onDrag(false);
      idle();
      layout();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return h('div', { class: 'ptl__row' }, h('span', { class: 'ptl__name' }, name), el);
  }

  const root = h('div', { class: 'ptl' }, track('c', 'Curtain'), track('t', 'Text'), axis, readout);

  function layout() {
    const cc = effective();
    const p = curtainPlan(cc, true);
    // The scale stays put while dragging so the bars don't slide under the pointer.
    if (!drag) total = Math.max(1, Math.ceil((p.end + 0.2) / 0.5) * 0.5);
    const pct = (v) => (v / total) * 100 + '%';
    const place = (bar, from, to, title) => {
      const f = Math.max(0, from);
      bar.style.left = pct(f);
      bar.style.width = pct(Math.max(0, to - f));
      bar.title = title;
    };
    place(bars.c[0], 0, p.closed, 'Comes in: 0 to ' + fmtS(p.closed) + 's');
    place(bars.c[1], p.closed, p.outAt, 'Closed');
    place(bars.c[2], p.outAt, p.outEnd, 'Leaves: ' + fmtS(p.outAt) + ' to ' + fmtS(p.outEnd) + 's');
    place(bars.t[0], p.textIn, p.textIn + cc.labelIn.duration, 'Comes in: ' + fmtS(p.textIn) + 's');
    place(bars.t[1], p.textIn + cc.labelIn.duration, p.textOut, 'Stays');
    place(bars.t[2], p.textOut, p.textGone, 'Leaves, gone at ' + fmtS(p.textGone) + 's');
    for (const hd of handles) hd.style.left = pct(hd.__def.at(p, cc));
    root.style.setProperty('--tick', pct(0.5));
    if (axisFor !== total) {
      axisFor = total;
      const every = total <= 3 ? 0.5 : 1;
      const marks = [];
      for (let t = 0; t <= total + 1e-6; t += every) marks.push(h('span', { style: { left: pct(t) } }, fmtS(t) + 's'));
      clear(axis, marks);
    }
  }
  layout();
  return { el: root, layout, get dragging() { return !!drag; } };
}

function pageTransitionGroup(store, bridge) {
  const get = (ptr) => store.get(FILE, ptr);
  const base = (ptr) => store.getBase(FILE, ptr);
  const set = (ptr, value, key) => store.set(FILE, ptr, value, { key, source: 'panel' });
  const effective = () => normalizeCurtain(get(CURTAIN) ?? true);
  const isChanged = (ptr) => JSON.stringify(get(ptr)) !== JSON.stringify(base(ptr));
  const numbers = [];
  const eases = [];
  const head = (label) => h('label', { class: 'tf__label' }, h('span', { class: 'tf__file' }, 'animations'), label, h('i', { class: 'dot', title: 'Changed' }));
  const numInput = (ptr, rel, cls, { step = 0.01, min = 0 } = {}) => h('input', {
    class: cls,
    type: 'number',
    step: String(step),
    min: String(min),
    max: String(MAX_S),
    value: get(ptr) ?? '',
    placeholder: fmtS(digRel(effective(), rel) ?? 0),
    dataset: { ptr },
    oninput: (e) => {
      const n = Number(e.target.value);
      const ok = e.target.value.trim() !== '' && Number.isFinite(n) && n >= min;
      e.target.classList.toggle('is-invalid', !ok);
      if (ok) set(ptr, n, 'curtain:' + ptr);
    },
  });
  const single = (rel, label, { min = 0, hint } = {}) => {
    const ptr = CURTAIN + rel;
    const input = numInput(ptr, rel, 'tf__input', { min });
    const changed = () => isChanged(ptr);
    const wrap = h('div', { class: ['tf', changed() && 'is-changed'] }, head(label), input, hint ? h('p', { class: 'hint small tf__hint' }, hint) : null);
    numbers.push({ ptr, rel, input, wrap, changed });
    return wrap;
  };
  // Duration + ease of one move on a single row.
  const pair = (rel, label) => {
    const dPtr = CURTAIN + rel + '/duration';
    const ePtr = CURTAIN + rel + '/ease';
    const input = numInput(dPtr, rel + '/duration', 'f__num');
    input.title = label + ' duration (seconds)';
    const ease = easeField({
      gsap: bridge.api?.gsap,
      value: get(ePtr) || digRel(effective(), rel + '/ease') || 'expo.inOut',
      compact: true,
      onChange: (v) => set(ePtr, v, 'curtain:' + ePtr),
    });
    const changed = () => isChanged(dPtr) || isChanged(ePtr);
    const wrap = h('div', { class: ['tf', changed() && 'is-changed'] },
      head(label),
      h('div', { class: 'f__pair' }, h('span', { class: 'f__numwrap' }, input, h('span', { class: 'f__unit' }, 's')), ease.el),
    );
    numbers.push({ ptr: dPtr, rel: rel + '/duration', input, wrap, changed });
    eases.push({ ptr: ePtr, rel: rel + '/ease', ease });
    return wrap;
  };
  const timeline = curtainTimeline({
    effective,
    setField: (rel, v) => set(CURTAIN + rel, v, 'curtain:' + CURTAIN + rel),
    onDrag: (on) => (el.__dragging = on),
  });
  const replay = h('button', {
    type: 'button',
    class: 'btn-ed',
    title: 'Play the transition over this page with the values above (no navigation)',
    onclick: () => bridge.api?.replayCurtain?.(),
  }, '\u21ba Replay');
  const el = h('section', { class: 'grp ptg' },
    h('h4', { class: 'grp__title' }, 'Page transition'),
    h('p', { class: 'hint' }, 'Site-wide curtain timing, in the order things happen. Drag the bar ends or type the values. The text itself is edited per page under Content \u2192 Page transition. Changes apply to the next page change in the preview.'),
    h('div', { class: 'ptg__actions' }, replay),
    h('div', { class: 'ptl-box' }, timeline.el),
    CURTAIN_ROWS.map(([kind, ...rest]) => (kind === 'pair' ? pair(...rest) : single(kind, ...rest))),
  );
  // Refresh in place (while typing in a field or dragging the timeline) without re-rendering.
  el.__update = () => {
    const eff = effective();
    timeline.layout();
    for (const r of numbers) {
      const v = get(r.ptr);
      r.wrap.classList.toggle('is-changed', r.changed());
      r.input.placeholder = fmtS(digRel(eff, r.rel) ?? 0);
      if (r.input !== document.activeElement && r.input.value !== String(v ?? '')) r.input.value = v ?? '';
    }
    for (const r of eases) r.ease.update(get(r.ptr) || digRel(eff, r.rel));
  };
  return el;
}

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
    s === 'element' ? `/elements${compile([sel.key])}` : s === 'target' ? `/targets${compile([sel.id])}` : `/presets${compile([m.presetName])}`;
  const keepFor = (s = scope) => (s === 'element' ? 1 : 2);
  const sourceOf = (m, path) => ['element', 'target', 'preset', 'defaults'].find((l) => dig(m.layers[l], path) !== undefined) || null;

  function setValue(path, value) {
    const m = model();
    store.set(FILE, layerPtr(m) + compile(path), value, { key: `anim:${scope}:${sel.key}:${path.join('.')}`, keep: keepFor(), source: 'motion' });
  }
  function resetValue(path) {
    const m = model();
    store.remove(FILE, layerPtr(m) + compile(path), { keep: keepFor(), source: 'motion' });
  }
  const meta = (m, path) => ({ source: sourceOf(m, path), canReset: dig(m.layers[scope], path) !== undefined });

  /** Duration + ease on one row (one badge / reset for both). */
  function makePair(def) {
    const [dp, ep] = def.paths;
    const f = pairField({
      label: def.label, hint: def.hint, min: def.min ?? 0, max: def.max, step: def.step, unit: def.unit,
      ease: easeField({ gsap: bridge.api.gsap, value: 'none', compact: true, onChange: (v) => setValue(ep, v) }),
      onNumber: (v) => setValue(dp, v),
      onReset: () => store.batch(() => { resetValue(dp); resetValue(ep); }, { source: 'motion' }),
    });
    updaters.push((m) => f.update([dig(m.spec, dp), dig(m.spec, ep)], [meta(m, dp), meta(m, ep)]));
    return f.el;
  }

  function makeField(def) {
    if (def.kind === 'pair') return makePair(def);
    const common = { label: def.label, hint: def.hint, onReset: () => resetValue(def.path) };
    const onChange = (v) => setValue(def.path, v);
    let f;
    if (def.kind === 'number') f = numberField({ ...common, min: def.min ?? 0, max: def.max, step: def.step, unit: def.unit, onChange });
    else if (def.kind === 'text') f = textField({ ...common, suggestions: def.suggestions, onChange });
    else if (def.kind === 'segment') f = segmentField({ ...common, options: def.options, onChange });
    else if (def.kind === 'ease') f = customField({ ...common, control: easeField({ gsap: bridge.api.gsap, value: 'none', onChange }) });
    updaters.push((m) => f.update(dig(m.spec, def.path), meta(m, def.path)));
    return f.el;
  }

  function propsGroup(which, m) {
    const values = m.spec[which] || {};
    const rows = Object.keys(values).map((prop) => {
      const p = PROPS[prop] || { label: prop, min: -200, max: 200, step: 1, text: typeof values[prop] !== 'number' };
      const def = p.text
        ? { path: [which, prop], label: p.label, kind: 'text', suggestions: p.suggestions || [] }
        : { path: [which, prop], label: p.label, kind: 'number', min: p.min, max: p.max, step: p.step, unit: p.unit };
      return makeField(def);
    });
    const missing = Object.keys(PROPS).filter((k) => !(k in values) && !(k === 'opacity' && 'autoAlpha' in values));
    const add = h('select', {
      class: 'f__add',
      onchange: () => {
        const prop = add.value;
        if (!prop) return;
        const other = which === 'from' ? 'to' : 'from';
        store.batch(() => {
          setValue([which, prop], which === 'from' ? PROPS[prop].init : PROPS[prop].neutral);
          // A from-value needs a matching to-value (and vice versa) or GSAP would only set it.
          if (dig(m.spec, [other, prop]) === undefined) setValue([other, prop], which === 'from' ? PROPS[prop].neutral : PROPS[prop].init);
        }, { source: 'motion-structure' });
      },
    }, h('option', { value: '' }, '+ add property'), missing.map((k) => h('option', { value: k }, PROPS[k].label)));
    return group(which === 'from' ? 'From (start state)' : 'To (end state)', [...rows, add]);
  }

  const group = (title, children) => h('section', { class: 'grp' }, h('h4', { class: 'grp__title' }, title), children);

  function renderList() {
    const items = bridge.animElements();
    const els = cfg().elements || {};
    return h('div', { class: 'mlist' },
      pageTransitionGroup(store, bridge),
      h('p', { class: 'hint' }, 'Click an animated element in the preview, or pick one below. Hold Alt to click through to links.'),
      items.length ? h('ol', { class: 'mlist__items' }, items.map(({ el, id, key }) => {
        const m = { own: els[key], target: cfg().targets[id] };
        const preset = m.own?.preset || m.target?.preset || '?';
        return h('li', {}, h('button', {
          type: 'button', class: 'mlist__item',
          onclick: () => { bridge.reveal(el); bridge.select(el, 'anim'); },
          onpointerenter: () => bridge.setHover(el),
          onpointerleave: () => bridge.setHover(null),
        },
        h('span', { class: 'mlist__id' }, id, m.own ? h('i', { class: 'dot', title: 'Has element overrides' }) : null),
        h('span', { class: 'mlist__preset' }, preset)));
      })) : h('p', { class: 'hint' }, 'No animated elements on this page.'),
    );
  }

  function renderSelected() {
    updaters = [];
    const m = model();
    const sameTarget = bridge.animElements().filter((x) => x.id === sel.id).length;
    const usage = Object.values(m.c.targets).filter((t) => t.preset === m.presetName).length;
    const scopes = [
      ['element', 'This element', `Only this element on ${sel.key.split('|')[0]}`],
      ['target', `All “${sel.id}”`, `Every data-anim="${sel.id}" element on the site (${sameTarget} on this page)`],
      ['preset', `Preset “${m.presetName}”`, `The preset itself: used by ${usage} target${usage === 1 ? '' : 's'}`],
    ];
    const head = h('div', { class: 'msel__head' },
      h('button', { type: 'button', class: 'link', onclick: () => bridge.select(null) }, '← All animations'),
      h('h3', { class: 'msel__title' }, sel.id),
      h('code', { class: 'msel__key', title: 'Stable element key used for element overrides' }, sel.key),
    );
    const actions = h('div', { class: 'msel__actions' },
      h('button', { type: 'button', class: 'btn-ed', onclick: () => bridge.replay(sel.el) }, '▶ Replay'),
      scrubber(),
    );
    const scopeSeg = h('div', { class: 'scope' },
      h('div', { class: 'seg' }, scopes.map(([s, label, title]) =>
        h('button', { type: 'button', class: ['seg__btn', s === scope && 'is-active'], title, onclick: () => { scope = s; render(true); } }, label))),
      h('p', { class: 'hint' }, 'Edits apply to: ', scopes.find((s) => s[0] === scope)[2], '.'),
    );
    const presets = Object.entries(m.c.presets).filter(([name, p]) => GENERIC_TYPES.has(p.type) || name === m.presetName);
    const presetRow = scope === 'preset'
      ? h('p', { class: 'hint' }, `Type: ${m.type}. Changing values here affects every target that uses “${m.presetName}”.`)
      : h('div', { class: 'f' },
        h('div', { class: 'f__top' }, h('label', { class: 'f__label' }, 'Preset'),
          h('span', { class: 'f__src', dataset: { src: m.own.preset ? 'element' : 'target' } }, m.own.preset ? 'element' : 'target'),
          scope === 'element' && m.own.preset ? h('button', { type: 'button', class: 'f__reset', title: 'Use the target preset', onclick: () => store.remove(FILE, `${layerPtr(m)}/preset`, { keep: 1, source: 'motion-structure' }) }, '↺') : null),
        h('select', {
          class: 'f__select',
          onchange: (e) => {
            const name = e.target.value;
            if (scope === 'element' && name === m.target.preset) store.remove(FILE, `${layerPtr(m)}/preset`, { keep: 1, source: 'motion-structure' });
            else store.set(FILE, `${layerPtr(m)}/preset`, name, { keep: keepFor(), source: 'motion-structure' });
          },
        }, presets.map(([name, p]) => h('option', { value: name, selected: name === m.presetName }, `${name}  (${p.type})`))),
      );

    const groups = (GROUPS[m.type] || [TIMING]).map((g) => {
      if (g === 'from' || g === 'to') return m.spec[g] ? propsGroup(g, m) : null;
      const [title, defs] = g;
      const visible = defs.filter((d) => !d.when || d.when(m.spec));
      return visible.length ? group(title, visible.map(makeField)) : null;
    });
    const resetAll = m.own && Object.keys(m.own).length
      ? h('button', { type: 'button', class: 'link link--danger', onclick: () => store.remove(FILE, `/elements${compile([sel.key])}`, { keep: 1, source: 'motion-structure' }) }, 'Remove all overrides of this element')
      : null;
    signature = sig(m);
    const out = h('div', { class: 'msel' }, head, actions, scopeSeg, presetRow, groups, resetAll);
    updaters.forEach((u) => u(m));
    return out;
  }

  function scrubber() {
    const label = h('span', { class: 'scrub__val' }, '0%');
    scrubInput = h('input', {
      type: 'range', min: 0, max: 100, step: 0.5, class: 'scrub__range',
      value: Math.round(bridge.scrubProgress(sel.el) * 100),
      oninput: (e) => { label.textContent = `${Math.round(e.target.value)}%`; bridge.scrubTo(sel.el, e.target.value / 100); },
    });
    label.textContent = `${Math.round(scrubInput.value)}%`;
    return h('label', { class: 'scrub', title: 'Scroll the page through this element (0% = entering at the bottom, 100% = leaving at the top)' },
      h('span', { class: 'scrub__label' }, 'Scroll'), scrubInput, label);
  }

  const sig = (m) => JSON.stringify([sel.key, scope, m.presetName, m.type, m.spec.trigger, !!m.spec.scrub, Object.keys(m.spec.from || {}), Object.keys(m.spec.to || {}), !!(m.own && Object.keys(m.own).length), !!m.own.preset]);

  function render(force = false) {
    if (!bridge.api) return clear(root, h('p', { class: 'hint' }, 'Waiting for the preview…'));
    if (!sel) {
      updaters = [];
      // Typing in a page-transition field or dragging its timeline: update in place (keeps focus and the drag).
      const active = document.activeElement;
      const ptg = root.querySelector('.ptg');
      if (ptg?.__update && (ptg.__dragging || (active?.matches?.('[data-ptr]') && ptg.contains(active)))) return ptg.__update();
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
    get selection() { return sel; },
    toast,
  };
}
