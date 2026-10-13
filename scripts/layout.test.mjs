import { flat, lay } from './test-layout.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save, renderOp } from './editor-server.mjs';
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
  moveBlockTo,
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
const block = (type, more = {}) => lay({ id: id('b'), type, ...more });
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
    assert.match(out, new RegExp(`<div class="blk blk--${type} blk--auto"`), type); // auto: the default
    assert.deepEqual(checkContent(F, { version: 1, id: 'pg-t006', sections: list }), [], type);
  }
});

test("a block whose source or item is cleared (the editor's ✕) still renders, and validates", () => {
  for (const [type, t] of Object.entries(BLOCK_TYPES)) {
    const route = t.item ? item : page;
    const ids = new Set();
    const b = newBlock(type, ids);
    for (const c of t.config || []) if (c.type === 'source') delete b.config?.[c.key];
    for (const f of t.fields || []) if (f.type === 'source') delete b[f.key];
    delete b.item;
    const list = [newSection(ids, [b])];
    assert.doesNotThrow(() => renderSections(ctxOf(route), route, F, list), type);
    assert.deepEqual(checkContent(F, { version: 1, id: 'pg-t007', sections: list }), [], type);
  }
});

test('a list block without a source: its head without a link, no items (not a default list)', () => {
  for (const type of ['grid', 'projects', 'albums']) {
    const ids = new Set();
    const b = newBlock(type, ids);
    b.config = { ...b.config, source: undefined };
    const out = renderSections(ctxOf(page), page, F, [newSection(ids, [b])]);
    assert.doesNotMatch(out, /section__cta|<img/, type);
  }
});

test('render: sections are grids, blocks carry their area; off is hidden', () => {
  const list = [
    section([
      block('text', { body: 'One', layout: { base: { col: 3, span: 10, row: 2, rows: 4 } }, z: 2 }),
    ]),
    section([block('text', { body: 'Two', config: { enabled: false } })], {
      name: 'Our People',
      height: 'full',
      width: 'full',
    }),
    section([block('text', { body: 'Three' })], { enabled: false }),
  ];
  const out = renderSections(ctxOf(page), page, F, list);
  // rows: down to the lowest block; the phone grid's rows: its blocks' halved areas
  // no space above or below (no --pt / --pb): the rows between sections are the space
  assert.match(out, /<section class="sec" style="--rows:5;--mrows:3">/);
  assert.match(
    out,
    /<div class="blk blk--text blk--auto" style="--c:3;--s:10;--r:2;--rs:4;--z:2;--mc:2;--ms:5;--mr:1;--mrs:2">/,
  );
  // a name: its anchor (id); a height preset: its min-height class
  assert.match(out, /<section id="our-people" class="sec sec--h-full sec--full"/);
  assert.match(out, /style="--c:1;--s:120;--r:1;--rs:1;--mc:1;--ms:60;--mr:1;--mrs:1" hidden>/); // no pos: full width
  // a section that is off: not on the public page; in the editor's preview rendered hidden
  assert.doesNotMatch(out, /Three/);
  setEditable(true);
  const ed = renderSections(ctxOf(page), page, F, list);
  setEditable(false);
  assert.match(ed, /data-sec="[^"]+" style="--rows:1;--mrows:1" hidden>[\s\S]*Three/);
  assert.ok(ed.indexOf('One') < ed.indexOf('Two') && ed.indexOf('Two') < ed.indexOf('Three'));
  // a phone area of its own: on the 60-column phone grid
  const mobile = [section([block('text', { phone: { col: 1, span: 24, row: 1, rows: 2 } })])];
  assert.match(
    renderSections(ctxOf(page), page, F, mobile),
    /class="sec"[\s\S]*;--mc:1;--ms:24;--mr:1;--mrs:1"/,
  );
  // links and scaled text on the element
  const linked = [
    section([
      block('text', { id: 'b-lead' }),
      block('text', {
        id: 'b-foll',
        link: { to: 'b-lead', gap: -3 },
        scale: { on: true, adjust: 120 },
      }),
    ]),
  ];
  const lo = renderSections(ctxOf(page), page, F, linked);
  assert.match(
    lo,
    /class="blk blk--text blk--auto blk--scale"[^>]*;--tk:1.2" data-link="b-lead -3" data-mlink="b-lead -2"/,
  );
  // a block can't run past column 120
  const wide = [
    section([block('text', { layout: { base: { col: 116, span: 10, row: 1, rows: 1 } } })]),
  ];
  assert.match(renderSections(ctxOf(page), page, F, wide), /--c:116;--s:5;/);
});

