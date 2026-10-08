/**
 * Page-transition curtain timing. Pure (no DOM), shared by the router and the editor.
 *
 * content/animations.json -> transitions.page.curtain
 *   easeMode   "shared" | "individual"  (missing = shared)
 *   ease       one ease for every step when easeMode is shared
 *   in         { duration, ease }  the curtain comes in (closes); ease used only in individual mode
 *   textDelay  seconds after the curtain STARTS coming in before the text starts coming in
 *              (0 = text and curtain start together; = in.duration: text waits for the closed curtain)
 *   labelIn    { duration, ease }  the text comes in
 *   hold       seconds the text stays fully visible
 *              (a page without curtain text keeps the closed curtain this long instead)
 *   labelOut   { duration, ease }  the text leaves
 *   afterText  seconds after the text has fully left before the curtain starts leaving
 *              (0 = as soon as the text is gone, negative = overlap)
 *   out        { duration, ease }  the curtain leaves (opens)
 *   label      false hides the text on every page
 *
 * Missing values fall back to CURTAIN_DEFAULTS, which reproduce the motion from before
 * textDelay / afterText existed (text after the closed curtain, curtain leaving 0.25s
 * before the text is gone).
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

  // Missing easeMode => shared. Shared ease: explicit ease, else in.ease, else a common step ease.
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

  return {
    label: c.label !== false,
    easeMode,
    ease: sharedEase,
    in: step(inn, c.in?.ease),
    textDelay: Math.max(0, num(c.textDelay, inn.duration)),
    labelIn: step(labelIn, c.labelIn?.ease),
    hold: Math.max(0, num(c.hold, D.hold)),
    labelOut: step(labelOut, c.labelOut?.ease),
    afterText: num(c.afterText, D.afterText),
    out: step(out, c.out?.ease),
  };
}

/**
 * When everything happens, in seconds from the moment the curtain starts coming in.
 * The curtain never starts leaving before it is fully closed (the page swaps then).
 */
export function curtainPlan(cc, hasText = true) {
  const closed = cc.in.duration;
  if (!hasText) {
    const outAt = closed + cc.hold;
    return { closed, outAt, outEnd: outAt + cc.out.duration, end: outAt + cc.out.duration };
  }
  const textIn = cc.textDelay;
  const textOut = textIn + cc.labelIn.duration + cc.hold;
  const textGone = textOut + cc.labelOut.duration;
  const outAt = Math.max(closed, textGone + cc.afterText);
  const outEnd = outAt + cc.out.duration;
  return { closed, textIn, textOut, textGone, outAt, outEnd, end: Math.max(outEnd, textGone) };
}
