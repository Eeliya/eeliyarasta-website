/**
 * Where content comes from and where saves go.
 *   dev    - `npm run dev`: the Vite plugin serves /__editor/content and writes files on save.
 *   github - deployed site: content is read from and committed to GitHub (needs a token);
 *            without a token the build-time snapshot in /edit/content/ is shown read-only.
 */
import config from './config.js';
import * as gh from './github.js';

async function json(url, opts) {
  const res = await fetch(url, { cache: 'no-store', ...opts });
  if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export async function load() {
  try {
    const dev = await json('/__editor/content');
    return { mode: 'dev', files: dev.files, from: 'local files' };
  } catch { /* not the dev server */ }
  if (gh.token.get()) {
    try {
      const head = await gh.head();
      return { mode: 'github', files: await gh.readFiles(config.files, head.sha), from: `GitHub ${config.branch}@${head.sha.slice(0, 7)}`, head };
    } catch (err) {
      console.warn('[editor] GitHub load failed, using the build snapshot', err);
      const snap = await loadSnapshot();
      return { ...snap, warning: err.message };
    }
  }
  return loadSnapshot();
}

async function loadSnapshot() {
  const files = {};
  await Promise.all(config.files.map(async (f) => (files[f] = await json(`/edit/content/${f}`))));
  return { mode: 'github', files, from: 'deployed snapshot' };
}

export async function saveDev(files) {
  return json('/__editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
}
