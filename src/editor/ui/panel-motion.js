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

const CURTAIN = '/transitions/page/curtain';
const TOTAL_PTR = CURTAIN + '/total';
const TOTAL_MAX = 12;
const EASE_PTRS = ['/in/ease', '/labelIn/ease', '/labelOut/ease', '/out/ease'];
const EASE_MODE_PTR = CURTAIN + '/easeMode';
const SHARED_EASE_PTR = CURTAIN + '/ease';
// Individual curtain fields live under Advanced. 'pair' = duration + ease on one row.
const CURTAIN_ROWS = [
  ['pair', '/in', 'Curtain in'],
  ['/textDelay', 'Text in starts (s)', { hint: 'Absolute start of the text-in bar from t=0.' }],
  ['pair', '/labelIn', 'Text in'],
  [
    '/hold',
    'Text stays (s)',
    {
      hint: 'Gap between text-in and text-out on the timeline. Drag either facing edge, or set it here. On pages without curtain text, the closed curtain stays this long.',
    },
  ],
  [
    '/textOutStart',
    'Text out starts (s)',
    {
      min: 0,
      hint: 'Absolute start of the text-out bar. The gap before it is how long the text stays.',
    },
  ],
  ['pair', '/labelOut', 'Text out'],
  [
    '/outStart',
    'Curtain out starts (s)',
    {
      min: 0,
      hint: 'Absolute time from the start of the transition. Independent of the text. The curtain-out bar runs from here to total.',
    },
  ],
  ['pair', '/out', 'Curtain out'],
];
/**
 * Drag handles on the timeline, in time order per row. at(p, cc) = where the handle sits (s);
 * value(x, p, cc) = the field value for the handle at x, using the plan from when the drag
 * started (none of these depend on their own field, so the maths stays stable while dragging).
 * The curtain-out end is pinned to total duration — no handle there.
 */
const HANDLES = [
  {
    row: 'c',
    ptr: '/in/duration',
    label: 'Curtain in',
    min: 0,
    at: (p) => p.closed,
    value: (x) => x,
  },
  {
    row: 'c',
    ptr: '/outStart',
    label: 'Curtain out starts',
    min: 0,
    at: (p) => p.outAt,
    value: (x) => x,
  },
  // Text in: left = start, right = duration
  {
    row: 't',
    ptr: '/textDelay',
    label: 'Text in starts',
    min: 0,
    at: (p) => p.textIn,
    value: (x) => x,
  },
  {
    row: 't',
    ptr: '/labelIn/duration',
    label: 'Text in',
    min: 0,
    at: (p, cc) => p.textIn + cc.labelIn.duration,
    value: (x, p) => x - p.textIn,
  },
  // Text out: left = textOutStart on THIS bar, right = duration
  {
    row: 't',
    ptr: '/textOutStart',
    label: 'Text out starts',
    min: 0,
    at: (p) => p.textOut,
    value: (x) => x,
  },
  {
    row: 't',
    ptr: '/labelOut/duration',
    label: 'Text out',
    min: 0,
    at: (p) => p.textGone,
    value: (x, p) => x - p.textOut,
  },
];

/** Body-drag targets: text-in and text-out only (the gap between them is hold). */
const TEXT_SEGS = [
  { startPtr: '/textDelay', durKey: 'labelIn', label: 'Text in' },
  { startPtr: '/textOutStart', durKey: 'labelOut', label: 'Text out' },
];
const segDuration = (cc, key) => cc[key].duration;
const segStart = (p, i) => (i === 0 ? p.textIn : p.textOut);
const fmtS = (v) => String(Math.round(v * 100) / 100);
const digRel = (obj, rel) =>
  rel
    .split('/')
    .filter(Boolean)
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
const IDLE = 'Drag the bar ends to change the timing. Shift = 0.1s steps.';

/** End of the curtain-out bar (and the derived total when /total is unset). */
const curtainOutEnd = (cc) => curtainPlan(cc, true).outEnd;
const leaveStart = (cc) => curtainPlan(cc, true).outAt;

