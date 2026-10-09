/**
 * R2 upload (scripts/r2.mjs) against a local mock S3 endpoint: `npm test`.
 * The mock checks the requests R2 would get, including their SigV4 signature (computed here
 * independently of aws4fetch); photos.json goes to a temp folder.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { NOT_CONFIGURED, photoBase, r2Config, uploadPhoto } from './r2.mjs';

const SECRET = 'test-secret-key';
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/** Is req's Authorization a valid SigV4 signature for SECRET, region auto, service s3? */
function signatureOk(req, body) {
  const m =
    /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(
      req.headers.authorization || '',
    );
  if (!m) return false;
  const [, , date, signed, signature] = m;
  const amzDate = req.headers['x-amz-date'];
  const payload = req.headers['x-amz-content-sha256'];
  if (payload !== sha256(body)) return false;
  const names = signed.split(';');
  const canonical = [
    req.method,
    req.url.split('?')[0],
    req.url.split('?')[1] || '',
    ...names.map((h) => `${h}:${String(req.headers[h]).trim()}`),
    '',
    signed,
    payload,
  ].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${SECRET}`, date);
  for (const part of ['auto', 's3', 'aws4_request']) key = hmac(key, part);
  return hmac(key, toSign).toString('hex') === signature;
}

let server;
let endpoint;
let puts = []; // the requests the mock got
let reply = null; // force an answer: { status, body }
let dir;
let photosFile;

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const valid = signatureOk(req, body);
      puts.push({ method: req.method, url: req.url, headers: req.headers, body, valid });
      if (reply) {
        res.writeHead(reply.status, { 'Content-Type': 'application/xml' });
        return res.end(reply.body);
      }
      res.writeHead(valid ? 200 : 403);
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  endpoint = `http://127.0.0.1:${server.address().port}`;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-test-'));
  photosFile = path.join(dir, 'photos.json');
});
after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const env = () => ({
  R2_ENDPOINT: endpoint,
  R2_ACCESS_KEY_ID: 'test-key-id',
  R2_SECRET_ACCESS_KEY: SECRET,
  R2_BUCKET: 'photos-bucket',
});
const opts = () => ({ photosFile });
const photos = () => JSON.parse(fs.readFileSync(photosFile, 'utf8'));

/** A width x height JPEG; orientation 6 = shot in portrait (stored sideways), with GPS-like EXIF. */
const jpeg = (width, height, orientation = 1) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } })
    .jpeg()
    .withMetadata({
      orientation,
      exif: { IFD0: { Copyright: 'test', Artist: 'GPS 52.09N 5.12E' } },
    })
    .toBuffer();

