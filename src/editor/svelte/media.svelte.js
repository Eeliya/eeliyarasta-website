/**
 * Photo URLs in the editor, resolved like the site does (mediaUrl in src/site/helpers.js):
 * a file in media/ from the media manifest, an R2 key from settings/site.json's mediaUrl
 * (the edited value, so a new URL shows at once), a full URL as is.
 * Both lists come with the content (source.js load()): the media/ manifest as { src, thumb }
 * per file, the R2 photos as content/settings/photos.json ({ srcset: [{ key, w }], ... } per
 * key; an upload adds its own entry; alt texts of both kinds live there too).
 * The Media window (MediaModal.svelte) lists them all; openMedia() opens it.
 */
import { mediaUrl } from '../../site/helpers.js';
import { SITE } from '../../site/files.js';
import { ui } from './ui.svelte.js';

// blobs: { key: object URL } of photos uploaded in this session, shown until R2 serves them
export const media = $state({ manifest: {}, photos: {}, blobs: {} });
let live = null;

/** main.js: the reactive store to read site.json from. */
export const connectMedia = (l) => (live = l);

/** Full-size URL of a photo (`src` as stored in the content). */
export const imageUrl = (src) =>
  src
    ? mediaUrl({ media: media.manifest, site: { mediaUrl: live?.get(SITE, '/mediaUrl') } }, src)
    : '';

/** srcset of an R2 photo ('' for others: media/ photos keep the one they were rendered with). */
export const imageSrcset = (src) =>
  media.photos[src]?.srcset?.map((s) => `${imageUrl(s.key)} ${s.w}w`).join(', ') || '';

/** A small version for a field's thumbnail: the smallest size, else the photo itself. */
export const thumbUrl = (src) =>
  media.manifest[src]?.thumb ||
  (media.photos[src]?.srcset ? imageUrl(media.photos[src].srcset[0].key) : imageUrl(src));

/** Is `key` an R2 photo (in photos.json with its sizes)? */
export const isR2 = (key) => Array.isArray(media.photos[key]?.srcset);

/**
 * What the editor knows of a photo: { name, size, sizes, storage } ('R2' | 'local' | '' when
 * it is in neither list), e.g. size "1600×2000".
 */
export function photoInfo(key) {
  const local = media.manifest[key];
  const r2 = isR2(key) ? media.photos[key] : null;
  const m = local || r2;
  return {
    name: String(key || '')
      .split('/')
      .pop(),
    size: m?.width ? `${m.width}×${m.height}` : '',
    sizes: local ? local.sizes || 1 : r2 ? r2.srcset.length : 0,
    storage: r2 ? 'R2' : local ? 'local' : '',
  };
}

/** "1600×2000 · 3 sizes · R2", or why there is nothing to say. */
export function photoLine(key) {
  const i = photoInfo(key);
  if (!i.storage) return /^https?:/.test(key) ? 'external URL' : 'not in media/ or R2';
  return [i.size, i.sizes > 1 ? `${i.sizes} sizes` : '', i.storage].filter(Boolean).join(' · ');
}

/**
 * An <img> attachment: when the photo doesn't load (an upload before the Photos address is
 * set), show the uploaded file itself if this session has it.
 */
export const fallback = (key) => (img) => {
  img.onerror = () => {
    const blob = media.blobs[key];
    if (blob && img.src !== blob) img.src = blob;
  };
};

/**
 * Open the Media window (MediaModal.svelte) on photo `key`; with `pick` (a field's data-edit,
 * "file#/pointer") it offers "Use this photo", which stores the key in that field.
 */
export function openMedia({ key = '', pick = '' } = {}) {
  ui.media = { ...ui.media, open: true, key, pick };
}
