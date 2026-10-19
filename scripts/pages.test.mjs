import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesOp, editableFiles } from './editor-server.mjs';
import { rowsOf } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { read } from './test-layout.mjs';

/** content/ in a temp dir: home, 404, about, people (+ [person] and team) and a people source. */
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const put = (f, data) => {
    const file = path.join(root, 'content/en', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('pages/index.json', { version: 1, kind: 'page', id: 'pg-t035' });
  put('pages/404/index.json', { version: 1, kind: 'page', id: 'pg-t036' });
  put('pages/about/index.json', { version: 1, kind: 'page', id: 'pg-t037', title: 'About' });
  put('pages/people/index.json', { version: 1, kind: 'page', id: 'pg-t038', title: 'People' });
  put('pages/people/[person]/index.json', {
    version: 1,
    kind: 'page',
    id: 'pg-t039',

    template: { source: 'people' },
  });
  put('pages/people/team/index.json', { version: 1, kind: 'page', id: 'pg-t040', title: 'Team' });
  put('sources/people.json', { version: 1, items: [{ slug: 'noor' }] });
  return root;
}
const pages = (root) => [...editableFiles(root)].filter((f) => f.startsWith('pages/'));

test('add: a folder with its index.json, valid slugs only, no overwrites', () => {
  const root = site();
  const r = pagesOp(root, { op: 'add', parent: 'people', name: 'new-one', title: 'New one' });
  assert.match(
    JSON.parse(
      fs.readFileSync(path.join(root, 'content/en/pages/people/new-one/index.json'), 'utf8'),
    ).id,
    /^pg-[a-z0-9]{4}$/,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 'people/new-one');
  assert.deepEqual(r.body.created, ['pages/people/new-one/index.json']);
  const [heading] = read(root, 'pages/people/new-one/index.json').sections;
  assert.deepEqual(
    heading.blocks.map(({ id: _id, ...b }) => b),
    [
      {
        type: 'heading',
        eyebrow: 'New one',
        title: 'New one',
        body: '',
        layout: { base: { row: 17 } },
      },
    ],
  );
  assert.match(heading.id, /^s-/);
  // below the header: the rows above it empty (sections have no space above)
  assert.equal(heading.spacing, undefined);
  assert.equal(rowsOf(heading), 17); // down to its block: no rows stored
  assert.deepEqual([heading.rows, heading.height], [undefined, undefined]);
  assert.deepEqual(pagesOp(root, { op: 'add', name: 'contact' }).body.created, [
    'pages/contact/index.json',
  ]);
  for (const name of ['New One', 'a_b', '', '-x', 'team'])
    assert.equal(pagesOp(root, { op: 'add', parent: 'people', name }).status, 400, name);
  for (const name of ['edit', 'home', '404'])
    assert.equal(pagesOp(root, { op: 'add', name }).status, 400, name); // reserved at the root
  assert.equal(pagesOp(root, { op: 'add', parent: 'nope', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'add', parent: '../x', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'add', parent: 'people/[person]', name: 'x' }).status, 400);
});

test('template: [param]/index.json in a page folder, one per folder, not at the root', () => {
  const root = site();
  assert.equal(pagesOp(root, { op: 'template', source: 'people' }).status, 400);
  assert.equal(pagesOp(root, { op: 'template', parent: 'about', source: 'nope' }).status, 400);
  const r = pagesOp(root, { op: 'template', parent: 'about', source: 'people' });
  assert.deepEqual(r.body.created, ['pages/about/[slug]/index.json']);
  assert.deepEqual(read(root, 'pages/about/[slug]/index.json').template, { source: 'people' });
  // what the editor writes passes the validator (its Save refuses anything else)
  assert.deepEqual(
    checkContent('pages/about/[slug]/index.json', read(root, 'pages/about/[slug]/index.json')),
    [],
  );
  const [album] = read(root, 'pages/about/[slug]/index.json').sections;
  assert.deepEqual(
    album.blocks.map((b) => b.type),
    ['album'],
  );
  assert.deepEqual([album.height, album.width, album.align], ['full', 'full', undefined]);
  assert.equal(pagesOp(root, { op: 'template', parent: 'about', source: 'people' }).status, 400);
});

test('rename moves the whole folder; a built-in view is kept', () => {
  const root = site();
  const r = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 'models');
  assert.deepEqual(r.body.created.sort(), [
    'pages/models/[person]/index.json',
    'pages/models/index.json',
    'pages/models/team/index.json',
  ]);
  assert.deepEqual(r.body.removed.sort(), [
    'pages/people/[person]/index.json',
    'pages/people/index.json',
    'pages/people/team/index.json',
  ]);
  assert.equal(read(root, 'pages/models/index.json').view, undefined); // no built-in view
  assert.equal(read(root, 'pages/models/team/index.json').view, undefined);
  assert.equal(pagesOp(root, { op: 'rename', id: 'about', name: 'models' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: 'models/[person]', name: 'X' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: '404', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: 'home', name: 'x' }).status, 400);
  // a page with a built-in view keeps it under its new name
  assert.equal(pagesOp(root, { op: 'rename', id: 'about', name: 'me' }).status, 200);
  assert.equal(read(root, 'pages/me/index.json').view, 'about');
});

