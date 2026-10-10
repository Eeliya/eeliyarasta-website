import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save, renderOp } from './editor-server.mjs';
import { migratePage } from './migrate-layout.mjs';
import * as render from '../src/site/render.js';
import { buildRoutes } from '../src/site/routes.js';
import { setEditable } from '../src/site/helpers.js';
import { checkContent } from '../src/site/validate.js';
import { BLOCK_TYPES } from '../src/site/blocks/index.js';
import { newBlock, newSection, renderSections, rowsOf } from '../src/site/layout/index.js';
import { idsOf, isId, newId } from '../src/site/layout/ids.js';
import { createStore } from '../src/editor/store.js';
import {
  addBlock,
  addSection,
  duplicateBlock,
  duplicateSection,
  layerBlock,
  moveBlock,
  moveSection,
  placeBlock,
  removeBlock,
  removeSection,
  setSection,
} from '../src/editor/layout-ops.js';

const content = loadContent('.');
const { routes } = buildRoutes(content);
const ctxOf = (route) => ({ ...content, route, routes, curtains: {} });
const page = routes.find((r) => r.path === '/about/');
const item = routes.find((r) => r.album);
const F = 'pages/test/index.json';

/** A section of blocks (given as [type, fields] or blocks), with fixed ids. */
let n = 0;
const id = (kind) => `${kind}-t${String(++n).padStart(3, '0')}`;
const block = (type, more = {}) => ({ id: id('b'), type, ...more });
const section = (blocks, more = {}) => ({ id: id('s'), blocks, ...more });

/** Console warnings while fn runs. */
function warnings(fn) {
  const seen = [];
  const warn = console.warn;
  console.warn = (...a) => seen.push(a.join(' '));
  try {
    return [fn(), seen];
  } finally {
    console.warn = warn;
  }
}

test('ids: s-/b- with 4+ letters or digits, new ones never taken', () => {
  assert.ok(isId('s-k3x9', 's'));
  assert.ok(isId('b-7qpa', 'b'));
  assert.ok(!isId('s-k3x9', 'b'));
  assert.ok(!isId('s-K3', 's'));
  const taken = new Set();
  for (let i = 0; i < 300; i++) assert.ok(isId(newId('b', taken), 'b'));
  assert.equal(taken.size, 300);
  const list = [section([block('text'), block('photo')])];
  assert.equal(idsOf(list).size, 3);
});

test('registry: every block type has a label, an icon and renders its defaults', () => {
  for (const [type, t] of Object.entries(BLOCK_TYPES)) {
    assert.equal(t.type, type);
    assert.ok(t.label && t.icon, type);
    const route = t.item ? item : page;
    const ids = new Set();
    const list = [newSection(ids, [newBlock(type, ids)])];
    const out = renderSections(ctxOf(route), route, F, list);
    assert.match(out, new RegExp(`<div class="blk blk--${type}"`), type);
    assert.deepEqual(checkContent(F, { sections: list }), [], type);
  }
});

test('render: sections are grids, blocks carry their area; off is hidden', () => {
  const list = [
    section([block('text', { text: 'One', pos: { col: 3, span: 10, row: 2, rows: 4 }, z: 2 })], {
      rows: 3,
      spacing: { top: 10, bottom: 12 },
    }),
    section([block('text', { text: 'Two', config: { enabled: false } })], {
      height: 'screen',
      align: 'bottom',
      width: 'full',
    }),
    section([block('text', { text: 'Three' })], { enabled: false }),
  ];
  const out = renderSections(ctxOf(page), page, F, list);
  assert.match(out, /<section class="sec" style="--rows:5;--pt:10;--pb:12">/); // rows grow to fit
  assert.match(out, /<div class="blk blk--text" style="--c:3;--s:10;--r:2;--rs:4;--z:2">/);
  assert.match(out, /<section class="sec sec--screen sec--bottom sec--full"/);
  assert.match(out, /style="--c:1;--s:24;--r:1;--rs:1" hidden>/); // no pos: full width
  assert.match(out, /style="--rows:1;--pt:0;--pb:0" hidden>/);
  assert.ok(out.indexOf('One') < out.indexOf('Two') && out.indexOf('Two') < out.indexOf('Three'));
  // a mobile area: the section keeps its grid on phones
  const mobile = [section([block('text', { mobile: { col: 1, span: 12, row: 1, rows: 2 } })])];
  assert.match(
    renderSections(ctxOf(page), page, F, mobile),
    /class="sec sec--mgrid"[\s\S]*;--mc:1;--ms:12;--mr:1;--mrs:2"/,
  );
  // a block can't run past column 24
  const wide = [section([block('text', { pos: { col: 20, span: 10, row: 1, rows: 1 } })])];
  assert.match(renderSections(ctxOf(page), page, F, wide), /--c:20;--s:5;/);
});