test('config: names what is missing; the R2 endpoint comes from the account', () => {
  assert.deepEqual(r2Config({}).missing, [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ]);
  const cfg = r2Config({ ...env(), R2_ENDPOINT: '', R2_ACCOUNT_ID: 'abc123' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
});

test('key base: photos/<slug>-<hash of the bytes>', () => {
  const a = Buffer.from('a');
  assert.match(photoBase('Noor Vermeer 01.JPG', a), /^photos\/noor-vermeer-01-[0-9a-f]{10}$/);
  assert.equal(photoBase('x.jpg', a).slice(-10), photoBase('y.png', a).slice(-10));
  assert.notEqual(photoBase('x.jpg', a), photoBase('x.jpg', Buffer.from('b')));
  assert.match(photoBase('', a), /^photos\/photo-[0-9a-f]{10}$/);
});

test('upload: rotated, metadata stripped, WebP sizes up to the original, photos.json entry', async () => {
  puts = [];
  const body = await jpeg(2000, 1200, 6); // upright: 1200 x 2000
  const r = await uploadPhoto(
    env(),
    { name: 'Kasteel de Haar.jpg', type: 'image/jpeg', body },
    opts(),
  );
  assert.equal(r.status, 200);
  const base = photoBase('Kasteel de Haar.jpg', body);
  // 1600 is wider than the photo: 480 and 960; the content gets the largest
  assert.equal(r.body.key, `${base}-960.webp`);
  assert.deepEqual(puts.map((p) => p.url).sort(), [
    `/photos-bucket/${base}-480.webp`,
    `/photos-bucket/${base}-960.webp`,
  ]);
  for (const p of puts) {
    assert.equal(p.method, 'PUT');
    assert.equal(p.headers['content-type'], 'image/webp');
    assert.equal(p.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.ok(p.valid, 'SigV4 signature checks out');
    const meta = await sharp(p.body).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.exif, undefined, 'no EXIF (GPS, camera) in the stored photo');
    assert.equal(meta.orientation, undefined);
    const w = Number(/-(\d+)\.webp$/.exec(p.url)[1]);
    assert.deepEqual([meta.width, meta.height], [w, Math.round((w * 2000) / 1200)], 'upright');
  }
  const entry = photos()[r.body.key];
  assert.deepEqual(entry, r.body.photo);
  assert.equal(entry.width, 1200);
  assert.equal(entry.height, 2000);
  assert.deepEqual(entry.srcset, [
    { key: `${base}-480.webp`, w: 480 },
    { key: `${base}-960.webp`, w: 960 },
  ]);
  assert.match(entry.lqip, /^data:image\/webp;base64,/);
  assert.match(entry.color, /^#[0-9a-f]{6}$/);
});

test('upload: a big photo gets 480, 960 and 1600; a small one only its own width', async () => {
  puts = [];
  const big = await uploadPhoto(
    env(),
    { name: 'big.jpg', type: 'image/jpeg', body: await jpeg(4000, 3000) },
    opts(),
  );
  assert.deepEqual(
    big.body.photo.srcset.map((s) => s.w),
    [480, 960, 1600],
  );
  assert.match(big.body.key, /-1600\.webp$/);
  const small = await uploadPhoto(
    env(),
    {
      name: 'small.png',
      type: 'image/png',
      body: await sharp({ create: { width: 300, height: 200, channels: 3, background: '#888' } })
        .png()
        .toBuffer(),
    },
    opts(),
  );
  assert.deepEqual(
    small.body.photo.srcset.map((s) => s.w),
    [300],
  );
  assert.equal(puts.length, 4);
  assert.equal(Object.keys(photos()).length, 3);
});

test('upload: the same photo again uploads nothing and adds no entry', async () => {
  const body = await jpeg(2000, 1200, 6);
  const before = photos();
  puts = [];
  const r = await uploadPhoto(
    env(),
    { name: 'Kasteel de Haar.jpg', type: 'image/jpeg', body },
    opts(),
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.existing, true);
  assert.equal(puts.length, 0);
  assert.deepEqual(photos(), before);
});

test('upload: a wrong secret is rejected by the endpoint, photos.json untouched', async () => {
  const before = photos();
  reply = { status: 403, body: '<Error><Code>SignatureDoesNotMatch</Code></Error>' };
  await assert.rejects(
    uploadPhoto(
      { ...env(), R2_SECRET_ACCESS_KEY: 'nope' },
      { name: 'new.jpg', type: 'image/jpeg', body: await jpeg(800, 600) },
      opts(),
    ),
    /R2 upload failed: 403 SignatureDoesNotMatch/,
  );
  reply = null;
  assert.deepEqual(photos(), before);
});

test('upload: no keys, not an image, empty or broken file', async () => {
  puts = [];
  const body = await jpeg(100, 100);
  const none = await uploadPhoto({}, { name: 'a.jpg', type: 'image/jpeg', body }, opts());
  assert.equal(none.status, 503);
  assert.equal(none.body.error, NOT_CONFIGURED);
  assert.equal(
    (await uploadPhoto(env(), { name: 'a.svg', type: 'image/svg+xml', body }, opts())).status,
    415,
  );
  assert.equal(
    (await uploadPhoto(env(), { name: 'a.jpg', type: 'image/jpeg', body: Buffer.alloc(0) }, opts()))
      .status,
    400,
  );
  const broken = await uploadPhoto(
    env(),
    { name: 'a.jpg', type: 'image/jpeg', body: Buffer.from('not a jpeg') },
    opts(),
  );
  assert.equal(broken.status, 415);
  assert.match(broken.body.error, /Could not read a\.jpg/);
  assert.equal(puts.length, 0, 'nothing was sent');
});
