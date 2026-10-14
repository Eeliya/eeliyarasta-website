import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLS, MCOLS, PHONE_MAX, PHONE_MQ } from '../src/site/layout/grid.js';
import { sizes } from '../src/site/helpers.js';

test('the phone breakpoint: PHONE_MAX is $bp-sm in the site tokens; sizes() uses it', () => {
  const scss = readFileSync(new URL('../src/client/styles/_tokens.scss', import.meta.url), 'utf8');
  assert.equal(scss.match(/\$bp-sm:\s*(\d+)px/)?.[1], String(PHONE_MAX));
  assert.equal(PHONE_MQ, `(max-width: ${PHONE_MAX}px)`);
  assert.equal(sizes('100vw', '50vw'), `(max-width: ${PHONE_MAX}px) 100vw, 50vw`);
});

test('the grid columns: --cols and --mcols in the site tokens are COLS and MCOLS', () => {
  const scss = readFileSync(new URL('../src/client/styles/_tokens.scss', import.meta.url), 'utf8');
  assert.equal(scss.match(/--cols:\s*(\d+);/)?.[1], String(COLS));
  assert.equal(scss.match(/--mcols:\s*(\d+);/)?.[1], String(MCOLS));
});