test('render: no automatic numbering; a heading can be numbered, counting the ones that are on', () => {
  const heading = (title, numbered, more) =>
    block('heading', { title, config: { numbered }, ...more });
  const list = [
    section([heading('A', true), heading('B', false)]),
    section([heading('C', true)], { enabled: false }),
    section([
      heading('D', true),
      block('grid', { title: 'G', label: 'L', config: { source: 'people' } }),
    ]),
  ];
  const out = renderSections(ctxOf(page), page, F, list);
  assert.match(out, /\(01\) <span>[\s\S]*>A</);
  assert.match(out, /\(02\) <span>[\s\S]*>D</);
  assert.doesNotMatch(out, /\(03\)/);
  assert.match(out, /data-anim="section.label">L</); // a grid head has no number
});

test('render: editor markers point into the blocks, only when editable', () => {
  const list = [section([block('text'), block('heading', { title: 'T' })])];
  assert.doesNotMatch(renderSections(ctxOf(page), page, F, list), /data-edit|data-sec|data-block/);
  setEditable(true);
  try {
    const out = renderSections(ctxOf(page), page, F, list);
    assert.match(out, new RegExp(`data-sec="${list[0].id}"`));
    assert.match(out, new RegExp(`data-block="${list[0].blocks[1].id}"`));
    assert.match(out, /data-edit="pages\/test\/index\.json#\/sections\/0\/blocks\/1\/title"/);
  } finally {
    setEditable(false);
  }
});

test('render: an unknown type, or an item type off a [slug] page, warns and is skipped', () => {
  const [out, seen] = warnings(() =>
    renderSections(ctxOf(page), page, F, [
      section([block('nope'), block('album'), block('text', { text: 'x' })]),
    ]),
  );
  assert.doesNotMatch(out, /data-album/);
  assert.match(out, /<p>x<\/p>/);
  assert.match(seen.join('\n'), /unknown block type "nope"/);
  assert.match(seen.join('\n'), /"album" block only works on a \[slug\] page/);
  assert.match(render.renderRoute(item, content).body, /data-album/);
});

test('validation: the layout, then each block against its type', () => {
  const problems = (sections) => checkContent(F, { sections });
  const ok = (more) => section([block('text')], more);
  assert.deepEqual(problems([ok()]), []);
  assert.deepEqual(problems([3]), ['section 1 must be an object']);
  assert.deepEqual(problems([{ id: 's-aaaa' }]), ['section 1: "blocks" must be a list']);
  assert.deepEqual(problems([{ id: 'x', blocks: [] }]), [
    'section 1: "id" must be a section id like "s-k3x9"',
  ]);
  assert.deepEqual(problems([ok({ height: 'tall', align: 'left', width: 'wide', rows: 0 })]), [
    'section 1: "height" must be auto or screen',
    'section 1: "align" must be one of top, center, bottom, stretch',
    'section 1: "width" must be contained or full',
    'section 1: "rows" must be a whole number from 1',
  ]);
  assert.deepEqual(problems([ok({ spacing: { top: -1 }, enabled: 'yes' })]), [
    'section 1: "enabled" must be true or false',
    'section 1: "spacing.top" must be a whole number of rows (0 or more)',
  ]);
  const one = (b) => problems([section([{ id: 'b-aaaa', ...b }])]);
  assert.deepEqual(one({ title: 'x' }), ['section 1, block 1 needs a "type"']);
  assert.deepEqual(one({ type: 'unknown-type', anything: 1 }), []);
  assert.deepEqual(one({ type: 'text', pos: { col: 20, span: 10, row: 1, rows: 1 } }), [
    'section 1, block 1 (Text): "pos" must end by column 24 (col 20 + span 10)',
  ]);
  assert.match(one({ type: 'text', pos: { col: 0, span: 1, row: 1, rows: 1 } })[0], /pos.col/);
  assert.match(one({ type: 'text', z: 1.5 })[0], /"z" must be a whole number/);
  assert.match(one({ type: 'heading', title: 3 })[0], /\(Page heading\): "title" must be a string/);
  assert.match(one({ type: 'about', facts: ['x'] })[0], /list of objects/);
  assert.match(one({ type: 'grid', config: { layout: 'wild' } })[0], /one of staggered, even/);
  assert.match(one({ type: 'heading', config: { numbered: 'yes' } })[0], /must be a boolean/);
  assert.match(one({ type: 'text', config: { enabled: 1 } })[0], /true or false/);
  const twice = section([block('text'), block('text')]);
  twice.blocks[1].id = twice.blocks[0].id;
  assert.deepEqual(problems([twice]), [`the id "${twice.blocks[0].id}" is used twice`]);
});

