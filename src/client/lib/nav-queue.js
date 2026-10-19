/**
 * The router's queue (router.js navigate): one navigation runs, the latest one asked for in
 * the meantime waits. Asking again for the one that runs (a double click in the editor's
 * pages list: select, then open, both show that page) drops what waits: that page is coming
 * already, its curtain plays once. And a waiting one that goes where the page now is, is not
 * run either.
 *   running  URL | null (nothing runs)   asked  { url: URL, push }   here  URL (location)
 */
const where = (u) => u.pathname + u.search + u.hash;

/** What waits after `asked` came in while `running` runs: asked, or null when it's that one. */
export const queueNav = (running, asked) =>
  running && where(running) === where(asked.url) ? null : asked;

/** The waiting navigation to run now, or null when it would go where the page is. */
export const nextNav = (queued, here) =>
  queued && where(queued.url) !== where(here) ? queued : null;
