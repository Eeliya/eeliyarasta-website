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
const keys = new Set(['name', 'role', 'year', 'summary', 'images']);
const warnings = () => {
  const list = [];
  return Object.assign(list, { onwarn: (m) => list.push(m) });
};

test('resolve: custom values stay, { bind } takes the whole value, {{name}} fills text', () => {
  const w = warnings();
  const o = { item: noor, keys, onwarn: w.onwarn };
  assert.equal(resolve('Plain text', { ...o, def: { type: 'text' } }), 'Plain text');
  assert.equal(resolve({ bind: 'name' }, { ...o, def: { type: 'text' } }), 'Noor Vermeer');
  assert.equal(resolve({ bind: 'images' }, { ...o, def: { list: { src: 'image' } } }), noor.images);
  assert.equal(
    resolve('{{name}} ({{year}}), {{ role }}', { ...o, def: { type: 'text' } }),
    `Noor Vermeer (${noor.year}), ${noor.role}`,
  );
  assert.equal(w.length, 0);
  // a list of objects: each subkey's text
  assert.deepEqual(
    resolve([{ label: 'Role', value: '{{role}}' }], {
      ...o,
      def: { list: { label: { type: 'text' }, value: { type: 'text' } } },
    }),
    [{ label: 'Role', value: noor.role }],
  );
  // HTML stays text: the blocks escape it as before
  assert.equal(resolve('{{name}}', { item: { name: '<b>' }, def: {} }), '<b>');
});

test('resolve: unknown fields and missing items are empty, with a warning ({{name}} in the editor)', () => {
  const w = warnings();
  const o = { item: noor, keys, onwarn: w.onwarn, at: 'x' };
  assert.equal(resolve({ bind: 'nope' }, { ...o, def: { type: 'text' } }), '');
  assert.equal(resolve('Hi {{nope}}!', { ...o, def: { type: 'text' } }), 'Hi !');
  assert.equal(resolve({ bind: 'name' }, { ...o, item: null, def: { type: 'text' } }), '');
  assert.equal(resolve('{{name}}', { ...o, item: null, def: { type: 'text' } }), '');
  assert.deepEqual(resolve({ bind: 'images' }, { ...o, item: null, def: { list: {} } }), []);
  assert.equal(w.length, 5);
  assert.match(w[0], /^x: the item has no field "nope"/);
  // the editor's preview shows what can't be filled
  const p = { ...o, placeholders: true, def: { type: 'text' } };
  assert.equal(resolve('Hi {{nope}}', p), 'Hi {{nope}}');
  assert.equal(resolve({ bind: 'name' }, { ...p, item: null }), '{{name}}');
  assert.equal(resolve({ bind: 'x' }, { ...p, item: null, def: { type: 'image' } }), '');
  // an empty value of a known field: empty, no warning
  const w2 = warnings();
  assert.equal(resolve('{{role}}', { item: {}, keys, def: {}, onwarn: w2.onwarn }), '');
  assert.equal(w2.length, 0);
});

test('resolveBlock: bound fields and config links resolved; an unbound block is the same object', () => {
  const t = BLOCK_TYPES.heading;
  const plain = { ...newBlock('heading', new Set()), title: 'Hi' };
  assert.equal(resolveBlock(plain, t, { item: noor, source: 'people', ctx: content }), plain);
  const bound = {
    ...plain,
    title: { bind: 'name' },
    intro: '{{role}} in {{location}}',
    config: { href: { bind: 'slug' } },
  };
  const out = resolveBlock(bound, t, { item: noor, source: 'people', ctx: content });
  assert.equal(out.title, 'Noor Vermeer');
  assert.equal(out.intro, `${noor.role} in ${noor.location}`);
  assert.equal(out.config.href, noor.slug);
  assert.deepEqual(bound.title, { bind: 'name' }); // not changed in place
  assert.equal(bindTypeOf(t.fields[0]), 'text');
  assert.equal(bindTypeOf(BLOCK_TYPES.hero.fields.find((f) => f.key === 'photos')), 'photos');
  assert.equal(bindTypeOf(BLOCK_TYPES.about.fields.find((f) => f.key === 'paragraphs')), null);
  assert.equal(bindTypeOf({ key: 'href', type: 'text' }, { config: true }), 'link');
  assert.ok(isBound('{{a}}') && isBound({ bind: 'a' }) && !isBound('{a}') && !isBound(''));
});