test('migration: each old section becomes a section with it as one full-width block', () => {
  const old = {
    curtain: 'x',
    sections: [
      { type: 'hero', title: 'Me', config: { enabled: true } },
      { type: 'grid', label: 'People', config: { enabled: false, source: 'people' } },
      { type: 'heading', title: '404', config: { center: true } },
    ],
  };
  const next = migratePage(old);
  assert.equal(next.curtain, 'x');
  const [hero, grid, heading] = next.sections;
  assert.deepEqual(
    { ...hero, id: 0, blocks: hero.blocks.map((b) => ({ ...b, id: 0 })) },
    {
      id: 0,
      height: 'screen',
      align: 'stretch',
      rows: 1,
      width: 'full',
      spacing: { top: 0, bottom: 0 },
      enabled: true,
      blocks: [
        {
          id: 0,
          type: 'hero',
          title: 'Me',
          config: {},
          pos: { col: 1, span: 24, row: 1, rows: 1 },
        },
      ],
    },
  );
  assert.equal(grid.enabled, false);
  assert.deepEqual(grid.blocks[0].config, { source: 'people' });
  assert.deepEqual([grid.width, grid.spacing], ['contained', { top: 11, bottom: 14 }]);
  assert.deepEqual([heading.height, heading.align], ['screen', 'center']);
  assert.equal(idsOf(next.sections).size, 6);
  assert.equal(migratePage(next), next); // once only
  assert.deepEqual(checkContent('pages/x/index.json', next), []);
  // the site's own content is migrated and valid
  for (const [pid, p] of Object.entries(content.pages)) {
    assert.ok(
      (p.sections || []).every((s) => Array.isArray(s.blocks)),
      pid,
    );
    assert.equal(migratePage(p), p, pid);
  }
});

