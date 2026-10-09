/**
 * Photo URLs in the editor, resolved like the site does (mediaUrl in src/site/helpers.js):
 * a file in media/ from the media manifest, an R2 key from settings/site.json's mediaUrl
 * (the edited value, so a new URL shows at once), a full URL as is.
 * Both lists come with the content (source.js load()): the media/ manifest as { src, thumb }
 * per file, the R2 photos as content/settings/photos.json ({ srcset: [{ key, w }], ... } per
 * key; an upload adds its own entry).
 */
import { mediaUrl } from '../../site/helpers.js';
import { SITE } from '../../site/files.js';

export const media = $state({ manifest: {}, photos: {} });
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
  media.photos[src]?.srcset.map((s) => `${imageUrl(s.key)} ${s.w}w`).join(', ') || '';

/** A small version for a field's thumbnail: the smallest size, else the photo itself. */
export const thumbUrl = (src) =>
  media.manifest[src]?.thumb ||
  (media.photos[src] ? imageUrl(media.photos[src].srcset[0].key) : imageUrl(src));
