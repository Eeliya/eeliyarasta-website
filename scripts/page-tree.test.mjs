import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crumbsOf,
  levelOf,
  linkPage,
  linksTo,
  movePage,
  parentPath,
  shownPath,
  unlinkPage,
} from '../src/editor/lib/page-tree.js';
import { buildRoutes } from '../src/site/routes.js';
import { hrefOf } from '../src/site/hrefs.js';
import { contentFromFiles } from '../src/site/files.js';
import { checkContent } from '../src/site/validate.js';
import { ownPageRedirects } from '../src/site/redirects.js';

const page = (id, title, more = {}) => ({
  version: 1,
  kind: 'page',
  id,
  sections: [{ id: 's-aaaa', blocks: [{ id: 'b-aaaa', type: 'heading', title }] }],
  ...more,
});
const NAV = {
  version: 1,
  header: [
    { label: 'Home', page: 'pg-home' },
    {
      label: 'Photography',
      page: 'pg-phot',
      children: [
        { label: 'Places', page: 'pg-plac' },
        { label: 'People', page: 'pg-peop' },
      ],
    },
    { label: 'About', page: 'pg-abou' },
  ],
};
const files = (more = {}) => ({
  'settings/site.json': { name: 'Site', title: 'Site home' },
  'settings/nav.json': NAV,
  'pages/index.json': page('pg-home', 'Home'),
  'pages/404/index.json': page('pg-nf00', 'Not found'),
  'pages/about/index.json': page('pg-abou', 'About'),
  'pages/old/index.json': page('pg-old0', 'Old portfolio'),
  'pages/photography/index.json': page('pg-phot', 'Photography'),
  'pages/photography/people/index.json': page('pg-peop', 'People'),
  'pages/photography/people/[person]/index.json': {
    ...page('pg-pslg', 'x'),
    template: { source: 'people' },
  },
  'pages/photography/places/index.json': page('pg-plac', 'Places'),
  'pages/photography/archive/index.json': page('pg-arch', 'Archive'),
  'sources/people.json': { version: 1, items: [{ id: 'p-aaaa', name: 'Noor' }] },
  ...more,
});

test('the top level: home its own page, the menu order, the rest not linked', () => {
  const l = levelOf(files(), '');
  assert.equal(l.own.title, 'Home');
  assert.equal(l.own.seg, '/');
  assert.deepEqual(
    l.sub.map((r) => [r.title, r.seg]),
    [
      ['Photography', '/photography/'],
      ['About', '/about/'],
    ],
  );
  assert.deepEqual(
    l.notLinked.map((r) => r.seg),
    ['/404/', '/old/', '/photography/archive/'],
  );
  assert.equal(l.canOwn, false);
});

test('a folder: own segments, menu order, [param] last, Not linked filtered', () => {
  const l = levelOf(files(), 'photography', 'here');
  assert.deepEqual(
    l.sub.map((r) => [r.title, r.seg, r.kids]),
    [
      ['Places', 'places/', 0],
      ['People', 'people/', 1],
    ],
  );
  assert.deepEqual(
    l.notLinked.map((r) => r.seg),
    ['archive/'],
  );
  assert.equal(levelOf(files(), 'photography', 'all').notLinked.length, 3);
  const people = levelOf(files(), 'photography/people');
  assert.deepEqual(
    people.sub.map((r) => [r.title, r.seg, r.template, r.items]),
    [['[person]', '[person]/', true, 1]],
  );
  assert.deepEqual(
    crumbsOf('photography/people').map((c) => c.label),
    ['/', 'photography/', 'people/'],
  );
});

