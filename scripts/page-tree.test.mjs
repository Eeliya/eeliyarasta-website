import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crumbsOf,
  levelOf,
  dropOf,
  goesInside,
  linkAt,
  linkPage,
  linksTo,
  movePage,
  parentPath,
  shownPath,
  sortedAt,
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

test('the top level: home a row of the menu list, the menu order, the rest not linked', () => {
  const l = levelOf(files(), '');
  assert.equal(l.own, null);
  assert.deepEqual(
    l.sub.map((r) => [r.title, r.seg, r.movable, r.fixed]),
    [
      ['Home', '/', true, true],
      ['Photography', '/photography/', true, false],
      ['About', '/about/', true, false],
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

test('own page off: the root row stays (off), the first sub item opens at the folder URL', () => {
  const f = files({
    'pages/photography/index.json': page('pg-phot', 'Photography', { ownPage: false }),
  });
  const l = levelOf(f, 'photography');
  assert.deepEqual(
    [l.own.title, l.own.seg, l.own.self, l.own.off],
    ['Photography', '/', true, true],
  );
  assert.equal(levelOf(files(), 'photography').own.off, false);
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

test('the Own page switch: only in a folder with a normal sub page', () => {
  const f = files();
  assert.equal(levelOf(f, '').canOwn, false); // the top: home is always its own page
  assert.equal(levelOf(f, 'photography').canOwn, true);
  assert.equal(levelOf(f, 'about').canOwn, false); // a plain page: nothing to open instead
  assert.equal(levelOf(f, 'photography/people').canOwn, false); // only its [param] page
  assert.equal(levelOf(f, 'photography/people/[person]').canOwn, false);
  // a [param] folder with its [param] page: + has nothing to add
  const nested = files({
    'pages/photography/people/[person]/[year]/index.json': {
      ...page('pg-year', 'x'),
      template: { source: 'people' },
    },
  });
  assert.equal(levelOf(f, 'photography/people/[person]').full, false);
  assert.equal(levelOf(nested, 'photography/people/[person]').full, true);
  assert.equal(levelOf(nested, 'photography/people').full, false);
});

test('404 has no grip, [param] pages neither; home moves (in the menu or Not linked)', () => {
  const top = levelOf(files(), '');
  const nf = top.notLinked.find((r) => r.id === '404');
  assert.equal(nf.movable, false);
  assert.equal(dropOf(files(), top, nf, 0).kind, 'refuse');
  const people = levelOf(files(), 'photography/people');
  assert.deepEqual(
    people.sub.map((r) => [r.title, r.movable]),
    [['[person]', false]],
  );
  // home out of the menu: first in Not linked, still movable
  const nav = unlinkPage(NAV, 'pg-home');
  const out = levelOf(files({ 'settings/nav.json': nav }), '');
  assert.deepEqual(
    out.notLinked.map((r) => [r.title, r.movable]),
    [
      ['Home', true],
      ['Not found', false],
      ['Old portfolio', true],
      ['Archive', true],
    ],
  );
  assert.deepEqual(dropOf(files(), out, out.notLinked[0], 1), {
    kind: 'link',
    place: { before: 'pg-abou' },
  });
  // home into a folder: it stays at /
  assert.equal(
    dropOf(files(), levelOf(files(), 'photography'), out.notLinked[0], 0).kind,
    'refuse',
  );
});

test('drag link / unlink: into the menu at the drop place, out of it; Not linked sorts', () => {
  const f = files();
  const ph = levelOf(f, 'photography');
  const archive = ph.notLinked.find((r) => r.id === 'photography/archive');
  // dropped between Places and People: linked into Photography's dropdown there
  const plan = dropOf(f, ph, archive, 1);
  assert.deepEqual(plan, { kind: 'link', place: { before: 'pg-peop' } });
  const linked = linkAt(NAV, archive.pid, archive.title, 'pg-phot', plan.place);
  assert.deepEqual(
    linked.header[1].children.map((c) => c.page),
    ['pg-plac', 'pg-arch', 'pg-peop'],
  );
  // last: after the last one; an empty list: where linkPage puts it
  assert.deepEqual(dropOf(f, ph, archive, 9).place, { after: 'pg-peop' });
  assert.equal(dropOf(f, levelOf(f, 'about'), { ...archive, id: 'about/x' }, 0).place, null);
  // out of the menu: unlinkPage; Not linked has no order: the line is its sorted place
  const after = levelOf(files({ 'settings/nav.json': unlinkPage(NAV, 'pg-abou') }), '');
  assert.ok(after.notLinked.some((r) => r.id === 'about'));
  assert.equal(sortedAt(levelOf(f, '').notLinked, 'about'), 1); // after 404, before old
  assert.equal(sortedAt(levelOf(f, '').notLinked, 'home'), 0);
});

test('a page of another folder dropped on the menu list moves here, unless its name is taken', () => {
  const f = files({ 'pages/about/archive/index.json': page('pg-arc2', 'Old archive') });
  const top = levelOf(f, '');
  const old = top.notLinked.find((r) => r.id === 'old');
  const ph = levelOf(f, 'photography');
  assert.deepEqual(dropOf(f, ph, old, 0), {
    kind: 'move',
    place: { before: 'pg-plac' },
    to: 'photography/old',
  });
  // /photography/archive/ exists: about/archive can't come in
  const clash = dropOf(
    f,
    ph,
    top.notLinked.find((r) => r.id === 'about/archive'),
    0,
  );
  assert.equal(clash.kind, 'refuse');
  assert.match(clash.why, /\/photography\/archive\/ exists already/);
  // not into itself, not into a [param] folder
  const phRow = { ...ph.own, self: false, id: 'photography' };
  assert.equal(dropOf(f, levelOf(f, 'photography/people'), phRow, 0).kind, 'refuse');
  assert.equal(dropOf(f, levelOf(f, 'photography/people/[person]'), old, 0).kind, 'refuse');
});

test('a double click goes into any page level; a root row, home and 404 open', () => {
  const f = files();
  const top = levelOf(f, '');
  const by = (l, id) => [...l.sub, ...l.notLinked].find((r) => r.id === id);
  assert.equal(goesInside(by(top, 'about')), true); // a plain page: its root row, no sub pages
  assert.equal(goesInside(by(top, 'photography')), true);
  assert.equal(goesInside(by(top, 'old')), true); // Not linked too
  assert.equal(goesInside(by(top, 'home')), false); // home is the top: it opens
  assert.equal(goesInside(by(top, '404')), false);
  const about = levelOf(f, 'about');
  assert.equal(goesInside(about.own), false); // the root row opens the page
  assert.deepEqual([about.own.title, about.sub.length], ['About', 0]);
  assert.equal(goesInside(levelOf(f, 'photography/people').sub[0]), true); // [person]
});
