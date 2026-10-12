import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save } from './editor-server.mjs';
import * as render from '../src/site/render.js';
import { buildRoutes } from '../src/site/routes.js';
import { setEditable } from '../src/site/helpers.js';
import { checkContent } from '../src/site/validate.js';
import { BLOCK_TYPES } from '../src/site/blocks/index.js';
import { newBlock, newSection, renderSections } from '../src/site/layout/index.js';
import {
  bindTypeOf,
  bindingProblems,
  isBound,
  itemOf,
  resolve,
  resolveBlock,
} from '../src/site/layout/bindings.js';
import { pageFile } from '../src/site/files.js';
import { createStore } from '../src/editor/store.js';

const content = loadContent('.');
const { routes } = buildRoutes(content);
const noor = content.people.find((p) => p.slug === 'noor-vermeer');
const keys = new Set(['title', 'role', 'year', 'body', 'images']);
const warnings = () => {
  const list = [];
  return Object.assign(list, { onwarn: (m) => list.push(m) });
};

test('resolve: custom values stay, { bind } takes the whole value, a format wraps text', () => {
  const w = warnings();
  const o = { item: noor, keys, onwarn: w.onwarn };
  assert.equal(resolve('Plain text', { ...o, def: { type: 'text' } }), 'Plain text');
  assert.equal(resolve({ bind: 'title' }, { ...o, def: { type: 'text' } }), 'Noor Vermeer');
  assert.equal(resolve({ bind: 'images' }, { ...o, def: { list: 'image' } }), noor.images);
  // a list of { src } (the hero's placed photos) gets the paths as { src }
  assert.deepEqual(
    resolve({ bind: 'images' }, { ...o, def: { list: { src: 'image' } } }),
    noor.images.map((src) => ({ src })),
  );
  assert.equal(
    resolve({ bind: 'year', format: '({value}) {value}' }, { ...o, def: { type: 'text' } }),
    `(${noor.year}) ${noor.year}`,
  );
  assert.equal(w.length, 0);
  // a list of objects: each subkey can be bound
  assert.deepEqual(
    resolve([{ label: 'Role', value: { bind: 'role' } }], {
      ...o,
      def: { list: { label: { type: 'text' }, value: { type: 'text' } } },
    }),
    [{ label: 'Role', value: noor.role }],
  );
  // HTML stays text: the blocks escape it as before
  assert.equal(resolve({ bind: 'title' }, { item: { title: '<b>' }, def: {} }), '<b>');
});

test('resolve: unknown fields and missing items are empty, with a warning ({{title}} in the editor preview)', () => {
  const w = warnings();
  const o = { item: noor, keys, onwarn: w.onwarn, at: 'x' };
  assert.equal(resolve({ bind: 'nope' }, { ...o, def: { type: 'text' } }), '');
  assert.equal(resolve({ bind: 'title' }, { ...o, item: null, def: { type: 'text' } }), '');
  // an empty value stays empty: no format around nothing
  assert.equal(resolve({ bind: 'nope', format: 'x {value}' }, { ...o, def: { type: 'text' } }), '');
  assert.deepEqual(resolve({ bind: 'images' }, { ...o, item: null, def: { list: {} } }), []);
  assert.equal(w.length, 4);
  assert.match(w[0], /^x: the item has no field "nope"/);
  // the editor's preview shows what can't be filled
  const p = { ...o, placeholders: true, def: { type: 'text' } };
  assert.equal(resolve({ bind: 'title' }, { ...p, item: null }), '{{title}}');
  assert.equal(resolve({ bind: 'x' }, { ...p, item: null, def: { type: 'image' } }), '');
  // an empty value of a known field: empty, no warning
  const w2 = warnings();
  assert.equal(resolve({ bind: 'role' }, { item: {}, keys, def: {}, onwarn: w2.onwarn }), '');
  assert.equal(w2.length, 0);
});

test('resolveBlock: bound fields and config links resolved; an unbound block is the same object', () => {
  const t = BLOCK_TYPES.heading;
  const plain = { ...newBlock('heading', new Set()), title: 'Hi' };
  assert.equal(resolveBlock(plain, t, { item: noor, source: 'people', ctx: content }), plain);
  const bound = {
    ...plain,
    title: { bind: 'title' },
    body: { bind: 'role', format: '{value} in Amsterdam' },
    config: { link: { bind: 'slug' } },
  };
  const out = resolveBlock(bound, t, { item: noor, source: 'people', ctx: content });
  assert.equal(out.title, 'Noor Vermeer');
  assert.equal(out.body, `${noor.role} in Amsterdam`);
  assert.equal(out.config.link, noor.slug);
  assert.deepEqual(bound.title, { bind: 'title' }); // not changed in place
  assert.equal(bindTypeOf(t.fields[0]), 'text');
  assert.equal(bindTypeOf(BLOCK_TYPES.hero.fields.find((f) => f.key === 'photos')), 'photos');
  assert.equal(bindTypeOf(BLOCK_TYPES.about.fields.find((f) => f.key === 'body')), null);
  assert.equal(bindTypeOf({ key: 'link', type: 'link' }, { config: true }), 'link');
  assert.ok(isBound({ bind: 'a' }) && !isBound('{{a}}') && !isBound(''));
});

