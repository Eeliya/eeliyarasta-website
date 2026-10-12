// The preview's injected CSS (overlay.js, bridge.js) takes its colours and sizes from
// src/editor/ui-tokens.js: they must be the editor's tokens (src/editor/styles/_tokens.scss).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { T } from '../src/editor/ui-tokens.js';

const scss = readFileSync(new URL('../src/editor/styles/_tokens.scss', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...scss.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
);
/** A token's value with var() references followed. */
const value = (name) => {
  const v = tokens[name];
  const m = v && /^var\((--[\w-]+)\)$/.exec(v);
  return m ? value(m[1]) : v;
};

test('ui-tokens.js mirrors the editor tokens', () => {
  assert.equal(T.accent, value('--c-accent'));
  assert.equal(T.onAccent, value('--c-on-accent'));
  assert.equal(T.error, value('--c-error'));
  assert.equal(T.white, value('--white'));
  assert.equal(T.black, value('--black'));
  assert.equal(T.fsXs, value('--fs-xs'));
  assert.equal(T.radiusXs, value('--radius-xs'));
  assert.equal(T.radiusSm, value('--radius-sm'));
  // the accent's rgb channels are the accent
  const hex = T.accent.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
  assert.equal(T.accentRgb, rgb);
});