test('own page off: no own row, the first sub item opens at the folder URL', () => {
  const f = files({
    'pages/photography/index.json': page('pg-phot', 'Photography', { ownPage: false }),
  });
  const l = levelOf(f, 'photography');
  assert.equal(l.own, null);
  assert.equal(l.canOwn, true);
  assert.deepEqual(
    l.sub.filter((r) => r.asRoot).map((r) => r.title),
    ['Places'],
  );
  // the site: /photography/ redirects (302) there, links go straight there
  const content = contentFromFiles(f);
  const { routes } = buildRoutes(content);
  const r = routes.find((x) => x.path === '/photography/');
  assert.equal(r.redirect, '/photography/places/');
  assert.equal(r.noindex, true);
  assert.equal(hrefOf({ ...content, routes }, { page: 'pg-phot' }), '/photography/places/');
  assert.deepEqual(ownPageRedirects(routes), [
    { from: '/photography/', to: '/photography/places/', status: 302 },
  ]);
  assert.deepEqual(
    checkContent('pages/photography/index.json', f['pages/photography/index.json']),
    [],
  );
  assert.notDeepEqual(
    checkContent('pages/index.json', { ...page('pg-home', 'H'), ownPage: false }),
    [],
  );
  assert.notDeepEqual(
    checkContent('pages/about/index.json', { ...page('pg-abou', 'A'), ownPage: true }),
    [],
  );
});

test('the menu: link into a dropdown or the top, unlink promotes, move', () => {
  const a = linkPage(NAV, 'pg-arch', 'Archive', 'pg-phot');
  assert.deepEqual(
    a.header[1].children.map((c) => c.page),
    ['pg-plac', 'pg-peop', 'pg-arch'],
  );
  assert.equal(linkPage(NAV, 'pg-old0', 'Old', null).header.at(-1).page, 'pg-old0');
  const u = unlinkPage(NAV, 'pg-phot');
  assert.deepEqual(
    u.header.map((c) => c.page),
    ['pg-home', 'pg-plac', 'pg-peop', 'pg-abou'],
  );
  assert.deepEqual(
    unlinkPage(NAV, 'pg-peop').header[1].children.map((c) => c.page),
    ['pg-plac'],
  );
  const m = movePage(NAV, 'pg-peop', { before: 'pg-plac' });
  assert.deepEqual(
    m.header[1].children.map((c) => c.page),
    ['pg-peop', 'pg-plac'],
  );
  assert.deepEqual(
    movePage(NAV, 'pg-home', { after: 'pg-abou' }).header.map((c) => c.page),
    ['pg-phot', 'pg-abou', 'pg-home'],
  );
  // a dropdown into a dropdown: no
  assert.equal(movePage(NAV, 'pg-phot', { before: 'pg-peop' }), null);
  assert.equal(NAV.header[1].children[0].page, 'pg-plac'); // unchanged
  assert.equal(linksTo(files(), 'pg-phot', 'pages/photography/index.json'), 1);
});

test('a [param] folder in a [param] folder: its own level, "per" the outer one', () => {
  const f = {
    'pages/index.json': {},
    'pages/people/index.json': { title: 'People' },
    'pages/people/[person]/index.json': { template: { source: 'people' } },
    'pages/people/[person]/[year]/index.json': { template: { source: 'shoots', key: 'year' } },
    'sources/people.json': { items: [{ slug: 'a' }] },
  };
  const outer = levelOf(f, 'people').sub.at(-1);
  assert.deepEqual(
    [outer.id, outer.seg, outer.kids, outer.nested],
    ['people/[person]', '[person]/', 1, null],
  );
  const L = levelOf(f, 'people/[person]');
  assert.equal(L.path, '/people/[person]/');
  assert.equal(L.canOwn, false);
  const inner = L.sub.at(-1);
  assert.deepEqual(
    [inner.id, inner.seg, inner.title, inner.nested],
    ['people/[person]/[year]', '[year]/', '[year]', '[person]'],
  );
  assert.equal(parentPath('people/[person]/[year]'), '/people/:person/');
  assert.equal(parentPath('people/[person]'), '/people/');
  assert.equal(shownPath('people/[person]/[year]'), '/people/[person]/[year]/');
});
