/**
 * Dev-server endpoints for the visual editor (/edit/). Mounted by the static-site
 * plugin in `configureServer`, so they only exist while `npm run dev` runs; a
 * production build has no editor and no endpoints.
 *
 *   GET  /__editor/content  → all editable content files, the media manifest's URLs and the
 *                             R2 photos (settings/photos.json)
 *   POST /__editor/save     → write content files to disk ({ files: { name: json } }): a draft
 *   GET  /__editor/status   → saved-but-unpublished content files (git status vs HEAD) and
 *                             commits not pushed yet
 *   POST /__editor/upload   → one image (the raw bytes, its Content-Type, X-Filename): resized,
 *                             stored in Cloudflare R2 and added to settings/photos.json
 *                             (scripts/r2.mjs), answers { key, photo }
 *   POST /__editor/publish  → { message }: git add + commit ONLY the changed content files in
 *                             one commit, then git push origin <current branch>
 *
 * Every request must come from this machine: loopback socket address, a localhost
 * Host header (blocks DNS rebinding) and, when present, a same-origin Origin header.
 * Only existing JSON files in content/pages/, content/sources/ and content/settings/ can be
 * read or written (src/editor/config.js, src/site/files.js); Save never creates files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { formatJSON } from '../src/editor/lib/json-format.js';
import editorConfig from '../src/editor/config.js';
import { diff } from '../src/editor/lib/diff.js';
import { PHOTOS, isContentFile } from '../src/site/files.js';
import { MAX_UPLOAD, uploadPhoto } from './r2.mjs';

const CONTENT_DIR = editorConfig.contentDir;

/** Editable content files that exist on disk, e.g. "pages/home.json" (paths relative to content/). */
export function editableFiles(root) {
  const files = [];
  for (const folder of editorConfig.folders) {
    const dir = path.join(root, CONTENT_DIR, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const file = `${folder}/${name}`;
      // photos.json belongs to the upload, not to the editor's edits
      if (isContentFile(file) && file !== PHOTOS && fs.statSync(path.join(dir, name)).isFile())
        files.push(file);
    }
  }
  return new Set(files);
}

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
  Object.fromEntries(
    [...editableFiles(root)].map((f) => [
      f,
      JSON.parse(fs.readFileSync(path.join(root, CONTENT_DIR, f), 'utf8')),
    ]),
  );

/** Local photos (.generated/media.json, scripts/images.mjs): { src, thumb } per media/ file. */
function readMedia(root) {
  const file = path.join(root, '.generated', 'media.json');
  if (!fs.existsSync(file)) return {};
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(
    Object.entries(all).map(([k, m]) => [k, { src: m.src, thumb: m.srcset?.[0]?.url || m.src }]),
  );
}

const readPhotos = (root) => {
  const file = path.join(root, CONTENT_DIR, PHOTOS);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
};

/** The request body as a Buffer; over `limit` bytes fails with 413. */
function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const tooLarge = () =>
      Object.assign(new Error(`Too large (max ${limit / 1024 / 1024} MB)`), { status: 413 });
    if (Number(req.headers['content-length']) > limit) return reject(tooLarge());
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(tooLarge());
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const readBody = async (req, limit = 5 * 1024 * 1024) =>
  (await readRaw(req, limit)).toString('utf8');

async function readJSON(req) {
  if (!(req.headers['content-type'] || '').includes('application/json')) {
    const err = new Error('JSON only');
    err.status = 415;
    throw err;
  }
  return JSON.parse((await readBody(req)) || '{}');
}

// ------------------------------------------------------------------ git (Publish)

/** Run git without a shell. Never prompts in the terminal (a missing login fails fast). */
function git(root, args, { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: root,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: String(stdout),
          stderr: String(stderr),
          output: `${stdout}${stderr}`.trim() || (err ? err.message : ''),
          timedOut: !!err?.killed,
        });
      },
    );
  });
}

/** https://github.com/<owner>/<repo> from the origin URL (falls back to src/editor/config.js). */
function repoUrlFrom(remote) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote || '');
  return m
    ? `https://github.com/${m[1]}/${m[2]}`
    : `https://github.com/${editorConfig.owner}/${editorConfig.repo}`;
}

const parseJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Content files that differ from HEAD (the ones Publish would commit), plus branch and
 * push state. Only content files in the editable folders (src/editor/config.js) are looked at.
 */
