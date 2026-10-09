/**
 * Page-transition curtain: the edit rules behind the curtain section (CurtainSection.svelte,
 * CurtainTimeline.svelte): the global curtain in Settings, a page's own one in Motion.
 * No DOM here. Times come only from normalizeCurtain + curtainPlan (src/client/anim/curtain.js).
 */
import { ANIMATIONS } from '../../site/files.js';
import { normalizeCurtain, curtainPlan } from '../../client/anim/curtain.js';

/** The global curtain in settings/animations.json. */
export const CURTAIN = '/transitions/page/curtain';
export const TOTAL_MAX = 12;
const EASE_PTRS = ['/in/ease', '/labelIn/ease', '/labelOut/ease', '/out/ease'];

/** Advanced rows, in the order things happen. pair = a duration + its ease. */
export const CURTAIN_ROWS = [
  { pair: '/in', label: 'Curtain in (s)' },
  {
    rel: '/textDelay',
    label: 'Text in starts (s)',
    hint: 'Absolute start of the text-in bar from t=0.',
  },
  { pair: '/labelIn', label: 'Text in (s)' },
  {
    rel: '/stay',
    label: 'Text stays (s)',
    hint: 'Gap between text-in and text-out on the timeline. Drag either facing edge, or set it here.',
  },
  {
    rel: '/textOutStart',
    label: 'Text out starts (s)',
    hint: 'Absolute start of the text-out bar. The gap before it is how long the text stays.',
  },
  { pair: '/labelOut', label: 'Text out (s)' },
  {
    rel: '/outStart',
    label: 'Curtain out starts (s)',
    hint: 'Absolute time from the start of the transition. The curtain-out bar runs from here to total.',
  },
  { pair: '/out', label: 'Curtain out (s)' },
];

/** 2 decimals, no trailing zeros: 0.5 -> "0.5", 1.234 -> "1.23". */
export const fmtS = (v) => String(Math.round(Number(v) * 100) / 100);

const digRel = (obj, rel) =>
  rel
    .split('/')
    .filter(Boolean)
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

/**
 * One clamp for every edit path. Returns { min, max } for `field` given a frozen plan.
 * Enter bars cannot pass leave bars; the leave end is pinned to total.
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
    case 'stay':
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

/**
 * A page's curtain mode (Motion tab), as one undo step. `page` is where the page's
 * "transition" is stored ({ file, ptr }, see src/site/routes.js). Custom starts from the
 * page's earlier custom values, else from a copy of the global curtain. The values stay
 * when switching to Global or Off, so switching back brings them back.
 */
export function setCurtainMode(store, page, mode) {
  const now = store.get(page.file, page.ptr);
  const fields = { ...(now && typeof now === 'object' ? now : {}) };
  delete fields.mode;
  if (mode === 'custom' && !Object.keys(fields).length)
    Object.assign(fields, structuredClone(store.get(ANIMATIONS, CURTAIN) ?? {}));
  // Global without earlier values: no "transition" at all, as before.
  const next = mode === 'global' && !Object.keys(fields).length ? undefined : { mode, ...fields };
  store.set(page.file, page.ptr, next, { source: 'panel' });
}

/**
 * The curtain edits on the store. Every write goes through here, so the timeline and the
 * number fields follow the same rules. file + base: the curtain being edited, the global one
 * by default or a page's own ("pages/index.json", "/transition").
 */
export function curtainEdits(store, file = ANIMATIONS, base = CURTAIN) {
  const TOTAL_PTR = base + '/total';
  const EASE_MODE_PTR = base + '/easeMode';
  const SHARED_EASE_PTR = base + '/ease';
  const get = (ptr) => store.get(file, ptr);
  const set = (ptr, value) =>
    store.set(file, ptr, value, { key: `curtain:${file}#${ptr}`, source: 'panel' });
  const effective = () => normalizeCurtain(get(base) ?? true);
  const plan = () => curtainPlan(effective(), true);

  /** Pull text (and outStart) back inside total after the window shrinks. */
  function pullInsideTotal(t) {
    const cc = effective();
    const outStart = Math.min(t, Math.max(cc.in.duration, cc.outStart));
    const lo = Math.min(cc.labelOut.duration, t);
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
      ['/outStart', outStart],
      ['/textDelay', td],
      ['/labelIn/duration', li],
      ['/textOutStart', tos],
      ['/labelOut/duration', lo],
    ];
    for (const [rel, v] of writes) {
      if (get(base + rel) !== snap(v)) set(base + rel, snap(v));
    }
  }

  function setTotal(raw) {
    const t = clampTo('total', raw, plan());
    set(TOTAL_PTR, t);
    pullInsideTotal(t);
  }

  /** field: a path below the curtain, e.g. 'textDelay', 'labelIn/duration', 'total', or 'stay'. */
  function setField(field, v) {
    const p = plan();
    if (field === 'total') return setTotal(v);
    // The leave end is pinned to total: changing the duration moves total.
    if (field === 'out/duration') return setTotal(p.curtainOut[0] + Math.max(0, v));
    // Stay is the gap between the text bars: only write textOutStart.
    if (field === 'stay') {
      const stay = clampTo('stay', v, p);
      return set(base + '/textOutStart', clampTo('textOutStart', p.textIn[1] + stay, p));
    }
    set(base + '/' + field, clampTo(field, v, p));
  }

  /** Resize a text bar from the left: pin its end, write start + duration as one undo step. */
  function setResize(startField, start, durField, dur) {
    store.batch(
      () => {
        set(base + '/' + startField, start);
        set(base + '/' + durField, dur);
      },
      { source: 'panel' },
    );
  }

  const easeMode = () =>
    get(EASE_MODE_PTR) === 'individual' || effective().easeMode === 'individual'
      ? 'individual'
      : 'shared';
  const sharedEase = () => get(SHARED_EASE_PTR) || effective().ease || 'expo.inOut';

  /** One ease for every step: clears the step eases. */
  function setSharedEase(v) {
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'shared');
        set(SHARED_EASE_PTR, v);
        for (const r of EASE_PTRS) set(base + r, undefined);
      },
      { source: 'panel' },
    );
  }

  /** A step ease: switches to per-step eases, the other steps keep the shared one. */
  function setStepEase(rel, v) {
    const shared = sharedEase();
    store.batch(
      () => {
        set(EASE_MODE_PTR, 'individual');
        if (get(SHARED_EASE_PTR) == null) set(SHARED_EASE_PTR, shared);
        for (const r of EASE_PTRS) set(base + r, shared);
        set(base + rel, v);
      },
      { source: 'panel' },
    );
  }

  /** The value a number field shows for `rel` ('/total', '/in/duration', '/stay', ...). */
  function shown(rel) {
    const p = plan();
    if (rel === '/total') return typeof get(TOTAL_PTR) === 'number' ? get(TOTAL_PTR) : p.total;
    if (rel === '/out/duration') return p.curtainOut[1] - p.curtainOut[0];
    if (rel === '/stay') return p.stay;
    return get(base + rel) ?? digRel(effective(), rel);
  }

  return {
    file,
    base,
    get,
    effective,
    plan,
    setTotal,
    setField,
    setResize,
    easeMode,
    sharedEase,
    setSharedEase,
    setStepEase,
    shown,
  };
}
