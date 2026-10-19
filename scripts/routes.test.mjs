import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paramPage } from './test-layout.mjs';
import { buildRoutes, pathOfId, sitemapXml } from '../src/site/routes.js';
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
  assert.equal(r.find((x) => x.path === '/about/').page, 'about'); // built-in view
  assert.equal(r.find((x) => x.path === '/people/').page, 'page'); // a view by id, not by name
  assert.equal(r.find((x) => x.path === '/people/whatever/').page, 'page');
  assert.equal(r.find((x) => x.path === '/people/whatever/').title, 'Whatever | Site');
});

test('[param] template: a page per item, slug field or slugified name', () => {
  const c = content({
    'pages/people/index.json': {},
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'sources/people.json': {
      version: 1,
      kind: 'page',
      id: 'pg-t029',

      items: [{ slug: 'noor', name: 'Noor' }, { name: 'Daan Ökafor' }],
    },
  });
  const r = buildRoutes(c).routes;
  assert.deepEqual(
    r.map((x) => x.path),
    ['/people/', '/people/noor/', '/people/daan-okafor/'],
  );
  const noor = r[1];
  assert.equal(noor.page, 'album');
  assert.equal(noor.template, 'pages/people/[person]/index.json');
  assert.equal(noor.section, 'People');
  assert.ok(!('nextPath' in noor)); // no next link (it comes back as a block)
  assert.equal(noor.title, 'Noor | People | Site');
  assert.equal(
    itemHref({ ...c, routes: r }, 'people', c.sources.people[1]),
    '/people/daan-okafor/',
  );
});

test('a fixed page beats the template for the same slug', () => {
  const c = content({
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'pages/people/noor/index.json': { title: 'Mine' },
    'sources/people.json': {
      version: 1,
      kind: 'page',
      id: 'pg-t030',

      items: [
        { slug: 'noor', name: 'Noor' },
        { slug: 'daan', name: 'Daan' },
      ],
    },
  });
  const r = buildRoutes(c).routes;
  assert.deepEqual(
    r.map((x) => [x.path, x.page]),
    [
      ['/people/noor/', 'page'],
      ['/people/daan/', 'album'],
    ],
  );
  assert.equal(r[1].path, '/people/daan/');
});

test('missing, invalid and duplicate slugs warn and get no page', () => {
  const c = content({
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'pages/places/[place]/index.json': paramPage('places/[place]', 'nope'),
    'sources/people.json': {
      version: 1,
      kind: 'page',
      id: 'pg-t031',

      items: [{ slug: 'a' }, { slug: 'a' }, {}, { slug: 'Not Valid' }],
    },
  });
  const { routes, warnings } = buildRoutes(c);
  assert.deepEqual(
    routes.map((x) => x.path),
    ['/people/a/'],
  );
  assert.equal(warnings.length, 4);
  assert.match(warnings.join('\n'), /duplicate slug "a"/);
  assert.match(warnings.join('\n'), /no slug or name/);
  assert.match(warnings.join('\n'), /"Not Valid" is not a valid URL part/);
  assert.match(warnings.join('\n'), /No pages are built: the main block’s source is missing/);
});

test('content file names', () => {
  assert.ok(isContentFile('pages/people/[person]/index.json'));
  assert.ok(isContentFile('pages/a/b/index.json'));
  assert.ok(!isContentFile('pages/a/b/c.json')); // a page is a folder with index.json
  assert.ok(!isContentFile('pages/about.json'));
  assert.ok(!isContentFile('pages/[slug]/index.json'));
  assert.ok(!isContentFile('sources/a/b.json'));
  assert.ok(!isContentFile('pages/a/../b.json'));
  assert.equal(pageIdOf('pages/people/[person]/index.json'), 'people/[person]');
  assert.equal(pageIdOf('pages/index.json'), 'home');
  assert.equal(pageIdOf('pages/people/whatever/index.json'), 'people/whatever');
  for (const id of ['home', 'people', 'people/[person]', 'a/b'])
    assert.equal(pageIdOf(pageFile(id)), id);
  assert.equal(slugify('  Kasteel de Haar! '), 'kasteel-de-haar');
});

test('placeholder items: noindex, so not in the sitemap', () => {
  const c = content({
    'pages/people/index.json': {},
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'sources/people.json': {
      version: 1,
      kind: 'page',
      id: 'pg-t032',

      items: [{ name: 'Real' }, { name: 'Stock', placeholder: true }],
    },
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
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'sources/people.json': { version: 1, items: [{ name: '??? //' }, {}] },
  });
  assert.deepEqual(buildRoutes(c).warnings, [
    'sources/people.json item 1: name "??? //" makes no slug, add a "slug": no page',
    'sources/people.json item 2 has no slug or name: no page',
  ]);
});

