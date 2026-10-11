/** Phase 3 of the layout engine: block sizes, placements, the phone grid and phone spacing. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../src/site/validate.js';
import {
  MCOLS,
  PLACES,
  blockClass,
  blockVars,
  halfArea,
  mobileRowsOf,
  phoneAreaOf,
  ratioOf,
  rowsOf,
  sectionClass,
  sectionVars,
} from '../src/site/layout/index.js';
import { createStore } from '../src/editor/store.js';
import { migratePage as migrateSections } from './migrate-sections.mjs';
import {
  placeMobile,
  placeOnPhone,
  resetMobile,
  setBlock,
  setSection,
} from '../src/editor/layout-ops.js';
import { migratePage, phoneSpacingOf, withPhoneSpacing } from './migrate-layout.mjs';

const F = 'pages/test/index.json';
const pos = { col: 3, span: 10, row: 5, rows: 20 };
const blk = (more = {}) => ({ id: 'b-aaaa', type: 'text', pos, ...more });
const sec = (blocks, more = {}) => ({ id: 's-aaaa', blocks, ...more });

test('ratios: "w:h" with positive numbers', () => {
  assert.deepEqual(ratioOf('16:9'), [16, 9]);
  assert.deepEqual(ratioOf(' 2.39:1 '), [2.39, 1]);
  for (const bad of ['16/9', '0:1', '1:', 'wide', undefined, 3]) assert.equal(ratioOf(bad), null);
});

const HALF = ';--mc:2;--ms:5;--mr:3;--mrs:10'; // pos halved onto the phone grid

test('sizes: auto by default; every block spans its stored rows (rows.js works out what it needs)', () => {
  assert.equal(blockClass(blk()), 'blk blk--text blk--auto');
  assert.equal(blockVars(blk()), '--c:3;--s:10;--r:5;--rs:20' + HALF);
  const aspect = blk({ size: 'aspect', aspect: '4:5' });
  assert.equal(blockClass(aspect), 'blk blk--text blk--aspect');
  assert.equal(blockVars(aspect), '--c:3;--s:10;--r:5;--rs:20;--ar:4 / 5' + HALF);
  // no valid ratio: sized by its content
  assert.equal(blockClass(blk({ size: 'aspect', aspect: 'x' })), 'blk blk--text blk--auto');
  assert.equal(blockClass(blk({ size: 'rows' })), 'blk blk--text'); // fixed rows
  assert.equal(blockClass(blk({ size: 'huge' })), 'blk blk--text blk--auto'); // unknown: auto
  assert.equal(rowsOf(sec([aspect], { rows: 1 })), 24);
  assert.equal(rowsOf(sec([blk()], { rows: 1 })), 24);
});

test('placements: classes per kind and corner, the phone ones prefixed m-', () => {
  const cls = (place, mobile) =>
    blockClass(blk({ place, mobile })).replace('blk blk--text blk--auto', '');
  assert.equal(cls('none'), '');
  assert.equal(cls('wobbly'), '');
  assert.equal(cls('sticky-top-left'), ' blk--sticky blk--v-top blk--h-left');
  assert.equal(cls('sticky-center'), ' blk--sticky blk--v-center blk--h-center');
  assert.equal(cls('fixed-bottom-center'), ' blk--fixed blk--v-bottom blk--h-center');
  assert.equal(cls('fullscreen'), ' blk--full');
  assert.equal(cls('pinned'), ' blk--pinned');
  assert.equal(cls(undefined, { place: 'pinned' }), ' blk--m-pinned');
  assert.equal(
    cls('sticky-top-right', { place: 'fixed-top-right' }),
    ' blk--sticky blk--v-top blk--h-right blk--m-fixed blk--m-v-top blk--m-h-right',
  );
  assert.equal(PLACES.length, 1 + 7 + 7 + 2);
});

test('phone grid: 60 columns; a block without a phone area shows its desktop area halved', () => {
  const placed = blk({ mobile: { col: 55, span: 9, row: 3, rows: 4 } }); // span cut at column 60
  assert.equal(blockVars(placed), '--c:3;--s:10;--r:5;--rs:20;--mc:55;--ms:6;--mr:3;--mrs:4');
  const s = sec([placed, { ...blk(), id: 'b-bbbb' }]);
  assert.equal(mobileRowsOf(s), 12); // b-bbbb halved: rows 3-12
  assert.match(sectionVars(s), /;--mrows:12$/);
  assert.equal(sectionClass(s), 'sec'); // nothing stacks
  // a placement alone: the halved area
  const only = sec([blk({ mobile: { place: 'sticky-top-left' } })]);
  assert.match(blockVars(only.blocks[0]), new RegExp(`${HALF}$`));
  assert.equal(phoneAreaOf(only.blocks[0]).span, 5);
  // halving: the cells it covers (first rounded down, last up), at least one
  assert.deepEqual(halfArea({ col: 1, span: 120, row: 1, rows: 9 }), {
    col: 1,
    span: 60,
    row: 1,
    rows: 5,
  });
  assert.deepEqual(halfArea({ col: 61, span: 60, row: 11, rows: 1 }), {
    col: 31,
    span: 30,
    row: 6,
    rows: 1,
  });
  assert.deepEqual(halfArea({ col: 2, span: 1, row: 2, rows: 1 }), {
    col: 1,
    span: 1,
    row: 1,
    rows: 1,
  });
  assert.equal(MCOLS, 60);
});

test('sections: Rows or Fullscreen; no aspect, no space above / below', () => {
  const s = sec([], { height: 'screen', align: 'bottom' });
  assert.equal(sectionClass(s), 'sec sec--screen sec--bottom');
  assert.equal(sectionVars(s), '--rows:1;--mrows:1');
  // an old aspect section (not migrated yet) renders as Rows; spacing is ignored
  const old = sec([], { height: 'aspect', aspect: '21:9', spacing: { top: 4 } });
  assert.equal(sectionClass(old), 'sec');
  assert.equal(sectionVars(old), '--rows:1;--mrows:1');
});

test('migrate-sections: aspect -> Rows, space above / below dropped (phone too); once', () => {
  const s = sec([], {
    height: 'aspect',
    aspect: '16:9',
    align: 'bottom',
    spacing: { top: 4, bottom: 2 },
    mobile: { spacing: { top: 1 } },
  });
  const page = { curtain: 'x', sections: [s, sec([], { id: 's-bbbb', height: 'screen' })] };
  const next = migrateSections(page);
  const { id: _id, ...rest } = next.sections[0]; // eslint-disable-line no-unused-vars
  assert.deepEqual(rest, { height: 'auto', align: 'bottom', blocks: [] });
  assert.equal(next.sections[1], page.sections[1]); // nothing to change: the same object
  assert.equal(next.curtain, 'x');
  assert.equal(migrateSections(next), next);
  assert.deepEqual(checkContent(F, next), []);
});

test('validation: size, aspect, place, mobile; no section aspect or spacing', () => {
  const one = (b) => checkContent(F, { sections: [sec([blk(b)])] });
  const of = (s) => checkContent(F, { sections: [sec([], s)] });
  assert.deepEqual(
    one({
      size: 'aspect',
      aspect: '4:5',
      place: 'pinned',
      mobile: { col: 1, span: 12, row: 1, rows: 3, place: 'fixed-top-left' },
    }),
    [],
  );
  assert.deepEqual(one({ mobile: { place: 'sticky-center' } }), []);
  const where = 'section 1, block 1 (Text)';
  assert.deepEqual(one({ size: 'big' }), [`${where}: "size" must be auto, aspect, rows`]);
  assert.deepEqual(one({ size: 'aspect' }), [`${where}: "aspect" must be a ratio like "4:5"`]);
  assert.deepEqual(one({ place: 'sticky' }), [
    `${where}: "place" must be a placement (see layout)`,
  ]);
  assert.deepEqual(one({ mobile: { place: 'up' } }), [
    `${where}: "mobile.place" must be a placement (see layout)`,
  ]);
  assert.deepEqual(one({ mobile: { col: 56, span: 6, row: 1, rows: 1 } }), [
    `${where}: "mobile" must end by column 60 (col 56 + span 6)`,
  ]);
  assert.match(one({ mobile: { col: 1 } })[0], /"mobile.span" must be a whole number/);
  const gone = (k) =>
    `section 1: "${k}" is no longer a section setting (node scripts/migrate-sections.mjs)`;
  assert.deepEqual(of({ height: 'screen' }), []);
  assert.deepEqual(of({ height: 'aspect', aspect: '16:9', mobile: { spacing: { top: 3 } } }), [
    'section 1: "height" must be one of auto, screen',
    gone('aspect'),
    gone('mobile'),
  ]);
  assert.deepEqual(of({ spacing: { top: 1 } }), [gone('spacing')]);
});

test('ops: block settings, a phone area of its own, phone placement, reset; one undo each', () => {
  const store = createStore();
  const a = { id: 'b-aaaa', type: 'text', pos: { col: 1, span: 24, row: 1, rows: 10 } };
  const b = { id: 'b-bbbb', type: 'text', pos: { col: 1, span: 24, row: 11, rows: 10 } };
  store.load({ [F]: { sections: [sec([a, b])] } });
  const blocks = () => store.current[F].sections[0].blocks;

  setBlock(store, F, 0, 0, { size: 'aspect', aspect: '3:2', place: 'sticky-center' });
  assert.deepEqual(
    [blocks()[0].size, blocks()[0].aspect, blocks()[0].place],
    ['aspect', '3:2', 'sticky-center'],
  );
  setBlock(store, F, 0, 0, { size: undefined, aspect: undefined });
  assert.ok(!('size' in blocks()[0]) && !('aspect' in blocks()[0]));

  // a move on the phone: its own phone area; the others keep showing their desktop halved
  placeMobile(store, F, 0, 1, { col: 49, span: 20, row: 1, rows: 10 });
  assert.deepEqual(blocks()[1].mobile, { col: 49, span: 12, row: 1, rows: 10 });
  assert.ok(!('mobile' in blocks()[0]));
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 2, rows: 5 });
  assert.deepEqual(blocks()[0].pos, a.pos); // the desktop is untouched
  placeOnPhone(store, F, 0, 0, 'pinned');
  assert.equal(blocks()[0].mobile.place, 'pinned');
  placeOnPhone(store, F, 0, 0, 'none');
  assert.ok(!('place' in blocks()[0].mobile));

  assert.equal(resetMobile(store, F, 0), true);
  assert.ok(blocks().every((x) => !('mobile' in x)));
  assert.equal(resetMobile(store, F, 0), false); // nothing to reset
  store.undo();
  assert.ok(blocks().every((x) => x.mobile));

  setSection(store, F, 0, { height: 'aspect', aspect: '16:9' });
  setSection(store, F, 0, { height: 'auto', aspect: undefined });
  assert.ok(!('aspect' in store.current[F].sections[0]));
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('migration: phone spacing from the old phone paddings, once', () => {
  assert.deepEqual(phoneSpacingOf({ type: 'intro' }), { top: 15, bottom: 15 });
  assert.deepEqual(phoneSpacingOf({ type: 'heading', title: 'x' }), { top: 16, bottom: 8 });
  assert.equal(phoneSpacingOf({ type: 'hero' }), null);
  assert.equal(phoneSpacingOf({ type: 'heading', config: { center: true } }), null);
  assert.deepEqual(phoneSpacingOf({ type: 'projects' }), { top: 0, bottom: 13 });
  const old = sec([blk({ type: 'about' })], { spacing: { top: 21, bottom: 16 } });
  assert.deepEqual(withPhoneSpacing(old).mobile, { spacing: { top: 12, bottom: 15 } });
  const edited = { ...old, spacing: { top: 20, bottom: 16 } };
  assert.equal(withPhoneSpacing(edited), edited); // changed since: left alone
  const page = { sections: [old] };
  const next = migratePage(page);
  assert.notEqual(next, page);
  assert.equal(migratePage(next), next);
  // migrating old content adds it too
  const fresh = migratePage({ sections: [{ type: 'grid', config: {} }] });
  assert.deepEqual(fresh.sections[0].mobile, { spacing: { top: 11, bottom: 13 } });
});