test('delete removes the folder and everything in it; home and 404 stay', () => {
  const root = site();
  assert.deepEqual(pagesOp(root, { op: 'delete', id: 'people/[person]' }).body.removed, [
    'pages/people/[person]/index.json',
  ]);
  const r = pagesOp(root, { op: 'delete', id: 'people' });
  assert.deepEqual(r.body.removed.sort(), [
    'pages/people/index.json',
    'pages/people/team/index.json',
  ]);
  assert.deepEqual(pages(root), [
    'pages/404/index.json',
    'pages/about/index.json',
    'pages/index.json',
  ]);
  assert.equal(pagesOp(root, { op: 'delete', id: 'home' }).status, 400);
  assert.equal(pagesOp(root, { op: 'delete', id: '404' }).status, 400);
  assert.equal(pagesOp(root, { op: 'delete', id: 'people' }).status, 404);
  assert.equal(pagesOp(root, { op: 'delete', id: '../sources/people' }).status, 404);
});

test('an unknown op says so (not "No page")', () => {
  const r = pagesOp(site(), { op: 'nuke', id: 'about' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Unknown pages op "nuke"');
});

test('template in a template: a named [param] folder in a [param] folder, one per folder', () => {
  const root = site();
  const op = (o) => pagesOp(root, { op: 'template', source: 'people', ...o });
  // its name: a param name, not one already in its URL
  for (const param of ['Year', '1y', 'a_b', ''])
    assert.equal(op({ parent: 'people/[person]', param }).status, 400, param);
  assert.equal(op({ parent: 'people/[person]', param: 'person' }).status, 400);
  assert.equal(op({ parent: 'people', param: 'other' }).status, 400); // people has [person]
  const r = op({ parent: 'people/[person]', param: 'year', key: 'year' });
  assert.equal(r.status, 200, r.body.error);
  assert.deepEqual(r.body.created, ['pages/people/[person]/[year]/index.json']);
  const data = read(root, 'pages/people/[person]/[year]/index.json');
  assert.deepEqual(data.template, { source: 'people', key: 'year' });
  assert.deepEqual(checkContent('pages/people/[person]/[year]/index.json', data), []);
  assert.equal(op({ parent: 'people/[person]', param: 'month' }).status, 400); // one per folder
  assert.equal(op({ parent: 'people/[person]', param: 'x', key: 'a b' }).status, 400);
  // a page in a [param] folder: no
  assert.equal(
    pagesOp(root, { op: 'add', parent: 'people/[person]/[year]', name: 'x' }).status,
    400,
  );
  // delete the outer one: both go
  assert.deepEqual(pagesOp(root, { op: 'delete', id: 'people/[person]' }).body.removed.sort(), [
    'pages/people/[person]/[year]/index.json',
    'pages/people/[person]/index.json',
  ]);
});

test('move: a page into another folder, its name kept; links follow, no redirect', () => {
  const root = site();
  const put = (f, data) => fs.writeFileSync(path.join(root, 'content/en', f), JSON.stringify(data));
  put('pages/about/index.json', {
    version: 1,
    kind: 'page',
    id: 'pg-t037',
    title: 'About',
    sections: [
      {
        id: 's-aaaa',
        blocks: [{ id: 'b-aaaa', type: 'text', body: 'x', href: '/people/team/#top' }],
      },
    ],
  });
  const r = pagesOp(root, { op: 'move', id: 'people/team', parent: 'about' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.id, 'about/team');
  assert.deepEqual(r.body.created, ['pages/about/team/index.json']);
  assert.deepEqual(r.body.removed, ['pages/people/team/index.json']);
  assert.deepEqual(r.body.added, []);
  assert.equal(read(root, 'pages/about/index.json').sections[0].blocks[0].href, '/about/team/#top');
  assert.equal(fs.existsSync(path.join(root, 'content/en/pages/people/team')), false);
  assert.equal(fs.existsSync(path.join(root, 'content/en/redirects.json')), false);
  // to the top and back
  assert.equal(pagesOp(root, { op: 'move', id: 'about/team', parent: '' }).body.id, 'team');
});

test('move refuses: a taken name, into itself, a [param] folder, home and 404, nowhere', () => {
  const root = site();
  pagesOp(root, { op: 'add', parent: 'about', name: 'team' });
  const move = (o) => pagesOp(root, { op: 'move', ...o });
  const clash = move({ id: 'people/team', parent: 'about' });
  assert.equal(clash.status, 400);
  assert.match(clash.body.error, /already exists/);
  assert.equal(move({ id: 'people', parent: 'people/team' }).status, 400);
  assert.equal(move({ id: 'about', parent: 'people/[person]' }).status, 400);
  assert.equal(move({ id: 'people/[person]', parent: 'about' }).status, 400);
  assert.equal(move({ id: 'home', parent: 'about' }).status, 400);
  assert.equal(move({ id: '404', parent: 'about' }).status, 400);
  assert.equal(move({ id: 'about', parent: 'nope' }).status, 400);
  assert.equal(move({ id: 'about', parent: '' }).status, 400); // there already
  assert.ok(fs.existsSync(path.join(root, 'content/en/pages/people/team/index.json')));
});

/** settings/nav.json in the test site: About, then People with Team in its dropdown. */
function withNav(root) {
  const nav = {
    version: 1,
    header: [
      { label: 'About', page: 'pg-t037' },
      { label: 'People', page: 'pg-t038', children: [{ label: 'Team', page: 'pg-t040' }] },
    ],
  };
  const file = path.join(root, 'content/en/settings/nav.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(nav));
  return root;
}

test('move refuses a reserved name at the top (and anything else listed there)', () => {
  const root = site();
  for (const name of ['edit', 'assets', 'media', 'sandbox']) {
    pagesOp(root, { op: 'add', parent: 'about', name });
    const r = pagesOp(root, { op: 'move', id: `about/${name}`, parent: '' });
    assert.equal(r.status, 400, name);
    assert.match(r.body.error, /reserved/);
  }
  assert.equal(pagesOp(root, { op: 'add', parent: '', name: 'sandbox' }).status, 400);
});

test('move with link: moved and in the menu at that place, in one op on disk', () => {
  const root = withNav(site());
  pagesOp(root, { op: 'add', parent: 'about', name: 'press', title: 'Press' });
  const pid = read(root, 'pages/about/press/index.json').id;
  const r = pagesOp(root, {
    op: 'move',
    id: 'about/press',
    parent: 'people',
    link: { parentPid: 'pg-t038', place: { before: 'pg-t040' } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.changed.includes('settings/nav.json'));
  assert.deepEqual(
    read(root, 'settings/nav.json').header[1].children.map((c) => [c.label, c.page]),
    [
      ['Press', pid],
      ['Team', 'pg-t040'],
    ],
  );
  // a place it can't go (a dropdown into a dropdown): refused before anything moves
  pagesOp(root, { op: 'add', parent: 'about', name: 'blog' });
  const bad = pagesOp(root, {
    op: 'move',
    id: 'about/blog',
    parent: 'people',
    link: { parentPid: 'pg-t038', place: { before: 'pg-nope' } },
  });
  assert.equal(bad.status, 400);
  assert.ok(fs.existsSync(path.join(root, 'content/en/pages/about/blog/index.json')));
});

test('delete without a redirect: its menu items go too (dropdown moves up); with one they follow', () => {
  const root = withNav(site());
  const r = pagesOp(root, { op: 'delete', id: 'people', redirect: null });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.changed.includes('settings/nav.json'));
  // People and Team (in it) are gone with the folder: both out of the menu, none broken
  assert.deepEqual(
    read(root, 'settings/nav.json').header.map((i) => i.label),
    ['About'],
  );
  assert.equal(r.body.broken, 0);

  const root2 = withNav(site());
  const r2 = pagesOp(root2, { op: 'delete', id: 'people/team', redirect: '/about/' });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.deepEqual(read(root2, 'settings/nav.json').header[1].children, [
    { label: 'Team', page: 'pg-t037' },
  ]);
});
