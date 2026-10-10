/** Real rows: uniform rows per section, blocks spanning whole rows (src/site/layout/flow.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowRows, rowsFor } from '../src/site/layout/flow.js';
import { rowsOf, sectionVars } from '../src/site/layout/index.js';
import { checkContent } from '../src/site/validate.js';
import { createStore } from '../src/editor/store.js';
import { placeBlock, placeMobile, setSection } from '../src/editor/layout-ops.js';

const b = (id, col, span, row, rows, need) => ({ id, col, span, row, rows, need });

test('rowsFor: whole rows, a hair under a row still that row', () => {
  assert.equal(rowsFor(80, 8), 10);
  assert.equal(rowsFor(80.05, 8), 10);
  assert.equal(rowsFor(81, 8), 11);
  assert.equal(rowsFor(0, 8), 1);
  assert.equal(rowsFor(900, 8), 113);
});

test('flowRows: nothing changes when every block has the rows it needs', () => {
  const items = [b('a', 1, 12, 1, 10, 10), b('b', 13, 12, 1, 6, null), b('c', 1, 24, 12, 4, 4)];
  assert.deepEqual(flowRows(items, 20), {
    rows: 20,
    at: { a: { row: 1, rows: 10 }, b: { row: 1, rows: 6 }, c: { row: 12, rows: 4 } },
  });
  assert.deepEqual(flowRows([], 7), { rows: 7, at: {} });
});

test('flowRows: a block that grows pushes the blocks below it in its columns', () => {
  // a grows by 5: c (below a) moves down 5 and d (below c) with it; b beside a stays
  const items = [
    b('a', 1, 12, 1, 10, 15),
    b('b', 13, 12, 1, 4, 4),
    b('c', 1, 12, 12, 4, 4),
    b('d', 1, 24, 20, 2, 2),
    b('e', 13, 12, 8, 2, 2),
  ];
  const { rows, at } = flowRows(items, 21);
  assert.deepEqual(at.a, { row: 1, rows: 15 });
  assert.deepEqual(at.b, { row: 1, rows: 4 });
  assert.deepEqual(at.e, { row: 8, rows: 2 }); // below b only
  assert.deepEqual(at.c, { row: 17, rows: 4 });
  assert.deepEqual(at.d, { row: 25, rows: 2 });
  assert.equal(rows, 26);
});

test('flowRows: a block that shrinks lets the blocks below up, unless another holds them', () => {
  const shrink = flowRows([b('a', 1, 24, 1, 20, 12), b('c', 1, 24, 22, 4, 4)], 30);
  assert.deepEqual(shrink.at.c, { row: 14, rows: 4 }); // the 1-row gap kept
  assert.equal(shrink.rows, 30 - 8); // the 4 empty rows below stay
  const held = flowRows(
    [b('a', 1, 12, 1, 20, 12), b('b', 13, 12, 1, 20, 20), b('c', 1, 24, 22, 4, 4)],
    25,
  );
  assert.deepEqual(held.at.c, { row: 22, rows: 4 });
  // the larger push wins
  const two = flowRows(
    [b('a', 1, 12, 1, 10, 13), b('b', 13, 12, 1, 10, 16), b('c', 1, 24, 11, 2, 2)],
    12,
  );
  assert.deepEqual(two.at.c, { row: 17, rows: 2 });
  assert.equal(two.rows, 18);
});

test('flowRows: overlapping blocks (not above one another) do not push', () => {
  const { at } = flowRows([b('photo', 1, 24, 1, 20, 30), b('title', 4, 10, 5, 3, 3)], 20);
  assert.deepEqual(at.title, { row: 5, rows: 3 });
});

test('row height: the old per-section rowHeight is ignored (a row is one square cell)', () => {
  assert.equal(sectionVars({ rows: 3, rowHeight: 12 }), sectionVars({ rows: 3 }));
  assert.doesNotMatch(sectionVars({ rows: 3, rowHeight: 12 }), /--grid-row|--cell/);
  const page = (s) => ({ sections: [{ id: 's-aaaa', blocks: [], ...s }] });
  const F = 'pages/t/index.json';
  for (const any of [16, 3, '8']) assert.deepEqual(checkContent(F, page({ rowHeight: any })), []);
});

test('sections count every block by its stored rows (aspect and auto too)', () => {
  const blk = (size, row, rows) => ({
    id: 'b-aaaa',
    type: 'text',
    size,
    pos: { col: 1, span: 24, row, rows },
  });
  assert.equal(rowsOf({ rows: 1, blocks: [blk('auto', 3, 40)] }), 42);
  assert.equal(rowsOf({ rows: 1, blocks: [blk('aspect', 1, 12)] }), 12);
});

test("a drag stores where the section's blocks are now (their real rows), one undo step", () => {
  const F = 'pages/t/index.json';
  const pos = (row, rows) => ({ col: 1, span: 24, row, rows });
  const page = {
    sections: [
      {
        id: 's-aaaa',
        rows: 20,
        blocks: [
          { id: 'b-aaaa', type: 'text', size: 'auto', pos: pos(1, 4) },
          { id: 'b-bbbb', type: 'text', pos: pos(6, 4) },
          {
            id: 'b-cccc',
            type: 'text',
            pos: pos(12, 2),
            mobile: { col: 1, span: 12, row: 3, rows: 2 },
          },
        ],
      },
    ],
  };
  const store = createStore();
  store.load({ [F]: structuredClone(page) });
  // a needs 10 rows now, so b and c were pushed down 6; c is dragged to row 30
  const flow = { 'b-aaaa': pos(1, 10), 'b-bbbb': pos(12, 4), 'b-cccc': pos(18, 2) };
  placeBlock(store, F, 0, 2, pos(30, 2), undefined, { flow, rows: 26 });
  const s = store.current[F].sections[0];
  assert.deepEqual(
    s.blocks.map((x) => [x.pos.row, x.pos.rows]),
    [
      [1, 10],
      [12, 4],
      [30, 2],
    ],
  );
  assert.equal(s.rows, 31);
  store.undo();
  assert.deepEqual(store.current[F], page);
  // on the phone: the other blocks' mobile rows
  placeMobile(
    store,
    F,
    0,
    1,
    { col: 1, span: 12, row: 1, rows: 3 },
    {
      flow: { 'b-cccc': { col: 1, span: 12, row: 7, rows: 3 } },
    },
  );
  assert.deepEqual(store.current[F].sections[0].blocks[2].mobile, {
    col: 1,
    span: 12,
    row: 7,
    rows: 3,
  });
  // a section setting set and removed again
  setSection(store, F, 0, { rowHeight: 12 });
  assert.equal(store.current[F].sections[0].rowHeight, 12);
  setSection(store, F, 0, { rowHeight: undefined });
  assert.equal('rowHeight' in store.current[F].sections[0], false);
});
