// The preview's injected CSS (overlay.js, bridge.js) takes its colours and sizes from the token
// files (src/editor/ui-tokens.js reads them, lib/css-tokens.js): the values it gets, and every
// token the injected CSS uses is there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rgbOf, tokensOf, uiTokens } from '../src/editor/lib/css-tokens.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const editor = read('src/editor/styles/_tokens.scss');
const T = uiTokens(editor);

test('ui tokens: the values the injected CSS gets from the token files', () => {
  assert.deepEqual(T, {
    accent: '#3cf',
    accentRgb: '51 204 255',
    chipRgb: '84 190 172',
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

test("the editor is decoupled from the site's look: its own tokens and fonts", () => {
  assert.doesNotMatch(read('src/editor/ui-tokens.js'), /client\/styles|theme\//);
  const scss = read('src/editor/styles/editor.scss');
  assert.doesNotMatch(scss, /client\/styles|site-theme|theme\//);
  // every site token the editor once borrowed is its own now
  const v = tokensOf(editor);
  for (const k of ['--f-mono', '--f-display', '--ease-out', '--c-text', '--c-line', '--c-bg-site'])
    assert.ok(v(k), k);
  assert.match(read('src/editor/styles/_fonts.scss'), /url\('\.\.\/fonts\/dm-mono-400\.woff2'\)/);
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
