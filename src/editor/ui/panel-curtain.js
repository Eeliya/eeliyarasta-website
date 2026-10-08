/**
 * Page-transition curtain editor: total window, two-row timeline, ease, Advanced.
 * Geometry comes only from normalizeCurtain + curtainPlan (src/client/anim/curtain.js).
 */
import { h, clear } from './dom.js';
import { easeField } from './ease.js';
import { normalizeCurtain, curtainPlan } from '../../client/anim/curtain.js';

const FILE = 'animations.json';
const CURTAIN = '/transitions/page/curtain';
const TOTAL_PTR = CURTAIN + '/total';
const TOTAL_MAX = 12;
const EASE_PTRS = ['/in/ease', '/labelIn/ease', '/labelOut/ease', '/out/ease'];
const EASE_MODE_PTR = CURTAIN + '/easeMode';
const SHARED_EASE_PTR = CURTAIN + '/ease';

// Advanced rows. 'pair' = duration + ease. 'hold' is derived (writes textOutStart only).
const CURTAIN_ROWS = [
  ['pair', '/in', 'Curtain in (s)'],
  ['/textDelay', 'Text in starts (s)', { hint: 'Absolute start of the text-in bar from t=0.' }],
  ['pair', '/labelIn', 'Text in (s)'],
  [
    '/hold',
    'Text stays (s)',
    {
      hint: 'Gap between text-in and text-out on the timeline. Drag either facing edge, or set it here.',
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
  ['pair', '/labelOut', 'Text out (s)'],
  [
    '/outStart',
    'Curtain out starts (s)',
    {
      min: 0,
      hint: 'Absolute time from the start of the transition. The curtain-out bar runs from here to total.',
    },
  ],
  ['pair', '/out', 'Curtain out (s)'],
];

/**
 * Drag handles, in time order per row.
 * at(plan) = where the handle sits.
 * edge "left" on a text bar pins the right edge and changes duration (resize, not slide).
 * edge "right" pins the left edge and changes duration.
 * value(x, plan0) = field value for right-edge / curtain handles.
 */
const HANDLES = [
  {
    row: 'c',
    field: 'in/duration',
    edge: 'right',
    label: 'Curtain in',
    at: (p) => p.curtainIn[1],
    value: (x) => x,
  },
  {
    row: 'c',
    field: 'outStart',
    edge: 'left',
    label: 'Curtain out starts',
    at: (p) => p.curtainOut[0],
    value: (x) => x,
  },
  {
    row: 't',
    edge: 'left',
    startField: 'textDelay',
    durField: 'labelIn/duration',
    label: 'Text in',
    at: (p) => p.textIn[0],
    span: (p) => p.textIn,
    minStart: () => 0,
  },
  {
    row: 't',
    edge: 'right',
    field: 'labelIn/duration',
    label: 'Text in',
    at: (p) => p.textIn[1],
    value: (x, p) => x - p.textIn[0],
  },
  {
    row: 't',
    edge: 'left',
    startField: 'textOutStart',
    durField: 'labelOut/duration',
    label: 'Text out',
    at: (p) => p.textOut[0],
    span: (p) => p.textOut,
    minStart: (p) => p.textIn[1],
  },
  {
    row: 't',
    edge: 'right',
    field: 'labelOut/duration',
    label: 'Text out',
    at: (p) => p.textOut[1],
    value: (x, p) => x - p.textOut[0],
  },
];

/** Body-drag targets: text-in and text-out only. */
const TEXT_SEGS = [
  { field: 'textDelay', label: 'Text in', range: (p) => p.textIn },
  { field: 'textOutStart', label: 'Text out', range: (p) => p.textOut },
];

const fmtS = (v) => String(Math.round(Number(v) * 100) / 100);
const digRel = (obj, rel) =>
  rel
    .split('/')
    .filter(Boolean)
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
/**
 * One clamp for every edit path. Returns { min, max } for `field` given a frozen plan.
 * Enter bars cannot pass leave bars; leave end is pinned to total.
 */
export function limits(field, plan) {
  const t = plan.total;
  const cIn1 = plan.curtainIn[1];
  const cOut0 = plan.curtainOut[0];
  const tIn = plan.textIn || [0, 0];
  const tOut = plan.textOut || [0, 0];
  const li = tIn[1] - tIn[0];
  const lo = tOut[1] - tOut[0];
  switch (field) {
    case 'total':
      return { min: cOut0, max: TOTAL_MAX };
    case 'in/duration':
      return { min: 0, max: cOut0 };
    case 'outStart':
      return { min: cIn1, max: t };
    case 'out/duration':
      return { min: 0, max: Math.max(0, TOTAL_MAX - cOut0) };
    case 'textDelay':
      return { min: 0, max: Math.max(0, Math.min(t - li, tOut[0] - li)) };
    case 'labelIn/duration':
      return { min: 0, max: Math.max(0, Math.min(t - tIn[0], tOut[0] - tIn[0])) };
    case 'textOutStart':
      return { min: tIn[1], max: Math.max(tIn[1], t - lo) };
    case 'labelOut/duration':
      return { min: 0, max: Math.max(0, t - tOut[0]) };
    case 'hold':
      return { min: 0, max: Math.max(0, t - lo - tIn[1]) };
    default:
      return { min: 0, max: TOTAL_MAX };
  }
}

export function clampTo(field, v, plan) {
  const { min, max } = limits(field, plan);
  const hi = Math.max(min, max);
  return Number(Math.min(hi, Math.max(min, Number(v))).toFixed(2));
}

function placeGap(el, from, to, total, trackW, title) {
  const f = Math.max(0, from);
  const w = Math.max(0, to - f);
  el.style.left = (f / total) * 100 + '%';
  el.style.width = (w / total) * 100 + '%';
  const len = Number(w.toFixed(2));
  el.__len.textContent = fmtS(len) + 's';
  const px = trackW ? (w / total) * trackW : 0;
  el.__len.hidden = len <= 0 || (trackW > 0 && px < 28);
  el.title = title + ' ' + fmtS(len) + 's';
}

function curtainTimeline({ planOf, setField, setResize, onDrag }) {
  const bars = { c: [], t: [] };
  const handles = [];
  let curtainGap = null;
  let textGap = null;
  let total = 1;
  let drag = null;
  const axis = h('div', { class: 'ptl__axis' });
  let axisFor = null;
  const near = (track, row, clientX, pointerType) => {
    const p = planOf();
    const r = track.getBoundingClientRect();
    const px = clientX - r.left;
    const tol = pointerType === 'touch' ? 16 : 8;
    const hits = handles
      .filter((el) => el.__def.row === row)
      .map((el) => ({ el, d: Math.abs((el.__def.at(p) / total) * r.width - px) }))
      .filter((c) => c.d <= tol);
    if (!hits.length) return null;
    const best = Math.min(...hits.map((c) => c.d));
    return { list: hits.filter((c) => c.d - best < 2).map((c) => c.el), p };
  };
  const textHit = (track, clientX) => {
    const p = planOf();
    if (!p.textIn) return null;
    const r = track.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * total;
    for (let i = 0; i < TEXT_SEGS.length; i++) {
      const [a, b] = TEXT_SEGS[i].range(p);
      const dur = b - a;
      if (dur > 1e-6 && x >= a - 1e-6 && x <= b + 1e-6) {
        return { p, seg: i, start: a, dur, def: TEXT_SEGS[i] };
      }
    }
    return null;
  };
  const fieldValue = (def, p) => {
    if (def.edge === 'left' && def.span) {
      const [a, b] = def.span(p);
      return b - a;
    }
    if (def.field === 'in/duration') return p.curtainIn[1] - p.curtainIn[0];
    if (def.field === 'labelIn/duration') return p.textIn[1] - p.textIn[0];
    if (def.field === 'labelOut/duration') return p.textOut[1] - p.textOut[0];
    return def.at(p);
  };
  /** Apply a handle at absolute time x (already stepped). */
  const applyHandle = (def, x, p0) => {
    // Text left edge: pin the right edge, change duration (start moves only as resize).
    if (def.edge === 'left' && def.span) {
      const end = def.span(p0)[1];
      const minS = def.minStart(p0);
      const start = Number(Math.min(end, Math.max(minS, x)).toFixed(2));
      const dur = Number((end - start).toFixed(2));
      setResize(def.startField, start, def.durField, dur);
      return dur;
    }
    const raw = def.value(x, p0);
    const v = clampTo(def.field, raw, p0);
    setField(def.field, v);
    return v;
  };
  const beginHandle = (el) => {
    drag.el = el;
    el.classList.add('is-active');
  };

  function track(row, name) {
    const barsEl = h('div', { class: 'ptl__bars' });
    const nBars = 2;
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
          const p = planOf();
          const [a, b] = seg.range(p);
          const dur = b - a;
          const step = e.shiftKey ? 0.1 : 0.01;
          const raw = a + (e.key === 'ArrowRight' ? 1 : -1) * step;
          const v = clampTo(seg.field, Math.round(raw / step) * step, p);
          setField(seg.field, v);
        });
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
        dataset: { field: def.field },
        onkeydown: (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const p = planOf();
          const step = e.shiftKey ? 0.1 : 0.01;
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          // Nudge the edge in time; left text edges resize (pin end), others use field maths.
          if (def.edge === 'left' && def.span) {
            const x = Math.round((def.at(p) + dir * step) / step) * step;
            applyHandle(def, x, p);
            return;
          }
          const fieldCur = fieldValue(def, p);
          const raw = fieldCur + dir * step;
          const v = clampTo(def.field, Math.round(raw / step) * step, p);
          setField(def.field, v);
        },
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
        field: body.def.field,
        label: body.def.label,
        p0: body.p,
      };
      root.classList.add('is-dragging', 'is-moving');
      onDrag(true);
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
        const v = clampTo(drag.field, raw, drag.p0);
        setField(drag.field, v);
        return;
      }
      if (!drag.el) {
        const dx = e.clientX - drag.x0;
        if (Math.abs(dx) < 3) return;
        beginHandle(dx > 0 ? drag.list.at(-1) : drag.list[0]);
      }
      const x = Math.round((((e.clientX - r.left) / r.width) * total) / step) * step;
      const def = drag.el.__def;
      applyHandle(def, x, drag.p0);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.el?.classList.remove('is-active');
      drag = null;
      root.classList.remove('is-dragging', 'is-moving');
      onDrag(false);
      layout();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return h('div', { class: 'ptl__row' }, h('span', { class: 'ptl__name' }, name), el);
  }

  const root = h('div', { class: 'ptl' }, track('c', 'Curtain'), track('t', 'Text'), axis);

  function layout() {
    const p = planOf();
    total = Math.max(0.01, p.total);
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
      bar.__len.hidden = len <= 0 || (trackW > 0 && px < 28);
    };
    place(
      bars.c[0],
      p.curtainIn[0],
      p.curtainIn[1],
      'Comes in: 0 to ' + fmtS(p.curtainIn[1]) + 's',
      p.curtainIn[1] - p.curtainIn[0],
    );
    place(
      bars.c[1],
      p.curtainOut[0],
      p.curtainOut[1],
      'Leaves: ' + fmtS(p.curtainOut[0]) + ' to ' + fmtS(p.curtainOut[1]) + 's',
      p.curtainOut[1] - p.curtainOut[0],
    );
    if (curtainGap) placeGap(curtainGap, p.curtainIn[1], p.curtainOut[0], total, trackW, 'Closed');
    if (p.textIn && p.textOut) {
      place(
        bars.t[0],
        p.textIn[0],
        p.textIn[1],
        'Text in @ ' + fmtS(p.textIn[0]) + 's',
        p.textIn[1] - p.textIn[0],
      );
      place(
        bars.t[1],
        p.textOut[0],
        p.textOut[1],
        'Text out @ ' + fmtS(p.textOut[0]) + 's',
        p.textOut[1] - p.textOut[0],
      );
      if (textGap) placeGap(textGap, p.textIn[1], p.textOut[0], total, trackW, 'Stays');
    }
    for (const hd of handles) hd.style.left = pct(Math.min(total, Math.max(0, hd.__def.at(p))));
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
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => layout());
  return {
    el: root,
    layout,
    get dragging() {
      return !!drag;
    },
  };
}