/** People, and a shoots source whose items name their person (by slug or id) and a year. */
const nested = (extra = {}) =>
  content({
    'pages/people/index.json': { title: 'People' },
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'pages/people/[person]/[year]/index.json': paramPage('people/[person]/[year]', 'shoots', {
      person: 'person',
      year: 'year',
    }),
    'sources/people.json': {
      version: 1,
      items: [
        { id: 'p-noor', slug: 'noor', name: 'Noor' },
        { id: 'p-daan', slug: 'daan', name: 'Daan' },
      ],
    },
    'sources/shoots.json': {
      version: 1,
      items: [
        { id: 's-1', name: 'Dunes', person: 'noor', year: '2024' },
        { id: 's-2', name: 'Forest', person: 'noor', year: '2024' },
        { id: 's-3', name: 'City', person: 'p-daan', year: '2025' },
        { id: 's-4', name: 'Odd', person: 'no-match', year: '2023' },
      ],
    },
    'sources/shoots.schema.json': {
      version: 1,
      fields: [
        { key: 'name', type: 'text' },
        { key: 'person', type: 'text' },
        { key: 'year', type: 'text' },
      ],
    },
    ...extra,
  });

test('nested [param] folders: a page per outer page and matching item, named params', () => {
  const { routes, warnings } = buildRoutes(nested());
  assert.deepEqual(warnings, []);
  assert.deepEqual(
    routes.map((r) => [r.id, r.path]),
    [
      ['people', '/people/'],
      ['people/[person]', '/people/noor/'],
      ['people/[person]', '/people/daan/'],
      // keyed by year: one page per value (its first item), only the person's items
      ['people/[person]/[year]', '/people/noor/2024/'],
      ['people/[person]/[year]', '/people/daan/2025/'],
    ],
  );
  const year = routes.find((r) => r.path === '/people/noor/2024/');
  assert.deepEqual(year.params, { person: 'noor', year: '2024' });
  assert.equal(year.album.id, 's-1');
  assert.equal(year.parent, '/people/noor/');
  assert.equal(year.section, 'Noor'); // its outer page's name
  assert.equal(year.template, 'pages/people/[person]/[year]/index.json');
  assert.equal(pathOfId('people/[person]/[year]'), '/people/:person/:year/');
  assert.equal(pathOfId('people/[person]'), '/people/:person/');
});

test('nested [param] folders: a fixed page wins, and gets no pages under it', () => {
  const r = buildRoutes(nested({ 'pages/people/daan/index.json': { title: 'Mine' } })).routes;
  assert.deepEqual(
    r.filter((x) => x.id === 'people/[person]/[year]').map((x) => x.path),
    ['/people/noor/2024/'], // daan is a fixed page: no items under it
  );
});

test('nested [param] folders: Any or a missing field on the main block builds no pages', () => {
  const inner = (rules) => {
    const p = paramPage('people/[person]/[year]', 'shoots');
    p.sections[0].blocks[0].source.where.rules = rules;
    return { 'pages/people/[person]/[year]/index.json': p };
  };
  const years = (c) => c.routes.filter((x) => x.id === 'people/[person]/[year]');
  // [person] on Any: every shoot under every person, the same page twice: no pages
  const any = buildRoutes(nested(inner([{ param: 'year', field: 'year' }])));
  assert.deepEqual(years(any), []);
  assert.match(any.warnings.join('\n'), /No pages are built: \[person\] needs a field to match/);
  const missing = buildRoutes(
    nested(
      inner([
        { param: 'person', field: 'person' },
        { param: 'year', field: 'when' },
      ]),
    ),
  );
  assert.deepEqual(years(missing), []);
  assert.match(missing.warnings.join('\n'), /\[year\] matches no field/);
  // the editor still gets pages to edit it on: the rules that can match, marked unbuilt
  const ed = buildRoutes(
    nested(
      inner([
        { param: 'person', field: 'person' },
        { param: 'year', field: 'when' },
      ]),
    ),
    { unbuilt: true },
  );
  const shown = years(ed);
  assert.ok(shown.length && shown.every((x) => x.unbuilt && x.noindex));
  // [year] matches nothing: one page per person, at its pattern, its first item
  assert.deepEqual(
    shown.map((x) => [x.path, x.album?.id]),
    [
      ['/people/noor/:year/', 's-1'],
      ['/people/daan/:year/', 's-3'],
    ],
  );
  // without a main block: one route at its pattern, no item
  const none = nested();
  delete none.pages['people/[person]/[year]'].main;
  assert.deepEqual(years(buildRoutes(none)), []);
  const [pattern] = years(buildRoutes(none, { unbuilt: true }));
  assert.equal(pattern.path, '/people/:person/:year/');
  assert.equal(pattern.album, null);
  assert.match(buildRoutes(none).warnings.join('\n'), /pick the main block/);
});

test('nested [param] folders: a page in one is no page; hrefs go to the item pages', () => {
  const c = nested({ 'pages/people/[person]/extra/index.json': {} });
  const { routes, warnings } = buildRoutes(c);
  assert.ok(!routes.some((r) => r.path.includes('extra')));
  assert.match(warnings.join('\n'), /holds only another \[param\] folder/);
  const ctx = { ...c, routes };
  assert.equal(itemHref(ctx, 'people', c.sources.people[1]), '/people/daan/');
  assert.equal(itemHref(ctx, 'shoots', c.sources.shoots[0]), '/people/noor/2024/');
  assert.ok(!isContentFile('pages/[a]/[b]/index.json')); // never at the root
  assert.ok(isContentFile('pages/a/[b]/[c]/index.json'));
  assert.equal(pageIdOf('pages/a/[b]/[c]/index.json'), 'a/[b]/[c]');
});
