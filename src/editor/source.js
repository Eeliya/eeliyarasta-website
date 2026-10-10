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
  let dev;
  try {
    dev = await json('/__editor/content');
  } catch (err) {
    // The dev server answered with its own error (e.g. broken JSON in a content file): show it.
    if (err.error) throw err;
    throw new Error(`The editor only works with the dev server (npm run dev). ${err.message}`, {
      cause: err,
    });
  }
  media.manifest = dev.media || {};
  media.photos = dev.photos || {};
  return { mode: 'dev', files: dev.files, from: 'local files' };
}

export const saveDev = (files) =>
  json('/__editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

/**
 * The unsaved edits the preview renders from (POST /__editor/draft, draftOp in
 * scripts/editor-server.mjs): { "pages/index.json": data, ... }; {} after a save.
 */
export const draft = (files) =>
  json('/__editor/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

/**
 * Add, rename or delete pages and folders in content/pages/ (POST /__editor/pages, see
 * pagesOp in scripts/editor-server.mjs): { op: 'add', parent, name, title }, ...
 * Resolves to { id, created, removed } (content file names).
 */
export const pagesOp = (body) =>
  json('/__editor/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * The Media window's photo ops (POST /__editor/media, mediaOp in scripts/editor-server.mjs):
 * { op: 'alt', key, alt } or { op: 'delete', key }. Takes the fresh photo lists it answers.
 */
export async function mediaOp(body) {
  const res = await json('/__editor/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  media.photos = res.photos;
  media.manifest = res.media;
  return res;
}

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
