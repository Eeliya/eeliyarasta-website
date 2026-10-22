/** Real rows: uniform rows per section, widgets spanning whole rows, free widgets (src/site/layout/flow.js). */
import { lay } from './test-layout.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRows, rowsFor } from '../src/site/layout/flow.js';
import { rowsOf } from '../src/site/layout/index.js';
import { createStore } from '../src/editor/store.js';
import { placeWidget, placeMobile, setSection } from '../src/editor/layout-ops.js';

const b = (id, col, span, row, rows, need) => ({ id, col, span, row, rows, need });

test('rowsFor: whole rows, a hair under a row still that row', () => {
  assert.equal(rowsFor(80, 8), 10);
  assert.equal(rowsFor(80.05, 8), 10);
  assert.equal(rowsFor(81, 8), 11);
  assert.equal(rowsFor(0, 8), 1);
  assert.equal(rowsFor(900, 8), 113);
});

test('resolveRows: nothing changes when every widget has the rows it needs', () => {
  const items = [b('a', 1, 12, 1, 10, 10), b('b', 13, 12, 1, 6, null), b('c', 1, 24, 12, 4, 4)];
  assert.deepEqual(resolveRows(items, 20), {
    rows: 20,
    at: { a: { row: 1, rows: 10 }, b: { row: 1, rows: 6 }, c: { row: 12, rows: 4 } },
  });
  assert.deepEqual(resolveRows([], 7), { rows: 7, at: {} });
});

test('resolveRows: free widgets stay where they are when a widget above them grows', () => {
  // a grows by 5: c and d (below it, free) stay; they overlap it now
  const items = [b('a', 1, 12, 1, 10, 15), b('c', 1, 12, 12, 4, 4), b('d', 1, 24, 20, 2, 2)];
  const { rows, at } = resolveRows(items, 21);
  assert.deepEqual(at.a, { row: 1, rows: 15 });
  assert.deepEqual(at.c, { row: 12, rows: 4 });
  assert.deepEqual(at.d, { row: 20, rows: 2 });
  assert.equal(rows, 21);
});

test('section rows: its lowest widget now, plus the empty rows it had below', () => {
  const grow = resolveRows([b('a', 1, 24, 1, 20, 30)], 24); // 4 empty rows below
  assert.equal(grow.rows, 34);
  const shrink = resolveRows([b('a', 1, 24, 1, 20, 12), b('c', 1, 24, 2, 4, 4)], 20);
  assert.equal(shrink.rows, 12);
});

test('sections count every widget by its stored rows (aspect and auto too)', () => {
  const wgt = (size, row, rows) => ({
    id: 'b-aaaa',
    type: 'text',
    size,
    layout: { base: { col: 1, span: 24, row, rows } },
  });
  assert.equal(rowsOf({ widgets: [wgt('auto', 3, 40)] }), 42);
  assert.equal(rowsOf({ widgets: [wgt('aspect', 1, 12)] }), 12);
  assert.equal(rowsOf({ rows: 30, widgets: [wgt('aspect', 1, 12)] }), 12); // an old count: ignored
  assert.equal(rowsOf({ widgets: [] }), 1);
});

test("a drag stores where the section's widgets are now (their real rows), one undo step", () => {
  const F = 'pages/t/index.json';
  const pos = (row, rows) => ({ col: 1, span: 24, row, rows });
  const page = {
    sections: [
      {
        id: 's-aaaa',
        widgets: [
          lay({ id: 'b-aaaa', type: 'text', pos: pos(1, 4) }),
          lay({ id: 'b-bbbb', type: 'text', size: 'rows', pos: pos(6, 4) }),
          lay({
            id: 'b-cccc',
            type: 'text',
            pos: pos(12, 2),
            phone: { col: 1, span: 12, row: 3, rows: 2 },
          }),
        ],
      },
    ],
  };
  const store = createStore();
  store.load({ [F]: structuredClone(page) });
  // where rows.js showed them (a needs 10 rows now); c is dragged to row 30
  const flow = { 'b-aaaa': pos(1, 10), 'b-bbbb': pos(12, 4), 'b-cccc': pos(18, 2) };
  placeWidget(store, F, 0, 2, pos(30, 2), undefined, { flow });
  const s = store.current[F].sections[0];
  assert.deepEqual(
    s.widgets.map((x) => [x.layout.base.row, x.layout.base.rows]),
    [
      [1, undefined], // auto: its row only (its rows are measured on the page)
      [12, 4],
      [30, undefined],
    ],
  );
  assert.equal(rowsOf(s), 30); // down to its lowest widget (no rows stored)
  assert.equal(s.rows, undefined);
  store.undo();
  assert.deepEqual(store.current[F], page);
  // on the phone: the other widgets' mobile rows
  placeMobile(
    store,
    F,
    0,
    1,
    { col: 1, span: 12, row: 1, rows: 3 },
    {
      flow: {
        'b-aaaa': { col: 1, span: 12, row: 1, rows: 9 },
        'b-cccc': { col: 1, span: 12, row: 7, rows: 3 },
      },
    },
  );
  // a widget with a phone area of its own stores its rows now; one without keeps none
  assert.deepEqual(store.current[F].sections[0].widgets[2].layout.phone, {
    col: 1,
    span: 12,
    row: 7,
  });
  assert.ok(!('phone' in store.current[F].sections[0].widgets[0].layout));
  // a section setting set and removed again
  setSection(store, F, 0, { name: 'Intro' });
  assert.equal(store.current[F].sections[0].name, 'Intro');
  setSection(store, F, 0, { name: undefined });
  assert.equal('name' in store.current[F].sections[0], false);
});
