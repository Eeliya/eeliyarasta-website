import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropTarget } from '../src/editor/drag-target.js';

// two sections' widgets areas, 40px rows with 8px gaps, a card's gap of 200px between them
const row = (top) => ({ top, bottom: top + 40 });
const lists = [
  { at: 0, top: 100, bottom: 236, rows: [row(100), row(148), row(196)] },
  { at: 1, top: 436, bottom: 476, rows: [row(436)] },
  { at: 2, top: 676, bottom: 700, rows: [] }, // empty: its "No widgets yet."
];

test('drop target: its own place is no move', () => {
  assert.equal(dropTarget(lists, { at: 0, j: 1 }, 168), null); // on itself
  assert.equal(dropTarget(lists, { at: 0, j: 1 }, 140), null); // just above its middle
  assert.equal(dropTarget(lists, { at: 0, j: 1 }, 200), null); // just below the next row's top
  assert.equal(dropTarget(lists, { at: 1, j: 0 }, 456), null); // a section of one widget
});

test('drop target: within its section it reorders', () => {
  assert.deepEqual(dropTarget(lists, { at: 0, j: 0 }, 230), {
    at: 0,
    to: 2,
    line: { j: 2, side: 'after' },
  });
  assert.deepEqual(dropTarget(lists, { at: 0, j: 2 }, 104), {
    at: 0,
    to: 0,
    line: { j: 0, side: 'before' },
  });
});

test('drop target: another section only over its widgets', () => {
  assert.equal(dropTarget(lists, { at: 0, j: 0 }, 330), null); // between the cards
  assert.equal(dropTarget(lists, { at: 0, j: 0 }, 250), null); // past the slack
  assert.deepEqual(dropTarget(lists, { at: 0, j: 0 }, 470), {
    at: 1,
    to: 1,
    line: { j: 0, side: 'after' },
  });
  assert.deepEqual(dropTarget(lists, { at: 0, j: 0 }, 690), {
    at: 2,
    to: 0,
    line: { j: 0, side: 'before' },
  });
});
