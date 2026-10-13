/**
 * A page's backdrop: photos behind its sections, one after another, as the page scrolls.
 *
 *   "backdrop": {
 *     "photos": ["places/kasteel-de-haar/02.jpg", ...],   media/ paths or R2 keys, in order
 *     "transition": "scroll" | "fade",                    default "scroll"
 *     "direction": "vertical" | "horizontal",             scroll only, default "vertical"
 *     "through": "none" | "black",                        fade only, default "black"
 *     "parallax": true, "scrub": true,                    fade only, default false
 *     "enabled": false                                    the editor's switch, default true
 *   }
 *
 * The first photo shows at the top of the page and the last stays to its end: scroll moves a
 * strip of them by its length less one screen (the last fully in view at the end); fade gives
 * each an equal share of the page and crossfades between them (directly, or through black),
 * tied to the scroll (scrub) or as a short timed fade at each point. Parallax: a slow zoom and
 * drift. Rendered as a fixed layer under the sections (src/client/modules/backdrop.js); the
 * sections have no background of their own, so they show it.
 *
 * Defaults are left out on save (BACKDROP_DEFAULTS, src/site/defaults.js), and so are the
 * other transition's options and a backdrop without photos (tidyBackdrop).
 */
import { esc, html, img } from './helpers.js';

export const TRANSITIONS = ['scroll', 'fade'];
export const DIRECTIONS = ['vertical', 'horizontal'];
export const THROUGH = ['none', 'black'];
export const BACKDROP_DEFAULTS = {
  transition: 'scroll',
  direction: 'vertical',
  through: 'black',
  parallax: false,
  scrub: false,
  enabled: true,
};
// a transition's own options: the other's are left out
const OWN = { scroll: ['direction'], fade: ['through', 'parallax', 'scrub'] };
const KEYS = ['photos', ...Object.keys(BACKDROP_DEFAULTS)];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A backdrop with every value filled in (defaults), or null: none, off, or no photos. */
export function backdropOf(b) {
  if (!isObject(b)) return null;
  const photos = Array.isArray(b.photos) ? b.photos.filter((p) => typeof p === 'string' && p) : [];
  const v = { ...BACKDROP_DEFAULTS, ...b, photos };
  return v.enabled === false || !photos.length ? null : v;
}

/** Problems of a page's "backdrop": ['backdrop: "transition" must be scroll or fade']. */
export function checkBackdrop(b) {
  if (b === undefined) return [];
  if (!isObject(b)) return ['"backdrop" must be an object { photos, transition, ... }'];
  const out = [];
  const bad = (key, want) => out.push(`backdrop: "${key}" must be ${want}`);
  if (!Array.isArray(b.photos) || b.photos.some((p) => typeof p !== 'string' || !p.trim()))
    bad('photos', 'a list of photos (media/ paths or R2 keys)');
  if (b.transition !== undefined && !TRANSITIONS.includes(b.transition))
    bad('transition', TRANSITIONS.join(' or '));
  if (b.direction !== undefined && !DIRECTIONS.includes(b.direction))
    bad('direction', DIRECTIONS.join(' or '));
  if (b.through !== undefined && !THROUGH.includes(b.through)) bad('through', THROUGH.join(' or '));
  for (const k of ['parallax', 'scrub', 'enabled'])
    if (b[k] !== undefined && typeof b[k] !== 'boolean') bad(k, 'true or false');
  const t = TRANSITIONS.includes(b.transition) ? b.transition : 'scroll';
  for (const [other, keys] of Object.entries(OWN))
    if (other !== t)
      for (const k of keys)
        if (b[k] !== undefined) out.push(`backdrop: "${k}" is only for the ${other} transition`);
  for (const k of Object.keys(b))
    if (!KEYS.includes(k)) out.push(`backdrop: "${k}" is not a backdrop setting`);
  return out;
}

/**
 * A backdrop tidied for saving, in place on `page`: its defaults and the other transition's
 * options left out; none at all without photos. found(message) for each default left out.
 */
export function tidyBackdrop(page, found = () => {}) {
  const b = page?.backdrop;
  if (!isObject(b)) return;
  if (Array.isArray(b.photos)) b.photos = b.photos.filter((p) => typeof p === 'string' && p);
  if (!Array.isArray(b.photos) || !b.photos.length) {
    delete page.backdrop;
    return;
  }
  const t = TRANSITIONS.includes(b.transition) ? b.transition : 'scroll';
  for (const [other, keys] of Object.entries(OWN))
    if (other !== t) for (const k of keys) delete b[k];
  for (const [k, v] of Object.entries(BACKDROP_DEFAULTS))
    if (b[k] === v) {
      found(`"${k}" is the default (${JSON.stringify(v)}): leave it out`);
      delete b[k];
    }
}

/**
 * The backdrop's HTML: a fixed layer (moved out of the view, [data-portal]) with its photos,
 * cover and centred, and its settings for the script. '' without one. The first photo loads
 * first (eager, high priority), the next eagerly too, the rest lazily (the script loads them
 * once the page is idle).
 */
export function renderBackdrop(ctx, b) {
  const v = backdropOf(b);
  if (!v) return '';
  const opts = {
    transition: v.transition,
    ...(v.transition === 'scroll'
      ? { direction: v.direction }
      : { through: v.through, parallax: v.parallax, scrub: v.scrub }),
  };
  const dir = v.transition === 'scroll' ? ` pbd--${v.direction}` : '';
  const black = v.transition === 'fade' && v.through === 'black' ? ' pbd--black' : '';
  return html`<div
    class="pbd pbd--${v.transition}${dir}${black}"
    data-portal
    data-backdrop="${esc(JSON.stringify(opts))}"
    style="--n:${v.photos.length}"
    aria-hidden="true"
  >
    <div class="pbd__track">
      ${v.photos
        .map(
          (src, i) =>
            html`<div class="pbd__photo">
              ${img(ctx, src, {
                decorative: true,
                loading: i < 2 ? 'eager' : 'lazy',
                priority: i === 0,
              })}
            </div>`,
        )
        .join('')}
    </div>
  </div>`;
}
