// UI text (src/site/strings.js): core English defaults under the site's strings.json, and the
// site settings the shell and head take: lang, themeColor, entityType, the editor's title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_STRINGS, stringsOf, t } from '../src/site/strings.js';
import { renderRoute, getRoutes } from '../src/site/render.js';
import { checkContent } from '../src/site/validate.js';
import { editorShell } from './vite-plugin-static-site.mjs';
import { loadContent } from './content.mjs';
import { SITE_A } from '../test/fixtures/index.mjs';

test('t: the site string, else the core default; placeholders filled', () => {
  const ctx = { strings: { nav: { menu: 'Menú' }, album: { prev: 'Vorige' } } };
  assert.equal(t(ctx, 'nav.menu'), 'Menú');
  assert.equal(t(ctx, 'nav.close'), 'Close');
  assert.equal(t(ctx, 'album.prev'), 'Vorige');
  assert.equal(t(ctx, 'album.show', { n: 3 }), 'Show photo 3');
  assert.equal(t({}, 'album.slide', { n: 1, total: 9 }), '1 of 9');
  assert.equal(t({}, 'nope.key'), 'nope.key');
  assert.deepEqual(stringsOf({ nav: { clock: 'NL' } }).nav, { ...CORE_STRINGS.nav, clock: 'NL' });
});

test('a site with its own strings renders them; without, the English defaults', () => {
  const base = loadContent(SITE_A);
  const route = getRoutes(base).find((r) => r.page === 'home');
  const en = renderRoute(route, base).body;
  assert.match(en, />Skip to content</);
  assert.match(en, />Scroll</);
  const nl = {
    ...base,
    strings: { ...base.strings, page: { skip: 'Naar de inhoud' }, hero: { scroll: 'Scrol' } },
  };
  const out = renderRoute(route, nl).body;
  assert.match(out, />Naar de inhoud</);
  assert.match(out, /<i><\/i>Scrol</);
  assert.doesNotMatch(out, /Skip to content/);
});

test('strings.json: groups are objects', () => {
  assert.deepEqual(checkContent('strings.json', { version: 1, album: { prev: 'x' } }), []);
  assert.equal(checkContent('strings.json', { version: 1, album: 'x' }).length, 1);
});

test('site.json: lang and themeColor reach the shell, entityType the JSON-LD', () => {
  const base = loadContent(SITE_A);
  const route = getRoutes(base).find((r) => r.page === 'home');
  const site = { ...base.site, lang: 'nl', themeColor: '#123456', entityType: 'Organization' };
  const r = renderRoute(route, { ...base, site });
  assert.equal(r.lang, 'nl');
  assert.equal(r.themeColor, '#123456');
  assert.match(r.head, /"@type":"Organization"/);
  assert.match(renderRoute(route, base).head, /"@type":"Person"/, 'the default');
});

test("the editor's page: its title names the site, its lang the site's", () => {
  const shell = '<html lang="en" class="editor-html"><head><title>Editor</title></head></html>';
  assert.equal(
    editorShell(shell, { name: 'A & B', lang: 'nl' }),
    '<html lang="nl" class="editor-html"><head><title>Editor · A &#38; B</title></head></html>',
  );
  assert.match(editorShell(shell, {}), /<title>Editor<\/title>/);
});
