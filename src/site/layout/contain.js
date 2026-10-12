/**
 * How wide a contained section is (site.json "layout": { "contained": N }): N columns of the
 * full-width grid's cell (the window's width / 120), centred, but never nearer the window's
 * edges than the page's side margin (--pad). Its content is still a 120-column grid (its
 * cells as much smaller as it is narrower), so a block keeps its columns whatever N is: a
 * narrower N scales a contained section's layout down, like a narrower window.
 *
 * The default, 115, is the look before this setting: up to 1920px wide the side margin
 * (clamp(16px, 2.6vw, 40px)) is the narrower of the two, so nothing changed; wider screens
 * keep 115/120 of the width (where the margin alone stopped at 40px).
 * Phones (below 760px): a contained section is the 60-column grid inside the side margins,
 * as before (N doesn't apply: on a phone every column counts).
 *
 * The CSS (_layout.scss) reads --contain on :root (head, templates/layout.js); the Settings
 * panel shows the widths at common window sizes (containedWidth).
 */
import { COLS } from './grid.js';

export const CONTAINED = 115;
export const CONTAINED_MIN = 60;
/** --pad in _tokens.scss: clamp(16px, 2.6vw, 40px). */
const padAt = (vw) => Math.min(40, Math.max(16, vw * 0.026));

/** site.json's contained columns (the default when unset or invalid). */
export function containedOf(site) {
  const n = site?.layout?.contained;
  return Number.isInteger(n) && n >= CONTAINED_MIN && n <= COLS ? n : CONTAINED;
}

/** A contained section's content width, px, in a window `vw` px wide (desktop). */
export const containedWidth = (vw, n = CONTAINED) => Math.min(vw - 2 * padAt(vw), (vw * n) / COLS);

/** The :root variable, when it isn't the default ('' then). */
export const layoutVars = (site) => {
  const n = containedOf(site);
  return n === CONTAINED ? '' : `--contain: ${n}`;
};

/** Problems of site.json "layout". */
export function checkLayout(l) {
  if (l === undefined) return [];
  if (!l || typeof l !== 'object' || Array.isArray(l))
    return ['"layout" must be an object { contained }'];
  const out = [];
  const n = l.contained;
  if (n !== undefined && !(Number.isInteger(n) && n >= CONTAINED_MIN && n <= COLS))
    out.push(
      `"layout.contained" must be a whole number of columns from ${CONTAINED_MIN} to ${COLS}`,
    );
  for (const k of Object.keys(l))
    if (k !== 'contained') out.push(`"layout.${k}" is not a layout setting`);
  return out;
}
