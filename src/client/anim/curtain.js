/**
 * Page-transition curtain timing. Pure (no DOM), shared by the router and the editor.
 *
 * content/settings/animations.json -> transitions.page.curtain
 *   easeMode      shared | individual  (missing = shared)
 *   ease          one ease for every step when easeMode is shared
 *   in            { duration, ease }  curtain comes in (closes)
 *   textDelay     absolute start of text-in (from t=0)
 *   labelIn       { duration, ease }  text comes in
 *   textOutStart  absolute start of text-out (missing => text-in end + legacy hold)
 *   labelOut      { duration, ease }  text leaves
 *   outStart      absolute start of curtain-out (missing => textGone + legacy afterText)
 *   total         timeline window (missing => outStart + out.duration)
 *   out           { ease, duration }  duration is always total - outStart (not a second source)
 *   label         false hides the text on every page
 *
 * Legacy JSON may still carry hold / afterText / out.duration; normalize derives absolutes
 * from them and does not return those relative fields.
 */
export const CURTAIN_DEFAULTS = {
  in: { duration: 0.7, ease: 'expo.inOut' },
  labelIn: { duration: 0.45, ease: 'expo.out' },
  labelOut: { duration: 0.35, ease: 'power2.in' },
  out: { duration: 0.8, ease: 'expo.inOut' },
};

/** Only used when absolute fields are missing in old JSON. */
const LEGACY = { hold: 0.12, afterText: -0.25 };

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Curtain config with every absolute value filled in, or null when the curtain is off. */
export function normalizeCurtain(raw) {
  if (!raw) return null;
  const c = raw === true ? {} : raw;
  const D = CURTAIN_DEFAULTS;
  const seg = (k) => ({
    ...D[k],
    ...(c[k] || {}),
    duration: Math.max(0, num(c[k]?.duration, D[k].duration)),
  });
  const inn = seg('in');
  const labelIn = seg('labelIn');
  const labelOut = seg('labelOut');
  const outSeg = seg('out');

  const easeMode = c.easeMode === 'individual' ? 'individual' : 'shared';
  const stepEases = [c.in?.ease, c.labelIn?.ease, c.labelOut?.ease, c.out?.ease].filter(
    (e) => typeof e === 'string' && e,
  );
  let sharedEase = typeof c.ease === 'string' && c.ease ? c.ease : null;
  if (!sharedEase) {
    if (stepEases.length && stepEases.every((e) => e === stepEases[0])) sharedEase = stepEases[0];
    else sharedEase = (typeof c.in?.ease === 'string' && c.in.ease) || inn.ease;
  }

  const step = (segObj, own) => ({
    ...segObj,
    ease: easeMode === 'shared' ? sharedEase : typeof own === 'string' && own ? own : sharedEase,
  });

  const textDelay = Math.max(0, num(c.textDelay, inn.duration));
  const textInEnd = textDelay + labelIn.duration;

  let textOutStart = num(c.textOutStart, NaN);
  if (!Number.isFinite(textOutStart)) {
    textOutStart = Math.max(0, textInEnd + Math.max(0, num(c.hold, LEGACY.hold)));
  } else {
    textOutStart = Math.max(0, textOutStart);
  }
  const textGone = textOutStart + labelOut.duration;

  let outStart = num(c.outStart, NaN);
  if (!Number.isFinite(outStart)) outStart = textGone + num(c.afterText, LEGACY.afterText);
  outStart = Math.max(0, outStart);

  let total = num(c.total, NaN);
  if (!Number.isFinite(total)) total = outStart + outSeg.duration;
  total = Number(Math.max(total, outStart, inn.duration).toFixed(2));

  const outDuration = Number(Math.max(0, total - outStart).toFixed(2));

  return {
    label: c.label !== false,
    easeMode,
    ease: sharedEase,
    in: step(inn, c.in?.ease),
    textDelay,
    labelIn: step(labelIn, c.labelIn?.ease),
    textOutStart,
    labelOut: step(labelOut, c.labelOut?.ease),
    outStart,
    total,
    out: { ...step(outSeg, c.out?.ease), duration: outDuration },
  };
}

/**
 * Geometry both the editor timeline and the router use.
 * Ranges are [start, end] in seconds from the moment the curtain starts coming in.
 * shut = closed wait between curtain enter and leave; stay = wait between text enter and leave.
 */
export function curtainPlan(cc, hasText = true) {
  const total = Math.max(0.01, num(cc.total, cc.outStart + cc.out.duration));
  const cIn1 = Math.max(0, cc.in.duration);
  const cOut0 = Math.max(cIn1, Math.max(0, num(cc.outStart, cIn1)));
  const cOut1 = total;
  const shut = Math.max(0, cOut0 - cIn1);

  if (!hasText) {
    return {
      total,
      curtainIn: [0, cIn1],
      curtainOut: [cOut0, cOut1],
      textIn: null,
      textOut: null,
      shut,
      stay: 0,
    };
  }

  const tIn0 = Math.max(0, num(cc.textDelay, 0));
  const tIn1 = tIn0 + cc.labelIn.duration;
  const tOut0 = Math.max(0, num(cc.textOutStart, tIn1));
  const tOut1 = tOut0 + cc.labelOut.duration;
  const stay = Math.max(0, tOut0 - tIn1);

  return {
    total,
    curtainIn: [0, cIn1],
    curtainOut: [cOut0, cOut1],
    textIn: [tIn0, tIn1],
    textOut: [tOut0, tOut1],
    shut,
    stay,
  };
}
