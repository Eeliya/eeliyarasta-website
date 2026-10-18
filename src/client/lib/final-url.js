/**
 * Where an in-site navigation ends (router.js): the requested URL, or the fetch's final one
 * when the server redirected it (_redirects: "/old/ /new/ 301"). Its hash is the requested
 * one (a fetch never sees it) unless the redirect named its own. null: it left the site (the
 * router does a full page load then).
 *   requested  URL                       response  { redirected, url } (a fetch Response)
 */
export function finalUrl(requested, response) {
  if (!response?.redirected || !response.url) return requested;
  const to = new URL(response.url, requested);
  if (to.origin !== requested.origin) return null;
  if (!to.hash) to.hash = requested.hash;
  return to;
}