/** Page-transition section for the Motion panel. */
export function pageTransitionGroup(store, bridge) {
  const get = (ptr) => store.get(FILE, ptr);
  const base = (ptr) => store.getBase(FILE, ptr);
  const set = (ptr, value, key) => store.set(FILE, ptr, value, { key, source: 'panel' });
  const isChanged = (ptr) => JSON.stringify(get(ptr)) !== JSON.stringify(base(ptr));
  const numbers = [];
  const head = (label) =>
    h('label', { class: 'tf__label' }, label, h('i', { class: 'dot', title: 'Changed' }));

  const effective = () => normalizeCurtain(get(CURTAIN) ?? true);
  const planOf = () => curtainPlan(effective(), true);

  /** Pull text (and outStart) back inside total after the window shrinks. */
  const pullInsideTotal = (t) => {
    const cc = effective();
    let outStart = Math.min(t, Math.max(cc.in.duration, cc.outStart));
    let lo = Math.min(cc.labelOut.duration, t);
    let tos = Math.min(t - lo, Math.max(0, cc.textOutStart));
    let li = cc.labelIn.duration;
    let td = cc.textDelay;
    // Enter cannot pass leave.
    if (td + li > tos) {
      li = Math.max(0, Math.min(li, tos - td));
      td = Math.max(0, Math.min(td, tos - li));
    }
    if (td + li > t) {
      li = Math.max(0, Math.min(li, t - td));
      td = Math.max(0, Math.min(td, t - li));
    }
    tos = Math.max(td + li, Math.min(tos, t - lo));
    const snap = (n) => Number(n.toFixed(2));
    const writes = [
      [CURTAIN + '/outStart', snap(outStart)],
      [CURTAIN + '/textDelay', snap(td)],
      [CURTAIN + '/labelIn/duration', snap(li)],
      [CURTAIN + '/textOutStart', snap(tos)],
      [CURTAIN + '/labelOut/duration', snap(lo)],
    ];
    for (const [ptr, v] of writes) {
      if (get(ptr) !== v) set(ptr, v, 'curtain:' + ptr);
    }
  };

  const setTotal = (raw) => {
    const p = planOf();
    const t = clampTo('total', raw, p);
    set(TOTAL_PTR, t, 'curtain:' + TOTAL_PTR);
    pullInsideTotal(t);
    return t;
  };

  const setCurtainField = (field, v) => {
    const rel = field.startsWith('/') ? field.slice(1) : field;
    const p = planOf();

    if (rel === 'out/duration') {
      // Leave end is pinned to total — changing duration moves total.
      setTotal(p.curtainOut[0] + Math.max(0, v));
      return;
    }
    if (rel === 'total') {
      setTotal(v);
      return;
    }
    // Derived stay: only write textOutStart so the gap matches.
    if (rel === 'hold') {
      const hold = clampTo('hold', v, p);
      const tos = clampTo('textOutStart', p.textIn[1] + hold, p);
      set(CURTAIN + '/textOutStart', tos, 'curtain:' + CURTAIN + '/textOutStart');
      return;
    }

    const clamped = clampTo(rel, v, p);
    set(CURTAIN + '/' + rel, clamped, 'curtain:' + CURTAIN + '/' + rel);
  };

  /** Resize a text bar from the left: pin end, write start + duration together. */
  const setResize = (startField, start, durField, dur) => {
    store.batch(
      () => {
        set(CURTAIN + '/' + startField, start, 'curtain:' + CURTAIN + '/' + startField);
        set(CURTAIN + '/' + durField, dur, 'curtain:' + CURTAIN + '/' + durField);
      },
      { source: 'panel' },
    );
  };

  const isPartialNumber = (raw) => {
    const t = raw.trim();
    return t === '' || t === '-' || t === '.' || t === '-.' || /^-?\d+\.$/.test(t);
  };
  const applyNumber = (ptr, n) => {
    if (ptr === TOTAL_PTR) return setTotal(n);
    const rel = ptr.slice(CURTAIN.length + 1); // drop leading "/"
    setCurtainField(rel, n);
    if (rel === 'out/duration') return planOf().curtainOut[1] - planOf().curtainOut[0];
    if (rel === 'hold') return planOf().stay;
    return get(ptr) ?? digRel(effective(), '/' + rel);
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
        applyNumber(ptr, n);
      },
      onblur: (e) => {
        const raw = e.target.value.trim();
        if (raw === '' || isPartialNumber(raw)) {
          let v;
          if (ptr === TOTAL_PTR) v = planOf().total;
          else if (rel === '/out/duration') {
            const p = planOf();
            v = p.curtainOut[1] - p.curtainOut[0];
          } else if (rel === '/hold') v = planOf().stay;
          else v = get(ptr) ?? digRel(effective(), rel) ?? 0;
          e.target.value = fmtS(v);
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
    const changed = () => (rel === '/hold' ? false : isChanged(ptr));
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

  const advEases = [];
  const readMode = () =>
    get(EASE_MODE_PTR) === 'individual' || effective().easeMode === 'individual'
      ? 'individual'
      : 'shared';
  const sharedEaseValue = () => get(SHARED_EASE_PTR) || effective().ease || 'expo.inOut';
  const setSharedEase = (v) => {
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'shared', 'curtain:easeMode');
        set(SHARED_EASE_PTR, v, 'curtain:ease');
        for (const r of EASE_PTRS) set(CURTAIN + r, undefined, 'curtain:' + CURTAIN + r);
      },
      { source: 'panel' },
    );
  };
  const setStepEase = (eRel, v) => {
    const shared = sharedEaseValue();
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'individual', 'curtain:easeMode');
        if (get(SHARED_EASE_PTR) == null) set(SHARED_EASE_PTR, shared, 'curtain:ease');
        for (const r of EASE_PTRS) set(CURTAIN + r, shared, 'curtain:' + CURTAIN + r);
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
    input.title = label;
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
      h('div', { class: 'f__pair' }, input, ease.el),
    );
    numbers.push({ ptr: dPtr, rel: dRel, input, wrap, changed, min: 0 });
    advEases.push({ ptr: ePtr, rel: eRel, ease, wrap });
    return wrap;
  };

  const totalInput = numInput(TOTAL_PTR, '/total', 'tf__input', { min: 0, max: TOTAL_MAX });
  totalInput.placeholder = fmtS(planOf().total);
  totalInput.value = fmtS(planOf().total);
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
    planOf,
    setField: (field, v) => setCurtainField(field, v),
    setResize,
    onDrag: (on) => (el.__dragging = on),
  });

  const easeHint = h('p', { class: 'hint small tf__hint' }, '');
  const globalEase = easeField({
    gsap: bridge.api?.gsap,
    value: sharedEaseValue(),
    emptyLabel: readMode() === 'individual' ? 'Individual' : null,
    compact: true,
    onChange: (v) => setSharedEase(v),
  });
  const globalEaseWrap = h('div', { class: 'tf ptg__ease' }, globalEase.el, easeHint);

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

  el.__update = () => {
    const eff = effective();
    const p = planOf();
    const stored = get(TOTAL_PTR);
    timeline.layout();
    for (const r of numbers) {
      r.wrap.classList.toggle('is-changed', r.changed());
      if (r.special === 'total') {
        r.input.placeholder = fmtS(p.total);
        const shown = fmtS(typeof stored === 'number' ? stored : p.total);
        if (r.input !== document.activeElement && r.input.value !== shown) r.input.value = shown;
        continue;
      }
      r.input.placeholder = fmtS(digRel(eff, r.rel) ?? 0);
      let v = get(r.ptr);
      if (r.rel === '/out/duration') v = p.curtainOut[1] - p.curtainOut[0];
      else if (r.rel === '/outStart' && v == null) v = eff.outStart;
      else if (r.rel === '/hold') v = p.stay;
      else if (r.rel === '/textOutStart' && v == null) v = eff.textOutStart;
      if (r.input !== document.activeElement) {
        const shown = v == null || v === '' ? '' : fmtS(Number(v));
        if (r.input.value !== shown) r.input.value = shown;
      }
    }
    syncEaseUi();
  };
  syncEaseUi();
  return el;
}
