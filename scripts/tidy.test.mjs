import { test } from 'node:test';
import assert from 'node:assert/strict';
import { omitDefaults, storedDefaults } from '../src/site/defaults.js';
import { checkContent } from '../src/site/validate.js';

const F = 'pages/x/index.json';

test('save tidies a page: no empty config or meta, an area without its defaults', () => {
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-t100',
    meta: {},
    sections: [
      {
        id: 's-t100',
        widgets: [
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
  const [a, b, c] = out.sections[0].widgets;
  assert.deepEqual(a, { id: 'b-t101', type: 'heading' });
  assert.deepEqual(b.layout, { base: { col: 13, row: 4 } });
  assert.deepEqual(c.layout, { base: { span: 60 }, phone: null });
  // tidied is valid, and the whole areas the editor keeps are too (not errors)
  assert.deepEqual(checkContent(F, out), []);
  assert.deepEqual(storedDefaults(F, page), []);
});

test('a [param] page: its main widget decides its pages; "template" and "grid" are gone', () => {
  const T = 'pages/people/[person]/index.json';
  const base = { version: 1, kind: 'page', id: 'pg-t110', sections: [] };
  const ok = { ...base, main: 'b-t111' };
  assert.deepEqual(checkContent(T, ok), []);
  assert.deepEqual(checkContent(T, { ...ok, grid: 120 }), [
    '"grid" must be left out: the page grid is always 120',
  ]);
  assert.deepEqual(checkContent(T, { ...base, template: { source: 'people' } }), [
    '"template" is gone: a [param] page\'s main widget decides its pages ("main")',
  ]);
  assert.deepEqual(checkContent('pages/people/index.json', { ...ok, id: 'pg-t112' }), [
    '"main" is only for [param] pages',
  ]);
});

test('changes: a layout value at its default is no change (a widget moved back)', async () => {
  const { createStore } = await import('../src/editor/store.js');
  const store = createStore();
  const F2 = 'pages/y/index.json';
  store.load({
    [F2]: {
      version: 1,
      kind: 'page',
      id: 'pg-t120',
      sections: [{ id: 's-t120', widgets: [{ id: 'b-t121', type: 'heading' }] }],
    },
  });
  const ptr = '/sections/0/widgets/0/layout';
  store.set(F2, ptr, { base: { col: 13, span: 108, row: 4 } });
  assert.deepEqual(store.dirtyFiles(), [F2]);
  assert.ok(store.changedAt(F2, `${ptr}/base/col`));
  store.set(F2, ptr, { base: { col: 1, span: 120, row: 1 } });
  assert.deepEqual(store.dirtyFiles(), []);
  assert.deepEqual(store.changes(F2), []);
  assert.ok(!store.changedAt(F2, `${ptr}/base/col`));
  assert.ok(!store.changedAt(F2, ptr));
});