/** Max value for a curtain field so the leave bar still starts at or before `total`. */
function maxForPtr(ptr, cc, total) {
  const t = total;
  const li = cc.labelIn.duration;
  const lo = cc.labelOut.duration;
  const td = cc.textDelay;
  const tos = cc.textOutStart;
  // Text: enter must not pass leave (gap/hold >= 0). Do not push the other bar.
  const textInEnd = td + li;
  switch (ptr) {
    case '/in/duration':
      // Enter end cannot pass leave start.
      return Math.max(0, Math.min(t, leaveStart(cc)));
    case '/outStart':
      return t;
    case '/textDelay':
      return Math.max(0, Math.min(t - li, tos - li));
    case '/labelIn/duration':
      return Math.max(0, Math.min(t - td, tos - td));
    case '/hold':
      return Math.max(0, t - lo - textInEnd);
    case '/textOutStart':
      return Math.max(0, t - lo);
    case '/labelOut/duration':
      return Math.max(0, t - tos);
    case '/out/duration':
      return Math.max(0, t - leaveStart(cc));
    default:
      return TOTAL_MAX;
  }
}

/** Floor so enter end never passes leave start (curtain or text). */
function minForPtr(ptr, cc, min) {
  if (ptr === '/outStart') return Math.max(min, cc.in.duration);
  if (ptr === '/textOutStart') return Math.max(min, cc.textDelay + cc.labelIn.duration);
  return min;
}

function clampField(ptr, v, min, cc, total) {
  const lo = minForPtr(ptr, cc, min);
  const hi = Math.max(lo, maxForPtr(ptr, cc, total));
  const n = Math.min(hi, Math.max(lo, Number(v)));
  return Number(n.toFixed(2));
}

/**
 * Two-row timeline of the curtain and the text (same maths as the router), with draggable
 * bar ends. The axis length is `getTotal()` and does not grow when bars are dragged.
 * Elements are built once and only re-laid out, so a drag survives store updates.
 */