test('render: no automatic numbering; a heading can be numbered, counting the ones that are on', () => {
  const heading = (title, numbered, more) =>
    block('heading', { title, config: { numbered }, ...more });
  const list = [
    section([heading('A', true), heading('B', false)]),
    section([heading('C', true)], { enabled: false }),
    section([
      heading('D', true),
      block('grid', { title: 'G', eyebrow: 'L', config: { source: 'people' } }),
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
      section([block('nope'), block('album'), block('text', { body: 'x' })]),
    ]),
  );
  assert.doesNotMatch(out, /data-album/);
  assert.match(out, /<p>x<\/p>/);
  assert.match(seen.join('\n'), /unknown block type "nope"/);
  assert.match(seen.join('\n'), /"album" block only works on a \[slug\] page/);
  assert.match(render.renderRoute(item, content).body, /data-album/);
});

test('validation: the layout, then each block against its type', () => {
  const problems = (sections) => checkContent(F, { version: 1, id: 'pg-t007', sections });
  const ok = (more) => section([block('text')], more);
  assert.deepEqual(problems([ok()]), []);
  assert.deepEqual(problems([3]), ['section 1 must be an object']);
  assert.deepEqual(problems([{ id: 's-aaaa' }]), ['section 1: "blocks" must be a list']);
  assert.deepEqual(problems([{ id: 'x', blocks: [] }]), [
    'section 1: "id" must be a section id like "s-k3x9"',
  ]);
  assert.deepEqual(problems([ok({ height: 'tall', width: 'wide' })]), [
    'section 1: "height" must be one of custom, fit, third, half, full',
    'section 1: "width" must be contained or full',
  ]);
  for (const height of ['third', 'half', 'full'])
    assert.deepEqual(problems([ok({ height })]), [], height);
  assert.deepEqual(problems([ok({ height: 'screen', enabled: 'yes' })]), [
    'section 1: "height" must be one of custom, fit, third, half, full',
    'section 1: "enabled" must be true or false',
  ]);
  const one = (b) => problems([section([{ id: 'b-aaaa', ...b }])]);
  assert.deepEqual(one({ title: 'x' }), ['section 1, block 1 needs a "type"']);
  assert.deepEqual(one({ type: 'unknown-type', anything: 1 }), []);
  assert.deepEqual(one({ type: 'text', layout: { base: { col: 116, span: 10, row: 1 } } }), [
    'section 1, block 1 (Text): "layout.base" must end by column 120 (col 116 + span 10)',
  ]);
  assert.match(
    one({ type: 'text', layout: { base: { col: 0, span: 1, row: 1 } } })[0],
    /layout.base.col/,
  );
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

test('anchors: a named section renders its id; a clash with another id on the page warns', () => {
  const projects = routes.find((r) => r.path === '/projects/');
  const data = structuredClone(content);
  const list = data.pages[projects.id].sections;
  list[0].name = 'Film scan rig'; // a project row's id (its slug) on this page
  list[1].name = 'All work';
  const [{ body }, seen] = warnings(() => render.renderRoute(projects, data));
  assert.match(body, /<section id="film-scan-rig" class="sec"/);
  assert.match(body, /<section id="all-work" class="sec"/);
  assert.match(
    seen.join('\n'),
    /\[anchors\] \/projects\/: section "Film scan rig" \(#film-scan-rig\) shares its id/,
  );
  assert.doesNotMatch(seen.join('\n'), /all-work/);
});

test('ops: sections and blocks added, copied, moved, removed; one undo step each', () => {
  const store = createStore();
  store.load({ [F]: { version: 1, id: 'pg-t008', sections: [] } });
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
  assert.deepEqual(flat(sections()[0].blocks[1]).pos, { col: 1, span: 120, row: 9 }); // below
  assert.equal(rowsOf(sections()[0]), 9);
  assert.equal(sections()[0].rows, undefined); // its rows: down to its lowest block, not stored
  assert.ok(isId(b.id, 'b'));
  duplicateBlock(store, F, 0, 1);
  assert.deepEqual(types()[0], 'heading+button+button');
  assert.equal(flat(sections()[0].blocks[2]).pos.row, 17);
  moveBlock(store, F, 0, 2, 0);
  assert.deepEqual(types()[0], 'button+heading+button');
  // to another section: free, below its blocks; one undo step
  moveBlockTo(store, F, 0, 0, 1, 0);
  assert.deepEqual(types().slice(0, 2), ['heading+button', 'button+text']);
  assert.equal(flat(sections()[1].blocks[0]).pos.row > 1, true);
  store.undo();
  assert.deepEqual(types()[0], 'button+heading+button');
  removeBlock(store, F, 0, 0);
  assert.deepEqual(types()[0], 'heading+button');
  placeBlock(store, F, 0, 1, { col: 13, span: 12, row: 30, rows: 4 });
  assert.deepEqual(flat(sections()[0].blocks[1]).pos, { col: 13, span: 12, row: 30 });
  assert.equal(rowsOf(sections()[0]), 30); // a section grows to fit
  placeBlock(store, F, 0, 1, { col: 13, span: 12, row: 40, rows: 4 });
  assert.equal(rowsOf(sections()[0]), 40); // grown in the same step
  layerBlock(store, F, 0, 1, 1);
  assert.equal(sections()[0].blocks[1].z, 1);
  layerBlock(store, F, 0, 1, -1);
  assert.equal(sections()[0].blocks[1].z, undefined);
  setSection(store, F, 1, { height: 'half', name: 'Our people' });
  assert.deepEqual([sections()[1].height, sections()[1].name], ['half', 'Our people']);
  assert.deepEqual(checkContent(F, store.current[F]), []);

  store.undo(); // section settings
  store.undo(); // layer down
  store.undo(); // layer up
  store.undo(); // the second drag
  assert.equal(rowsOf(sections()[0]), 30);
  store.undo(); // the first drag
  assert.deepEqual(flat(sections()[0].blocks[1]).pos, { col: 1, span: 120, row: 9 });
  assert.equal(rowsOf(sections()[0]), 9); // down to its lowest block again
  store.undo(); // remove
  assert.deepEqual(types()[0], 'button+heading+button');
  store.redo();
  assert.deepEqual(types()[0], 'heading+button');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'));
  for (const f of ['settings/site.json', 'settings/animations.json', 'pages/index.json']) {
    fs.mkdirSync(path.dirname(path.join(root, 'content/en', f)), { recursive: true });
    fs.copyFileSync(path.join('content/en', f), path.join(root, 'content/en', f));
  }
  fs.mkdirSync(path.join(root, 'content/en/pages/test'));
  fs.writeFileSync(path.join(root, 'content/en', F), '{ "version": 1, "id": "pg-xxxx" }');
  assert.equal(save(root, { [F]: store.current[F] }).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'content/en', F), 'utf8'));
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
  s.blocks[0].title = 'Edited headline';
  const r = renderOp(render, '.', {}, { path: '/about/', file, data, ids: [s.id] });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.html), [s.id]);
  const html = r.body.html[s.id];
  assert.match(
    html,
    new RegExp(
      `^<section class="sec" data-sec="${s.id}" style="--rows:${rowsOf(s)};--mrows:${Math.ceil(rowsOf(s) / 2)}">`,
    ),
  );
  assert.match(html, /Edited headline/);
  assert.match(html, /data-edit="pages\/about\/index\.json#\/sections\/0\/blocks\/0\/title"/);
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
