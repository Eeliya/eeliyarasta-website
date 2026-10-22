/**
 * Text that scales with the grid: a text widget (SCALE_TYPES) whose `scale` is on sizes its
 * text in cells, so it grows and shrinks with the page's width like the widgets do:
 *
 *   "scale": { "on": true, "adjust": 120 }     adjust: % of its styles' sizes (default 100)
 *   "scale": { "fit": true }                    as large as fits the widget (fixed height only)
 *
 * Each text style is defined once, in cells of the 120-column grid (site.json "typography";
 * TEXT_STYLES are the defaults):
 *
 *   "typography": { "paragraph": { "size": 1.4, "line": 1.75, "tracking": 0, "min": 14 } }
 *
 *   size      font size in cells (on the phone grid half a cell each: its cells are twice as
 *             wide, so a phone shows the desktop's text scaled like its layout)
 *   line      line height, × the font size (so it scales with it)
 *   tracking  letter spacing, em (likewise)
 *   min       the smallest font size, px: scaled text never gets smaller (readable on phones)
 *
 * Which of a widget's texts has which style: _layout.scss (.wgt--scale), e.g. a heading widget's
 * title "title", its eyebrow "label", its body "paragraph". With `scale` off (the default) a
 * text has its style's normal fixed size (the site's stylesheets).
 */
import { isObject } from '../is.js';

/** The text styles and their defaults (sizes in cells; at 1440px a cell is ~11.3px). */
export const TEXT_STYLES = {
  title: { label: 'Title', size: 19, line: 0.82, tracking: -0.02, min: 40 },
  heading: { label: 'Heading', size: 3, line: 1.1, tracking: -0.01, min: 20 },
  paragraph: { label: 'Paragraph', size: 1.4, line: 1.75, tracking: 0, min: 14 },
  label: { label: 'Label', size: 1, line: 1.3, tracking: 0.08, min: 10 },
  subheading: { label: 'Subheading', size: 2, line: 1.2, tracking: -0.005, min: 18 },
  statement: { label: 'Statement', size: 5, line: 1.06, tracking: -0.005, min: 26 },
  small: { label: 'Small', size: 1.05, line: 1.5, tracking: 0, min: 11 },
};
const STYLE_KEYS = ['size', 'line', 'tracking', 'min'];

/** Widget types whose text can scale (a Scale switch in the editor). */
export const SCALE_TYPES = ['text', 'button'];

/**
 * Fit to widget: its text as large as fits its box (a widget with a fixed height: aspect or
 * rows), worked out live in the page (src/client/modules/fit.js: --tkf, over adjust).
 */
export const fitted = (b) =>
  SCALE_TYPES.includes(b?.type) && b?.scale?.fit === true && ['aspect', 'rows'].includes(b?.size);

/** Is a widget's text scaled (in cells: by the grid, or fitted)? */
export const scaled = (b) => SCALE_TYPES.includes(b?.type) && (b?.scale?.on === true || fitted(b));

/** A scaled widget's adjust as a factor (1 = 100%). */
export const adjustOf = (b) => {
  const a = b?.scale?.adjust;
  return typeof a === 'number' && a > 0 ? a / 100 : 1;
};

/** site.json typography merged over the defaults: { style: { size, line, tracking, min } }. */
export function typographyOf(site) {
  const own = isObject(site?.typography) ? site.typography : {};
  return Object.fromEntries(
    Object.entries(TEXT_STYLES).map(([k, d]) => {
      const o = isObject(own[k]) ? own[k] : {};
      const pick = (key) =>
        typeof o[key] === 'number' && Number.isFinite(o[key]) ? o[key] : d[key];
      return [k, Object.fromEntries(STYLE_KEYS.map((key) => [key, pick(key)]))];
    }),
  );
}

/** The CSS variables of site.json's typography (only what differs from the defaults). */
export function typographyVars(site) {
  const t = typographyOf(site);
  const out = [];
  for (const [k, s] of Object.entries(t)) {
    const d = TEXT_STYLES[k];
    if (s.size !== d.size) out.push(`--ts-${k}: ${s.size}`);
    if (s.line !== d.line) out.push(`--ts-${k}-lh: ${s.line}`);
    if (s.tracking !== d.tracking) out.push(`--ts-${k}-tr: ${s.tracking}em`);
    if (s.min !== d.min) out.push(`--ts-${k}-min: ${s.min}px`);
  }
  return out.join('; ');
}

/** Problems of site.json "typography". */
export function checkTypography(t) {
  if (t === undefined) return [];
  if (!isObject(t))
    return ['"typography" must be an object { <style>: { size, line, tracking, min } }'];
  const out = [];
  for (const [k, s] of Object.entries(t)) {
    if (!TEXT_STYLES[k]) {
      out.push(`typography: unknown style "${k}" (${Object.keys(TEXT_STYLES).join(', ')})`);
      continue;
    }
    if (!isObject(s)) {
      out.push(`typography.${k} must be an object { size, line, tracking, min }`);
      continue;
    }
    for (const key of Object.keys(s)) {
      const v = s[key];
      if (!STYLE_KEYS.includes(key)) out.push(`typography.${k}: unknown key "${key}"`);
      else if (typeof v !== 'number' || !Number.isFinite(v))
        out.push(`typography.${k}.${key} must be a number`);
      else if (key !== 'tracking' && v <= 0 && !(key === 'min' && v === 0))
        out.push(`typography.${k}.${key} must be more than 0`);
    }
  }
  return out;
}

/** Problems of a widget's "scale". */
export function checkScale(b) {
  const s = b?.scale;
  if (s === undefined) return [];
  if (!SCALE_TYPES.includes(b.type))
    return [`"scale" is for text widgets (${SCALE_TYPES.join(', ')})`];
  if (!isObject(s))
    return ['"scale" must be an object { "on": true, "adjust": 100, "fit": false }'];
  const out = [];
  if (s.on !== undefined && typeof s.on !== 'boolean') out.push('"scale.on" must be true or false');
  if (s.fit !== undefined && typeof s.fit !== 'boolean')
    out.push('"scale.fit" must be true or false');
  if (
    s.adjust !== undefined &&
    !(typeof s.adjust === 'number' && s.adjust >= 10 && s.adjust <= 1000)
  )
    out.push('"scale.adjust" must be a % from 10 to 1000');
  return out;
}
