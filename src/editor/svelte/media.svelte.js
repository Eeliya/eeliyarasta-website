/**
 * Photo URLs in the editor, resolved like the site does (mediaUrl in src/site/helpers.js):
 * a file in media/ from the media manifest, an R2 key from settings/site.json's mediaUrl
 * (the edited value, so a new URL shows at once), a full URL as is.
 * The manifest comes with the content (source.js load()), as { src, thumb } per file.
 */
import { mediaUrl } from '../../site/helpers.js';
import { SITE } from '../../site/files.js';

export const media = $state({ manifest: {} });
let live = null;

/** main.js: the reactive store to read site.json from. */
export const connectMedia = (l) => (live = l);

/** Full-size URL of a photo (`src` as stored in the content). */
export const imageUrl = (src) =>
  src
    ? mediaUrl({ media: media.manifest, site: { mediaUrl: live?.get(SITE, '/mediaUrl') } }, src)
    : '';

/** A small version for a field's thumbnail: the smallest local size, else the photo itself. */
export const thumbUrl = (src) => media.manifest[src]?.thumb || imageUrl(src);
