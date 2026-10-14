import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesOp } from './editor-server.mjs';
import {
  buildRedirects,
  itemMoves,
  moveLinks,
  moveRedirects,
  pruneRedirects,
  redirectsText,
  sitePaths,
} from '../src/site/redirects.js';
import { checkContent } from '../src/site/validate.js';
import { read } from './test-layout.mjs';

/** content/ in a temp dir: home, 404, people (+ [slug] and team), about, a menu and redirects. */
function site(redirects = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'redirects-'));
  const put = (f, data) => {
    const file = path.join(root, 'content/en', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('settings/site.json', { version: 1, name: 'Test', url: 'https://test.example' });
  put('settings/nav.json', {
    version: 1,
    header: [
      { label: 'People', page: 'pg-peop', children: [{ label: 'Team', page: 'pg-team' }] },
      { label: 'About', page: 'pg-abou' },
      { label: 'Noor', item: { source: 'people', id: 'p-noor' } },
    ],
  });
  put('settings/redirects.json', { version: 1, redirects });
  put(
    'pages/index.json',
    page('pg-home', {
      type: 'button',
      label: 'Team',
      config: { link: { href: '/people/team/#join' } },
    }),
  );
  put('pages/404/index.json', { version: 1, id: 'pg-t404' });
  put(
    'pages/about/index.json',
    page('pg-abou', { type: 'button', label: 'x', config: { link: { href: '/peoples/' } } }),
  );
  put('pages/people/index.json', { version: 1, id: 'pg-peop' });
  put('pages/people/[slug].json', {
    version: 1,
    id: 'pg-pslg',

    template: { source: 'people' },
  });
  put('pages/people/team/index.json', { version: 1, id: 'pg-team' });
  put('sources/people.json', {
    version: 1,
    items: [
      { id: 'p-noor', slug: 'noor', name: 'Noor' },
      { id: 'p-daan', name: 'Daan' },
    ],
  });
  return root;
}
/** A page with one section holding `block`. */
function page(id, block) {
  const layout = { base: { col: 1, span: 24, row: 1 } };
  return {
    version: 1,
    id,

    sections: [{ id: 's-aaaa', blocks: [{ id: 'b-aaaa', layout, ...block }] }],
  };
}

test('rename: every path of the folder redirects (items by pattern), links follow', () => {
  const root = site();
  const r = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.equal(r.status, 200, r.body.error);
  assert.deepEqual(read(root, 'settings/redirects.json').redirects, [
    { from: '/people/', to: '/models/' },
    { from: '/people/:slug/', to: '/models/:slug/' }, // also /people/team/ (one segment)
  ]);
  // links by id (the menus) need nothing; an href path follows
  const nav = read(root, 'settings/nav.json');
  assert.equal(nav.header[0].page, 'pg-peop');
  assert.equal(
    read(root, 'pages/index.json').sections[0].blocks[0].config.link.href,
    '/models/team/#join',
  );
  assert.equal(
    read(root, 'pages/about/index.json').sections[0].blocks[0].config.link.href,
    '/peoples/',
  ); // not a match
  assert.equal(r.body.links, 1);
  assert.deepEqual(r.body.changed.sort(), ['pages/index.json', 'settings/redirects.json']);
});

test('chain collapse, self-loops and a redirect from a page again', () => {
  const root = site([
    { from: '/team/', to: '/people/team/', status: 302 },
    { from: '/models/', to: '/elsewhere/' },
  ]);
  const first = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.deepEqual(first.body.pruned, [{ from: '/models/', to: '/elsewhere/' }]); // a page now
  const list = read(root, 'settings/redirects.json').redirects;
  assert.deepEqual(list[0], { from: '/team/', to: '/models/team/', status: 302 }); // no chain
  // back again: /people/ -> /models/ -> /people/ would loop: those go
  const r = pagesOp(root, { op: 'rename', id: 'models', name: 'people' });
  assert.deepEqual(r.body.pruned, []);
  assert.deepEqual(read(root, 'settings/redirects.json').redirects, [
    { from: '/team/', to: '/people/team/', status: 302 },
    { from: '/models/', to: '/people/' },
    { from: '/models/:slug/', to: '/people/:slug/' },
  ]);
  // a new page where a redirect was: the redirect goes
  const add = pagesOp(root, { op: 'add', name: 'team' });
  assert.deepEqual(
    add.body.pruned.map((p) => p.from),
    ['/team/'],
  );
});

test('delete: to the parent (default), to a chosen page, or gone', () => {
  let root = site([{ from: '/crew/', to: '/people/team/' }]);
  let r = pagesOp(root, { op: 'delete', id: 'people/team' });
  assert.equal(r.status, 200, r.body.error);
  assert.deepEqual(read(root, 'settings/redirects.json').redirects, [
    { from: '/crew/', to: '/people/' },
    { from: '/people/team/', to: '/people/' },
  ]);
  // links to it go to the target (a page link: the target's id), without the #hash
  assert.equal(read(root, 'pages/index.json').sections[0].blocks[0].config.link.href, '/people/');
  assert.equal(read(root, 'settings/nav.json').header[0].children[0].page, 'pg-peop');

  root = site();
  r = pagesOp(root, { op: 'delete', id: 'people/[slug]', redirect: '/about/' });
  assert.deepEqual(r.body.removed, ['pages/people/[slug].json']);
  assert.deepEqual(read(root, 'settings/redirects.json').redirects, [
    { from: '/people/:slug/', to: '/about/' },
  ]);
  // an item link of a deleted [slug] page: broken (the build warns), not rewritten
  assert.deepEqual(read(root, 'settings/nav.json').header[2].item, {
    source: 'people',
    id: 'p-noor',
  });
  assert.equal(r.body.broken, 1);
  assert.equal(
    pagesOp(site(), { op: 'delete', id: 'people', redirect: '/people/team/' }).status,
    400,
  );
  assert.equal(pagesOp(site(), { op: 'delete', id: 'about', redirect: '/nope/' }).status, 400);

  root = site([{ from: '/crew/', to: '/people/team/' }]);
  r = pagesOp(root, { op: 'delete', id: 'people', redirect: null });
  assert.deepEqual(read(root, 'settings/redirects.json').redirects, []); // gone: no redirect to it either
  assert.equal(r.body.broken, 4); // links to it stay (the build's link check finds them)
  assert.equal(r.body.links, 0);
});

test('an item slug change: its page redirects; links by id need nothing', () => {
  const root = site();
  const before = Object.fromEntries(
    [
      'settings/site.json',
      'settings/nav.json',
      'pages/people/[slug].json',
      'sources/people.json',
    ].map((f) => [f, read(root, f)]),
  );
  const after = structuredClone(before);
  after['sources/people.json'].items[0].slug = 'noor-v';
  after['sources/people.json'].items[1].name = 'Daan O'; // slug from the name: daan -> daan-o
  const moves = itemMoves(before, after);
  assert.deepEqual(
    [...moves],
    [
      ['/people/noor/', '/people/noor-v/'],
      ['/people/daan/', '/people/daan-o/'],
    ],
  );
  assert.deepEqual(moveLinks(after, moves).edits, []); // the menu links the item by its id
  const { list } = moveRedirects([], moves);
  assert.deepEqual(pruneRedirects(list, sitePaths(after)).list, [
    { from: '/people/noor/', to: '/people/noor-v/' },
    { from: '/people/daan/', to: '/people/daan-o/' },
  ]);
});

test('_redirects: one line per path, with and without its slash; build warnings', () => {
  const list = [
    { from: '/old/', to: '/new/' },
    { from: '/p/:slug/', to: '/people/:slug/', status: 302 },
    { from: '/x.html', to: 'https://example.com' },
  ];
  assert.equal(
    redirectsText(list),
    [
      '/old/ /new/ 301',
      '/old /new/ 301',
      '/p/:slug/ /people/:slug/ 302',
      '/p/:slug /people/:slug/ 302',
      '/x.html https://example.com 301',
    ].join('\n'),
  );
  const paths = new Set(['/', '/new/', '/people/:slug/', '/about/']);
  const out = buildRedirects(
    [...list, { from: '/about/', to: '/' }, { from: '/a/', to: '/b/' }],
    paths,
  );
  assert.equal(out.list.length, 4);
  assert.deepEqual(out.warnings, [
    '/about/ is a page: its redirect is left out (remove it in Settings > Redirects)',
    '/a/ -> /b/: there is no page /b/',
  ]);
});

test('validation: redirects.json', () => {
  const R = 'settings/redirects.json';
  assert.deepEqual(checkContent(R, { version: 1, redirects: [] }), []);
  assert.deepEqual(checkContent(R, { version: 1, redirects: {} }), [
    '"redirects" must be a list (a JSON array), not an object',
  ]);
  assert.deepEqual(
    checkContent(R, {
      version: 1,
      redirects: [
        { from: 'old', to: '/new/' },
        { from: '/a/', to: 'new' },
        { from: '/a/', to: '/b/', status: 307 },
      ],
    }),
    [
      'redirect 1: "from" must be a path that starts with /',
      'redirect 2: "to" must be a path that starts with / or an http(s) URL, without spaces',
      'redirect 3: another redirect is from /a/',
      'redirect 3: "status" is 301 (moved for good, the default) or 302 (for now)',
    ],
  );
});

test('"See all" links go to the page that shows the source, wherever it is', async () => {
  const { sourcePage } = await import('../src/site/blocks/data.js');
  const pages = {
    home: page('pg-home', { type: 'grid', config: { source: 'people' } }),
    'models/[slug]': { template: { source: 'people' } },
    work: page('pg-work', { type: 'projects', config: { source: 'projects' } }),
  };
  assert.equal(sourcePage({ pages }, 'people'), '/models/');
  assert.equal(sourcePage({ pages }, 'projects'), '/work/');
  assert.equal(sourcePage({ pages }, 'places'), '/places/');
});
