/**
 * Test fixtures: small sites the tests read instead of the live site's content.
 *
 *   SITE_A  test/fixtures/site-a: content/en (pages, sources, settings, strings.json) and
 *           .generated/media.json (the media manifest), a frozen copy of a real site. Tests
 *           that change files copy it to a temp folder first; it is never written to.
 */
import { fileURLToPath } from 'node:url';

export const SITE_A = fileURLToPath(new URL('./site-a', import.meta.url));