export async function contentStatus(root) {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok) return { git: false, error: 'Not a git repository', files: [], ahead: 0 };
  const [branchR, prefixR, remoteR] = await Promise.all([
    git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(root, ['rev-parse', '--show-prefix']),
    git(root, ['remote', 'get-url', 'origin']),
  ]);
  const branch = branchR.stdout.trim();
  const prefix = prefixR.stdout.trim();
  // Every JSON file in the editable folders, including deleted or new ones.
  const rel = editorConfig.folders.map((d) => `:(glob)${CONTENT_DIR}/${d}/*.json`);

  const st = await git(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    ...rel,
  ]);
  const files = [];
  const entries = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const code = entry.slice(0, 2);
    // Renames/copies are followed by their source path as a separate entry: skip it.
    if (code[0] === 'R' || code[0] === 'C') i++;
    const repoPath = entry.slice(3);
    const p = repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : repoPath;
    const name = p.slice(CONTENT_DIR.length + 1);
    if (!isContentFile(name) || p !== `${CONTENT_DIR}/${name}`) continue;
    const status =
      code === '??' || code[0] === 'R' || code[0] === 'C'
        ? 'new'
        : code.includes('D')
          ? 'deleted'
          : code.includes('A')
            ? 'new'
            : 'modified';
    files.push({ name, path: p, status });
  }
  await Promise.all(
    files.map(async (f) => {
      const [numstat, head] = await Promise.all([
        git(root, ['diff', '--numstat', 'HEAD', '--', f.path]),
        git(root, ['show', `HEAD:${prefix}${f.path}`]),
      ]);
      const [added, removed] = numstat.stdout.trim().split(/\s+/);
      const disk = fs.existsSync(path.join(root, f.path))
        ? parseJSON(fs.readFileSync(path.join(root, f.path), 'utf8'))
        : undefined;
      const before = head.ok ? parseJSON(head.stdout) : undefined;
      f.added =
        Number(added) ||
        (f.status === 'new'
          ? fs.readFileSync(path.join(root, f.path), 'utf8').split('\n').length - 1
          : 0);
      f.removed = Number(removed) || 0;
      f.changes =
        before === undefined || disk === undefined ? 1 : Math.max(1, diff(before, disk).length);
    }),
  );
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Commits on this branch that origin doesn't have yet (e.g. a publish whose push failed).
  let upstream = (
    await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  ).stdout.trim();
  if (
    !upstream &&
    branch !== 'HEAD' &&
    (await git(root, ['rev-parse', '--verify', '-q', `refs/remotes/origin/${branch}`])).ok
  )
    upstream = `origin/${branch}`;
  const ahead = upstream
    ? Number((await git(root, ['rev-list', '--count', `${upstream}..HEAD`])).stdout.trim()) || 0
    : 0;
  const unpushed = ahead
    ? (await git(root, ['log', '--format=%h%x09%s', '-n', '20', `${upstream}..HEAD`])).stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => ({
          hash: line.split('\t')[0],
          subject: line.split('\t').slice(1).join('\t'),
        }))
    : [];

  return {
    git: true,
    branch,
    detached: branch === 'HEAD',
    upstream: upstream || null,
    ahead,
    unpushed,
    remote: remoteR.ok ? remoteR.stdout.trim() : null,
    repoUrl: repoUrlFrom(remoteR.stdout.trim()),
    files,
  };
}

/** Readable hint for common push failures. */
function pushHint(output) {
  if (
    /could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|invalid credentials|could not read Password/i.test(
      output,
    )
  ) {
    return "Git on this machine has no working GitHub login. In this repo's terminal run `gh auth login` (HTTPS) and `gh auth setup-git`, then click Publish again to push. Your commit is kept locally.";
  }
  if (/non-fast-forward|fetch first|rejected/i.test(output)) {
    return "GitHub has commits you don't have yet. Run `git pull --rebase` in the terminal, then click Publish again to push.";
  }
  if (/Could not resolve host|unable to access|timed out/i.test(output))
    return 'Could not reach GitHub. Check the connection and try again.';
  return '';
}

let publishing = false;

