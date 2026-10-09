import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesOp, editableFiles } from './editor-server.mjs';

/** content/ in a temp dir: home, 404, about, people (+ [slug] and team) and a people source. */
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const put = (f, data) => {
    const file = path.join(root, 'content', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('pages/index.json', {});
  put('pages/404/index.json', {});
  put('pages/about/index.json', { title: 'About' });
  put('pages/people/index.json', { title: 'People' });
  put('pages/people/[slug].json', { config: { source: 'people' } });
  put('pages/people/team/index.json', { title: 'Team' });
  put('sources/people.json', [{ slug: 'noor' }]);
  return root;
}
const read = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));
const pages = (root) => [...editableFiles(root)].filter((f) => f.startsWith('pages/'));

test('add: a folder with its index.json, valid slugs only, no overwrites', () => {
  const root = site();
  const r = pagesOp(root, { op: 'add', parent: 'people', name: 'new-one', title: 'New one' });
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 'people/new-one');
  assert.deepEqual(r.body.created, ['pages/people/new-one/index.json']);
  assert.equal(read(root, 'pages/people/new-one/index.json').title, 'New one');
  assert.deepEqual(pagesOp(root, { op: 'add', name: 'contact' }).body.created, [
    'pages/contact/index.json',
  ]);
  for (const name of ['New One', 'a_b', '', '-x', 'team'])
    assert.equal(pagesOp(root, { op: 'add', parent: 'people', name }).status, 400, name);
  for (const name of ['edit', 'home', '404'])
    assert.equal(pagesOp(root, { op: 'add', name }).status, 400, name); // reserved at the root
  assert.equal(pagesOp(root, { op: 'add', parent: 'nope', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'add', parent: '../x', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'add', parent: 'people/[slug]', name: 'x' }).status, 400);
});

test('template: [slug].json in a page folder, one per folder, not at the root', () => {
  const root = site();
  assert.equal(pagesOp(root, { op: 'template', source: 'people' }).status, 400);
  assert.equal(pagesOp(root, { op: 'template', parent: 'about', source: 'nope' }).status, 400);
  const r = pagesOp(root, { op: 'template', parent: 'about', source: 'people' });
  assert.deepEqual(r.body.created, ['pages/about/[slug].json']);
  assert.equal(read(root, 'pages/about/[slug].json').config.source, 'people');
  assert.equal(pagesOp(root, { op: 'template', parent: 'about', source: 'people' }).status, 400);
});

test('rename moves the whole folder; a built-in view is kept', () => {
  const root = site();
  const r = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 'models');
  assert.deepEqual(r.body.created.sort(), [
    'pages/models/[slug].json',
    'pages/models/index.json',
    'pages/models/team/index.json',
  ]);
  assert.deepEqual(r.body.removed.sort(), [
    'pages/people/[slug].json',
    'pages/people/index.json',
    'pages/people/team/index.json',
  ]);
  assert.equal(read(root, 'pages/models/index.json').view, 'people');
  assert.equal(read(root, 'pages/models/team/index.json').view, undefined);
  assert.equal(pagesOp(root, { op: 'rename', id: 'about', name: 'models' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: 'models/[slug]', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: '404', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: 'home', name: 'x' }).status, 400);
});

test('delete removes the folder and everything in it; home and 404 stay', () => {
  const root = site();
  assert.deepEqual(pagesOp(root, { op: 'delete', id: 'people/[slug]' }).body.removed, [
    'pages/people/[slug].json',
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
