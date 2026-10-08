/**
 * Where content comes from and where saves go: the dev server (`npm run dev`).
 * The Vite plugin (scripts/vite-plugin-static-site.mjs) serves /__editor/* to
 * localhost only. There is no editor in production builds.
 */
async function json(url, opts) {
  const res = await fetch(url, { cache: 'no-store', ...opts });
  const isJSON = (res.headers.get('content-type') || '').includes('json');
  const data = isJSON ? await res.json() : null;
  if (!res.ok || !isJSON) {
    const err = new Error(data?.error || `${url}: ${res.status}`);
    Object.assign(err, data || {});
    throw err;
  }
  return data;
}

export async function load() {
  try {
    const dev = await json('/__editor/content');
    return { mode: 'dev', files: dev.files, from: 'local files' };
  } catch (err) {
    throw new Error(`The editor only works with the dev server (npm run dev). ${err.message}`);
  }
}

export const saveDev = (files) =>
  json('/__editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

/** Saved-but-unpublished content changes (git status of the content files). */
export const status = () => json('/__editor/status');

/** Commit all changed content files in one commit and push it. */
export const publish = (message) =>
  json('/__editor/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
