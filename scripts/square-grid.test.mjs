/** The square grid (exp/square-grid-100): 120 columns, rows one cell, the migration from 24. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, MCOLS, cellOf, newBlock, placeOf } from '../src/site/layout/index.js';
import {
  cellAt,
  convertArea,
  convertRows,
  migratePage,
  migrateSection,
} from './migrate-square-grid.mjs';
import { checkContent } from '../src/site/validate.js';

test('grid: 120 columns, 24 on the phone; new blocks full width', () => {
  assert.equal(COLS, 120);
  assert.equal(MCOLS, 24);
  assert.deepEqual(placeOf({}), { col: 1, span: 120, row: 1, rows: 1 });
  assert.deepEqual(newBlock('text', new Set()).pos, { col: 1, span: 120, row: 1, rows: 8 });
});

test('cellOf: width over the columns, floored to 1/64px, never wider than the width', () => {
  assert.equal(cellOf(1200), 10);
  assert.equal(cellOf(1365.12), 11.375); // 1440 wide, contained
  assert.equal(cellOf(358, MCOLS), 14.90625); // 390 wide phone
  assert.equal(cellOf(0), 0);
  for (const w of [1440, 1365.12, 1100, 1042.8, 800, 758.4, 358, 390, 333.3]) {
    const c = cellOf(w);
    assert.equal((c * 64) % 1, 0, `${w}: a whole number of 1/64px`);
    assert.ok(c * COLS <= w && w - c * COLS < COLS / 64, `${w}: fits, under 2px left over`);
  }
});

test('migration: columns ×5 (phone ×2), rows by their px edges at 1440', () => {
  const cell = cellAt(1440, false, COLS);
  assert.equal(cell, 11.375);
  assert.equal(cellAt(1440, true, COLS), 12);
  assert.deepEqual(convertRows({ row: 1, rows: 25 }, 8, cell), { row: 1, rows: 18 });
  assert.deepEqual(convertRows({ row: 11, rows: 1 }, 8, cell), { row: 8, rows: 1 }); // >= 1
  assert.deepEqual(convertArea({ col: 13, span: 12, row: 1, rows: 1 }, 24, 120, 8, cell), {
    col: 61,
    span: 60,
    row: 1,
    rows: 1,
  });
  const s = migrateSection({
    id: 's-aaaa',
    rows: 25,
    rowHeight: 16,
    width: 'contained',
    blocks: [
      {
        id: 'b-aaaa',
        type: 'text',
        pos: { col: 1, span: 24, row: 1, rows: 25 },
        mobile: { col: 7, span: 6, row: 1, rows: 10 },
      },
    ],
  });
  assert.ok(!('rowHeight' in s));
  assert.deepEqual(s.blocks[0].pos, { col: 1, span: 120, row: 1, rows: 35 }); // 400px / 11.375
  assert.deepEqual(s.blocks[0].mobile, { col: 13, span: 12, row: 1, rows: 11 }); // 160px / 14.9
  assert.equal(s.rows, 35);
  const page = { sections: [s] };
  assert.equal(migratePage(page), page); // already migrated: left alone
  assert.deepEqual(checkContent('pages/t/index.json', page), []);
});
