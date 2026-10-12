import { test } from 'node:test';
import assert from 'node:assert/strict';
import { omitDefaults, storedDefaults } from '../src/site/defaults.js';
import { checkContent } from '../src/site/validate.js';

const F = 'pages/x/index.json';

test('save tidies a page: no empty config or meta, an area without its defaults', () => {
  const page = {
    version: 1,
    id: 'pg-t100',
    meta: {},
    sections: [
      {
        id: 's-t100',
        blocks: [
          {
            id: 'b-t101',
            type: 'heading',
            config: {},
            layout: { base: { col: 1, span: 120, row: 1 } },
          },
          { id: 'b-t102', type: 'heading', layout: { base: { col: 13, span: 108, row: 4 } } },
          {
            id: 'b-t103',
            type: 'heading',
            layout: { base: { col: 1, span: 60, row: 1 }, phone: null },
          },
        ],
      },
    ],
  };
  const out = omitDefaults(F, page);
  assert.equal(out.meta, undefined);
  const [a, b, c] = out.sections[0].blocks;
  assert.deepEqual(a, { id: 'b-t101', type: 'heading' });
  assert.deepEqual(b.layout, { base: { col: 13, row: 4 } });
  assert.deepEqual(c.layout, { base: { span: 60 }, phone: null });
  // tidied is valid, and the whole areas the editor keeps are too (not errors)
  assert.deepEqual(checkContent(F, out), []);
  assert.deepEqual(storedDefaults(F, page), []);
});

test('a [slug] page: its labels in "template"; "grid" and top-level labels are gone', () => {
  const T = 'pages/people/[slug].json';
  const base = { version: 1, id: 'pg-t110', sections: [] };
  const ok = { ...base, template: { source: 'people', section: 'People', next: 'Next person' } };
  assert.deepEqual(checkContent(T, ok), []);
  assert.deepEqual(checkContent(T, { ...ok, grid: 120 }), [
    '"grid" must be left out: the page grid is always 120',
  ]);
  assert.deepEqual(checkContent(T, { ...ok, next: 'Next' }), [
    '"next" must be left out: it is "template.next"',
  ]);
  assert.deepEqual(checkContent(T, { ...base, template: { source: 'people', back: 'x' } }), [
    '"template" has only "source", "section" and "next"',
  ]);
});
