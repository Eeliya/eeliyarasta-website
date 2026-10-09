/**
 * R2 upload (scripts/r2.mjs) against a local mock S3 endpoint: `npm test`.
 * The mock checks the request R2 would get, including its SigV4 signature (computed here
 * independently of aws4fetch).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { NOT_CONFIGURED, photoKey, r2Config, uploadPhoto } from './r2.mjs';

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
let last = null; // the last request the mock got
let reply = null; // force an answer: { status, body }

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      last = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
        valid: signatureOk(req, body),
      };
      if (reply) {
        res.writeHead(reply.status, { 'Content-Type': 'application/xml' });
        return res.end(reply.body);
      }
      res.writeHead(last.valid ? 200 : 403);
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  endpoint = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const env = () => ({
  R2_ENDPOINT: endpoint,
  R2_ACCESS_KEY_ID: 'test-key-id',
  R2_SECRET_ACCESS_KEY: SECRET,
  R2_BUCKET: 'photos-bucket',
});
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

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

test('key: photos/<slug>-<content hash>.<ext>, same bytes same key', () => {
  const key = photoKey('Noor Vermeer 01.JPG', 'image/jpeg', jpeg);
  assert.match(key, /^photos\/noor-vermeer-01-[0-9a-f]{10}\.jpg$/);
  assert.equal(
    photoKey('other.png', 'image/png', jpeg).split('-').pop(),
    key.split('-').pop().replace('jpg', 'png'),
  );
  assert.notEqual(
    photoKey('a.jpg', 'image/jpeg', Buffer.from('x')),
    photoKey('a.jpg', 'image/jpeg', jpeg),
  );
  assert.match(photoKey('', 'image/webp', jpeg), /^photos\/photo-[0-9a-f]{10}\.webp$/);
});

test('upload: a signed PUT with type, long cache and the bytes', async () => {
  reply = null;
  const r = await uploadPhoto(env(), {
    name: 'Kasteel de Haar.jpg',
    type: 'image/jpeg',
    body: jpeg,
  });
  assert.equal(r.status, 200);
  assert.match(r.body.key, /^photos\/kasteel-de-haar-[0-9a-f]{10}\.jpg$/);
  assert.equal(last.method, 'PUT');
  assert.equal(last.url, `/photos-bucket/${r.body.key}`);
  assert.equal(last.headers['content-type'], 'image/jpeg');
  assert.equal(last.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.deepEqual(last.body, jpeg);
  assert.ok(last.valid, 'SigV4 signature checks out');
  assert.match(last.headers.authorization, /Credential=test-key-id\/\d{8}\/auto\/s3\/aws4_request/);
});

test('upload: a wrong secret is rejected by the endpoint', async () => {
  reply = { status: 403, body: '<Error><Code>SignatureDoesNotMatch</Code></Error>' };
  await assert.rejects(
    uploadPhoto(
      { ...env(), R2_SECRET_ACCESS_KEY: 'nope' },
      { name: 'a.jpg', type: 'image/jpeg', body: jpeg },
    ),
    /R2 upload failed: 403 SignatureDoesNotMatch/,
  );
  reply = null;
});

test('upload: no keys, not an image, empty file', async () => {
  last = null;
  const none = await uploadPhoto({}, { name: 'a.jpg', type: 'image/jpeg', body: jpeg });
  assert.equal(none.status, 503);
  assert.equal(none.body.error, NOT_CONFIGURED);
  assert.equal(
    (await uploadPhoto(env(), { name: 'a.svg', type: 'image/svg+xml', body: jpeg })).status,
    415,
  );
  assert.equal(
    (await uploadPhoto(env(), { name: 'a.jpg', type: 'image/jpeg', body: Buffer.alloc(0) })).status,
    400,
  );
  assert.equal(last, null, 'nothing was sent');
});
