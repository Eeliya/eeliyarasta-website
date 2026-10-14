/**
 * Tiny value checks shared by the site, the editor and the client. A leaf module: it imports
 * nothing, so any module can use it (helpers.js imports schemas.js, which can't import it).
 */

/** A plain object: not null, not an array. */
export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** An absolute http(s) URL (a link or photo off the site). */
export const isExternal = (url = '') => /^https?:\/\//.test(url);
