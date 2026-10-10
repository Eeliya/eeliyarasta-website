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

/** content/ in a temp dir: home, 404, people (+ [slug] and team), about, a menu and redirects. */
function site(redirects = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'redirects-'));
  const put = (f, data) => {
    const file = path.join(root, 'content', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('settings/site.json', { name: 'Test', url: 'https://test.example' });
  put('settings/nav.json', {
    header: [
      { label: 'People', page: '/people/', children: [{ label: 'Team', page: '/people/team/' }] },
      { label: 'About', page: '/about/' },
    ],
    footer: [{ label: 'Noor', page: '/people/noor/' }],
  });
  put('settings/redirects.json', redirects);
  put(
    'pages/index.json',
    page({ type: 'button', label: 'Team', config: { href: '/people/team/#join' } }),
  );
  put('pages/404/index.json', {});
  put(
    'pages/about/index.json',
    page({ type: 'button', label: 'x', config: { href: '/peoples/' } }),
  );
  put('pages/people/index.json', {});
  put('pages/people/[slug].json', { config: { source: 'people' } });
  put('pages/people/team/index.json', {});
  put('sources/people.json', [{ slug: 'noor', name: 'Noor' }, { name: 'Daan' }]);
  return root;
}
/** A page with one section holding `block`. */
function page(block) {
  const pos = { col: 1, span: 24, row: 1, rows: 1 };
  return { sections: [{ id: 's-aaaa', blocks: [{ id: 'b-aaaa', pos, ...block }] }] };
}
const read = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));

test('rename: every path of the folder redirects (items by pattern), links follow', () => {
  const root = site();
  const r = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.equal(r.status, 200, r.body.error);
  assert.deepEqual(read(root, 'settings/redirects.json'), [
    { from: '/people/', to: '/models/' },
    { from: '/people/:slug/', to: '/models/:slug/' }, // also /people/team/ (one segment)
  ]);
  const nav = read(root, 'settings/nav.json');
  assert.equal(nav.header[0].page, '/models/');
  assert.equal(nav.header[0].children[0].page, '/models/team/');
  assert.equal(nav.footer[0].page, '/models/noor/');
  assert.equal(
    read(root, 'pages/index.json').sections[0].blocks[0].config.href,
    '/models/team/#join',
  );
  assert.equal(read(root, 'pages/about/index.json').sections[0].blocks[0].config.href, '/peoples/'); // not a match
  assert.equal(r.body.links, 4);
  assert.deepEqual(r.body.changed.sort(), [
    'pages/index.json',
    'settings/nav.json',
    'settings/redirects.json',
  ]);
});

test('chain collapse, self-loops and a redirect from a page again', () => {
  const root = site([
    { from: '/team/', to: '/people/team/', status: 302 },
    { from: '/models/', to: '/elsewhere/' },
  ]);
  const first = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.deepEqual(first.body.pruned, [{ from: '/models/', to: '/elsewhere/' }]); // a page now
  const list = read(root, 'settings/redirects.json');
  assert.deepEqual(list[0], { from: '/team/', to: '/models/team/', status: 302 }); // no chain
  // back again: /people/ -> /models/ -> /people/ would loop: those go
  const r = pagesOp(root, { op: 'rename', id: 'models', name: 'people' });
  assert.deepEqual(r.body.pruned, []);
  assert.deepEqual(read(root, 'settings/redirects.json'), [
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
  assert.deepEqual(read(root, 'settings/redirects.json'), [
    { from: '/crew/', to: '/people/' },
    { from: '/people/team/', to: '/people/' },
  ]);
  // links to it go to the target, without the #hash
  assert.equal(read(root, 'pages/index.json').sections[0].blocks[0].config.href, '/people/');
  assert.equal(read(root, 'settings/nav.json').header[0].children[0].page, '/people/');

  root = site();
  r = pagesOp(root, { op: 'delete', id: 'people/[slug]', redirect: '/about/' });
  assert.deepEqual(r.body.removed, ['pages/people/[slug].json']);
  assert.deepEqual(read(root, 'settings/redirects.json'), [
    { from: '/people/:slug/', to: '/about/' },
  ]);
  assert.equal(read(root, 'settings/nav.json').footer[0].page, '/about/');
  assert.equal(
    pagesOp(site(), { op: 'delete', id: 'people', redirect: '/people/team/' }).status,
    400,
  );
  assert.equal(pagesOp(site(), { op: 'delete', id: 'about', redirect: '/nope/' }).status, 400);

  root = site([{ from: '/crew/', to: '/people/team/' }]);
  r = pagesOp(root, { op: 'delete', id: 'people', redirect: null });
  assert.deepEqual(read(root, 'settings/redirects.json'), []); // gone: no redirect to it either
  assert.equal(r.body.broken, 4); // links to it stay (the build's link check finds them)
  assert.equal(r.body.links, 0);
});

test('an item slug change: its page redirects, links follow', () => {
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
  after['sources/people.json'][0].slug = 'noor-v';
  after['sources/people.json'][1].name = 'Daan O'; // slug from the name: daan -> daan-o
  const moves = itemMoves(before, after);
  assert.deepEqual(
    [...moves],
    [
      ['/people/noor/', '/people/noor-v/'],
      ['/people/daan/', '/people/daan-o/'],
    ],
  );
  const { edits } = moveLinks(after, moves);
  assert.deepEqual(edits, [
    { file: 'settings/nav.json', parts: ['footer', '0', 'page'], value: '/people/noor-v/' },
  ]);
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
  assert.deepEqual(checkContent('settings/redirects.json', []), []);
  assert.deepEqual(checkContent('settings/redirects.json', {}), [
    'must be a list (a JSON array), not an object',
  ]);
  assert.deepEqual(
    checkContent('settings/redirects.json', [
      { from: 'old', to: '/new/' },
      { from: '/a/', to: 'new' },
      { from: '/a/', to: '/b/', status: 307 },
    ]),
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
    home: page({ type: 'grid', config: { source: 'people' } }),
    'models/[slug]': { config: { source: 'people' } },
    work: page({ type: 'projects', config: { source: 'projects' } }),
  };
  assert.equal(sourcePage({ pages }, 'people'), '/models/');
  assert.equal(sourcePage({ pages }, 'projects'), '/work/');
  assert.equal(sourcePage({ pages }, 'places'), '/places/');
});
