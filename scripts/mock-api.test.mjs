// The mock sandbox's files (scripts/mock-api.mjs): listed newest first, deleted only inside
// sandbox/mocks/ (no traversal, no other files), and its endpoints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deleteMock, deleteOlder, listMocks, mockPath, mocksMiddleware } from './mock-api.mjs';

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mocks-'));
  const dir = path.join(root, 'sandbox', 'mocks');
  fs.mkdirSync(dir, { recursive: true });
  const at = (f, days) => {
    const p = path.join(dir, f);
    fs.writeFileSync(p, '<p>x</p>');
    const t = new Date(Date.now() - days * 86400000);
    fs.utimesSync(p, t, t);
  };
  at('new.svelte', 0);
  at('mid.html', 5);
  at('old.svelte', 30);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep');
  fs.writeFileSync(path.join(root, 'secret.svelte'), 'keep');
  fs.writeFileSync(path.join(root, 'sandbox', 'main.js'), 'keep');
  return { root, dir };
}

test('mocks: listed newest first, only .svelte and .html', () => {
  const { dir } = tree();
  assert.deepEqual(
    listMocks(dir).map((m) => m.file),
    ['new.svelte', 'mid.html', 'old.svelte'],
  );
  assert.deepEqual(listMocks(path.join(dir, 'nope')), []);
});

test('mocks: a path outside sandbox/mocks/ is refused (resolved and checked)', () => {
  const { root, dir } = tree();
  for (const bad of [
    '../secret.svelte',
    '..\\secret.svelte',
    '../../secret.svelte',
    '/etc/passwd.svelte',
    'C:\\x.svelte',
    'sub/a.svelte',
    '.svelte',
    'notes.txt',
    '',
    '..',
    'a.svelte\0',
  ]) {
    assert.equal(mockPath(dir, bad), null, bad);
    assert.throws(() => deleteMock(dir, bad), undefined, bad);
  }
  assert.throws(() => deleteMock(dir, { name: 'x' }));
  assert.ok(fs.existsSync(path.join(root, 'secret.svelte')));
  assert.ok(fs.existsSync(path.join(root, 'sandbox', 'main.js')));
  assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));
  assert.equal(mockPath(dir, 'a.svelte'), path.join(path.resolve(dir), 'a.svelte'));
});

test('mocks: delete one by name; older than N days', () => {
  const { dir } = tree();
  assert.deepEqual(deleteMock(dir, 'mid'), ['mid.html']);
  assert.throws(() => deleteMock(dir, 'mid'), /No mock/);
  assert.deepEqual(deleteOlder(dir, 7), ['old.svelte']);
  assert.deepEqual(deleteOlder(dir, 7), []);
  assert.throws(() => deleteOlder(dir, -1));
  assert.throws(() => deleteOlder(dir, NaN));
  assert.deepEqual(
    listMocks(dir).map((m) => m.file),
    ['new.svelte'],
  );
  assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));
});

/** One request through the middleware: { status, body }. */
function call(mw, { method = 'GET', url, body, headers = {} }) {
  return new Promise((ok) => {
    const req = new (class extends EventTarget {})();
    Object.assign(req, { method, url, headers: { host: 'localhost:5199', ...headers } });
    const handlers = {};
    req.on = (ev, fn) => ((handlers[ev] = fn), req);
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end(text) {
        ok({ status: this.status, body: JSON.parse(text) });
      },
    };
    mw(req, res, () => ok({ status: 404 }));
    queueMicrotask(() => {
      if (body !== undefined) handlers.data?.(body);
      handlers.end?.();
    });
  });
}

test('mocks: the endpoints (JSON only, this origin only, traversal refused)', async () => {
  const { root, dir } = tree();
  const mw = mocksMiddleware(dir);
  const json = { 'content-type': 'application/json' };
  assert.equal((await call(mw, { url: '/list' })).body.length, 3);
  const bad = await call(mw, {
    method: 'POST',
    url: '/delete',
    headers: json,
    body: '{"name":"../secret.svelte"}',
  });
  assert.equal(bad.status, 400);
  assert.ok(fs.existsSync(path.join(root, 'secret.svelte')));
  const form = await call(mw, { method: 'POST', url: '/delete', body: 'name=new' });
  assert.equal(form.status, 415);
  const cross = await call(mw, {
    method: 'POST',
    url: '/delete',
    headers: { ...json, origin: 'https://evil.example' },
    body: '{"name":"new"}',
  });
  assert.equal(cross.status, 403);
  const one = await call(mw, {
    method: 'POST',
    url: '/delete',
    headers: { ...json, origin: 'http://localhost:5199' },
    body: '{"name":"new"}',
  });
  assert.deepEqual(one.body, { ok: true, deleted: ['new.svelte'] });
  const old = await call(mw, {
    method: 'POST',
    url: '/delete',
    headers: json,
    body: '{"olderThanDays":1}',
  });
  assert.deepEqual(old.body.deleted.sort(), ['mid.html', 'old.svelte']);
  assert.equal((await call(mw, { url: '/other' })).status, 404);
});
