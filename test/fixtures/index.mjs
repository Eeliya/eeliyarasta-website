/**
 * Test fixtures: small sites the tests read instead of the live site's content.
 *
 *   SITE_A  test/fixtures/site-a: content/en (pages, sources, settings, strings.json) and
 *           .generated/media.json (the media manifest), a frozen copy of a real site. Tests
 *           that change files copy it to a temp folder first; it is never written to.
 *   SITE_B  test/fixtures/site-b: site A plus a widget of its own, widgets/quote (index.js,
 *           style.scss, client.js), listed in its site.config.mjs; used on its about page.
 */
import { fileURLToPath } from 'node:url';

export const SITE_A = fileURLToPath(new URL('./site-a', import.meta.url));

/** Site B: site A with a widget of its own (widgets/quote, listed in its site.config.mjs). */
export const SITE_B = fileURLToPath(new URL('./site-b', import.meta.url));
