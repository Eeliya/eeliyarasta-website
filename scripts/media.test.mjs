/**
 * The Media window's dev-server ops (mediaOp in scripts/editor-server.mjs): alt text in
 * photos.json, and deleting unused photos (local media/ files, R2 photos against a mock).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mediaOp } from './editor-server.mjs';
import { photoUses } from '../src/editor/lib/photo-uses.js';

let server;
let env;
let deletes = [];
before(async () => {
  server = http.createServer((req, res) => {
    deletes.push(`${req.method} ${req.url}`);
    req.resume();
    req.on('end', () => res.writeHead(204).end());
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  env = {
    R2_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
    R2_ACCESS_KEY_ID: 'id',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'b',
  };
});
after(() => server.close());

const R2 = 'photos/cat-0123456789-960.webp';
const r2Photo = {
  width: 960,
  height: 1200,
  srcset: [
    { key: 'photos/cat-0123456789-480.webp', w: 480 },
    { key: R2, w: 960 },
  ],
};

/** A project with one used and one unused photo of each kind. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
  const write = (f, data) => {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), typeof data === 'string' ? data : JSON.stringify(data));
  };
  write('content/settings/site.json', { name: 'S', url: 'https://x.com' });
  write('content/pages/index.json', { hero: { photos: [{ src: 'a/used.jpg' }] } });
  write('content/sources/people.json', [{ name: 'N', images: [{ src: 'photos/used-1600.webp' }] }]);
  write('content/settings/photos.json', {
    'a/used.jpg': { alt: 'Used' },
    'a/free.jpg': { alt: 'Free' },
    [R2]: { ...r2Photo, alt: 'Cat' },
    'photos/used-1600.webp': { srcset: [{ key: 'photos/used-1600.webp', w: 1600 }] },
  });
  const local = (k) => ({
    width: 960,
    height: 640,
    src: `/media/${k.replace('.jpg', '-960.webp')}`,
    srcset: [480, 960].map((w) => ({ url: `/media/${k.replace('.jpg', `-${w}.webp`)}`, w })),
  });
  write('.generated/media.json', {
    'a/used.jpg': local('a/used.jpg'),
    'a/free.jpg': local('a/free.jpg'),
  });
  for (const n of ['used', 'free']) {
    write(`media/a/${n}.jpg`, 'jpg');
    write(`public/media/a/${n}-480.webp`, 'w');
    write(`public/media/a/${n}-960.webp`, 'w');
  }
  return root;
}
const photosOf = (root) =>
  JSON.parse(fs.readFileSync(path.join(root, 'content/settings/photos.json'), 'utf8'));

test('photoUses: every place a key is stored, as file + pointer', () => {
  const files = {
    'pages/index.json': { hero: { photos: [{ src: 'k' }, { src: 'x' }] } },
    'sources/p.json': [{ image: 'k', 'a/b': 'k' }],
  };
  assert.deepEqual(photoUses(files, 'k'), [
    { file: 'pages/index.json', ptr: '/hero/photos/0/src' },
    { file: 'sources/p.json', ptr: '/0/image' },
    { file: 'sources/p.json', ptr: '/0/a~1b' },
  ]);
  assert.deepEqual(photoUses(files, ''), []);
});

test('alt: set, trimmed, removed; local and R2 photos; unknown keys refused', async () => {
  const root = project();
  let r = await mediaOp(root, env, { op: 'alt', key: 'a/free.jpg', alt: '  A  free\nphoto ' });
  assert.equal(r.status, 200);
  assert.equal(photosOf(root)['a/free.jpg'].alt, 'A free photo');
  assert.equal(r.body.photos['a/free.jpg'].alt, 'A free photo');
  assert.equal(r.body.media['a/free.jpg'].sizes, 2);
  r = await mediaOp(root, env, { op: 'alt', key: R2, alt: 'A cat' });
  assert.equal(r.body.photos[R2].alt, 'A cat');
  assert.deepEqual(photosOf(root)[R2], { ...r2Photo, alt: 'A cat' }, 'the sizes stay');
  await mediaOp(root, env, { op: 'alt', key: 'a/free.jpg', alt: '' });
  assert.equal(photosOf(root)['a/free.jpg'], undefined, 'an empty local entry goes');
  assert.equal((await mediaOp(root, env, { op: 'alt', key: 'nope.jpg', alt: 'x' })).status, 404);
  assert.equal((await mediaOp(root, env, { op: 'move', key: R2 })).status, 400);
});

test('delete: a used photo is refused and names where it is used', async () => {
  const root = project();
  const before = photosOf(root);
  deletes = [];
  const local = await mediaOp(root, env, { op: 'delete', key: 'a/used.jpg' });
  assert.equal(local.status, 409);
  assert.deepEqual(local.body.uses, [{ file: 'pages/index.json', ptr: '/hero/photos/0/src' }]);
  const r2 = await mediaOp(root, env, { op: 'delete', key: 'photos/used-1600.webp' });
  assert.equal(r2.status, 409);
  assert.match(r2.body.error, /sources\/people\.json#\/0\/images\/0\/src/);
  assert.ok(fs.existsSync(path.join(root, 'media/a/used.jpg')));
  assert.deepEqual(photosOf(root), before);
  assert.equal(deletes.length, 0);
});

test('delete: a local photo loses its file, sizes, manifest entry and alt', async () => {
  const root = project();
  const r = await mediaOp(root, env, { op: 'delete', key: 'a/free.jpg' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.deleted.sort(), [
    'media/a/free.jpg',
    'public/media/a/free-480.webp',
    'public/media/a/free-960.webp',
  ]);
  for (const f of r.body.deleted) assert.ok(!fs.existsSync(path.join(root, f)));
  assert.ok(fs.existsSync(path.join(root, 'media/a/used.jpg')), 'the others stay');
  assert.equal(r.body.media['a/free.jpg'], undefined);
  assert.equal(photosOf(root)['a/free.jpg'], undefined);
  assert.equal(photosOf(root)['a/used.jpg'].alt, 'Used');
});

test('delete: an R2 photo loses every size in R2 and its photos.json entry', async () => {
  const root = project();
  deletes = [];
  const r = await mediaOp(root, env, { op: 'delete', key: R2 });
  assert.equal(r.status, 200);
  assert.deepEqual(deletes.sort(), [
    'DELETE /b/photos/cat-0123456789-480.webp',
    'DELETE /b/photos/cat-0123456789-960.webp',
  ]);
  assert.equal(photosOf(root)[R2], undefined);
  assert.equal(r.body.photos[R2], undefined);
  // no R2 keys: nothing happens
  const root2 = project();
  assert.equal((await mediaOp(root2, {}, { op: 'delete', key: R2 })).status, 503);
  assert.ok(photosOf(root2)[R2]);
});