test('ops: sections and blocks added, copied, moved, removed; one undo step each', () => {
  const store = createStore();
  store.load({ [F]: { sections: [] } });
  const sections = () => store.current[F].sections;
  const types = () => sections().map((s) => s.blocks.map((b) => b.type).join('+'));
  addSection(store, F, 'heading');
  addSection(store, F, 'text', 0);
  addSection(store, F); // empty
  assert.deepEqual(types(), ['text', 'heading', '']);
  assert.ok(sections().every((s) => isId(s.id, 's') && s.blocks.every((b) => isId(b.id, 'b'))));
  duplicateSection(store, F, 0);
  assert.deepEqual(types(), ['text', 'text', 'heading', '']);
  assert.notEqual(sections()[0].id, sections()[1].id);
  assert.notEqual(sections()[0].blocks[0].id, sections()[1].blocks[0].id);
  moveSection(store, F, 2, 0);
  assert.deepEqual(types(), ['heading', 'text', 'text', '']);
  assert.equal(moveSection(store, F, 0, -1), false);
  removeSection(store, F, 3);
  assert.deepEqual(types(), ['heading', 'text', 'text']);

  const b = addBlock(store, F, 0, 'button');
  assert.deepEqual(sections()[0].blocks[1].pos, { col: 1, span: 24, row: 13, rows: 12 }); // below
  assert.equal(sections()[0].rows, 24);
  assert.ok(isId(b.id, 'b'));
  duplicateBlock(store, F, 0, 1);
  assert.deepEqual(types()[0], 'heading+button+button');
  assert.equal(sections()[0].blocks[2].pos.row, 25);
  moveBlock(store, F, 0, 2, 0);
  assert.deepEqual(types()[0], 'button+heading+button');
  removeBlock(store, F, 0, 0);
  assert.deepEqual(types()[0], 'heading+button');
  placeBlock(store, F, 0, 1, { col: 13, span: 12, row: 30, rows: 4 });
  assert.deepEqual(sections()[0].blocks[1].pos, { col: 13, span: 12, row: 30, rows: 4 });
  assert.equal(sections()[0].rows, 36); // a section grows to fit, never shrinks by itself
  placeBlock(store, F, 0, 1, { col: 13, span: 12, row: 40, rows: 4 });
  assert.equal(sections()[0].rows, 43); // grown in the same step
  layerBlock(store, F, 0, 1, 1);
  assert.equal(sections()[0].blocks[1].z, 1);
  layerBlock(store, F, 0, 1, -1);
  assert.equal(sections()[0].blocks[1].z, undefined);
  setSection(store, F, 1, { height: 'screen', align: 'top' });
  assert.deepEqual([sections()[1].height, sections()[1].align], ['screen', 'top']);
  assert.deepEqual(checkContent(F, store.current[F]), []);

  store.undo(); // section settings
  store.undo(); // layer down
  store.undo(); // layer up
  store.undo(); // the second drag
  assert.equal(sections()[0].rows, 36);
  store.undo(); // the first drag
  assert.deepEqual(sections()[0].blocks[1].pos, { col: 1, span: 24, row: 13, rows: 12 });
  assert.equal(rowsOf(sections()[0]), 36);
  store.undo(); // remove
  assert.deepEqual(types()[0], 'button+heading+button');
  store.redo();
  assert.deepEqual(types()[0], 'heading+button');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'));
  for (const f of ['settings/site.json', 'settings/animations.json', 'pages/index.json']) {
    fs.mkdirSync(path.dirname(path.join(root, 'content', f)), { recursive: true });
    fs.copyFileSync(path.join('content', f), path.join(root, 'content', f));
  }
  fs.mkdirSync(path.join(root, 'content/pages/test'));
  fs.writeFileSync(path.join(root, 'content', F), '{}');
  assert.equal(save(root, { [F]: store.current[F] }).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'content', F), 'utf8'));
  assert.deepEqual(
    saved.sections.map((s) => s.blocks.length),
    [2, 1, 1],
  );
  const bad = { sections: [section([block('heading', { title: 3 })])] };
  assert.equal(save(root, { [F]: bad }).status, 400);
});

test('render endpoint: one section of a page, from the editor copy over the drafts', () => {
  const file = 'pages/about/index.json';
  const data = structuredClone(content.pages.about);
  const [s] = data.sections;
  s.blocks[0].headline = 'Edited headline';
  s.spacing = { top: 3, bottom: 4 };
  const r = renderOp(render, '.', {}, { path: '/about/', file, data, ids: [s.id] });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.html), [s.id]);
  const html = r.body.html[s.id];
  assert.match(
    html,
    new RegExp(`^<section class="sec" data-sec="${s.id}" style="--rows:1;--pt:3;--pb:4">`),
  );
  assert.match(html, /Edited headline/);
  assert.match(html, /data-edit="pages\/about\/index\.json#\/sections\/0\/blocks\/0\/headline"/);
  assert.match(html, /<\/section>$/);
  // the item of a [slug] page
  const slug = routes.find((r) => r.album);
  const tpl = content.pages[slug.id];
  const out = renderOp(
    render,
    '.',
    {},
    {
      path: slug.path,
      file: `pages/${slug.id}.json`,
      data: tpl,
      ids: [tpl.sections[0].id],
    },
  );
  assert.match(Object.values(out.body.html)[0], /data-album/);
  // wrong page, bad data, no ids
  assert.equal(renderOp(render, '.', {}, { path: '/', file, data, ids: [] }).status, 400);
  const bad = { sections: [{ id: 'x', blocks: [] }] };
  assert.equal(
    renderOp(render, '.', {}, { path: '/about/', file, data: bad, ids: [] }).status,
    400,
  );
  assert.equal(renderOp(render, '.', {}, { path: '/about/', file }).status, 400);
});