test('item resolution: the block item, else the [slug] page item', () => {
  const daan = content.people.find((p) => p.slug === 'daan-okafor');
  assert.deepEqual(itemOf(content, {}, { item: { source: 'people', slug: 'daan-okafor' } }), {
    item: daan,
    source: 'people',
  });
  assert.deepEqual(itemOf(content, { album: noor, kind: 'people' }, {}), {
    item: noor,
    source: 'people',
  });
  // the block's own item wins on a [slug] page too
  assert.equal(
    itemOf(
      content,
      { album: noor, kind: 'people' },
      { item: { source: 'people', slug: 'daan-okafor' } },
    ).item,
    daan,
  );
  assert.equal(itemOf(content, {}, { item: { source: 'people', slug: 'nobody' } }).item, null);
  assert.equal(itemOf(content, {}, {}).item, null);
});

test('[slug] templates: the album title, facts and summary come from each item', () => {
  for (const route of routes.filter((r) => r.album)) {
    const html = render.renderRoute(route, content).body;
    const a = route.album;
    const h1 = html.match(/<h1 class="album__title"[^>]*>([^<]*)<\/h1>/)[1];
    assert.equal(h1, a.name.replace(/&/g, '&amp;'), route.path);
    if (a.summary) assert.match(html, /class="album__summary"/);
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
    crumb: 'Featured',
    title: '{{name}}, {{role}}',
    intro: { bind: 'summary' },
    item: { source: 'people', slug: 'noor-vermeer' },
  };
  const page = [newSection(ids, [heading])];
  const html = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.match(html, new RegExp(`Noor Vermeer, ${noor.role}`));
  assert.match(html, new RegExp(noor.summary.slice(0, 20)));
  delete heading.item;
  const empty = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.doesNotMatch(empty, /Noor/);
  setEditable(true);
  try {
    const ed = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
    assert.match(ed, /data-bound="[^"]*\/title" data-bound-missing>\{\{name\}\}, \{\{role\}\}/);
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
            block({ title: { bind: 'name' }, item: { source: 'people', slug: 'noor-vermeer' } }),
            block({ title: { bind: 'nope' }, item: { source: 'people', slug: 'noor-vermeer' } }),
            block({ title: { bind: 'images' }, item: { source: 'people', slug: 'noor-vermeer' } }),
            block({ title: '{{nope}}', item: { source: 'people', slug: 'noor-vermeer' } }),
            block({ title: { bind: 'name' } }),
            block({ title: 'x', item: { source: 'nope', slug: 'a' } }),
            block({ title: { bind: 'name' }, item: { source: 'people', slug: 'nobody' } }),
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
  assert.deepEqual(at(3), ['warn']);
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
    sections: [newSection(ids, [{ ...newBlock(type, ids), ...patch }])],
  });
  const F = 'pages/x/index.json';
  assert.deepEqual(checkContent(F, page({ title: { bind: 'name' }, intro: 'A {{role}}' })), []);
  assert.deepEqual(checkContent(F, page({ config: { href: { bind: 'slug' } } })), []);
  assert.deepEqual(checkContent(F, page({ item: { source: 'people', slug: 'a' } })), []);
  const one = (p, type) => checkContent(F, page(p, type)).join('; ');
  assert.match(one({ title: { bind: '' } }), /"title" must be \{ "bind": "<field>" \}/);
  assert.match(one({ title: { bind: 'a', x: 1 } }), /"title" must be \{ "bind"/);
  assert.match(one({ item: 'people' }), /"item" must be/);
  assert.match(one({ item: { source: 'People!', slug: 'a' } }), /"item" must be/);
  assert.match(
    one({ paragraphs: { bind: 'summary' } }, 'about'),
    /"paragraphs" must be a list of its own/,
  );
  assert.match(one({ src: '{{cover}}.jpg' }, 'photo'), /"src" must be its own value/);
});

test('Save refuses bindings that do not fit the schema', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bindings-'));
  for (const f of [
    'settings/site.json',
    'settings/animations.json',
    'sources/people.json',
    'sources/people.schema.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, 'content', f)), { recursive: true });
    fs.copyFileSync(path.join('content', f), path.join(root, 'content', f));
  }
  const F = 'pages/x/index.json';
  fs.mkdirSync(path.join(root, 'content/pages/x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content', F), '{}');
  const ids = new Set();
  const page = (title) => ({
    sections: [
      newSection(ids, [
        { ...newBlock('heading', ids), title, item: { source: 'people', slug: 'noor-vermeer' } },
      ]),
    ],
  });
  assert.equal(save(root, { [F]: page({ bind: 'name' }) }).status, 200);
  const bad = save(root, { [F]: page({ bind: 'nope' }) });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /people has no field "nope"/);
  assert.equal(save(root, { [F]: page({ bind: 'images' }) }).status, 400);
  // a {{name}} the source doesn't have only warns (the build), so it saves
  assert.equal(save(root, { [F]: page('{{nope}}') }).status, 200);
  // a schema change that breaks a saved page's binding is refused too
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'content/sources/people.schema.json')));
  fs.writeFileSync(path.join(root, 'content', F), JSON.stringify(page({ bind: 'role' })));
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
