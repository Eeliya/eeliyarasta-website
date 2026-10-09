import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesOp, pageFolders, editableFiles } from './editor-server.mjs';

/** A content/ folder in a temp dir with home, about, people (+ folder) and a people source. */
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const put = (f, data) => {
    const file = path.join(root, 'content', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  };
  put('pages/home.json', {});
  put('pages/404.json', {});
  put('pages/about.json', { title: 'About' });
  put('pages/people.json', { title: 'People' });
  put('pages/people/[slug].json', { config: { source: 'people' } });
  put('pages/people/team.json', { title: 'Team' });
  put('sources/people.json', [{ slug: 'noor' }]);
  return root;
}
const read = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));
const files = (root) => [...editableFiles(root)].filter((f) => f.startsWith('pages/'));

test('add: a page with a heading, valid slugs only, no overwrites', () => {
  const root = site();
  const r = pagesOp(root, { op: 'add', folder: 'people', name: 'new-one', title: 'New one' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.created, ['pages/people/new-one.json']);
  assert.equal(read(root, 'pages/people/new-one.json').title, 'New one');
  for (const name of ['New One', 'a_b', '', '-x', 'team'])
    assert.equal(pagesOp(root, { op: 'add', folder: 'people', name }).status, 400, name);
  assert.equal(pagesOp(root, { op: 'add', name: 'edit' }).status, 400); // reserved at the root
  assert.equal(pagesOp(root, { op: 'add', folder: 'nope', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'add', folder: '../x', name: 'x' }).status, 400);
});

test('children and template: the folder, then a [slug] page with a source', () => {
  const root = site();
  assert.equal(pagesOp(root, { op: 'template', folder: '', source: 'people' }).status, 400);
  assert.equal(pagesOp(root, { op: 'children', id: 'about' }).status, 200);
  assert.deepEqual(pageFolders(root), ['about', 'people']);
  assert.equal(pagesOp(root, { op: 'template', folder: 'about', source: 'nope' }).status, 400);
  const r = pagesOp(root, { op: 'template', folder: 'about', source: 'people' });
  assert.deepEqual(r.body.created, ['pages/about/[slug].json']);
  assert.equal(read(root, 'pages/about/[slug].json').config.source, 'people');
  assert.equal(pagesOp(root, { op: 'template', folder: 'about', source: 'people' }).status, 400);
  assert.equal(pagesOp(root, { op: 'children', id: 'home' }).status, 400);
});

test('rename moves the page and its folder; a built-in view is kept', () => {
  const root = site();
  const r = pagesOp(root, { op: 'rename', id: 'people', name: 'models' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.created.sort(), [
    'pages/models.json',
    'pages/models/[slug].json',
    'pages/models/team.json',
  ]);
  assert.equal(read(root, 'pages/models.json').view, 'people');
  assert.deepEqual(files(root), [
    'pages/404.json',
    'pages/about.json',
    'pages/home.json',
    'pages/models.json',
    'pages/models/[slug].json',
    'pages/models/team.json',
  ]);
  assert.equal(pagesOp(root, { op: 'rename', id: 'about', name: 'models' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: 'models/[slug]', name: 'x' }).status, 400);
  assert.equal(pagesOp(root, { op: 'rename', id: '404', name: 'x' }).status, 400);
});

test('delete removes the page and everything below it; home and 404 stay', () => {
  const root = site();
  const r = pagesOp(root, { op: 'delete', id: 'people' });
  assert.deepEqual(r.body.removed.sort(), [
    'pages/people.json',
    'pages/people/[slug].json',
    'pages/people/team.json',
  ]);
  assert.deepEqual(files(root), ['pages/404.json', 'pages/about.json', 'pages/home.json']);
  assert.equal(pagesOp(root, { op: 'delete', id: 'home' }).status, 400);
  assert.equal(pagesOp(root, { op: 'delete', id: 'people' }).status, 404);
  assert.equal(pagesOp(root, { op: 'delete', id: '../sources/people' }).status, 404);
});
