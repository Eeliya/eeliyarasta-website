/**
 * Page-transition curtain timing. Pure (no DOM), shared by the router and the editor.
 *
 * content/animations.json -> transitions.page.curtain
 *   easeMode      "shared" | "individual"  (missing = shared)
 *   ease          one ease for every step when easeMode is shared
 *   in            { duration, ease }  curtain comes in (closes)
 *   textDelay     absolute start of text-in (from t=0)
 *   labelIn       { duration, ease }  text comes in
 *   holdStart     absolute start of text-stays (missing => textDelay + labelIn.duration)
 *   hold          length of the stays segment
 *   textOutStart  absolute start of text-out (missing => holdStart + hold)
 *   labelOut      { duration, ease }  text leaves
 *   outStart      absolute start of curtain-out (missing => textGone + afterText;
 *                 re-derived each normalize when missing — supply outStart for a stable value)
 *   afterText     derived as outStart - textGone (compat only)
 *   out           { duration, ease }  curtain leaves (opens)
 *   label         false hides the text on every page
 */
export const CURTAIN_DEFAULTS = {
  in: { duration: 0.7, ease: 'expo.inOut' },
  labelIn: { duration: 0.45, ease: 'expo.out' },
  hold: 0.12,
  labelOut: { duration: 0.35, ease: 'power2.in' },
  afterText: -0.25,
  out: { duration: 0.8, ease: 'expo.inOut' },
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Curtain config with every value filled in, or null when the curtain is off. */
export function normalizeCurtain(raw) {
  if (!raw) return null;
  const c = raw === true ? {} : raw;
  const D = CURTAIN_DEFAULTS;
  const seg = (k) => ({ ...D[k], ...(c[k] || {}), duration: Math.max(0, num(c[k]?.duration, D[k].duration)) });
  const inn = seg('in');
  const labelIn = seg('labelIn');
  const labelOut = seg('labelOut');
  const out = seg('out');

  const easeMode = c.easeMode === 'individual' ? 'individual' : 'shared';
  const stepEases = [c.in?.ease, c.labelIn?.ease, c.labelOut?.ease, c.out?.ease].filter((e) => typeof e === 'string' && e);
  let sharedEase = typeof c.ease === 'string' && c.ease ? c.ease : null;
  if (!sharedEase) {
    if (stepEases.length && stepEases.every((e) => e === stepEases[0])) sharedEase = stepEases[0];
    else sharedEase = (typeof c.in?.ease === 'string' && c.in.ease) || inn.ease;
  }

  const step = (segObj, own) => ({
    ...segObj,
    ease: easeMode === 'shared' ? sharedEase : (typeof own === 'string' && own ? own : sharedEase),
  });

  const textDelay = Math.max(0, num(c.textDelay, inn.duration));
  const hold = Math.max(0, num(c.hold, D.hold));
  let holdStart = num(c.holdStart, NaN);
  if (!Number.isFinite(holdStart)) holdStart = textDelay + labelIn.duration;
  holdStart = Math.max(0, holdStart);
  let textOutStart = num(c.textOutStart, NaN);
  if (!Number.isFinite(textOutStart)) textOutStart = holdStart + hold;
  textOutStart = Math.max(0, textOutStart);
  const textGone = textOutStart + labelOut.duration;

  const afterLegacy = num(c.afterText, D.afterText);
  let outStart = num(c.outStart, NaN);
  if (!Number.isFinite(outStart)) outStart = textGone + afterLegacy;
  outStart = Math.max(0, outStart);
  const afterText = outStart - textGone;

  return {
    label: c.label !== false,
    easeMode,
    ease: sharedEase,
    in: step(inn, c.in?.ease),
    textDelay,
    labelIn: step(labelIn, c.labelIn?.ease),
    holdStart,
    hold,
    textOutStart,
    labelOut: step(labelOut, c.labelOut?.ease),
    outStart,
    afterText,
    out: step(out, c.out?.ease),
  };
}

/**
 * When everything happens, in seconds from the moment the curtain starts coming in.
 * Text-in, text-stays, text-out, and curtain-out each use their own absolute start.
 */
export function curtainPlan(cc, hasText = true) {
  const closed = cc.in.duration;
  const outAt = Math.max(closed, Math.max(0, num(cc.outStart, closed)));
  if (!hasText) {
    return { closed, outAt, outEnd: outAt + cc.out.duration, end: outAt + cc.out.duration };
  }
  const textIn = Math.max(0, num(cc.textDelay, 0));
  const textHold = Math.max(0, num(cc.holdStart, textIn + cc.labelIn.duration));
  const textOut = Math.max(0, num(cc.textOutStart, textHold + cc.hold));
  const textGone = textOut + cc.labelOut.duration;
  const outEnd = outAt + cc.out.duration;
  return { closed, textIn, textHold, textOut, textGone, outAt, outEnd, end: Math.max(outEnd, textGone) };
}
