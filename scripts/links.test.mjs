/** Free blocks and links (src/site/layout/links.js, flow.js), scaled text (type.js), the migration. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRows } from '../src/site/layout/flow.js';
import {
  blockClass,
  blockLinks,
  blockVars,
  linkOf,
  linkProblems,
  makesLoop,
  newBlock,
} from '../src/site/layout/index.js';
import {
  checkScale,
  checkTypography,
  typographyOf,
  typographyVars,
} from '../src/site/layout/type.js';
import { flat, lay } from './test-layout.mjs';
import { checkContent } from '../src/site/validate.js';
import { createStore } from '../src/editor/store.js';
import {
  addBlock,
  duplicateBlock,
  linkBlock,
  placeBlock,
  placeMobile,
  removeBlock,
} from '../src/editor/layout-ops.js';

const it = (id, row, rows, need, link = null) => ({ id, col: 1, span: 120, row, rows, need, link });
const to = (id, gap = 0) => ({ to: id, gap });

test('links: a follower sits its gap below its leader; it moves when the leader grows', () => {
  // text a (auto) grows from 10 to 16 rows: b follows it 2 below, f is free
  const items = [it('a', 1, 10, 16), it('b', 13, 6, 6, to('a', 2)), it('f', 13, 6, 6)];
  const { at, rows } = resolveRows(items, 18);
  assert.deepEqual(at.a, { row: 1, rows: 16 });
  assert.deepEqual(at.b, { row: 19, rows: 6 }); // 16 + 1 + 2
  assert.deepEqual(at.f, { row: 13, rows: 6 }); // free: where it was
  assert.equal(rows, 24);
  // the leader shrinks: the follower comes up with it
  assert.deepEqual(resolveRows([it('a', 1, 10, 4), it('b', 13, 6, 6, to('a', 2))], 18).at.b, {
    row: 7,
    rows: 6,
  });
});

test('links: negative gaps overlap; a follower never goes above row 1', () => {
  const { at } = resolveRows([it('photo', 1, 20, 20), it('cap', 30, 3, 3, to('photo', -4))]);
  assert.deepEqual(at.cap, { row: 17, rows: 3 }); // its top 4 rows into the photo
  assert.equal(resolveRows([it('a', 1, 2, 2), it('b', 9, 1, 1, to('a', -10))]).at.b.row, 1);
});

test('links: chains and several followers of one leader, in the links order', () => {
  // listed followers first: still placed after their leaders
  const items = [
    it('c', 50, 2, 2, to('b', 0)),
    it('b', 40, 5, 8, to('a', 1)),
    it('cap', 40, 2, 2, to('a', 0)),
    it('a', 1, 10, 12),
  ];
  const { at } = resolveRows(items, 10);
  assert.equal(at.b.row, 14); // 12 + 1 + 1
  assert.equal(at.cap.row, 13);
  assert.equal(at.c.row, 22); // b ends at 21
});

test('links: a loop or a missing leader counts as free (and resolving ends)', () => {
  const { at } = resolveRows([it('a', 5, 2, 2, to('b')), it('b', 9, 2, 2, to('a'))]);
  assert.ok(at.a && at.b);
  assert.ok(at.a.row === 5 || at.b.row === 9); // one of them stays where it was
  assert.equal(resolveRows([it('a', 5, 2, 2, to('gone'))]).at.a.row, 5);
  assert.equal(resolveRows([it('a', 5, 2, 2, to('a'))]).at.a.row, 5);
});

test('links on the phone: its own phone link, else the desktop link with the gap halved', () => {
  const b = lay({ id: 'b-bbbb', type: 'text', link: to('b-aaaa', 5) });
  assert.deepEqual(linkOf(b), to('b-aaaa', 5));
  assert.deepEqual(linkOf(b, true), to('b-aaaa', 3));
  assert.deepEqual(linkOf(lay({ ...flat(b), link: to('b-aaaa', -3) }), true), to('b-aaaa', -2));
  // a phone area of its own: only its own phone link
  const own = lay({ ...flat(b), phone: { col: 1, span: 60, row: 1 } });
  assert.equal(linkOf(own, true), null);
  assert.deepEqual(
    linkOf(lay({ ...flat(own), phone: { ...flat(own).phone, link: to('b-cccc', -1) } }), true),
    to('b-cccc', -1),
  );
  assert.deepEqual(blockLinks(b), { 'data-link': 'b-aaaa 5', 'data-mlink': 'b-aaaa 3' });
  assert.deepEqual(blockLinks({ id: 'b-x' }), { 'data-link': null, 'data-mlink': null });
});

test('links: loops are found; validation rejects unknown, other sections, self, loops', () => {
  const blocks = [
    lay({ id: 'b-aaaa', type: 'text' }),
    lay({ id: 'b-bbbb', type: 'text', link: to('b-aaaa') }),
    lay({ id: 'b-cccc', type: 'text', link: to('b-bbbb') }),
  ];
  assert.equal(makesLoop(blocks, 'b-aaaa', 'b-cccc'), true);
  assert.equal(makesLoop(blocks, 'b-aaaa', 'b-aaaa'), true);
  assert.equal(makesLoop(blocks, 'b-cccc', 'b-aaaa'), false);
  assert.deepEqual(linkProblems(blocks), []);
  const F = 'pages/t/index.json';
  const page = (s1, s2 = []) => ({
    version: 1,
    id: 'pg-t001',

    sections: [
      { id: 's-aaaa', blocks: s1 },
      { id: 's-bbbb', blocks: s2 },
    ],
  });
  assert.deepEqual(checkContent(F, page(blocks)), []);
  const loop = [lay({ id: 'b-aaaa', type: 'text', link: to('b-cccc') }), ...blocks.slice(1)];
  assert.deepEqual(checkContent(F, page(loop)), [
    'section 1: links make a loop: b-aaaa -> b-cccc -> b-bbbb -> b-aaaa',
  ]);
  assert.deepEqual(
    checkContent(F, page([lay({ id: 'b-aaaa', type: 'text', link: to('b-zzzz') })])),
    ['section 1: block "b-aaaa" layout.base.link follows "b-zzzz", which isn\'t on the page'],
  );
  assert.deepEqual(
    checkContent(
      F,
      page(
        [lay({ id: 'b-aaaa', type: 'text', phone: { link: to('b-dddd') } })],
        [lay({ id: 'b-dddd', type: 'text' })],
      ),
    ),
    [
      'section 1: block "b-aaaa" layout.phone.link follows "b-dddd" of another section (links stay in their section)',
    ],
  );
  assert.deepEqual(
    checkContent(F, page([lay({ id: 'b-aaaa', type: 'text', link: to('b-aaaa') })])),
    ['section 1: block "b-aaaa" layout.base.link can\'t follow the block itself'],
  );
  assert.match(
    checkContent(F, page([lay({ id: 'b-aaaa', type: 'text', link: { to: 'b-x', gap: 1.5 } })]))[0],
    /must be \{ "to"/,
  );
});

test('editor: link, drag a follower (its gap changes), unlink; new blocks are free', () => {
  const F = 'pages/t/index.json';
  const pos = (row, rows) => ({ col: 1, span: 120, row, rows });
  // fixed rows: these blocks' stored rows are what links settle on
  const at = (id, p) => lay({ id, type: 'text', size: 'rows', pos: p });
  const store = createStore();
  store.load({
    [F]: {
      version: 1,
      id: 'pg-t002',

      sections: [
        {
          id: 's-aaaa',
          blocks: [at('b-aaaa', pos(1, 10)), at('b-bbbb', pos(14, 4)), at('b-cccc', pos(20, 4))],
        },
        { id: 's-bbbb', blocks: [at('b-dddd', pos(1, 4))] },
      ],
    },
  });
  const blocks = () => store.current[F].sections[0].blocks;
  assert.equal(linkBlock(store, F, 0, 1, 'b-aaaa', 3), true);
  assert.deepEqual(flat(blocks()[1]).link, to('b-aaaa', 3));
  assert.equal(flat(blocks()[1]).pos.row, 14); // where it was: 10 + 1 + 3
  assert.equal(linkBlock(store, F, 0, 2, 'b-bbbb', -2), true);
  assert.equal(flat(blocks()[2]).pos.row, 16); // stored rows settle to the links: 17 - 2 + 1
  // a loop, another section's block, itself: refused
  assert.equal(linkBlock(store, F, 0, 0, 'b-cccc', 0), null);
  assert.equal(linkBlock(store, F, 0, 0, 'b-dddd', 0), null);
  assert.equal(linkBlock(store, F, 0, 0, 'b-aaaa', 0), null);
  // dragged up 6 rows: still linked, the gap -3 (overlapping); its follower comes along
  placeBlock(store, F, 0, 1, pos(8, 4));
  assert.deepEqual(flat(blocks()[1]).link, to('b-aaaa', -3));
  assert.equal(flat(blocks()[2]).pos.row, 10);
  // the leader removed: its followers are free
  store.batch(() => {});
  linkBlock(store, F, 0, 1, null);
  assert.ok(!('link' in flat(blocks()[1])));
  store.undo();
  assert.ok(flat(blocks()[1]).link);
  removeBlock(store, F, 0, 0);
  assert.ok(!('link' in flat(blocks()[0])));
  store.undo();
  // a copy is free; a new block is free
  const copy = duplicateBlock(store, F, 0, 2);
  assert.ok(!('link' in flat(copy)));
  const added = addBlock(store, F, 0, 'text');
  assert.ok(!('link' in flat(added)) && !('link' in flat(newBlock('text', new Set()))));
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('editor: phone links are separate; the first phone move brings the desktop link along', () => {
  const F = 'pages/t/index.json';
  const store = createStore();
  store.load({
    [F]: {
      version: 1,
      id: 'pg-t003',

      sections: [
        {
          id: 's-aaaa',
          blocks: [
            lay({
              id: 'b-aaaa',
              type: 'text',
              size: 'rows',
              pos: { col: 1, span: 120, row: 1, rows: 10 },
            }),
            lay({
              id: 'b-bbbb',
              type: 'text',
              size: 'rows',
              pos: { col: 1, span: 60, row: 15, rows: 4 },
              link: to('b-aaaa', 4),
            }),
          ],
        },
      ],
    },
  });
  const b = () => store.current[F].sections[0].blocks[1];
  // on the phone a's halved area ends at row 5; b dropped at row 9: gap 3
  placeMobile(store, F, 0, 1, { col: 1, span: 60, row: 9, rows: 2 });
  assert.deepEqual(flat(b()).phone, { col: 1, span: 60, row: 9, rows: 2, link: to('b-aaaa', 3) });
  assert.deepEqual(flat(b()).link, to('b-aaaa', 4)); // the desktop's unchanged
  linkBlock(store, F, 0, 1, null, 0, { phone: true });
  assert.ok(!('link' in flat(b()).phone) && flat(b()).link);
  store.undo();
  // unlinked where the preview shows it (an auto leader grew): it stays on that row
  linkBlock(store, F, 0, 1, null, 0, { phone: true, row: 14 });
  assert.equal(flat(b()).phone.row, 14);
  linkBlock(store, F, 0, 1, null, 0, { row: 30 });
  assert.ok(!('link' in flat(b())));
  assert.equal(flat(b()).pos.row, 30);
});

test('scaled text: per block, by its styles; site typography over the defaults', () => {
  const t = (more) => ({
    id: 'b-aaaa',
    type: 'text',
    layout: { base: { col: 1, span: 120, row: 1, rows: 1 } },
    ...more,
  });
  assert.doesNotMatch(blockClass(t()), /scale/);
  assert.match(blockClass(t({ scale: { on: true } })), / blk--scale$/);
  assert.doesNotMatch(blockClass(t({ scale: { on: false, adjust: 150 } })), /scale/);
  assert.doesNotMatch(blockVars(t({ scale: { on: true } })), /--tk/);
  assert.match(blockVars(t({ scale: { on: true, adjust: 80 } })), /;--tk:0.8$/);
  // only text blocks scale
  assert.doesNotMatch(blockClass({ ...t({ scale: { on: true } }), type: 'photo' }), /scale/);
  assert.deepEqual(checkScale({ type: 'photo', scale: { on: true } }), [
    '"scale" is for text blocks (heading, text, button)',
  ]);
  assert.deepEqual(checkScale({ type: 'text', scale: { on: 'yes', adjust: 5 } }), [
    '"scale.on" must be true or false',
    '"scale.adjust" must be a % from 10 to 1000',
  ]);
  assert.equal(typographyOf({}).paragraph.size, 1.4);
  const site = { typography: { paragraph: { size: 1.6, min: 15 }, title: { tracking: -0.03 } } };
  assert.deepEqual(typographyOf(site).paragraph, { size: 1.6, line: 1.75, tracking: 0, min: 15 });
  assert.equal(
    typographyVars(site),
    '--ts-title-tr: -0.03em; --ts-paragraph: 1.6; --ts-paragraph-min: 15px',
  );
  assert.equal(typographyVars({}), '');
  assert.deepEqual(checkTypography(site.typography), []);
  assert.deepEqual(checkTypography({ huge: {}, paragraph: { size: 0, x: 1 } }), [
    'typography: unknown style "huge" (title, heading, paragraph, label)',
    'typography.paragraph.size must be more than 0',
    'typography.paragraph: unknown key "x"',
  ]);
  assert.match(
    checkContent('settings/site.json', { version: 1, name: 'x', url: 'y', typography: 3 })[0],
    /typography/,
  );
});
