/**
 * Photo uploads to Cloudflare R2 (S3-compatible API), for the editor's upload endpoint
 * (POST /__editor/upload, scripts/editor-server.mjs). Node only, dev server only.
 *
 * The keys come from .env.local (git-ignored, see .env.example), read on the Node side by
 * the static-site plugin with Vite's loadEnv. They never reach the browser: only VITE_*
 * variables are exposed to client code.
 *
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET   required
 *   R2_ENDPOINT   optional: another S3 endpoint (tests use a local mock)
 *
 * An upload is resized like the photos in media/ (scripts/image-variants.mjs: auto-rotated,
 * metadata stripped, WebP at 480/960/1600 px, never wider than the original) and each size is
 * stored as photos/<name>-<hash>-<width>.webp. The hash is of the original bytes: the same
 * photo always gets the same keys, and the objects can be cached forever. The original itself
 * is not kept: the largest size is the fallback src, and it is the key the content stores.
 *
 * deletePhoto removes every size of an uploaded photo from R2 and its photos.json entry (the
 * Media window's Delete, only for photos nothing uses).
 *
 * Sizes, placeholder and colour go into content/settings/photos.json (PHOTOS, files.js), keyed by
 * that key, so the build renders srcset, width/height and the blurred placeholder without
 * downloading anything from R2. Publish commits it with the content.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { AwsClient } from 'aws4fetch';
import { FORMAT, loadSharp, makeVariants, uprightSize, widthsFor } from './image-variants.mjs';
import { formatJSON } from '../src/editor/lib/json-format.js';
import { writeFileAtomic } from './content.mjs';

/** Image types an upload can be (they are stored as WebP). */
export const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/tiff',
]);
export const MAX_UPLOAD = 60 * 1024 * 1024; // 60 MB: camera JPEGs, and most TIFFs
const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
export const NOT_CONFIGURED = 'R2 not configured: add keys to .env.local';

/** The R2 settings from `env`, or { missing: [names] } when some are not set. */
export function r2Config(env) {
  const need = env.R2_ENDPOINT ? REQUIRED.slice(1) : REQUIRED; // a custom endpoint needs no account
  const missing = need.filter((k) => !env[k]);
  if (missing.length) return { missing };
  return {
    endpoint: (env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(
      /\/+$/,
      '',
    ),
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'photo';

/** "Noor Vermeer 01.JPG" + bytes -> "photos/noor-vermeer-01-3f9a0c1b2d" (sizes add "-<width>.webp") */
export function photoBase(name, body) {
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  return `photos/${slug(String(name || '').replace(/\.[a-z0-9]+$/i, ''))}-${hash}`;
}

const sizeKey = (base, w) => `${base}-${w}.${FORMAT.ext}`;

const readJSON = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});

const client = (cfg) =>
  new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
const objectUrl = (cfg, key) =>
  `${cfg.endpoint}/${[cfg.bucket, ...key.split('/')].map(encodeURIComponent).join('/')}`;
const sha256 = (body) => crypto.createHash('sha256').update(body).digest('hex');

/** Throws "R2 <what> failed: <status> <R2 error code>" for a failed answer. */
async function check(res, what) {
  if (res.ok) return;
  const code = /<Code>([^<]+)<\/Code>/.exec(await res.text())?.[1];
  throw new Error(`R2 ${what} failed: ${res.status}${code ? ` ${code}` : ''}`);
}

/**
 * PUT one object, signed with SigV4 (region "auto") including the hash of the bytes, so R2
 * rejects a body that changed on the way. Throws with R2's error code when it fails.
 */
export async function putObject(cfg, { key, body, type }) {
  const res = await client(cfg).fetch(objectUrl(cfg, key), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Amz-Content-Sha256': sha256(body),
    },
  });
  await check(res, 'upload');
}

