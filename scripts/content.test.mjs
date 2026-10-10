import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent, writeFileAtomic } from './content.mjs';
import { readContentFiles, save } from './editor-server.mjs';
import { checkContent, parseContent } from '../src/site/validate.js';

const site = { name: 'Site', url: 'https://example.com' };
const animations = { presets: {}, targets: {}, transitions: {} };

/** content/ in a temp dir; files as { "settings/site.json": data or raw text }. */
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-'));
  const all = {
    'settings/site.json': site,
    'settings/animations.json': animations,
    'pages/index.json': {},
    'sources/people.json': [{ name: 'Noor' }],
    ...files,
  };
  for (const [f, data] of Object.entries(all)) {
    const file = path.join(root, 'content', f);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
  return root;
}
const read = (root, f) => fs.readFileSync(path.join(root, 'content', f), 'utf8');

test('broken JSON: the error names the file, line and column', () => {
  assert.throws(
    () => parseContent('{\n  "a": 1\n  "b": 2\n}', 'pages/about/index.json'),
    /^Error: content\/pages\/about\/index\.json: invalid JSON, .* \(line 3, column 3\)$/,
  );
  const root = tree({ 'sources/places.json': '[{ "name": "A" },\n]' });
  assert.throws(() => loadContent(root), /content\/sources\/places\.json: invalid JSON/);
  // the editor's GET /content too
  assert.throws(() => readContentFiles(root), /content\/sources\/places\.json: invalid JSON/);
});

test('shapes: the build stops on a wrong shape and names the file', () => {
  assert.throws(
    () => loadContent(tree({ 'settings/animations.json': [] })),
    /content\/settings\/animations\.json: must be an object, not an array/,
  );
  assert.throws(
    () => loadContent(tree({ 'settings/site.json': { ...site, footer: 'x' } })),
    /content\/settings\/site\.json: "footer" must be an object, not a string/,
  );
  // optional keys may be missing
  assert.equal(loadContent(tree()).site.name, 'Site');
});

test('checkContent per kind', () => {
  assert.deepEqual(checkContent('settings/site.json', site), []);
  assert.deepEqual(checkContent('settings/site.json', { url: 'u' }), ['"name" must be a string']);
  assert.deepEqual(checkContent('settings/animations.json', { ...animations, presets: [] }), [
    '"presets" must be an object',
  ]);
  assert.deepEqual(checkContent('settings/photos.json', { a: 1 }), ['photo "a" must be an object']);
  assert.deepEqual(checkContent('sources/people.json', {}), [
    'must be a list (a JSON array), not an object',
  ]);
  assert.deepEqual(checkContent('sources/people.json', [{}, 'x']), ['item 2 must be an object']);
  assert.deepEqual(checkContent('pages/about/index.json', { sections: {} }), [
    '"sections" must be an array, not an object',
  ]);
  assert.equal(checkContent('pages/people/[slug].json', {}).length, 1);
  assert.deepEqual(checkContent('pages/people/[slug].json', { config: { source: 'people' } }), []);
});

test('save: rejects bad shapes and writes nothing', () => {
  const root = tree();
  const before = read(root, 'pages/index.json');
  const r = save(root, { 'pages/index.json': { title: 'New' }, 'settings/animations.json': [] });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /content\/settings\/animations\.json: must be an object/);
  assert.equal(read(root, 'pages/index.json'), before);
  assert.equal(save(root, { 'settings/nope.json': {} }).status, 400);
  assert.equal(save(root, { '../package.json': {} }).status, 400);
  assert.equal(save(root, {}).status, 400);
  assert.equal(save(root, null).status, 400);
});

test('save: writes every file, formatted, with no temporary files left', () => {
  const root = tree();
  let writes = 0;
  const r = save(root, { 'pages/index.json': { title: 'New' } }, () => writes++);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.written, ['pages/index.json']);
  assert.equal(writes, 1);
  assert.equal(read(root, 'pages/index.json'), '{ "title": "New" }\n');
  assert.deepEqual(fs.readdirSync(path.join(root, 'content', 'pages')), ['index.json']);
});

test('writeFileAtomic: replaces the file in one step; a failed write keeps the old file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-'));
  const file = path.join(dir, 'a.json');
  fs.writeFileSync(file, 'old');
  writeFileAtomic(file, 'new');
  assert.equal(fs.readFileSync(file, 'utf8'), 'new');
  // the target is a folder: the rename fails, the temp file is cleaned up
  fs.mkdirSync(path.join(dir, 'b.json'));
  fs.writeFileSync(path.join(dir, 'b.json', 'x'), '');
  assert.throws(() => writeFileAtomic(path.join(dir, 'b.json'), 'new'));
  assert.deepEqual(fs.readdirSync(dir).sort(), ['a.json', 'b.json']);
});
