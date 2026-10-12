/** Phase 3 of the layout engine: block sizes, placements, the phone grid. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../src/site/validate.js';
import {
  HEIGHTS,
  MCOLS,
  PLACES,
  anchorOf,
  blockClass,
  blockVars,
  halfArea,
  mobileRowsOf,
  nameProblems,
  phoneAreaOf,
  ratioOf,
  rowsOf,
  phoneHeightOf,
  sectionAnchor,
  sectionClass,
  sectionVars,
} from '../src/site/layout/index.js';
import { createStore } from '../src/editor/store.js';
import {
  placeBlock,
  placeMobile,
  placeOnPhone,
  resetMobile,
  setBlock,
  setPhoneHeight,
  setSection,
  setSectionRows,
} from '../src/editor/layout-ops.js';

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

test('sections: a minimum height (fit, 1/3, 1/2, full screen), content always centred', () => {
  assert.deepEqual(HEIGHTS, ['custom', 'fit', 'third', 'half', 'full']);
  const cls = (more) => sectionClass(sec([], more));
  assert.equal(cls({}), 'sec'); // fit (the default): its rows
  assert.equal(cls({ height: 'fit' }), 'sec');
  assert.equal(cls({ height: 'third' }), 'sec sec--h-third');
  assert.equal(cls({ height: 'half', width: 'full' }), 'sec sec--h-half sec--full');
  assert.equal(cls({ height: 'full' }), 'sec sec--h-full');
  // custom: at least rows.min square cells (phones: half, rounded up), only with its rows
  const custom = sec([], { height: 'custom', rows: { min: 41 } });
  assert.equal(sectionClass(custom), 'sec sec--h-custom');
  assert.equal(sectionVars(custom), '--rows:41;--mrows:21;--minrows:41;--mminrows:21');
  // never shorter than its content: a block reaching row 60 makes it 60 rows
  const deep = [blk({ pos: { col: 1, span: 10, row: 51, rows: 10 } })];
  assert.equal(
    sectionVars(sec(deep, { height: 'custom', rows: { min: 41 } })),
    '--rows:60;--mrows:30;--minrows:41;--mminrows:21',
  );
  assert.equal(cls({ height: 'custom' }), 'sec'); // no rows: as fit
  assert.equal(sectionVars(sec([], { height: 'fit', rows: { min: 9 } })), '--rows:1;--mrows:1');
  const of = (more) => checkContent(F, { version: 1, sections: [sec([], more)] });
  assert.deepEqual(of({ height: 'custom', rows: { min: 30 } }), []);
  assert.deepEqual(of({ height: 'custom' }), [
    'section 1: "rows.min" must be a whole number of rows from 1 (a custom height)',
  ]);
  assert.deepEqual(of({ height: 'custom', rows: { min: 1000 } }), [
    'section 1: "rows.min" must be a whole number of rows from 1 to 999',
  ]);
  assert.deepEqual(of({ height: 'half', rows: { min: 8 } }), [
    'section 1: "rows" must be left out unless the height is custom',
  ]);
  // an unknown height renders as fit; keys sections no longer have are ignored
  const old = sec([], { height: 'screen', align: 'bottom', rows: 9, spacing: { top: 4 } });
  assert.equal(sectionClass(old), 'sec');
  assert.equal(sectionVars(old), '--rows:1;--mrows:1');
  // its rows: down to its lowest block
  const blocks = [blk({ pos: { col: 1, span: 10, row: 3, rows: 5 } })];
  assert.equal(sectionVars(sec(blocks, { rows: 20 })), '--rows:7;--mrows:4');
});

test('section names: an anchor (id) from the name, unique on the page, a letter first', () => {
  assert.equal(anchorOf('Our People'), 'our-people');
  assert.equal(anchorOf('  Café & Crème — 2026! '), 'cafe-creme-2026');
  assert.equal(sectionAnchor(sec([], { name: 'Our People' })), 'our-people');
  assert.equal(sectionAnchor(sec([], {})), '');
  assert.equal(sectionAnchor(sec([], { name: '2026' })), ''); // a number: an album photo's hash
  assert.equal(sectionAnchor(sec([], { name: 'Main' })), ''); // the page's own id
  const named = (...names) => names.map((name, i) => sec([], { id: `s-n${i}00`, name }));
  assert.deepEqual(nameProblems(named('Our people', '', undefined, 'Work')), ['', '', '', '']);
  const of = (...names) => checkContent(F, { version: 1, sections: named(...names) });
  assert.deepEqual(of('Our people', 'Work'), []);
  assert.deepEqual(of('Our People', 'our  people!'), [
    'section 2: "name" #our-people is already section 1\'s anchor',
  ]);
  assert.deepEqual(of('!!!'), [
    'section 1: "name" needs a letter or a digit (it becomes the section\'s #anchor)',
  ]);
  assert.deepEqual(of('3 rooms'), [
    'section 1: "name" #3-rooms must start with a letter (a number is a photo\'s link)',
  ]);
  assert.deepEqual(of('portal'), ['section 1: "name" #portal is taken by the page itself']);
  assert.deepEqual(checkContent(F, { version: 1, sections: [sec([], { name: 4 })] }), [
    'section 1: "name" must be text',
  ]);
});

test('validation: size, aspect, place, mobile', () => {
  const one = (b) => checkContent(F, { version: 1, sections: [sec([blk(b)])] });
  const of = (s) => checkContent(F, { version: 1, sections: [sec([], s)] });
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
  assert.deepEqual(of({ height: 'full' }), []);
  assert.deepEqual(of({ height: 'aspect', mobile: { spacing: { top: 3 } } }), [
    'section 1: "height" must be one of custom, fit, third, half, full',
    `section 1: "mobile" must be an object { height, rows: { min } } (the phone's height and rows)`,
  ]);
});

test('ops: block settings, a phone area of its own, phone placement, reset; one undo each', () => {
  const store = createStore();
  const a = { id: 'b-aaaa', type: 'text', pos: { col: 1, span: 24, row: 1, rows: 10 } };
  const b = { id: 'b-bbbb', type: 'text', pos: { col: 1, span: 24, row: 11, rows: 10 } };
  store.load({ [F]: { version: 1, sections: [sec([a, b])] } });
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

  setSection(store, F, 0, { height: 'third', name: 'Intro' });
  setSection(store, F, 0, { height: 'custom', rows: { min: 24 } });
  assert.deepEqual(checkContent(F, store.current[F]), []);
  store.undo();
  assert.equal(store.current[F].sections[0].height, 'third');
  assert.ok(!('rows' in store.current[F].sections[0]));
  setSection(store, F, 0, { height: 'fit', name: undefined });
  assert.ok(!('name' in store.current[F].sections[0]));
  assert.equal(store.current[F].sections[0].height, 'fit');
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('custom rows: block moves only grow them; the bottom edge sets them; phone rows own', () => {
  const store = createStore();
  const a = { id: 'b-aaaa', type: 'text', pos: { col: 1, span: 24, row: 1, rows: 10 } };
  store.load({ [F]: { version: 1, sections: [sec([a], { height: 'custom', rows: { min: 50 } })] } });
  const s = () => store.current[F].sections[0];
  const vars = '--rows:50;--mrows:25;--minrows:50;--mminrows:25';
  // moved inside its rows (desktop, phone): still 50 rows, not its content's
  placeBlock(store, F, 0, 0, { col: 5, span: 24, row: 3, rows: 10 }, undefined, {
    flow: { 'b-aaaa': a.pos },
    rows: 12,
  });
  assert.equal(sectionVars(s()), vars);
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 2, rows: 5 }, { rows: 6 });
  assert.equal(sectionVars(s()), vars);
  assert.ok(!('mobile' in s()));
  // dragged past its bottom: its rows become the content's, in the move's one undo step
  placeBlock(store, F, 0, 0, { col: 5, span: 24, row: 55, rows: 10 });
  assert.equal(s().rows.min, 64);
  // a flowed follower lower than the stored areas show: the overlay's rows count
  placeBlock(store, F, 0, 0, { col: 5, span: 24, row: 50, rows: 10 }, undefined, { rows: 70 });
  assert.equal(s().rows.min, 70);
  // moved back up: the rows stay (empty space)
  placeBlock(store, F, 0, 0, { col: 5, span: 24, row: 1, rows: 10 });
  assert.equal(s().rows.min, 70);
  store.undo();
  store.undo();
  assert.equal(s().rows.min, 64);
  store.undo();
  assert.equal(s().rows.min, 50);
  assert.equal(s().blocks[0].pos.row, 3);

  // the phone: its own rows, the desktop's untouched
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 30, rows: 5 }, { rows: 34 });
  assert.equal(s().mobile.rows.min, 34);
  assert.equal(s().rows.min, 50);
  assert.match(sectionVars(s()), /--minrows:50;--mminrows:34$/);
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 1, rows: 5 });
  assert.equal(s().mobile.rows.min, 34);

  // the bottom edge / Rows field: the desktop's, or the phone's own (never the other)
  assert.equal(setSectionRows(store, F, 0, 72), true);
  assert.deepEqual([s().rows.min, s().mobile.rows.min], [72, 34]);
  assert.equal(setSectionRows(store, F, 0, 72), false);
  setSectionRows(store, F, 0, 20, { phone: true });
  assert.deepEqual([s().rows.min, s().mobile.rows.min], [72, 20]);
  assert.equal(setSectionRows(store, F, 0, 5000), true);
  assert.equal(s().rows.min, 999);
  store.undo();
  assert.equal(s().rows.min, 72);
  assert.deepEqual(checkContent(F, store.current[F]), []);
  // no phone rows of its own: half, rounded up
  setSection(store, F, 0, { mobile: undefined });
  assert.match(sectionVars(s()), /--mminrows:36$/);
  setSection(store, F, 0, { height: 'fit', rows: undefined });
  assert.equal(setSectionRows(store, F, 0, 40), false); // not custom
  assert.equal(setSectionRows(store, F, 0, 40, { phone: true }), false);
  // fit / other heights never grow
  placeBlock(store, F, 0, 0, { col: 5, span: 24, row: 80, rows: 10 });
  assert.ok(!('rows' in s()));
});

test('phone height: validation', () => {
  const of = (more) => checkContent(F, { version: 1, sections: [sec([], more)] });
  assert.deepEqual(of({ height: 'custom', rows: { min: 30 }, mobile: { rows: { min: 12 } } }), []);
  assert.deepEqual(of({ height: 'fit', mobile: { height: 'half' } }), []);
  assert.deepEqual(of({ height: 'fit', mobile: { height: 'custom', rows: { min: 9 } } }), []);
  assert.deepEqual(of({ height: 'custom', rows: { min: 30 }, mobile: { height: 'custom' } }), []);
  assert.deepEqual(of({ height: 'fit', mobile: { rows: { min: 12 } } }), [
    'section 1: "mobile.rows" must be left out unless the phone height is custom',
  ]);
  assert.deepEqual(of({ height: 'custom', rows: { min: 30 }, mobile: { height: 'fit', rows: { min: 4 } } }), [
    'section 1: "mobile.rows" must be left out unless the phone height is custom',
  ]);
  assert.deepEqual(of({ height: 'fit', mobile: { height: 'custom' } }), [
    'section 1: "mobile.rows.min" must be a whole number of rows from 1 (a custom phone height)',
  ]);
  assert.deepEqual(of({ height: 'custom', rows: { min: 30 }, mobile: { rows: { min: 0 } } }), [
    'section 1: "mobile.rows.min" must be a whole number of rows from 1 to 999',
  ]);
  assert.deepEqual(of({ mobile: { height: 'tall' } }), [
    'section 1: "mobile.height" must be one of custom, fit, third, half, full',
  ]);
  assert.equal(of({ height: 'custom', rows: { min: 30 }, mobile: { spacing: {} } }).length, 1);
});

test('phone height: its own, the desktop untouched; reset; rows, line and growth follow it', () => {
  const store = createStore();
  const a = { id: 'b-aaaa', type: 'text', pos: { col: 1, span: 24, row: 1, rows: 10 } };
  store.load({ [F]: { version: 1, sections: [sec([a], { height: 'custom', rows: { min: 40 } })] } });
  const s = () => store.current[F].sections[0];
  // unset: the desktop's (custom: half its rows)
  assert.equal(phoneHeightOf(s()), 'custom');
  assert.equal(sectionClass(s()), 'sec sec--h-custom');
  assert.match(sectionVars(s()), /--mminrows:20$/);
  // phone: half the screen; the desktop stays custom 40
  assert.equal(setPhoneHeight(store, F, 0, 'half'), true);
  assert.deepEqual(s().mobile, { height: 'half' });
  assert.equal(s().rows.min, 40);
  assert.equal(sectionClass(s()), 'sec sec--h-custom sec--mh-half');
  assert.equal(sectionVars(s()), '--rows:40;--mrows:5;--minrows:40');
  // not custom on the phone: no phone rows from the line, a phone drag doesn't grow anything
  assert.equal(setSectionRows(store, F, 0, 30, { phone: true }), false);
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 50, rows: 5 }, { rows: 54 });
  assert.deepEqual(s().mobile, { height: 'half' });
  // phone custom: rows to start from (the desktop's halved); the line and growth edit them
  setPhoneHeight(store, F, 0, 'custom');
  assert.deepEqual(s().mobile, { height: 'custom', rows: { min: 20 } });
  assert.equal(sectionClass(s()), 'sec sec--h-custom sec--mh-custom');
  setSectionRows(store, F, 0, 33, { phone: true });
  assert.equal(s().mobile.rows.min, 33);
  placeMobile(store, F, 0, 0, { col: 1, span: 30, row: 60, rows: 5 }, { rows: 64 });
  assert.equal(s().mobile.rows.min, 64);
  assert.equal(s().rows.min, 40);
  assert.deepEqual(checkContent(F, store.current[F]), []);
  // the desktop fit: the phone keeps its own custom height and rows
  setSection(store, F, 0, { height: 'fit', rows: undefined });
  assert.deepEqual(s().mobile, { height: 'custom', rows: { min: 64 } });
  assert.equal(sectionClass(s()), 'sec sec--mh-custom');
  assert.match(sectionVars(s()), /^--rows:10;--mrows:64;--mminrows:64$/);
  assert.deepEqual(checkContent(F, store.current[F]), []);
  // reset: the phone follows the desktop (fit): its rows go too
  assert.equal(setPhoneHeight(store, F, 0, undefined), true);
  assert.ok(!('mobile' in s()));
  assert.equal(sectionClass(s()), 'sec');
  assert.equal(setPhoneHeight(store, F, 0, undefined), false);
  // one undo step each
  store.undo();
  assert.deepEqual(s().mobile, { height: 'custom', rows: { min: 64 } });
  store.undo();
  assert.equal(s().height, 'custom');
  // a phone custom height without desktop rows: from its phone content
  setSection(store, F, 0, { height: 'third', rows: undefined, mobile: undefined });
  setPhoneHeight(store, F, 0, 'custom');
  assert.equal(s().mobile.rows.min, 64); // its phone content (the block at phone row 60)
  assert.deepEqual(checkContent(F, store.current[F]), []);
});
