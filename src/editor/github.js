/**
 * Commit content from the browser with the GitHub REST API (git data endpoints).
 *
 * Auth: a fine-grained personal access token limited to this one repository with
 * "Contents: read and write". It lives in this browser's localStorage only, and
 * is only ever sent to https://api.github.com (enforced in request()).
 */
import config from './config.js';

const API = 'https://api.github.com';
const repoPath = `/repos/${config.owner}/${config.repo}`;
const filePath = (name) => `${config.contentDir}/${name}`;

export const repoUrl = `https://github.com/${config.owner}/${config.repo}`;

export const token = {
  get: () => {
    try { return localStorage.getItem(config.tokenKey) || ''; } catch { return ''; }
  },
  set: (value) => localStorage.setItem(config.tokenKey, value.trim()),
  clear: () => localStorage.removeItem(config.tokenKey),
};

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, raw = false, auth = token.get() } = {}) {
  const url = new URL(path, API);
  if (url.origin !== API) throw new Error('Refusing to send the token outside api.github.com');
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* not json */ }
    const hint = res.status === 401 ? ' (token invalid or expired)' : res.status === 403 || res.status === 404 ? ' (token lacks access to this repo?)' : '';
    throw new GitHubError(res.status, `GitHub ${res.status}: ${msg}${hint}`);
  }
  return raw ? res.text() : res.json();
}

/** Check a token: can it read the repo? Returns { login, repo, canPush }. */
export async function verify(auth) {
  const repo = await request(repoPath, { auth });
  let login = '';
  try { login = (await request('/user', { auth })).login; } catch { /* fine-grained tokens may not read /user */ }
  return { login, repo: repo.full_name, canPush: repo.permissions ? !!repo.permissions.push : null };
}

/** Latest commit on the branch: { sha, treeSha }. */
export async function head() {
  const ref = await request(`${repoPath}/git/ref/heads/${config.branch}`);
  const commit = await request(`${repoPath}/git/commits/${ref.object.sha}`);
  return { sha: ref.object.sha, treeSha: commit.tree.sha };
}

/** Parsed content files at a commit. */
export async function readFiles(names, ref) {
  const out = {};
  await Promise.all(
    names.map(async (name) => {
      const text = await request(`${repoPath}/contents/${filePath(name)}?ref=${encodeURIComponent(ref)}`, { raw: true });
      out[name] = JSON.parse(text);
    }),
  );
  return out;
}

/**
 * One commit containing all `files` ({ name: text }) on top of `parent`.
 * Throws GitHubError 422 when the branch moved meanwhile (not a fast-forward).
 */
export async function commit({ files, message, parent }) {
  const tree = await request(`${repoPath}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: parent.treeSha,
      tree: Object.entries(files).map(([name, content]) => ({ path: filePath(name), mode: '100644', type: 'blob', content })),
    },
  });
  const created = await request(`${repoPath}/git/commits`, {
    method: 'POST',
    body: { message, tree: tree.sha, parents: [parent.sha] },
  });
  await request(`${repoPath}/git/refs/heads/${config.branch}`, {
    method: 'PATCH',
    body: { sha: created.sha, force: false },
  });
  return { sha: created.sha, url: created.html_url || `${repoUrl}/commit/${created.sha}` };
}
