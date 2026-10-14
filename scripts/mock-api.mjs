/**
 * The mock sandbox's local files (dev only): sandbox/mocks/<name>.svelte or .html, which live on
 * the machine that makes them (git-ignored). Lists them for the viewer (sandbox/Viewer.svelte)
 * and deletes them, never anything outside sandbox/mocks/: a name is one plain file name, its
 * resolved path must sit directly in the folder.
 *
 *   GET  /__mocks/list                         [{ name, file, mtime }] newest first
 *   POST /__mocks/delete  { name }             one mock
 *   POST /__mocks/delete  { olderThanDays: N } every mock last changed more than N days ago
 *
 * POSTs must be JSON (a page elsewhere can't send that without asking first). The Vite plugin
 * tells the viewer when a mock is added, changed or removed ("mocks:changed").
 */
import fs from 'node:fs';
import path from 'node:path';

export const MOCKS_DIR = path.resolve('sandbox', 'mocks');
const EXT = /\.(svelte|html)$/;
const NAME = /^[\w.-]+$/;

/** The path of mock file `file` ("a.svelte") in `dir`, or null if it isn't one there. */
export function mockPath(dir, file) {
  if (typeof file !== 'string' || !NAME.test(file) || !EXT.test(file) || file.startsWith('.'))
    return null;
  const root = path.resolve(dir);
  const p = path.resolve(root, file);
  return path.dirname(p) === root && path.relative(root, p) === file ? p : null;
}

/** The mocks in `dir`, newest first: { name, file, mtime (ms) }. */
export function listMocks(dir = MOCKS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && mockPath(dir, e.name))
    .map((e) => ({
      name: e.name.replace(EXT, ''),
      file: e.name,
      mtime: fs.statSync(path.join(dir, e.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
}

/** Delete one mock by name ("a" or "a.svelte"): the files deleted. */
export function deleteMock(dir, name) {
  if (typeof name !== 'string') throw new Error('No mock name');
  const files = EXT.test(name) ? [name] : [`${name}.svelte`, `${name}.html`];
  const paths = files.map((f) => mockPath(dir, f));
  if (paths.some((p) => !p)) throw new Error(`Not a mock in sandbox/mocks/: ${name}`);
  const gone = paths.filter((p) => fs.existsSync(p) && fs.lstatSync(p).isFile());
  if (!gone.length) throw new Error(`No mock "${name}"`);
  for (const p of gone) fs.rmSync(p);
  return gone.map((p) => path.basename(p));
}

/** Delete every mock last changed more than `days` days before `now`: the files deleted. */
export function deleteOlder(dir, days, now = Date.now()) {
  if (!(Number.isFinite(days) && days >= 0)) throw new Error('"olderThanDays" must be 0 or more');
  const before = now - days * 86400000;
  const old = listMocks(dir).filter((m) => m.mtime < before);
  for (const m of old) fs.rmSync(mockPath(dir, m.file));
  return old.map((m) => m.file);
}

function readJSON(req) {
  return new Promise((ok, fail) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 10000) fail(new Error('Too big'));
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(body || '{}'));
      } catch {
        fail(new Error('Not JSON'));
      }
    });
  });
}

/** The /__mocks middleware (Connect): (req, res, next). */
export function mocksMiddleware(dir = MOCKS_DIR) {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://x');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    // this machine's own pages only
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host)
      return send(403, { error: 'Not here' });
    try {
      if (url.pathname === '/list' && req.method === 'GET') return send(200, listMocks(dir));
      if (url.pathname === '/delete' && req.method === 'POST') {
        if (!/^application\/json\b/.test(req.headers['content-type'] || ''))
          return send(415, { error: 'JSON only' });
        const b = await readJSON(req);
        const deleted =
          b.olderThanDays !== undefined
            ? deleteOlder(dir, Number(b.olderThanDays))
            : deleteMock(dir, b.name);
        return send(200, { ok: true, deleted });
      }
    } catch (err) {
      return send(400, { error: err.message });
    }
    next();
  };
}

/** Vite plugin (dev server only): the /__mocks endpoints, and "mocks:changed" to the viewer. */
export function mocksPlugin(dir = MOCKS_DIR) {
  return {
    name: 'mock-sandbox',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(dir, { recursive: true });
      server.middlewares.use('/__mocks', mocksMiddleware(dir));
      const changed = (file) => {
        if (path.dirname(path.resolve(file)) === path.resolve(dir) && EXT.test(file))
          server.ws.send({ type: 'custom', event: 'mocks:changed' });
      };
      for (const ev of ['add', 'unlink', 'change']) server.watcher.on(ev, changed);
    },
  };
}
