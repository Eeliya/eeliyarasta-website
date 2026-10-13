import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backdropOf, checkBackdrop, renderBackdrop } from '../src/site/backdrop.js';
import { checkContent } from '../src/site/validate.js';
import { omitDefaults, storedDefaults } from '../src/site/defaults.js';

const FILE = 'pages/index.json';
const page = (backdrop) => ({ version: 1, id: 'pg-t001', sections: [], backdrop });
const P = ['a/1.jpg', 'a/2.jpg', 'a/3.jpg'];

test('a valid backdrop passes; bad values are named', () => {
  assert.deepEqual(checkContent(FILE, page({ photos: P })), []);
  assert.deepEqual(
    checkContent(FILE, page({ photos: P, transition: 'fade', through: 'none', scrub: true })),
    [],
  );
  assert.deepEqual(checkBackdrop('x'), [
    '"backdrop" must be an object { photos, transition, ... }',
  ]);
  const out = checkBackdrop({
    photos: ['a.jpg', ''],
    transition: 'slide',
    direction: 'up',
    parallax: 'yes',
    color: 1,
  });
  assert.ok(out.some((p) => p.includes('"photos"')));
  assert.ok(out.some((p) => p.includes('"transition" must be scroll or fade')));
  assert.ok(out.some((p) => p.includes('"direction" must be vertical or horizontal')));
  assert.ok(out.some((p) => p.includes('"parallax" must be true or false')));
  assert.ok(out.some((p) => p.includes('"color" is not a backdrop setting')));
});

test("a transition's options belong to it", () => {
  assert.deepEqual(checkBackdrop({ photos: P, direction: 'horizontal' }), []);
  assert.deepEqual(checkBackdrop({ photos: P, transition: 'fade', direction: 'horizontal' }), [
    'backdrop: "direction" is only for the scroll transition',
  ]);
  assert.deepEqual(checkBackdrop({ photos: P, scrub: true }), [
    'backdrop: "scrub" is only for the fade transition',
  ]);
});

test('save leaves out defaults, the other transition, and an empty backdrop', () => {
  const full = {
    photos: P,
    transition: 'scroll',
    direction: 'vertical',
    through: 'black',
    parallax: false,
    scrub: true,
    enabled: true,
  };
  assert.deepEqual(omitDefaults(FILE, page(full)).backdrop, { photos: P });
  assert.deepEqual(
    omitDefaults(FILE, page({ ...full, transition: 'fade', direction: 'horizontal' })).backdrop,
    { photos: P, transition: 'fade', scrub: true },
  );
  assert.equal(omitDefaults(FILE, page({ photos: [], transition: 'fade' })).backdrop, undefined);
  assert.deepEqual(storedDefaults(FILE, page({ photos: P, transition: 'scroll' })), [
    'backdrop: "transition" is the default ("scroll"): leave it out',
  ]);
});

test('backdropOf fills in defaults; off or without photos: none', () => {
  assert.deepEqual(backdropOf({ photos: P }), {
    photos: P,
    transition: 'scroll',
    direction: 'vertical',
    through: 'black',
    parallax: false,
    scrub: false,
    enabled: true,
  });
  assert.equal(backdropOf({ photos: P, enabled: false }), null);
  assert.equal(backdropOf({ photos: [] }), null);
  assert.equal(backdropOf(undefined), null);
});

test('renderBackdrop: a fixed layer with its photos and settings', () => {
  const ctx = { site: {}, media: {}, photos: {} };
  assert.equal(renderBackdrop(ctx, undefined), '');
  const out = renderBackdrop(ctx, { photos: P, transition: 'fade', through: 'none' });
  assert.match(out, /class="pbd pbd--fade"/);
  assert.match(out, /data-portal/);
  assert.match(out, /--n:3/);
  assert.equal(out.match(/<img/g).length, 3);
  assert.match(out, /fetchpriority="high"/);
  assert.equal(out.match(/loading="lazy"/g).length, 1);
  const opts = JSON.parse(out.match(/data-backdrop="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.deepEqual(opts, { transition: 'fade', through: 'none', parallax: false, scrub: false });
  assert.match(
    renderBackdrop(ctx, { photos: P, direction: 'horizontal' }),
    /pbd--scroll pbd--horizontal/,
  );
  assert.match(renderBackdrop(ctx, { photos: P, transition: 'fade' }), /pbd--black/);
});
