// The CSS the editor injects into the preview (overlay.js's Shadow DOM, bridge.js's <style>)
// gets the editor's 4px-grid and text-colour rules too: Stylelint can't see it inside JS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import stylelint from 'stylelint';
import local from './stylelint-4px.mjs';

// a widget's border width: a label or box lines up with a 1.5px or 2px border on purpose
const BORDER = /left: -(1\.5|2)px/g;

function cssOf(file, name) {
  const src = readFileSync(file, 'utf8');
  const m = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(src);
  assert.ok(m, `${name} in ${file}`);
  return m[1].replace(/\$\{[^}]*\}/g, '0').replace(BORDER, 'left: 0');
}

for (const [file, name] of [
  ['src/editor/overlay.js', 'STYLE'],
  ['src/editor/bridge.js', 'INJECTED_CSS'],
])
  test(`injected CSS on the 4px grid, solid text colours: ${file}`, async () => {
    const { results } = await stylelint.lint({
      code: cssOf(file, name),
      config: {
        plugins: local,
        rules: { 'local/grid-4px': true, 'local/no-alpha-text-color': true },
      },
    });
    const problems = results[0].warnings.map((w) => `${w.line}: ${w.text}`);
    assert.deepEqual(problems, []);
  });
