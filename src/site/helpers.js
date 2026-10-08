/**
 * Tiny, dependency-free helpers shared by every template.
 * Templates are plain functions: (data) => HTML string. They run in Node at
 * build time (prerender) and can also run in the browser (e.g. the future
 * visual editor's live preview), so nothing in src/site may use Node APIs.
 */

/** Escape text for HTML text/attribute context. Always use for content values. */
export const esc = (value = '') =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Join template parts: arrays are concatenated, null/false/undefined are dropped. */
const part = (v) => (Array.isArray(v) ? v.map(part).join('') : v === null || v === undefined || v === false ? '' : String(v));

/** Tagged template literal: html`<p>${esc(text)}</p>` (does NOT auto-escape). */
export const html = (strings, ...values) => strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ''), '');

/** Zero-padded index: pad(3) -> "03". */
export const pad = (n, len = 2) => String(n).padStart(len, '0');

/** Is this an external (absolute http) URL? */
export const isExternal = (url = '') => /^https?:\/\//.test(url);

/** Attributes for links that leave the site. */
export const extAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener"' : '');

/**
 * Responsive <img>. `src` is a path relative to /media (e.g. "people/x/01.jpg").
 * Uses the generated manifest (srcset, intrinsic size, blurred placeholder) when present.
 */
export function img(ctx, src, { alt = '', sizes = '100vw', cls = '', loading = 'lazy', attrs = '', priority = false } = {}) {
  const m = ctx.media?.[src];
  const url = m ? m.src : `/media/${src}`;
  const srcset = m && m.srcset.length > 1 ? m.srcset.map((s) => `${s.url} ${s.w}w`).join(', ') : '';
  const dims = m && m.width ? ` width="${m.width}" height="${m.height}"` : '';
  const lqip = m?.lqip ? ` style="background-image:url(${m.lqip})"` : '';
  return html`<img class="${esc(cls)}" src="${url}"${srcset ? ` srcset="${srcset}" sizes="${esc(sizes)}"` : ''}${dims} alt="${esc(alt)}" loading="${priority ? 'eager' : loading}" decoding="async"${priority ? ' fetchpriority="high"' : ''}${lqip}${attrs ? ' ' + attrs : ''}>`;
}

/** Aspect ratio of a media item (w/h), fallback 4/5. */
export const ratio = (ctx, src) => {
  const m = ctx.media?.[src];
  return m && m.width ? m.width / m.height : 0.8;
};

/* ---------- colour helpers for album accents ---------- */

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
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
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
};

/**
 * Accent colour for an album: explicit `accent` wins, otherwise the dominant
 * colour of the cover image (from the image pipeline), normalised so it works
 * as a soft tint on black. Greyscale covers fall back to the site accent.
 */
export function accentOf(ctx, album) {
  if (album?.accent) return album.accent;
  const cover = album?.images?.[album.cover || 0]?.src;
  const color = cover && ctx.media?.[cover]?.color;
  if (!color) return ctx.site.accent;
  const [h, s] = rgbToHsl(hexToRgb(color));
  if (s < 0.12) return ctx.site.accent;
  return hsl(h, Math.min(0.55, Math.max(0.3, s)), 0.66);
}

/** Cover image of an album. */
export const coverOf = (album) => album.images[album.cover || 0];

/** "Photo: Name / Unsplash" credit line (placeholder images). */
export const creditText = (credit) => (credit ? `Photo: ${credit.name}${credit.license ? ' / Unsplash' : ''}` : '');
