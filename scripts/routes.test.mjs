import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutes, sitemapXml } from '../src/site/routes.js';
import { contentFromFiles, isContentFile, pageFile, pageIdOf } from '../src/site/files.js';
import { itemHref, slugify } from '../src/site/helpers.js';

const site = { name: 'Site', title: 'Site home', description: 'd' };
const content = (files) => contentFromFiles({ 'settings/site.json': site, ...files });
const paths = (c) => buildRoutes(c).routes.map((r) => r.path);

test('folders mirror URLs, in tree order', () => {
  const c = content({
    'pages/index.json': {},
    'pages/404/index.json': {},
    'pages/people/index.json': { title: 'People' },
    'pages/people/whatever/index.json': {},
    'pages/people/whatever/deep/index.json': {},
    'pages/about/index.json': {},
  });
  assert.deepEqual(paths(c), [
    '/',
    '/about/',
    '/people/',
    '/people/whatever/',
    '/people/whatever/deep/',
    '/404/',
  ]);
  const r = buildRoutes(c).routes;
  assert.equal(r.find((x) => x.path === '/404/').out, '404.html');
  assert.doesNotMatch(sitemapXml(r, ''), /404/);
  assert.equal(r.find((x) => x.path === '/people/').page, 'people'); // built-in view
  assert.equal(r.find((x) => x.path === '/people/whatever/').page, 'page');
  assert.equal(r.find((x) => x.path === '/people/whatever/').title, 'Whatever | Site');
});

test('[slug] template: a page per item, slug field or slugified name', () => {
  const c = content({
    'pages/people/index.json': {},
    'pages/people/[slug].json': { config: { source: 'people' }, section: 'People' },
    'sources/people.json': [{ slug: 'noor', name: 'Noor' }, { name: 'Daan Ökafor' }],
  });
  const r = buildRoutes(c).routes;
  assert.deepEqual(
    r.map((x) => x.path),
    ['/people/', '/people/noor/', '/people/daan-okafor/'],
  );
  const noor = r[1];
  assert.equal(noor.page, 'album');
  assert.equal(noor.template, 'pages/people/[slug].json');
  assert.equal(noor.nextPath, '/people/daan-okafor/');
  assert.equal(r[2].nextPath, '/people/noor/');
  assert.equal(noor.title, 'Noor | People | Site');
  assert.equal(itemHref({ routes: r }, 'people', c.people[1]), '/people/daan-okafor/');
});

test('a fixed page beats the template for the same slug', () => {
  const c = content({
    'pages/people/[slug].json': { config: { source: 'people' } },
    'pages/people/noor/index.json': { title: 'Mine' },
    'sources/people.json': [
      { slug: 'noor', name: 'Noor' },
      { slug: 'daan', name: 'Daan' },
    ],
  });
  const r = buildRoutes(c).routes;
  assert.deepEqual(
    r.map((x) => [x.path, x.page]),
    [
      ['/people/noor/', 'page'],
      ['/people/daan/', 'album'],
    ],
  );
  assert.equal(r[1].nextPath, '/people/noor/'); // still the item's URL
});

test('missing, invalid and duplicate slugs warn and get no page', () => {
  const c = content({
    'pages/people/[slug].json': { config: { source: 'people' } },
    'pages/places/[slug].json': { config: { source: 'nope' } },
    'sources/people.json': [{ slug: 'a' }, { slug: 'a' }, {}, { slug: 'Not Valid' }],
  });
  const { routes, warnings } = buildRoutes(c);
  assert.deepEqual(
    routes.map((x) => x.path),
    ['/people/a/'],
  );
  assert.equal(warnings.length, 4);
  assert.match(warnings.join('\n'), /duplicate slug "a"/);
  assert.match(warnings.join('\n'), /no slug or name/);
  assert.match(warnings.join('\n'), /"Not Valid" is not valid/);
  assert.match(warnings.join('\n'), /config.source "nope"/);
});

test('content file names', () => {
  assert.ok(isContentFile('pages/people/[slug].json'));
  assert.ok(isContentFile('pages/a/b/index.json'));
  assert.ok(!isContentFile('pages/a/b/c.json')); // a page is a folder with index.json
  assert.ok(!isContentFile('pages/about.json'));
  assert.ok(!isContentFile('pages/[slug].json'));
  assert.ok(!isContentFile('sources/a/b.json'));
  assert.ok(!isContentFile('pages/a/../b.json'));
  assert.equal(pageIdOf('pages/people/[slug].json'), 'people/[slug]');
  assert.equal(pageIdOf('pages/index.json'), 'home');
  assert.equal(pageIdOf('pages/people/whatever/index.json'), 'people/whatever');
  for (const id of ['home', 'people', 'people/[slug]', 'a/b'])
    assert.equal(pageIdOf(pageFile(id)), id);
  assert.equal(slugify('  Kasteel de Haar! '), 'kasteel-de-haar');
});

test('placeholder items: noindex, so not in the sitemap', () => {
  const c = content({
    'pages/people/index.json': {},
    'pages/people/[slug].json': { config: { source: 'people' } },
    'sources/people.json': [{ name: 'Real' }, { name: 'Stock', placeholder: true }],
  });
  const r = buildRoutes(c).routes;
  assert.equal(r.find((x) => x.path === '/people/real/').noindex, false);
  assert.equal(r.find((x) => x.path === '/people/stock/').noindex, true);
  const xml = sitemapXml(r, 'https://example.com');
  assert.match(xml, /<loc>https:\/\/example\.com\/people\/real\/<\/loc>/);
  assert.doesNotMatch(xml, /stock/);
});

test('a name that makes no slug says so', () => {
  const c = content({
    'pages/people/[slug].json': { config: { source: 'people' } },
    'sources/people.json': [{ name: '??? //' }, {}],
  });
  assert.deepEqual(buildRoutes(c).warnings, [
    'sources/people.json item 1: name "??? //" makes no slug, add a "slug": no page',
    'sources/people.json item 2 has no slug or name: no page',
  ]);
});