/** Commit every changed content file in one commit and push the branch. */
export async function publish(root, message) {
  const s = await contentStatus(root);
  if (!s.git) return { status: 400, body: { error: s.error } };
  if (s.detached)
    return {
      status: 409,
      body: { error: 'HEAD is detached: check out a branch before publishing.' },
    };
  if (!s.files.length && !s.ahead)
    return {
      status: 400,
      body: { error: 'Nothing to publish: no saved content changes and no unpushed commits.' },
    };

  let hash = null;
  let committed = false;
  const steps = [];
  if (s.files.length) {
    const msg = String(message || '').trim();
    if (!msg) return { status: 400, body: { error: 'A commit message is required.' } };
    if (msg.length > 5000) return { status: 400, body: { error: 'Commit message is too long.' } };
    const paths = s.files.map((f) => f.path);
    const add = await git(root, ['add', '--', ...paths]);
    steps.push({ cmd: `git add -- ${paths.join(' ')}`, ...add });
    if (!add.ok)
      return { status: 500, body: { error: 'git add failed', output: add.output, steps } };
    // With pathspecs, `git commit` commits ONLY these paths, even if other files are staged.
    const commit = await git(root, ['commit', '-m', msg, '--', ...paths]);
    steps.push({ cmd: `git commit -m <message> -- ${paths.join(' ')}`, ...commit });
    if (!commit.ok)
      return { status: 500, body: { error: 'git commit failed', output: commit.output, steps } };
    committed = true;
  }
  hash = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  const url = `${s.repoUrl}/commit/${hash}`;
  const push = await git(root, ['push', 'origin', s.branch], { timeout: 120_000 });
  steps.push({ cmd: `git push origin ${s.branch}`, ...push });
  const files = s.files.map((f) => f.path);
  if (!push.ok) {
    return {
      status: 502,
      body: {
        error: push.timedOut ? 'git push timed out' : 'git push failed',
        output: push.output,
        hint: pushHint(push.output),
        committed,
        hash,
        short: hash.slice(0, 7),
        url,
        branch: s.branch,
        files,
      },
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      committed,
      pushed: true,
      hash,
      short: hash.slice(0, 7),
      url,
      branch: s.branch,
      files,
      output: push.output,
    },
  };
}

const sendJSON = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};

/**
 * @param {{ root: string, logger: import('vite').Logger, env?: object, onWrite?: () => void }} opts
 * env: the R2_* variables for uploads (Node side only). onWrite runs right before files are
 * written (used to keep the editor from reloading itself).
 */
export function editorMiddleware({ root, logger, env = {}, onWrite = () => {} }) {
  const log = (msg) => logger.info(`\x1b[32m✓\x1b[0m ${msg}`, { timestamp: true });

  return async (req, res) => {
    try {
      if (!isLocalRequest(req))
        return sendJSON(res, 403, { error: 'The editor only accepts requests from localhost.' });
      const route = `${req.method} ${(req.url || '').split('?')[0]}`;

      if (route === 'GET /content')
        return sendJSON(res, 200, {
          mode: 'dev',
          files: readContentFiles(root),
          media: readMedia(root),
          photos: readPhotos(root),
        });

      if (route === 'POST /save') {
        const { files } = await readJSON(req);
        const names = Object.keys(files || {});
        const editable = editableFiles(root);
        const bad = names.filter(
          (n) => !editable.has(n) || files[n] === null || typeof files[n] !== 'object',
        );
        if (!names.length || bad.length)
          return sendJSON(res, 400, { error: `Not writable: ${bad.join(', ') || '(nothing)'}` });
        onWrite();
        for (const n of names)
          fs.writeFileSync(path.join(root, CONTENT_DIR, n), formatJSON(files[n]));
        log(`editor saved ${names.map((n) => `${CONTENT_DIR}/${n}`).join(', ')}`);
        return sendJSON(res, 200, { ok: true, written: names });
      }

      if (route === 'POST /upload') {
        const type = String(req.headers['content-type'] || '')
          .split(';')[0]
          .trim();
        const name = decodeURIComponent(String(req.headers['x-filename'] || ''));
        const body = await readRaw(req, MAX_UPLOAD);
        const { status, body: out } = await uploadPhoto(
          env,
          { name, type, body },
          { photosFile: path.join(root, CONTENT_DIR, PHOTOS), onWrite },
        );
        if (out.ok)
          log(
            out.existing
              ? `editor upload: ${out.key} is already in R2`
              : `editor uploaded ${out.photo.srcset.length} sizes of ${name} to R2 (${out.key})`,
          );
        return sendJSON(res, status, out);
      }

      if (route === 'GET /status') return sendJSON(res, 200, await contentStatus(root));

      if (route === 'POST /publish') {
        const { message } = await readJSON(req);
        if (publishing) return sendJSON(res, 409, { error: 'A publish is already running.' });
        publishing = true;
        try {
          const { status, body } = await publish(root, message);
          if (body.ok) log(`editor published ${body.short} to origin/${body.branch}`);
          else
            logger.warn(`editor publish: ${body.error}${body.output ? `\n${body.output}` : ''}`, {
              timestamp: true,
            });
          return sendJSON(res, status, body);
        } finally {
          publishing = false;
        }
      }

      sendJSON(res, 404, { error: 'Unknown editor endpoint' });
    } catch (err) {
      sendJSON(res, err.status || 500, { error: err.message });
    }
  };
}
