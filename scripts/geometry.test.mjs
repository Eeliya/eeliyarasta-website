/**
 * Layout geometry: resolveRows' edge cases, the phone grid's halving, and the pure parts of
 * the site's rows.js and the editor's overlay (fake elements: no browser).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRows } from '../src/site/layout/flow.js';
import { halfArea, phoneAreaOf } from '../src/site/layout/grid.js';
import { linkOf } from '../src/site/layout/links.js';
import {
  areaOfEl as areaOf,
  halfArea as halfAreaG,
  phoneAreaOf as phoneAreaOfG,
  flowAreas,
  linesOf,
  linkOfEl,
  nearest,
  parseLink,
  rectOf,
  tracksOf,
  widthOf,
} from '../src/site/layout/geometry.js';

const it = (id, row, rows, need = null, link = null) => ({ id, row, rows, need, link });
const style = (vars) => ({ getPropertyValue: (k) => (k in vars ? String(vars[k]) : '') });
const el = ({ vars = {}, dataset = {}, rect, sec } = {}) => ({
  style: style(vars),
  dataset,
  getBoundingClientRect: () => rect,
  closest: () => sec,
});

test('resolveRows: loops of two and three, and a self link, count as free (and end)', () => {
  const two = resolveRows(
    [it('a', 1, 2, null, { to: 'b', gap: 0 }), it('b', 5, 2, null, { to: 'a', gap: 0 })],
    6,
  );
  // a is placed first: it waits for b, whose leader a is busy, so b is free; a follows b
  assert.deepEqual(two.at, { a: { row: 7, rows: 2 }, b: { row: 5, rows: 2 } });
  assert.equal(two.rows, 8);
  const three = resolveRows(
    [
      it('a', 1, 1, null, { to: 'c', gap: 1 }),
      it('b', 3, 1, null, { to: 'a', gap: 1 }),
      it('c', 5, 1, null, { to: 'b', gap: 1 }),
    ],
    5,
  );
  assert.deepEqual(three.at, {
    a: { row: 7, rows: 1 },
    b: { row: 3, rows: 1 },
    c: { row: 5, rows: 1 },
  });
  const self = resolveRows([it('a', 4, 2, null, { to: 'a', gap: 3 })], 5);
  assert.deepEqual(self, { rows: 5, at: { a: { row: 4, rows: 2 } } });
  // a missing leader: free
  assert.deepEqual(resolveRows([it('a', 3, 2, null, { to: 'zz', gap: 1 })], 4).at.a, {
    row: 3,
    rows: 2,
  });
});

test('resolveRows: negative gaps overlap the leader, never above row 1; no gap is 0', () => {
  const r = resolveRows([it('a', 1, 4), it('b', 9, 2, null, { to: 'a', gap: -2 })], 10);
  assert.deepEqual(r.at.b, { row: 3, rows: 2 });
  const top = resolveRows([it('a', 1, 2), it('b', 9, 2, null, { to: 'a', gap: -9 })], 10);
  assert.deepEqual(top.at.b, { row: 1, rows: 2 });
  const none = resolveRows([it('a', 1, 2), it('b', 9, 2, null, { to: 'a' })], 10);
  assert.deepEqual(none.at.b, { row: 3, rows: 2 });
  const odd = resolveRows([it('a', 1, 2), it('b', 9, 2, null, { to: 'a', gap: 1.5 })], 10);
  assert.deepEqual(odd.at.b, { row: 3, rows: 2 }); // not a whole number: 0
});

test('resolveRows: empty sections keep their rows (at least 1)', () => {
  assert.deepEqual(resolveRows([], 7), { rows: 7, at: {} });
  assert.deepEqual(resolveRows([], 0), { rows: 1, at: {} });
  assert.deepEqual(resolveRows([]), { rows: 1, at: {} });
});

test('resolveRows: linked chains follow a grown leader; the section keeps its empty rows below', () => {
  const r = resolveRows(
    [
      it('a', 1, 4, 10),
      it('b', 6, 3, null, { to: 'a', gap: 1 }),
      it('c', 10, 2, 5, { to: 'b', gap: 0 }),
    ],
    14,
  );
  assert.deepEqual(r.at, {
    a: { row: 1, rows: 10 },
    b: { row: 12, rows: 3 },
    c: { row: 15, rows: 5 },
  });
  assert.equal(r.rows, 19 + (14 - 11)); // lowest now 19, 3 empty rows were below the stored 11
  // a need that isn't a positive whole number: the stored rows
  assert.deepEqual(resolveRows([it('a', 2, 3, 0), it('b', 2, 3, 2.5)], 1).at, {
    a: { row: 2, rows: 3 },
    b: { row: 2, rows: 3 },
  });
});

test('phone grid: 60 columns, desktop areas halved to the cells they cover, links with half gaps', () => {
  assert.deepEqual(halfArea({ col: 2, span: 3, row: 2, rows: 3 }), {
    col: 1,
    span: 2,
    row: 1,
    rows: 2,
  });
  assert.deepEqual(halfArea({ col: 120, span: 1, row: 7, rows: 1 }), {
    col: 60,
    span: 1,
    row: 4,
    rows: 1,
  });
  const b = {
    layout: { base: { col: 31, span: 60, row: 11, rows: 8, link: { to: 'x', gap: 3 } } },
  };
  assert.deepEqual(phoneAreaOf(b), { col: 16, span: 30, row: 6, rows: 4 });
  assert.deepEqual(linkOf(b, true), { to: 'x', gap: 2 });
  assert.deepEqual(linkOf({ layout: { base: { link: { to: 'x', gap: -3 } } } }, true), {
    to: 'x',
    gap: -2,
  });
  const own = {
    layout: { base: { col: 1, span: 120, row: 1 }, phone: { col: 5, span: 70, row: 2 } },
  };
  assert.deepEqual(phoneAreaOf(own), { col: 5, span: 56, row: 2, rows: 1 }); // cut at column 60
  assert.equal(linkOf(own, true), null); // its own phone area: its own (no) link
});

test("rows.js: a block element's stored area and link on each grid", () => {
  const e = el({
    vars: { '--c': 3, '--s': 10, '--r': 5, '--rs': 20, '--mc': 2, '--ms': 5, '--mr': 3 },
    dataset: { link: 'b-aaaa 2', mlink: 'b-bbbb -1' },
  });
  assert.deepEqual(areaOf(e, false), { col: 3, span: 10, row: 5, rows: 20 });
  assert.deepEqual(areaOf(e, true), { col: 2, span: 5, row: 3, rows: 1 });
  assert.deepEqual(areaOf(el(), false), { col: 1, span: 120, row: 1, rows: 1 });
  assert.deepEqual(areaOf(el(), true), { col: 1, span: 60, row: 1, rows: 1 });
  assert.deepEqual(areaOf(el({ vars: { '--c': 0, '--s': -2, '--r': 'x' } }), false), {
    col: 1,
    span: 120,
    row: 1,
    rows: 1,
  });
  assert.deepEqual(linkOfEl(e, false), { to: 'b-aaaa', gap: 2 });
  assert.deepEqual(linkOfEl(e, true), { to: 'b-bbbb', gap: -1 });
  for (const v of [undefined, '', 'b-aaaa', 'b-aaaa 1.5', 'a b 2'])
    assert.equal(linkOfEl(el({ dataset: { link: v } }), false), null, String(v));
});

test("rows.js: a section's content width (border-box minus padding and border)", () => {
  const cs = (boxSizing) => ({
    width: '1000px',
    boxSizing,
    paddingLeft: '20px',
    paddingRight: '30px',
    borderLeftWidth: '1px',
    borderRightWidth: '2px',
  });
  assert.equal(widthOf(cs('border-box')), 947);
  assert.equal(widthOf(cs('content-box')), 1000);
  assert.equal(widthOf({ width: 'auto' }), 0);
});

const win = (cs) => ({ scrollX: 10, scrollY: 100, getComputedStyle: () => cs });
const gridCs = (more = {}) => ({
  gridTemplateColumns: '10px 10px 10px',
  gridTemplateRows: '10px 10px',
  paddingLeft: '5px',
  paddingRight: '5px',
  paddingTop: '0px',
  paddingBottom: '0px',
  borderLeftWidth: '0px',
  borderRightWidth: '0px',
  borderTopWidth: '0px',
  borderBottomWidth: '0px',
  columnGap: '0px',
  rowGap: '0px',
  justifyContent: 'normal',
  alignContent: 'normal',
  getPropertyValue: (k) => (k === '--cell' ? '10px' : ''),
  ...more,
});

test('overlay: rects in page coordinates, tracks moved by the free space before them', () => {
  assert.deepEqual(rectOf(el({ rect: { left: 1, top: 2, width: 3, height: 4 } }), win({})), {
    x: 11,
    y: 102,
    w: 3,
    h: 4,
  });
  const r = { w: 100, h: 50 };
  assert.deepEqual(tracksOf(gridCs(), r), {
    x: 5,
    y: 0,
    w: 30,
    h: 20,
    cols: [10, 10, 10],
    rows: [10, 10],
  });
  const c = tracksOf(gridCs({ justifyContent: 'center', alignContent: 'end' }), r);
  assert.deepEqual([c.x, c.y], [5 + 30, 30]); // (100 - 10 - 30) / 2; 50 - 20
  const g = tracksOf(gridCs({ columnGap: '2px', justifyContent: 'safe center' }), r);
  assert.deepEqual([g.x, g.w], [5 + 28, 34]);
});

test('overlay: grid lines and the nearest line, past the end in row steps', () => {
  const sec = el({ rect: { left: 0, top: 0, width: 100, height: 50 } });
  const l = linesOf(sec, win(gridCs()));
  assert.deepEqual(l.cols, { starts: [15, 25, 35], ends: [25, 35, 45] });
  assert.deepEqual(l.rows, { starts: [100, 110], ends: [110, 120] });
  assert.equal(l.row, 10);
  assert.equal(l.rowGap, 0);
  assert.equal(linesOf(sec, win(gridCs({ getPropertyValue: () => '' }))).row, 8); // no --cell yet
  assert.equal(nearest([0, 10, 20], 4), 1);
  assert.equal(nearest([0, 10, 20], 6), 2);
  assert.equal(nearest([0, 10, 20], 5), 1); // a tie: the first
  assert.equal(nearest([0, 10, 20], 24, 10), 3);
  assert.equal(nearest([0, 10, 20], 26, 10), 4);
  assert.equal(nearest([0, 10, 20], 41, 10), 5);
  assert.equal(nearest([0, 10, 20], 99), 3); // no step: the last
});

test('overlay: where blocks are now, the real rows over the stored area (own section only)', () => {
  const sec = { id: 'sec' };
  const blocks = {
    a: { id: 'a', layout: { base: { col: 1, span: 60, row: 2, rows: 4 } } },
    b: { id: 'b', layout: { base: { col: 61, span: 60, row: 1, rows: 6 } } },
  };
  const els = [
    el({ dataset: { block: 'a' }, vars: { '--fr': 3, '--frs': 9 }, sec }),
    el({ dataset: { block: 'b' }, vars: { '--fr': 2 }, sec }), // no --frs: stored
    el({ dataset: { block: 'zz' }, sec }), // not a stored block
    el({ dataset: { block: 'c' }, sec: { id: 'nested' } }),
  ];
  sec.querySelectorAll = () => els;
  const blockOf = (id) => blocks[id] || (id === 'c' ? { layout: {} } : null);
  assert.deepEqual(flowAreas(sec, false, blockOf), {
    a: { col: 1, span: 60, row: 3, rows: 9 },
    b: { col: 61, span: 60, row: 1, rows: 6 },
  });
  assert.deepEqual(flowAreas(sec, true, blockOf), {
    a: { col: 1, span: 30, row: 3, rows: 9 },
    b: { col: 31, span: 30, row: 1, rows: 3 },
  });
});

test('geometry: one link parse; grid helpers re-exported as they are', () => {
  assert.deepEqual(parseLink('b-1 -3'), { to: 'b-1', gap: -3 });
  assert.deepEqual(parseLink('b-1   4'), { to: 'b-1', gap: 4 });
  for (const v of ['', undefined, 'b-1', 'b-1 x', 'b-1 1.5', ' b-1 2'])
    assert.equal(parseLink(v), null);
  assert.equal(halfAreaG, halfArea);
  assert.equal(phoneAreaOfG, phoneAreaOf);
});