function curtainTimeline({ effective, getTotal, setField, onDrag }) {
  const bars = { c: [], t: [] };
  const handles = [];
  let curtainGap = null; // closed-time label between curtain enter and leave
  let textGap = null; // stay-length label in the gap between text-in and text-out
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
    const hits = handles
      .filter((el) => el.__def.row === row)
      .map((el) => ({ el, d: Math.abs((el.__def.at(p, cc) / total) * r.width - px) }))
      .filter((c) => c.d <= tol);
    if (!hits.length) return null;
    const best = Math.min(...hits.map((c) => c.d));
    return { list: hits.filter((c) => c.d - best < 2).map((c) => c.el), p, cc };
  };
  const textHit = (track, clientX) => {
    const cc = effective();
    const p = curtainPlan(cc, true);
    const r = track.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * total;
    for (let i = 0; i < TEXT_SEGS.length; i++) {
      const start = segStart(p, i);
      const dur = segDuration(cc, TEXT_SEGS[i].durKey);
      if (dur > 1e-6 && x >= start - 1e-6 && x <= start + dur + 1e-6) {
        return { p, cc, seg: i, start, dur, def: TEXT_SEGS[i] };
      }
    }
    return null;
  };
  const show = (label, v) => {
    readout.textContent = label + ': ' + fmtS(v) + 's';
    readout.classList.add('is-on');
  };
  const idle = () => {
    readout.textContent = IDLE;
    readout.classList.remove('is-on');
  };
  const beginHandle = (el) => {
    drag.el = el;
    el.classList.add('is-active');
    show(el.__def.label, digRel(drag.cc0, el.__def.ptr) ?? 0);
  };
  const clampSegStart = (v, dur, tmax, { minStart = 0, maxEnd = null } = {}) => {
    let hi = Math.max(0, tmax - dur);
    if (maxEnd != null) hi = Math.min(hi, Math.max(0, maxEnd - dur));
    return Number(Math.min(hi, Math.max(minStart, v)).toFixed(2));
  };

  function track(row, name) {
    const barsEl = h('div', { class: 'ptl__bars' });
    // Curtain and text: enter + leave only (the wait between is an empty gap).
    const nBars = row === 't' ? TEXT_SEGS.length : 2;
    for (let i = 0; i < nBars; i++) {
      const len = h('span', { class: 'ptl__len', 'aria-hidden': 'true' });
      const seg = row === 't' ? TEXT_SEGS[i] : null;
      const bar = h(
        'i',
        {
          class: ['ptl__bar', 'is-move', row === 't' && 'is-text'],
          ...(seg
            ? {
                tabindex: '0',
                role: 'slider',
                title: 'Drag to move this segment (arrow keys to nudge)',
                'aria-label': 'Move ' + seg.label,
              }
            : {}),
        },
        len,
      );
      bar.__len = len;
      bar.__seg = i;
      if (seg) {
        bar.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const cc = effective();
          const p = curtainPlan(cc, true);
          const dur = segDuration(cc, seg.durKey);
          const cur = segStart(p, i);
          const step = e.shiftKey ? 0.1 : 0.01;
          const raw = cur + (e.key === 'ArrowRight' ? 1 : -1) * step;
          const v = clampSegStart(Math.round(raw / step) * step, dur, getTotal(), {
            minStart: i === 1 ? p.textIn + cc.labelIn.duration : 0,
            maxEnd: i === 0 ? p.textOut : null,
          });
          setField(seg.startPtr, v);
          show(seg.label, v);
        });
        bar.addEventListener('blur', () => !drag && idle());
      }
      bars[row].push(bar);
      barsEl.append(bar);
    }
    {
      const gap = h('span', { class: 'ptl__gap', 'aria-hidden': 'true' });
      const gapLen = h('span', { class: 'ptl__len' });
      gap.append(gapLen);
      gap.__len = gapLen;
      if (row === 'c') curtainGap = gap;
      else textGap = gap;
      barsEl.append(gap);
    }
    const el = h('div', { class: 'ptl__track' }, h('div', { class: 'ptl__grid' }), barsEl);
    for (const def of HANDLES.filter((d) => d.row === row)) {
      const hd = h('button', {
        type: 'button',
        class: 'ptl__handle',
        title: def.label + ' (drag, or arrow keys)',
        'aria-label': def.label,
        dataset: { ptr: CURTAIN + def.ptr },
        onkeydown: (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const cc = effective();
          const cur = digRel(cc, def.ptr) ?? 0;
          const step = e.shiftKey ? 0.1 : 0.01;
          const raw = cur + (e.key === 'ArrowRight' ? 1 : -1) * step;
          const v = clampField(def.ptr, Math.round(raw / step) * step, def.min, cc, getTotal());
          setField(def.ptr, v);
          show(def.label, v);
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
      if (hit) {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        drag = {
          kind: 'handle',
          id: e.pointerId,
          track: el,
          x0: e.clientX,
          list: hit.list,
          el: null,
          p0: hit.p,
          cc0: hit.cc,
        };
        root.classList.add('is-dragging');
        onDrag(true);
        if (hit.list.length === 1) beginHandle(hit.list[0]);
        return;
      }
      if (row !== 't') return;
      const body = textHit(el, e.clientX);
      if (!body) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drag = {
        kind: 'move',
        id: e.pointerId,
        track: el,
        x0: e.clientX,
        start0: body.start,
        dur: body.dur,
        startPtr: body.def.startPtr,
        label: body.def.label,
        p0: body.p,
        cc0: body.cc,
      };
      root.classList.add('is-dragging', 'is-moving');
      onDrag(true);
      show(body.def.label, body.start);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) {
        if (near(el, row, e.clientX, e.pointerType)) el.style.cursor = 'ew-resize';
        else if (row === 't' && textHit(el, e.clientX)) el.style.cursor = 'grab';
        else el.style.cursor = '';
        return;
      }
      if (e.pointerId !== drag.id) return;
      const r = el.getBoundingClientRect();
      const step = e.shiftKey ? 0.1 : 0.01;
      if (drag.kind === 'move') {
        const dx = ((e.clientX - drag.x0) / r.width) * total;
        const raw = Math.round((drag.start0 + dx) / step) * step;
        const v = clampSegStart(raw, drag.dur, getTotal(), {
          minStart:
            drag.startPtr === '/textOutStart' ? drag.p0.textIn + drag.cc0.labelIn.duration : 0,
          maxEnd: drag.startPtr === '/textDelay' ? drag.p0.textOut : null,
        });
        setField(drag.startPtr, v);
        show(drag.label, v);
        return;
      }
      if (!drag.el) {
        // Several ends on the same spot: the drag direction decides (right = the later one).
        const dx = e.clientX - drag.x0;
        if (Math.abs(dx) < 3) return;
        beginHandle(dx > 0 ? drag.list.at(-1) : drag.list[0]);
      }
      const x = ((e.clientX - r.left) / r.width) * total;
      const def = drag.el.__def;
      const raw = Math.round(def.value(x, drag.p0, drag.cc0) / step) * step;
      const v = clampField(def.ptr, raw, def.min, drag.cc0, getTotal());
      setField(def.ptr, v);
      show(def.label, v);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.el?.classList.remove('is-active');
      drag = null;
      root.classList.remove('is-dragging', 'is-moving');
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
    // Axis length is the total-duration window; only the total field rescales it.
    total = Math.max(0.01, getTotal());
    const pct = (v) => (v / total) * 100 + '%';
    const trackW = bars.c[0]?.parentElement?.parentElement?.getBoundingClientRect().width || 0;
    const place = (bar, from, to, title, dur) => {
      const f = Math.max(0, from);
      const w = Math.max(0, to - f);
      bar.style.left = pct(f);
      bar.style.width = pct(w);
      bar.title = title;
      const len = Number((dur != null ? dur : w).toFixed(2));
      bar.__len.textContent = fmtS(len) + 's';
      const px = trackW ? (w / total) * trackW : 0;
      // trackW is 0 on first layout before the box is in the DOM — keep labels visible then.
      bar.__len.hidden = len <= 0 || (trackW > 0 && px < 28);
    };
    // Curtain: enter + leave only. Empty gap between them is closed time (no middle bar).
    const outEnd = total;
    place(bars.c[0], 0, p.closed, 'Comes in: 0 to ' + fmtS(p.closed) + 's', cc.in.duration);
    place(
      bars.c[1],
      p.outAt,
      outEnd,
      'Leaves: ' + fmtS(p.outAt) + ' to ' + fmtS(outEnd) + 's',
      Math.max(0, outEnd - p.outAt),
    );
    if (curtainGap) {
      const g0 = Math.min(total, p.closed);
      const g1 = Math.min(total, Math.max(p.closed, p.outAt));
      const gw = Math.max(0, g1 - g0);
      curtainGap.style.left = pct(g0);
      curtainGap.style.width = pct(gw);
      const closed = Number(gw.toFixed(2));
      curtainGap.__len.textContent = fmtS(closed) + 's';
      const gpx = trackW ? (gw / total) * trackW : 0;
      curtainGap.__len.hidden = closed <= 0 || (trackW > 0 && gpx < 28);
      curtainGap.title = 'Closed ' + fmtS(closed) + 's';
    }
    // Text row: in + out only. The empty gap between them is hold (no middle bar).
    const tIn0 = Math.min(total, p.textIn);
    const tIn1 = Math.min(total, p.textIn + cc.labelIn.duration);
    const tOut0 = Math.min(total, p.textOut);
    const tOut1 = Math.min(total, p.textGone);
    place(bars.t[0], tIn0, tIn1, 'Text in @ ' + fmtS(p.textIn) + 's', cc.labelIn.duration);
    place(bars.t[1], tOut0, tOut1, 'Text out @ ' + fmtS(p.textOut) + 's', cc.labelOut.duration);
    if (textGap) {
      const g0 = Math.min(total, tIn1);
      const g1 = Math.min(total, Math.max(tIn1, tOut0));
      const gw = Math.max(0, g1 - g0);
      textGap.style.left = pct(g0);
      textGap.style.width = pct(gw);
      const hold = Number(gw.toFixed(2));
      textGap.__len.textContent = fmtS(hold) + 's';
      const gpx = trackW ? (gw / total) * trackW : 0;
      textGap.__len.hidden = hold <= 0 || (trackW > 0 && gpx < 28);
      textGap.title = 'Stays ' + fmtS(hold) + 's';
    }
    for (const hd of handles) hd.style.left = pct(Math.min(total, Math.max(0, hd.__def.at(p, cc))));
    root.style.setProperty('--tick', pct(0.5));
    if (axisFor !== total) {
      axisFor = total;
      const every = total <= 3 ? 0.5 : total <= 6 ? 1 : 2;
      const marks = [];
      for (let t = 0; t <= total + 1e-6; t += every)
        marks.push(h('span', { style: { left: pct(t) } }, fmtS(t) + 's'));
      clear(axis, marks);
    }
  }
  layout();
  // Second pass once the track has a real width so in-bar labels can measure.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => layout());
  return {
    el: root,
    layout,
    get dragging() {
      return !!drag;
    },
  };
}

function pageTransitionGroup(store, bridge) {
  const get = (ptr) => store.get(FILE, ptr);
  const base = (ptr) => store.getBase(FILE, ptr);
  const set = (ptr, value, key) => store.set(FILE, ptr, value, { key, source: 'panel' });
  const isChanged = (ptr) => JSON.stringify(get(ptr)) !== JSON.stringify(base(ptr));
  const numbers = [];
  const head = (label) =>
    h(
      'label',
      { class: 'tf__label' },
      h('span', { class: 'tf__file' }, 'animations'),
      label,
      h('i', { class: 'dot', title: 'Changed' }),
    );
  const OUT_START_PTR = CURTAIN + '/outStart';
  const TEXT_OUT_START_PTR = CURTAIN + '/textOutStart';

  // Session window when /total is not yet stored; only the total field writes /total.
  let sessionTotal = null;
  // Freeze derived absolute starts once so missing values are not re-chained from siblings.
  let sessionOutStart = null;
  let sessionTextOutStart = null;
  const readNum = (ptr) => {
    const v = get(ptr);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const lockStart = (ptr, sessionKey, pick) => {
    const stored = readNum(ptr);
    if (stored != null) {
      if (sessionKey === 'out') sessionOutStart = stored;
      else sessionTextOutStart = stored;
      return stored;
    }
    if (sessionKey === 'out') {
      if (sessionOutStart == null) sessionOutStart = pick(normalizeCurtain(get(CURTAIN) ?? true));
      return sessionOutStart;
    }
    if (sessionTextOutStart == null)
      sessionTextOutStart = pick(normalizeCurtain(get(CURTAIN) ?? true));
    return sessionTextOutStart;
  };
  const lockedOutStart = () => lockStart(OUT_START_PTR, 'out', (n) => n.outStart);
  const lockedTextOutStart = () => lockStart(TEXT_OUT_START_PTR, 'textOut', (n) => n.textOutStart);
  const effective = () => {
    const raw = get(CURTAIN) ?? true;
    const o = raw === true ? {} : { ...raw };
    o.outStart = lockedOutStart();
    o.textOutStart = lockedTextOutStart();
    return normalizeCurtain(o);
  };
  const readStoredTotal = () => {
    const t = get(TOTAL_PTR);
    return typeof t === 'number' && Number.isFinite(t) ? t : null;
  };
  const getTotal = () => {
    const stored = readStoredTotal();
    if (stored != null) return stored;
    if (sessionTotal == null)
      sessionTotal = Math.max(leaveStart(effective()), curtainOutEnd(effective()));
    return sessionTotal;
  };
  const pinOutDuration = (total) => {
    const cc = effective();
    const outAt = leaveStart(cc);
    const od = Math.max(0, Number((total - outAt).toFixed(2)));
    if (cc.out.duration !== od)
      set(CURTAIN + '/out/duration', od, 'curtain:' + CURTAIN + '/out/duration');
  };
  const setTotal = (raw, { storeTotal = true } = {}) => {
    const cc = effective();
    const min = leaveStart(cc);
    const t = Number(Math.min(TOTAL_MAX, Math.max(min, Number(raw))).toFixed(2));
    sessionTotal = t;
    if (storeTotal) set(TOTAL_PTR, t, 'curtain:' + TOTAL_PTR);
    pinOutDuration(t);
    return t;
  };
  const gapHold = (cc) =>
    Math.max(0, Number((cc.textOutStart - (cc.textDelay + cc.labelIn.duration)).toFixed(2)));
  const syncHoldFromGap = () => {
    const hold = gapHold(effective());
    if (readNum(CURTAIN + '/hold') !== hold)
      set(CURTAIN + '/hold', hold, 'curtain:' + CURTAIN + '/hold');
  };
  const setCurtainField = (rel, v) => {
    const ptr = rel.startsWith('/') ? rel : '/' + rel;
    if (ptr === '/out/duration') {
      // Out duration lengthens/shortens via total (pinned end).
      setTotal(leaveStart(effective()) + Math.max(0, v));
      return;
    }
    // Persist absolute starts before sibling edits so missing values are not re-chained.
    const persistIfMissing = (fullPtr, lockFn) => {
      if (readNum(fullPtr) == null) set(fullPtr, lockFn(), 'curtain:' + fullPtr);
    };
    if (ptr !== '/outStart') persistIfMissing(OUT_START_PTR, lockedOutStart);
    if (ptr !== '/textOutStart' && ptr !== '/hold')
      persistIfMissing(TEXT_OUT_START_PTR, lockedTextOutStart);
    const cc = effective();
    const total = getTotal();
    // Advanced "Text stays": write hold and move text-out so the gap matches.
    if (ptr === '/hold') {
      const hold = clampField('/hold', v, 0, cc, total);
      const textInEnd = cc.textDelay + cc.labelIn.duration;
      const tos = clampField('/textOutStart', textInEnd + hold, 0, cc, total);
      sessionTextOutStart = tos;
      set(CURTAIN + '/hold', hold, 'curtain:' + CURTAIN + '/hold');
      set(TEXT_OUT_START_PTR, tos, 'curtain:' + TEXT_OUT_START_PTR);
      pinOutDuration(getTotal());
      return;
    }
    const def = HANDLES.find((d) => d.ptr === ptr) || (ptr === '/textOutStart' ? { min: 0 } : null);
    const min = def ? def.min : 0;
    const clamped = clampField(ptr, v, min, cc, total);
    if (ptr === '/outStart') sessionOutStart = clamped;
    if (ptr === '/textOutStart') sessionTextOutStart = clamped;
    set(CURTAIN + ptr, clamped, 'curtain:' + CURTAIN + ptr);
    // Facing edges / body-drags change the gap — keep /hold in sync.
    if (ptr === '/textDelay' || ptr === '/labelIn/duration' || ptr === '/textOutStart')
      syncHoldFromGap();
    // Keep the leave bar pinned to the current total window (from locked outStart, not text).
    pinOutDuration(getTotal());
  };

  // Text inputs so ".", "0.", "1." can be typed; commit when the value parses, finalize on blur.
  const isPartialNumber = (raw) => {
    const t = raw.trim();
    return t === '' || t === '-' || t === '.' || t === '-.' || /^-?\d+\.$/.test(t);
  };
  const applyNumber = (ptr, n) => {
    if (ptr === TOTAL_PTR) return setTotal(n);
    const relPtr = ptr.slice(CURTAIN.length);
    setCurtainField(relPtr, n);
    if (relPtr === '/out/duration') return Math.max(0, getTotal() - leaveStart(effective()));
    if (ptr === TOTAL_PTR) return getTotal();
    return get(ptr);
  };
  const numInput = (ptr, rel, cls, { step = 0.01, min = 0, max = TOTAL_MAX } = {}) => {
    const input = h('input', {
      class: cls,
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: false,
      value: get(ptr) ?? '',
      placeholder: fmtS(digRel(effective(), rel) ?? 0),
      dataset: { ptr, min: String(min), max: String(max), step: String(step) },
      oninput: (e) => {
        const raw = e.target.value;
        if (isPartialNumber(raw)) {
          e.target.classList.remove('is-invalid');
          return;
        }
        const n = Number(raw.trim());
        const ok = raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
        e.target.classList.toggle('is-invalid', !ok);
        if (!ok) return;
        // Commit to the store; leave the typed string alone while focused.
        applyNumber(ptr, n);
      },
      onblur: (e) => {
        const raw = e.target.value.trim();
        if (raw === '' || isPartialNumber(raw)) {
          // Restore the effective / stored value.
          let v;
          if (ptr === TOTAL_PTR) v = getTotal();
          else if (ptr.slice(CURTAIN.length) === '/out/duration')
            v = Math.max(0, getTotal() - leaveStart(effective()));
          else v = get(ptr) ?? digRel(effective(), rel) ?? 0;
          e.target.value = String(v);
          e.target.classList.remove('is-invalid');
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          e.target.classList.add('is-invalid');
          return;
        }
        const shown = applyNumber(ptr, n);
        e.target.value = fmtS(shown ?? n);
        e.target.classList.remove('is-invalid');
      },
    });
    return input;
  };

  const single = (rel, label, { min = 0, hint } = {}) => {
    const ptr = CURTAIN + rel;
    const input = numInput(ptr, rel, 'tf__input', { min });
    const changed = () => isChanged(ptr);
    const wrap = h(
      'div',
      { class: ['tf', changed() && 'is-changed'] },
      head(label),
      input,
      hint ? h('p', { class: 'hint small tf__hint' }, hint) : null,
    );
    numbers.push({ ptr, rel, input, wrap, changed, min });
    return wrap;
  };

  // Duration + ease on one row (Advanced).
  const advEases = [];
  const readMode = () =>
    get(EASE_MODE_PTR) === 'individual' || effective().easeMode === 'individual'
      ? 'individual'
      : 'shared';
  const sharedEaseValue = () => get(SHARED_EASE_PTR) || effective().ease || 'expo.inOut';
  const setSharedEase = (v) => {
    // Shared mode: one value plays; clear per-step eases so they cannot affect playback.
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'shared', 'curtain:easeMode');
        set(SHARED_EASE_PTR, v, 'curtain:ease');
        for (const rel of EASE_PTRS) set(CURTAIN + rel, undefined, 'curtain:' + CURTAIN + rel);
      },
      { source: 'panel' },
    );
  };
  const setStepEase = (eRel, v) => {
    const shared = sharedEaseValue();
    // Individual mode: seed every step from the current shared ease, then apply this pick.
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'individual', 'curtain:easeMode');
        if (get(SHARED_EASE_PTR) == null) set(SHARED_EASE_PTR, shared, 'curtain:ease');
        // Seed every step from the shared ease so untouched steps do not jump.
        for (const rel of EASE_PTRS) set(CURTAIN + rel, shared, 'curtain:' + CURTAIN + rel);
        set(CURTAIN + eRel, v, 'curtain:' + CURTAIN + eRel);
      },
      { source: 'panel' },
    );
  };

  const pair = (seg, label) => {
    const dRel = seg + '/duration';
    const eRel = seg + '/ease';
    const dPtr = CURTAIN + dRel;
    const ePtr = CURTAIN + eRel;
    const input = numInput(dPtr, dRel, 'f__num', { min: 0 });
    input.title = label + ' duration (seconds)';
    const ease = easeField({
      gsap: bridge.api?.gsap,
      value: get(ePtr) || sharedEaseValue(),
      compact: true,
      onChange: (v) => setStepEase(eRel, v),
    });
    const changed = () => isChanged(dPtr) || isChanged(ePtr);
    const wrap = h(
      'div',
      { class: ['tf', changed() && 'is-changed'] },
      head(label),
      h(
        'div',
        { class: 'f__pair' },
        h('span', { class: 'f__numwrap' }, input, h('span', { class: 'f__unit' }, 's')),
        ease.el,
      ),
    );
    numbers.push({ ptr: dPtr, rel: dRel, input, wrap, changed, min: 0 });
    advEases.push({ ptr: ePtr, rel: eRel, ease, wrap });
    return wrap;
  };

  // Total duration above the timeline (fixed axis window).
  const totalInput = numInput(TOTAL_PTR, '/total', 'tf__input', { min: 0, max: TOTAL_MAX });
  totalInput.placeholder = fmtS(getTotal());
  totalInput.value = fmtS(getTotal());
  const totalChanged = () => isChanged(TOTAL_PTR);
  const totalWrap = h(
    'div',
    { class: ['tf', totalChanged() && 'is-changed'] },
    head('Total duration (s)'),
    totalInput,
    h(
      'p',
      { class: 'hint small tf__hint' },
      'Fixed length of the timeline. The curtain-out bar is pinned to the end. Dragging bars will not grow this.',
    ),
  );
  numbers.push({
    ptr: TOTAL_PTR,
    rel: '/total',
    input: totalInput,
    wrap: totalWrap,
    changed: totalChanged,
    special: 'total',
  });

  const timeline = curtainTimeline({
    effective,
    getTotal,
    setField: (rel, v) => setCurtainField(rel, v),
    onDrag: (on) => (el.__dragging = on),
  });

  // Shared ease under the timeline — either/or with Advanced per-step eases.
  const easeHint = h('p', { class: 'hint small tf__hint' }, '');
  const globalEase = easeField({
    gsap: bridge.api?.gsap,
    value: sharedEaseValue(),
    emptyLabel: readMode() === 'individual' ? 'Individual' : null,
    compact: true,
    onChange: (v) => setSharedEase(v),
  });
  const globalEaseWrap = h('div', { class: 'tf ptg__ease' }, head('Ease'), globalEase.el, easeHint);

  const advancedBody = CURTAIN_ROWS.map((row) =>
    row[0] === 'pair' ? pair(row[1], row[2]) : single(row[0], row[1], row[2] || {}),
  );
  const advanced = h(
    'details',
    { class: 'ptg__advanced' },
    h('summary', {}, 'Advanced'),
    h('div', { class: 'ptg__advanced-body' }, ...advancedBody),
  );

  const replay = h(
    'button',
    {
      type: 'button',
      class: 'btn-ed',
      title: 'Play the transition over this page with the values above (no navigation)',
      onclick: () => bridge.api?.replayCurtain?.(),
    },
    '\u21ba Replay',
  );

  const syncEaseUi = () => {
    const mode = readMode();
    const shared = sharedEaseValue();
    const individual = mode === 'individual';
    globalEase.update(shared, { emptyLabel: individual ? 'Individual' : null });
    easeHint.textContent = individual
      ? 'Per-step eases in Advanced. Pick an ease here to use one for all.'
      : 'One ease for every step. Set a step ease in Advanced to use separate eases.';
    globalEaseWrap.classList.toggle('is-individual', individual);
    for (const r of advEases) {
      const v = individual ? get(r.ptr) || shared : shared;
      r.ease.update(v);
      r.wrap.classList.toggle('is-ease-inactive', !individual);
      r.ease.el.classList.toggle('is-inactive', !individual);
      r.ease.el.title = individual
        ? ''
        : 'Not in effect — shared ease is active. Pick an ease to switch to per-step.';
    }
  };

  const el = h(
    'section',
    { class: 'grp ptg' },
    h('h4', { class: 'grp__title' }, 'Page transition'),
    h(
      'p',
      { class: 'hint' },
      'Site-wide curtain timing, in the order things happen. Drag the bar ends or type the values. The text itself is edited per page under Content \u2192 Page transition. Changes apply to the next page change in the preview.',
    ),
    h('div', { class: 'ptg__actions' }, replay),
    h('div', { class: 'ptg__box' }, totalWrap, timeline.el, globalEaseWrap, advanced),
  );

  // Refresh in place (while typing in a field or dragging the timeline) without re-rendering.
  el.__update = () => {
    const eff = effective();
    const stored = readStoredTotal();
    if (stored != null) sessionTotal = stored;
    else if (sessionTotal == null) sessionTotal = curtainOutEnd(eff);
    // Display out.duration as pinned to the window (writes happen in setCurtainField / setTotal).
    const wantOut = Math.max(0, Number((getTotal() - leaveStart(eff)).toFixed(2)));
    timeline.layout();
    for (const r of numbers) {
      r.wrap.classList.toggle('is-changed', r.changed());
      if (r.special === 'total') {
        r.input.placeholder = fmtS(getTotal());
        const shown = fmtS(stored != null ? stored : getTotal());
        if (r.input !== document.activeElement && r.input.value !== shown) r.input.value = shown;
        continue;
      }
      r.input.placeholder = fmtS(digRel(eff, r.rel) ?? 0);
      let v = get(r.ptr);
      if (r.rel === '/out/duration') v = wantOut;
      else if (r.rel === '/outStart' && v == null) v = eff.outStart;
      else if (r.rel === '/hold') v = eff.hold;
      else if (r.rel === '/textOutStart' && v == null) v = eff.textOutStart;
      if (r.input !== document.activeElement) {
        const shown = v == null || v === '' ? '' : fmtS(Number(v));
        if (r.input.value !== shown) r.input.value = shown;
      }
    }
    syncEaseUi();
  };
  // Initialise session total / absolute starts and pin once.
  lockedOutStart();
  lockedTextOutStart();
  getTotal();
  pinOutDuration(getTotal());
  syncEaseUi();
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
        '▶ Replay',
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
                    '↺',
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
