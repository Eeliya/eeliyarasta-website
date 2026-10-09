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
 * An upload is stored as photos/<name>-<hash>.<ext>: the hash of the bytes keeps names unique
 * and lets the object be cached forever (a changed photo gets a new key).
 */
import crypto from 'node:crypto';
import { AwsClient } from 'aws4fetch';

/** Accepted image types and their file extension. */
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
export const MAX_UPLOAD = 30 * 1024 * 1024; // 30 MB: a full-size camera JPEG fits
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

/** "Noor Vermeer 01.JPG" + bytes -> "photos/noor-vermeer-01-3f9a0c1b2d.jpg" */
export function photoKey(name, type, body) {
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  const base = slug(String(name || '').replace(/\.[a-z0-9]+$/i, ''));
  return `photos/${base}-${hash}.${IMAGE_TYPES[type]}`;
}

/**
 * PUT one object, signed with SigV4 (region "auto") including the hash of the bytes, so R2
 * rejects a body that changed on the way. Throws with R2's error code when it fails.
 */
export async function putObject(cfg, { key, body, type }) {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const path = [cfg.bucket, ...key.split('/')].map(encodeURIComponent).join('/');
  const res = await client.fetch(`${cfg.endpoint}/${path}`, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Amz-Content-Sha256': crypto.createHash('sha256').update(body).digest('hex'),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
    throw new Error(`R2 upload failed: ${res.status}${code ? ` ${code}` : ''}`);
  }
}

/**
 * Check and store one uploaded image: { status, body } for the endpoint.
 * env: the R2_* variables; name: the original file name; type: its Content-Type.
 */
export async function uploadPhoto(env, { name, type, body }) {
  const cfg = r2Config(env);
  if (cfg.missing) return { status: 503, body: { error: NOT_CONFIGURED, missing: cfg.missing } };
  if (!IMAGE_TYPES[type])
    return {
      status: 415,
      body: {
        error: `Not an image type the site takes (${type || 'unknown'}): JPEG, PNG, WebP, AVIF or GIF`,
      },
    };
  if (!body.length) return { status: 400, body: { error: 'Empty file' } };
  const key = photoKey(name, type, body);
  await putObject(cfg, { key, body, type });
  return { status: 200, body: { ok: true, key, size: body.length, type } };
}
