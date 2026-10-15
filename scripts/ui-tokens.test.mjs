// The preview's injected CSS (overlay.js, bridge.js) takes its colours and sizes from the token
// files (src/editor/ui-tokens.js reads them, lib/css-tokens.js): the values it gets, and every
// token the injected CSS uses is there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rgbOf, tokensOf, uiTokens } from '../src/editor/lib/css-tokens.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const site = read('src/client/styles/_tokens.scss');
const editor = read('src/editor/styles/_tokens.scss');
const T = uiTokens(site, editor);

test('ui tokens: the values the injected CSS gets from the token files', () => {
  assert.deepEqual(T, {
    accent: '#3cf',
    accentRgb: '51 204 255',
    onAccent: '#000',
    error: '#ff8a7a',
    peekLine: 'rgb(255 255 255 / 0.7)',
    white: '#fff',
    black: '#000',
    font: "'DM Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
    fsXs: '10px',
    radiusXs: '2px',
    radiusSm: '4px',
  });
});

test('ui tokens: every token overlay.js and bridge.js use is set', () => {
  for (const f of ['src/editor/overlay.js', 'src/editor/bridge.js'])
    for (const [, k] of read(f).matchAll(/\bT\.(\w+)/g))
      assert.ok(typeof T[k] === 'string' && T[k], `${f}: T.${k}`);
  // ui-tokens.js is only the token files, read (no values of its own)
  assert.doesNotMatch(read('src/editor/ui-tokens.js'), /#[0-9a-f]{3,6}\b|\d+px/i);
});

test('tokensOf: var() followed, later files win, loops and unknowns undefined', () => {
  const v = tokensOf(
    ':root {\n  --a: #fff;\n  --b: var(--a);\n  --l: var(--l);\n}',
    '  --a: #000;',
  );
  assert.equal(v('--b'), '#000');
  assert.equal(v('--l'), undefined);
  assert.equal(v('--nope'), undefined);
  assert.equal(rgbOf('#33ccff'), '51 204 255');
});
