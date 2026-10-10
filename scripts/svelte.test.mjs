// Compiles every editor component and .svelte.js module the way the dev server does
// (vite.config.js + vite-plugin-svelte: runes mode, SCSS styles preprocessed, client output,
// dev mode, CSS emitted separately). `npm run build` skips the editor, so this is what
// catches a broken component before it reaches /edit/. Warnings fail too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compile, compileModule, preprocess } from 'svelte/compiler';
import * as sass from 'sass';

const files = (await readdir('src/editor', { recursive: true }))
  .filter((f) => /\.svelte(\.js)?$/.test(f))
  .map((f) => join('src/editor', f));

const scss = {
  style: ({ content, attributes }) =>
    attributes.lang === 'scss' ? { code: sass.compileString(content).css } : undefined,
};

const where = (e) => (e.start ? `:${e.start.line}:${e.start.column}` : '');

async function build(filename) {
  const source = await readFile(filename, 'utf8');
  const options = { filename, generate: 'client', dev: true, runes: true };
  if (filename.endsWith('.svelte.js')) return compileModule(source, options);
  const { code } = await preprocess(source, scss, { filename });
  return compile(code, { ...options, css: 'external' });
}

test('editor Svelte files compile (runes mode) without errors or warnings', async () => {
  assert.ok(files.length > 0, 'no editor Svelte files found');
  const problems = [];
  for (const file of files.sort()) {
    try {
      const { warnings } = await build(file);
      for (const w of warnings) problems.push(`${file}${where(w)} warning ${w.code}: ${w.message}`);
    } catch (e) {
      problems.push(`${file}${where(e)} ${e.code ?? 'error'}: ${e.message}`);
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});