/** DELETE one object (SigV4 like putObject). A key that is already gone is fine (S3: 204). */
export async function deleteObject(cfg, key) {
  const res = await client(cfg).fetch(objectUrl(cfg, key), {
    method: 'DELETE',
    headers: { 'X-Amz-Content-Sha256': sha256('') },
  });
  await check(res, 'delete');
}

/** Write photos.json sorted by key (formatted like Save), right after onWrite(). */
export function writePhotos(photosFile, photos, onWrite = () => {}) {
  onWrite();
  writeFileAtomic(
    photosFile,
    formatJSON(
      Object.fromEntries(
        Object.keys(photos)
          .sort()
          .map((k) => [k, photos[k]]),
      ),
    ),
  );
}

/**
 * Check, resize and store one uploaded image: { status, body } for the endpoint; body.key is
 * the value for the content, body.photo its photos.json entry.
 *   env           the R2_* variables
 *   name, type    the original file name and Content-Type; body: its bytes
 *   photosFile    the photos.json to add the entry to
 *   onWrite       called right before photos.json is written
 * The same photo again (same bytes, same name) uploads nothing: it is already in photos.json.
 */
export async function uploadPhoto(env, { name, type, body }, { photosFile, onWrite = () => {} }) {
  const cfg = r2Config(env);
  if (cfg.missing) return { status: 503, body: { error: NOT_CONFIGURED, missing: cfg.missing } };
  if (!IMAGE_TYPES.has(type))
    return {
      status: 415,
      body: {
        error: `Not an image type the site takes (${type || 'unknown'}): JPEG, PNG, WebP, AVIF, GIF or TIFF`,
      },
    };
  if (!body.length) return { status: 400, body: { error: 'Empty file' } };
  const sharp = await loadSharp();
  if (!sharp) return { status: 500, body: { error: 'sharp is not installed: run npm install' } };

  let width;
  try {
    ({ width } = await uprightSize(sharp, body));
  } catch {
    return { status: 415, body: { error: `Could not read ${name || 'the file'} as an image` } };
  }
  const base = photoBase(name, body);
  const key = sizeKey(base, widthsFor(width).at(-1));
  const photos = readJSON(photosFile);
  if (photos[key])
    return { status: 200, body: { ok: true, key, photo: photos[key], existing: true } };

  const v = await makeVariants(sharp, body);
  const srcset = v.sizes.map(({ w }) => ({ key: sizeKey(base, w), w }));
  await Promise.all(
    v.sizes.map(({ w, buffer }) =>
      putObject(cfg, { key: sizeKey(base, w), body: buffer, type: FORMAT.type }),
    ),
  );
  const photo = { width: v.width, height: v.height, srcset, color: v.color, lqip: v.lqip };
  // re-read: another upload may have finished meanwhile
  writePhotos(photosFile, { ...readJSON(photosFile), [key]: photo }, onWrite);
  const bytes = v.sizes.reduce((n, s) => n + s.buffer.length, 0);
  return { status: 200, body: { ok: true, key, photo, size: body.length, stored: bytes } };
}

/**
 * Delete an uploaded photo: every size in R2, then its photos.json entry (alt included).
 * { status, body } like uploadPhoto. The caller checks that nothing uses it.
 */
export async function deletePhoto(env, key, { photosFile, onWrite = () => {} }) {
  const cfg = r2Config(env);
  if (cfg.missing) return { status: 503, body: { error: NOT_CONFIGURED, missing: cfg.missing } };
  const photo = readJSON(photosFile)[key];
  if (!Array.isArray(photo?.srcset))
    return { status: 404, body: { error: `No R2 photo "${key}"` } };
  await Promise.all(photo.srcset.map((s) => deleteObject(cfg, s.key)));
  const now = readJSON(photosFile); // re-read, like the upload
  delete now[key];
  writePhotos(photosFile, now, onWrite);
  return { status: 200, body: { ok: true, key, deleted: photo.srcset.map((s) => s.key) } };
}