test('item resolution: the block item, else the [slug] page item', () => {
  const daan = content.people.find((p) => p.slug === 'daan-okafor');
  assert.deepEqual(itemOf(content, {}, { item: { source: 'people', id: 'p-3pdk' } }), {
    item: daan,
    source: 'people',
  });
  assert.deepEqual(itemOf(content, { album: noor, kind: 'people' }, {}), {
    item: noor,
    source: 'people',
  });
  // the block's own item wins on a [slug] page too
  assert.equal(
    itemOf(content, { album: noor, kind: 'people' }, { item: { source: 'people', id: 'p-3pdk' } })
      .item,
    daan,
  );
  assert.equal(itemOf(content, {}, { item: { source: 'people', id: 'p-zzzz' } }).item, null);
  assert.equal(itemOf(content, {}, {}).item, null);
});

test('[slug] templates: the album title, facts and summary come from each item', () => {
  for (const route of routes.filter((r) => r.album)) {
    const html = render.renderRoute(route, content).body;
    const a = route.album;
    const h1 = html.match(/<h1 class="album__title"[^>]*>([^<]*)<\/h1>/)[1];
    assert.equal(h1, a.title.replace(/&/g, '&amp;'), route.path);
    if (a.body) assert.match(html, /class="album__summary"/);
    const facts = [...html.matchAll(/<dt class="label">([^<]*)<\/dt>/g)].map((m) => m[1]);
    const want = (route.kind === 'people' ? ['Role', 'Agency'] : [])
      .concat(['Location', 'Year'])
      .filter((k) => a[k.toLowerCase()] !== undefined && a[k.toLowerCase()] !== '')
      .concat('Photos');
    assert.deepEqual(facts, want, route.path);
  }
  // in the editor: bound values are marked, not editable
  setEditable(true);
  try {
    const route = routes.find((r) => r.album);
    const html = render.renderRoute(route, content, { editable: true }).body;
    assert.match(
      html,
      /<h1 class="album__title" data-anim="album.title"\s+data-bound="pages\/people\/\[slug\]\.json#\/sections\/0\/blocks\/0\/title">/,
    );
    assert.doesNotMatch(html, /data-edit="[^"]*#\/sections\/0\/blocks\/0\/title"/);
  } finally {
    setEditable(false);
  }
});

test('a normal page: a block with an item; without one its bound fields are empty', () => {
  const ids = new Set();
  const heading = {
    ...newBlock('heading', ids),
    eyebrow: 'Featured',
    title: { bind: 'title', format: '{value}, model' },
    body: { bind: 'body' },
    item: { source: 'people', id: 'p-qw7b' },
  };
  const page = [newSection(ids, [heading])];
  const html = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.match(html, /Noor Vermeer, model/);
  assert.match(html, new RegExp(noor.body.slice(0, 20)));
  delete heading.item;
  const empty = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.doesNotMatch(empty, /Noor/);
  setEditable(true);
  try {
    const ed = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
    assert.match(ed, /data-bound="[^"]*\/title" data-bound-missing>\{\{title\}\}/);
  } finally {
    setEditable(false);
  }
});

