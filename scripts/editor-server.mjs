/**
 * Dev-server endpoints for the visual editor (/edit/). Mounted by the static-site
 * plugin in `configureServer`, so they only exist while `npm run dev` runs; a
 * production build has no editor and no endpoints.
 *
 *   GET  /__editor/content  → all editable content files
 *   POST /__editor/save     → write content files to disk ({ files: { name: json } })
 *
 * Every request must come from this machine: loopback socket address, a localhost
 * Host header (blocks DNS rebinding) and, when present, a same-origin Origin header.
 * Only the files listed in src/editor/config.js can be read or written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatJSON } from '../src/editor/lib/json-format.js';
import editorConfig from '../src/editor/config.js';

export const EDITABLE = new Set(editorConfig.files);
const CONTENT_DIR = editorConfig.contentDir;

const LOOPBACK = /^(?:127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** True only for requests made on this machine to a localhost URL. */
export function isLocalRequest(req) {
  if (!LOOPBACK.test(req.socket?.remoteAddress || '')) return false;
  const host = String(req.headers.host || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(hostname) && !hostname.endsWith('.localhost')) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export const readContentFiles = (root) =>
  Object.fromEntries([...EDITABLE].map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, CONTENT_DIR, f), 'utf8'))]));

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('Body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJSON(req) {
  if (!(req.headers['content-type'] || '').includes('application/json')) {
    const err = new Error('JSON only');
    err.status = 415;
    throw err;
  }
  return JSON.parse((await readBody(req)) || '{}');
}

const sendJSON = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};

/**
 * @param {{ root: string, logger: import('vite').Logger, onWrite?: () => void }} opts
 * onWrite runs right before files are written (used to keep the editor from reloading itself).
 */
export function editorMiddleware({ root, logger, onWrite = () => {} }) {
  const log = (msg) => logger.info(`\x1b[32m✓\x1b[0m ${msg}`, { timestamp: true });

  return async (req, res) => {
    try {
      if (!isLocalRequest(req)) return sendJSON(res, 403, { error: 'The editor only accepts requests from localhost.' });
      const route = `${req.method} ${(req.url || '').split('?')[0]}`;

      if (route === 'GET /content') return sendJSON(res, 200, { mode: 'dev', files: readContentFiles(root) });

      if (route === 'POST /save') {
        const { files } = await readJSON(req);
        const names = Object.keys(files || {});
        const bad = names.filter((n) => !EDITABLE.has(n) || files[n] === null || typeof files[n] !== 'object');
        if (!names.length || bad.length) return sendJSON(res, 400, { error: `Not writable: ${bad.join(', ') || '(nothing)'}` });
        onWrite();
        for (const n of names) fs.writeFileSync(path.join(root, CONTENT_DIR, n), formatJSON(files[n]));
        log(`editor saved ${names.map((n) => `${CONTENT_DIR}/${n}`).join(', ')}`);
        return sendJSON(res, 200, { ok: true, written: names });
      }

      sendJSON(res, 404, { error: 'Unknown editor endpoint' });
    } catch (err) {
      sendJSON(res, err.status || 500, { error: err.message });
    }
  };
}
