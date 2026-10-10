/**
 * Tiny, dependency-free helpers shared by every template.
 * Templates are plain functions: (data) => HTML string. They run in Node at
 * build time (prerender) and can also run in the browser (e.g. the future
 * visual editor's live preview), so nothing in src/site may use Node APIs.
 */

/** Escape text for HTML text/attribute context. Always use for content values. */
export const esc = (value = '') =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Join template parts: arrays are concatenated, null/false/undefined are dropped. */
const part = (v) =>
  Array.isArray(v)
    ? v.map(part).join('')
    : v === null || v === undefined || v === false
      ? ''
      : String(v);

/** Tagged template literal: html`<p>${esc(text)}</p>` (does NOT auto-escape). */
export const html = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ''), '');

/** Text with line breaks ("a\nb" -> "a<br>b"), escaped. */
export const lines = (text) => esc(text).replace(/\r?\n/g, '<br>');

/**
 * One <span> per word ("Eeliya Rasta" -> "<span>Eeliya</span> <span>Rasta</span>"), escaped.
 * Used for the big hero name, whose layout (and SplitText animation) works per word.
 * The editor re-renders edited values with the same function.
 */
export const words = (text) =>
  String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span>${esc(w)}</span>`)
    .join(' ');

/** JSON Pointer (RFC 6901) from path parts: ['about', 'facts', 0] -> "/about/facts/0". */
export const pointer = (parts) =>
  parts.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('');

/**
 * Visual-editor marker: maps an element's text to a value in a content file (content/<folder>/<name>.json).
 *   ed('pages/index.json', ['hero', 'title'])  ->  data-edit="pages/index.json#/hero/title"
 * type: 'text' (single line, default), 'block' (multi-line, \n <-> <br>), 'number', or
 * 'words' (single line rendered with words(), e.g. the hero name).
 * The editor (src/editor) finds these in its preview; the public site ignores them.
 */
export const ed = (file, parts, type = 'text') =>
  ` data-edit="${esc(file + '#' + pointer(parts))}"${type === 'text' ? '' : ` data-edit-type="${type}"`}`;

/** "Noor Vermeer" -> "noor-vermeer". */
export const slugify = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** URL slug of a source item: its "slug" field, else its name (or title) slugified. */
export const itemSlug = (item) =>
  item?.slug != null && item.slug !== ''
    ? String(item.slug)
    : slugify(item?.name ?? item?.title ?? '');

/**
 * URL of a source item's page, from the routes (ctx.routes): the template route of its
 * source (content/pages/<folder>/[slug].json) or the fixed page that replaced it.
 * itemHref(ctx, 'people', item) -> "/people/noor-vermeer/"; "#" (and a warning) when no
 * template shows that source.
 */
export const itemHref = (ctx, source, item) => {
  const tpl = (ctx.routes || []).find((r) => r.source === source && r.template);
  if (tpl) return `${tpl.parent}${itemSlug(item)}/`;
  warnOnce(`no [slug].json page shows source "${source}": its links go nowhere`, 'routes');
  return '#';
};

/** Zero-padded index: pad(3) -> "03". */
export const pad = (n, len = 2) => String(n).padStart(len, '0');

/** Is this an external (absolute http) URL? */
export const isExternal = (url = '') => /^https?:\/\//.test(url);

/** Attributes for links that leave the site. */
export const extAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener"' : '');

/**
 * URL of a photo in the content. `src` is one of:
 *   "people/x/01.jpg"               a file in media/, resized by scripts/images.mjs: /media/...
 *   "photos/x-3f9a0c1b2d-1600.webp" an object in Cloudflare R2 (uploaded and resized in the
 *                                   editor, scripts/r2.mjs): site.mediaUrl (settings/site.json)
 *                                   + "/" + key; its other sizes are in ctx.photos
 *   "https://..."                a full URL, as is
 * Files in the media manifest are local; anything else is read from site.mediaUrl, so a photo
 * moved from media/ to R2 under the same key needs no content change. The content keeps keys,
 * not URLs: the photo domain can change in one place.
 */
export function mediaUrl(ctx, src = '') {
  if (isExternal(src)) return src;
  const m = ctx.media?.[src];
  if (m) return m.src;
  const base = String(ctx.site?.mediaUrl || '').replace(/\/+$/, '');
  return base ? `${base}/${String(src).replace(/^\/+/, '')}` : `/media/${src}`;
}

const warned = new Set();
/** Warn once per message (templates render every page, and again on every dev request). */
function warnOnce(msg, tag = 'photos') {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn(`[${tag}] ${msg}`);
}

/**
 * Sizes of a photo, the same shape for both kinds: { src, srcset: [{ url, w }], width, height,
 * color, lqip }, or null when there are none (a full URL, or a key missing from photos.json).
 *   media/ photos: the generated manifest (.generated/media.json, scripts/images.mjs)
 *   R2 photos:     content/settings/photos.json (written by the upload), keys made URLs here
 */
export function photoOf(ctx, src) {
  if (!src || isExternal(src)) return null;
  const local = ctx.media?.[src];
  if (local) return local;
  const r2 = ctx.photos?.[src];
  if (!r2) {
    warnOnce(`"${src}" is not in media/ or content/settings/photos.json: plain <img>, no sizes`);
    return null;
  }
  if (!ctx.site?.mediaUrl)
    warnOnce(
      `"${src}" is in R2, but no Photos address is set (Settings > Photos, site.json mediaUrl)`,
    );
  return {
    ...r2,
    src: mediaUrl(ctx, src),
    srcset: r2.srcset.map((s) => ({ url: mediaUrl(ctx, s.key), w: s.w })),
  };
}

/**
 * Loading of the i-th photo at the top of a page (the hero, the first cards of a grid, the
 * photography panels): the first is the likely LCP (eager + fetchpriority="high"), the next
 * two are eager too (the rest of the first row), everything after that is lazy.
 * img(ctx, src, { ...firstPhotos(i) }). Album slides and the About photo set their own.
 */
export const firstPhotos = (i) => ({ priority: i === 0, loading: i < 3 ? 'eager' : 'lazy' });

/**
 * Responsive <img> for a photo (`src`: see mediaUrl): srcset, intrinsic size and blurred
 * placeholder from photoOf(), for media/ and R2 photos alike.
 */
export function img(
  ctx,
  src,
  { alt = '', sizes = '100vw', cls = '', loading = 'lazy', attrs = '', priority = false } = {},
) {
  const m = photoOf(ctx, src);
  const url = m?.src || mediaUrl(ctx, src);
  const srcset = m && m.srcset.length > 1 ? m.srcset.map((s) => `${s.url} ${s.w}w`).join(', ') : '';
  const dims = m && m.width ? ` width="${m.width}" height="${m.height}"` : '';
  const lqip = m?.lqip ? ` style="background-image:url(${m.lqip})"` : '';
  return html`<img
    class="${esc(cls)}"
    src="${url}"
    ${srcset ? ` srcset="${srcset}" sizes="${esc(sizes)}"` : ''}${dims}
    alt="${esc(alt)}"
    loading="${priority ? 'eager' : loading}"
    decoding="async"
    ${priority ? ' fetchpriority="high"' : ''}${lqip}${attrs ? ' ' + attrs : ''}
  />`;
}

/** Aspect ratio of a photo (w/h), fallback 4/5. */
export const ratio = (ctx, src) => {
  const m = photoOf(ctx, src);
  return m && m.width ? m.width / m.height : 0.8;
};

/** Is a content section enabled? Missing/undefined counts as on. */
export const isEnabled = (section) => section?.enabled !== false;

/**
 * data-section + optional hidden for section toggles in the editor.
 * Templates always render the section; disabled ones are hidden (not omitted)
 * so the editor can turn them back on without a full page rebuild.
 */
export const sectionAttrs = (id, enabled) =>
  ` data-section="${esc(id)}"${enabled === false ? ' hidden' : ''}`;

/* ---------- colour helpers for album accents ---------- */

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
};
/** HSL → #rrggbb (hex keeps GSAP colour tweening of --accent simple). */
const hsl = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};

/**
 * Accent colour for an album: explicit `accent` wins, otherwise the dominant
 * colour of the cover image (from the image pipeline), normalised so it works
 * as a soft tint on black. Greyscale covers fall back to the site accent.
 */
export function accentOf(ctx, album) {
  if (album?.accent) return album.accent;
  const cover = coverOf(album)?.src;
  const color = cover && photoOf(ctx, cover)?.color;
  if (!color) return ctx.site.accent;
  const [h, s] = rgbToHsl(hexToRgb(color));
  if (s < 0.12) return ctx.site.accent;
  return hsl(h, Math.min(0.55, Math.max(0.3, s)), 0.66);
}

/** Photos of an album ([] when it has none yet, e.g. a person just added in the editor). */
export const imagesOf = (album) => (Array.isArray(album?.images) ? album.images : []);

/** Cover image of an album (undefined when it has no photos). */
export const coverOf = (album) => imagesOf(album)[album?.cover || 0] || imagesOf(album)[0];

/** "Photo: Name / Unsplash" credit line (placeholder images). */
export const creditText = (credit) =>
  credit ? `Photo: ${credit.name}${credit.license ? ' / Unsplash' : ''}` : '';
