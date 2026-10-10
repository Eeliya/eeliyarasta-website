import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save } from './editor-server.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { renderRoute } from '../src/site/render.js';
import { setEditable } from '../src/site/helpers.js';
import { checkContent } from '../src/site/validate.js';
import { SECTION_TYPES, newSection, renderSections } from '../src/site/sections/index.js';
import { createStore } from '../src/editor/store.js';
import {
  addSection,
  duplicateSection,
  moveSection,
  removeSection,
} from '../src/editor/section-ops.js';

const content = loadContent('.');
const { routes } = buildRoutes(content);
const ctxOf = (route) => ({ ...content, route, routes, curtains: {} });
const page = routes.find((r) => r.path === '/about/');
const item = routes.find((r) => r.album);
const F = 'pages/test/index.json';

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

test('registry: every type has a label, an icon and renders its defaults', () => {
  for (const [type, t] of Object.entries(SECTION_TYPES)) {
    assert.equal(t.type, type);
    assert.ok(t.label && t.icon, type);
    const route = t.item ? item : page;
    const out = renderSections(ctxOf(route), route, F, [newSection(type)]);
    assert.match(out, /<section\s/, type);
    assert.deepEqual(checkContent(F, { sections: [newSection(type)] }), [], type);
  }
});

test('render: in order; off is hidden; numbering counts the numbered ones that are on', () => {
  const ctx = ctxOf(page);
  const list = [
    { type: 'grid', title: 'A', config: { source: 'people' } },
    { type: 'text', text: 'One\n\nTwo' },
    { type: 'grid', title: 'B', config: { source: 'places', enabled: false } },
    { type: 'grid', title: 'C', config: { source: 'people' } },
  ];
  const out = renderSections(ctx, page, F, list);
  assert.ok(out.indexOf('>A<') < out.indexOf('<p>One'));
  assert.match(out, /<p>One<\/p>\s*<p>Two<\/p>/);
  assert.match(out, /\(01\)[\s\S]*\(02\)/);
  assert.doesNotMatch(out, /\(03\)/);
  assert.equal((out.match(/ hidden>/g) || []).length, 1);
});

test('render: editor markers point into the page file, only when editable', () => {
  const list = [{ type: 'heading', title: 'T', config: {} }];
  assert.doesNotMatch(renderSections(ctxOf(page), page, F, list), /data-edit|data-section/);
  setEditable(true);
  try {
    const out = renderSections(ctxOf(page), page, F, list);
    assert.match(out, /data-section="s0" data-section-kind="heading"/);
    assert.match(out, /data-edit="pages\/test\/index\.json#\/sections\/0\/title"/);
  } finally {
    setEditable(false);
  }
});

test('render: an unknown type, or an item type off a [slug] page, warns and is skipped', () => {
  const [out, seen] = warnings(() =>
    renderSections(ctxOf(page), page, F, [
      { type: 'nope' },
      { type: 'album' },
      { type: 'text', text: 'x' },
    ]),
  );
  assert.doesNotMatch(out, /data-album/);
  assert.match(out, /<p>x<\/p>/);
  assert.match(seen.join('\n'), /unknown section type "nope"/);
  assert.match(seen.join('\n'), /"album" section only works on a \[slug\] page/);
});

test('template pages: the album section shows the route item', () => {
  const html = renderRoute(item, content).body;
  assert.match(html, /data-album/);
  assert.ok(html.includes(item.album.name));
});

test('validation per type from the registry', () => {
  const problems = (sections) => checkContent(F, { sections });
  assert.deepEqual(problems([{ type: 'unknown-type', anything: 1 }]), []);
  assert.deepEqual(problems([3]), ['section 1 must be an object']);
  assert.deepEqual(problems([{ title: 'x' }]), ['section 1 needs a "type"']);
  assert.deepEqual(problems([{ type: 'heading', title: 3 }]), [
    'section 1 (Page heading): "title" must be a string',
  ]);
  assert.match(problems([{ type: 'about', paragraphs: 'x' }])[0], /"paragraphs" must be a list/);
  assert.match(problems([{ type: 'about', facts: ['x'] }])[0], /list of objects/);
  assert.match(
    problems([{ type: 'grid', config: { layout: 'wild' } }])[0],
    /one of staggered, even/,
  );
  assert.match(problems([{ type: 'heading', config: { center: 'yes' } }])[0], /must be a boolean/);
  assert.match(problems([{ type: 'text', config: { enabled: 1 } }])[0], /true or false/);
  assert.deepEqual(problems([{ type: 'heading', config: { count: '' } }]), []);
});

test('save path: add, duplicate, reorder, remove; one undo step each; Save writes the list', () => {
  const store = createStore();
  store.load({ [F]: { sections: [newSection('heading')] } });
  const types = () => store.current[F].sections.map((s) => s.type);
  addSection(store, F, 'text');
  addSection(store, F, 'photo', 1);
  assert.deepEqual(types(), ['heading', 'photo', 'text']);
  assert.deepEqual(store.current[F].sections[1], {
    type: 'photo',
    src: '',
    caption: '',
    config: { enabled: true },
  });
  duplicateSection(store, F, 2);
  moveSection(store, F, 0, 3);
  assert.deepEqual(types(), ['photo', 'text', 'text', 'heading']);
  assert.equal(moveSection(store, F, 0, -1), false);
  removeSection(store, F, 1);
  assert.deepEqual(types(), ['photo', 'text', 'heading']);
  store.undo();
  assert.deepEqual(types(), ['photo', 'text', 'text', 'heading']);
  store.undo();
  assert.deepEqual(types(), ['heading', 'photo', 'text', 'text']);
  store.undo();
  store.undo();
  assert.deepEqual(types(), ['heading', 'text']);
  store.redo();
  assert.deepEqual(types(), ['heading', 'photo', 'text']);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sections-'));
  for (const f of ['settings/site.json', 'settings/animations.json', 'pages/index.json']) {
    fs.mkdirSync(path.dirname(path.join(root, 'content', f)), { recursive: true });
    fs.copyFileSync(path.join('content', f), path.join(root, 'content', f));
  }
  fs.mkdirSync(path.join(root, 'content/pages/test'));
  fs.writeFileSync(path.join(root, 'content', F), '{}');
  assert.equal(save(root, { [F]: store.current[F] }).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'content', F), 'utf8'));
  assert.deepEqual(
    saved.sections.map((s) => s.type),
    ['heading', 'photo', 'text'],
  );
  const bad = { sections: [{ type: 'heading', title: 3 }] };
  assert.equal(save(root, { [F]: bad }).status, 400);
});