test('bindingProblems: schema-aware errors and warnings', () => {
  const ids = new Set();
  const block = (patch) => ({ ...newBlock('heading', ids), ...patch });
  const c = {
    ...content,
    pages: {
      x: {
        sections: [
          newSection(ids, [
            block({ title: { bind: 'title' }, item: { source: 'people', id: 'p-qw7b' } }),
            block({ title: { bind: 'nope' }, item: { source: 'people', id: 'p-qw7b' } }),
            block({ title: { bind: 'images' }, item: { source: 'people', id: 'p-qw7b' } }),
            block({
              title: { bind: 'title', format: '{value}!' },
              item: { source: 'people', id: 'p-qw7b' },
            }),
            block({ title: { bind: 'title' } }),
            block({ title: 'x', item: { source: 'nope', id: 'p-aaaa' } }),
            block({ title: { bind: 'title' }, item: { source: 'people', id: 'p-zzzz' } }),
          ]),
        ],
      },
    },
  };
  const out = bindingProblems(c, { types: BLOCK_TYPES, pageFile });
  const at = (j) => out.filter((p) => p.message.includes(`blocks/${j})`)).map((p) => p.level);
  assert.deepEqual(at(0), []);
  assert.deepEqual(at(1), ['error']);
  assert.deepEqual(at(2), ['error']);
  assert.deepEqual(at(3), []);
  assert.deepEqual(at(4), ['warn']);
  assert.deepEqual(at(5), ['error']);
  assert.deepEqual(at(6), ['warn']);
  assert.match(
    out.find((p) => p.message.includes('blocks/2)')).message,
    /people\.images \(photos\) doesn't fit a text field/,
  );
  // the site's own pages: nothing wrong
  assert.deepEqual(render.bindingChecks(content), []);
});

test('validation: the shape of bindings and items', () => {
  const ids = new Set();
  const page = (patch, type = 'heading') => ({
    version: 1,
    id: 'pg-t004',

    sections: [newSection(ids, [{ ...newBlock(type, ids), ...patch }])],
  });
  const F = 'pages/x/index.json';
  assert.deepEqual(
    checkContent(
      F,
      page({ title: { bind: 'title' }, body: { bind: 'role', format: 'A {value}' } }),
    ),
    [],
  );
  assert.deepEqual(checkContent(F, page({ config: { link: { bind: 'slug' } } })), []);
  assert.deepEqual(checkContent(F, page({ item: { source: 'people', id: 'p-aaaa' } })), []);
  const one = (p, type) => checkContent(F, page(p, type)).join('; ');
  assert.match(one({ title: { bind: '' } }), /"title" must be \{ "bind": "<field>", "format"/);
  assert.match(one({ title: { bind: 'a', x: 1 } }), /"title" must be \{ "bind"/);
  assert.match(one({ item: 'people' }), /"item" must be/);
  assert.match(one({ item: { source: 'People!', id: 'p-aaaa' } }), /"item" must be/);
  assert.match(one({ body: { bind: 'body' } }, 'about'), /"body" must be a list of its own/);
  assert.match(
    one({ src: { bind: 'cover', format: '{value}.jpg' } }, 'photo'),
    /"src.format" must be left out/,
  );
  assert.match(
    one({ title: { bind: 'a', format: 'no value' } }),
    /"title.format" must be a text with \{value\}/,
  );
});

test('Save refuses bindings that do not fit the schema', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bindings-'));
  for (const f of [
    'settings/site.json',
    'settings/animations.json',
    'sources/people.json',
    'sources/people.schema.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, 'content/en', f)), { recursive: true });
    fs.copyFileSync(path.join('content/en', f), path.join(root, 'content/en', f));
  }
  const F = 'pages/x/index.json';
  fs.mkdirSync(path.join(root, 'content/en/pages/x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/en', F), '{ "version": 1, "id": "pg-xxxx" }');
  const ids = new Set();
  const page = (title) => ({
    version: 1,
    id: 'pg-t005',

    sections: [
      newSection(ids, [
        { ...newBlock('heading', ids), title, item: { source: 'people', id: 'p-qw7b' } },
      ]),
    ],
  });
  assert.equal(save(root, { [F]: page({ bind: 'title' }) }).status, 200);
  const bad = save(root, { [F]: page({ bind: 'nope' }) });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /people has no field "nope"/);
  assert.equal(save(root, { [F]: page({ bind: 'images' }) }).status, 400);
  // a schema change that breaks a saved page's binding is refused too
  const schema = JSON.parse(
    fs.readFileSync(path.join(root, 'content/en/sources/people.schema.json')),
  );
  fs.writeFileSync(path.join(root, 'content/en', F), JSON.stringify(page({ bind: 'role' })));
  const without = { ...schema, fields: schema.fields.filter((f) => f.key !== 'role') };
  assert.equal(save(root, { 'sources/people.schema.json': without }).status, 400);
});

test('undo: typing in one field is one step until it is left (seal) or a pause', () => {
  const store = createStore();
  store.load({ 'a.json': { n: 1 } });
  for (const n of [4, 40, 401]) store.set('a.json', '/n', n, { key: 'num' });
  store.seal(); // blur / Enter
  for (const n of [5, 50]) store.set('a.json', '/n', n, { key: 'num' });
  store.undo();
  assert.equal(store.get('a.json', '/n'), 401);
  store.undo();
  assert.equal(store.get('a.json', '/n'), 1);
  assert.equal(store.canUndo(), false);
});
