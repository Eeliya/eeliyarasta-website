/**
 * Where content comes from and where saves go: the dev server (`npm run dev`).
 * The Vite plugin (scripts/vite-plugin-static-site.mjs) serves /__editor/* to
 * localhost only. There is no editor in production builds.
 */
import { media } from './svelte/media.svelte.js';
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
    media.manifest = dev.media || {};
    media.photos = dev.photos || {};
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

/**
 * Upload a photo to Cloudflare R2 (POST /__editor/upload), where the dev server resizes it:
 * resolves to { key, photo }, key being the value to store in the content. onprogress(0..1)
 * follows the bytes going up (fetch can't, so XMLHttpRequest); at 1 the server is resizing.
 */
export function upload(file, onprogress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/__editor/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onprogress?.(e.loaded / e.total);
    xhr.upload.onload = () => onprogress?.(1);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status === 200 && data?.key) resolve(data);
      else reject(new Error(data?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed: the dev server did not answer'));
    xhr.send(file);
  });
}

/** Saved-but-unpublished content changes (git status of the content files). */
export const status = () => json('/__editor/status');

/** Commit all changed content files in one commit and push it. */
export const publish = (message) =>
  json('/__editor/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
