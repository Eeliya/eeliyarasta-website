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
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { newWidget, newSection, renderSections } from '../src/site/layout/index.js';
import {
  bindTypeOf,
  bindingProblems,
  isBinding,
  resolve,
  resolveWidget,
} from '../src/site/layout/bindings.js';
import { createStore } from '../src/editor/store.js';
import { widgetItems } from '../src/site/layout/source.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const content = loadContent(SITE_A);
const { routes } = buildRoutes(content);
const noor = content.sources.people.find((p) => p.slug === 'noor-vermeer');
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
  // HTML stays text: the widgets escape it as before
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

test('resolveWidget: bound fields and config links resolved; an unbound widget is the same object', () => {
  // a type with a text, a multi-line text and a link (the registry's have one or two of them)
  const t = {
    fields: [{ key: 'title' }, { key: 'body', type: 'block' }],
    config: [{ key: 'link', type: 'link' }],
  };
  const plain = { ...newWidget('button', new Set()), title: 'Hi' };
  assert.equal(resolveWidget(plain, t, { item: noor, source: 'people', ctx: content }), plain);
  const bound = {
    ...plain,
    title: { bind: 'title' },
    body: { bind: 'role', format: '{value} in Amsterdam' },
    config: { link: { bind: 'slug' } },
  };
  const out = resolveWidget(bound, t, { item: noor, source: 'people', ctx: content });
  assert.equal(out.title, 'Noor Vermeer');
  assert.equal(out.body, `${noor.role} in Amsterdam`);
  assert.equal(out.config.link, noor.slug);
  assert.deepEqual(bound.title, { bind: 'title' }); // not changed in place
  assert.equal(bindTypeOf(t.fields[0]), 'text');
  assert.equal(bindTypeOf(WIDGET_TYPES.hero.fields.find((f) => f.key === 'photos')), 'photos');
  assert.equal(bindTypeOf(WIDGET_TYPES.about.fields.find((f) => f.key === 'body')), null);
  assert.equal(bindTypeOf({ key: 'link', type: 'link' }, { config: true }), 'link');
  assert.ok(isBinding({ bind: 'a' }) && !isBinding('{{a}}') && !isBinding(''));
});

test("item resolution: Item picks one, From URL the page's matches, None nothing", () => {
  const daan = content.sources.people.find((p) => p.slug === 'daan-okafor');
  const item = { source: { mode: 'item', from: 'people', id: 'p-3pdk' } };
  assert.equal(widgetItems(content, {}, item).item, daan);
  assert.equal(widgetItems(content, {}, item).source, 'people');
  const url = {
    source: {
      mode: 'url',
      from: 'people',
      where: { op: 'and', rules: [{ param: 'person', field: 'slug' }] },
    },
  };
  assert.equal(widgetItems(content, { params: { person: 'noor-vermeer' } }, url).item, noor);
  assert.equal(widgetItems(content, { params: { person: 'nobody' } }, url).item, null);
  const missing = { source: { mode: 'item', from: 'people', id: 'p-zzzz' } };
  assert.equal(widgetItems(content, {}, missing).item, null);
  assert.equal(widgetItems(content, {}, {}).item, null);
  assert.equal(widgetItems(content, {}, {}).source, null);
});

test('[param] templates: the album title, facts and summary come from each item', () => {
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
      /<h1 class="album__title" data-anim="album.title"\s+data-bound="pages\/photography\/people\/\[person\]\/index\.json#\/sections\/0\/widgets\/0\/title">/,
    );
    assert.doesNotMatch(html, /data-edit="[^"]*#\/sections\/0\/widgets\/0\/title"/);
  } finally {
    setEditable(false);
  }
});

test('a normal page: a widget with an item; without one its bound fields are empty', () => {
  const ids = new Set();
  // a Text widget's field runs (src/site/text.js): the item's fields in its lines
  const heading = {
    ...newWidget('text', ids),
    body: [
      { style: 'label', text: [{ t: 'Featured' }] },
      { style: 'title', text: [{ field: 'title', format: '{value}, model' }] },
      { style: 'paragraph', text: [{ field: 'body' }] },
    ],
    source: { mode: 'item', from: 'people', id: 'p-qw7b' },
  };
  const page = [newSection(ids, [heading])];
  const html = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.match(html, /Noor Vermeer, model/);
  assert.match(html, new RegExp(noor.body.slice(0, 20)));
  delete heading.source;
  const empty = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
  assert.doesNotMatch(empty, /Noor/);
  setEditable(true);
  try {
    const ed = renderSections(content, { id: 'x' }, 'pages/x/index.json', page);
    assert.match(ed, /data-field="title" data-format="\{value\}, model">\{\{title\}\}/);
  } finally {
    setEditable(false);
  }
});

test('bindingProblems: schema-aware errors and warnings', () => {
  const ids = new Set();
  // a Text widget: its title line one field (src/site/text.js), or a text
  const widget = ({ title, ...patch }) => ({
    ...newWidget('text', ids),
    body: [
      {
        style: 'title',
        text: [
          typeof title === 'string'
            ? { t: title }
            : { field: title.bind, ...(title.format ? { format: title.format } : {}) },
        ],
      },
    ],
    ...patch,
  });
  const c = {
    ...content,
    pages: {
      x: {
        sections: [
          newSection(ids, [
            widget({
              title: { bind: 'title' },
              source: { mode: 'item', from: 'people', id: 'p-qw7b' },
            }),
            widget({
              title: { bind: 'nope' },
              source: { mode: 'item', from: 'people', id: 'p-qw7b' },
            }),
            widget({
              title: { bind: 'images' },
              source: { mode: 'item', from: 'people', id: 'p-qw7b' },
            }),
            widget({
              title: { bind: 'title', format: '{value}!' },
              source: { mode: 'item', from: 'people', id: 'p-qw7b' },
            }),
            widget({ title: { bind: 'title' } }),
            widget({ title: 'x', source: { mode: 'item', from: 'nope', id: 'p-aaaa' } }),
            widget({
              title: { bind: 'title' },
              source: { mode: 'item', from: 'people', id: 'p-zzzz' },
            }),
          ]),
        ],
      },
    },
  };
  const out = bindingProblems(c, { types: WIDGET_TYPES });
  const at = (j) => out.filter((p) => p.message.includes(`widgets/${j})`)).map((p) => p.level);
  assert.deepEqual(at(0), []);
  assert.deepEqual(at(1), ['error']);
  assert.deepEqual(at(2), ['error']);
  assert.deepEqual(at(3), []);
  assert.deepEqual(at(4), ['warn']);
  assert.deepEqual(at(5), ['error']);
  assert.deepEqual(at(6), ['warn']);
  assert.match(
    out.find((p) => p.message.includes('widgets/2)')).message,
    /people\.images \(photos\) doesn't fit a text field/,
  );
  // the site's own pages: nothing wrong
  assert.deepEqual(render.bindingChecks(content), []);
});

test('validation: the shape of bindings and items', () => {
  const ids = new Set();
  const page = (patch, type = 'button') => ({
    version: 1,
    kind: 'page',
    id: 'pg-t004',

    sections: [newSection(ids, [{ ...newWidget(type, ids), ...patch }])],
  });
  const F = 'pages/x/index.json';
  assert.deepEqual(checkContent(F, page({ label: { bind: 'role', format: 'A {value}' } })), []);
  assert.deepEqual(checkContent(F, page({ config: { link: { bind: 'slug' } } })), []);
  assert.deepEqual(
    checkContent(F, page({ source: { mode: 'item', from: 'people', id: 'p-aaaa' } })),
    [],
  );
  const one = (p, type) => checkContent(F, page(p, type)).join('; ');
  assert.match(one({ label: { bind: '' } }), /"label" must be \{ "bind": "<field>", "format"/);
  assert.match(one({ label: { bind: 'a', x: 1 } }), /"label" must be \{ "bind"/);
  assert.match(one({ item: 'people' }), /"item" must be/);
  assert.match(one({ item: { source: 'People!', id: 'p-aaaa' } }), /"item" must be/);
  assert.match(one({ body: { bind: 'body' } }, 'about'), /"body" must be a list of its own/);
  assert.match(
    one({ src: { bind: 'cover', format: '{value}.jpg' } }, 'photo'),
    /"src.format" must be left out/,
  );
  assert.match(
    one({ label: { bind: 'a', format: 'no value' } }),
    /"label.format" must be a text with \{value\}/,
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
    fs.copyFileSync(path.join(SITE_A, 'content/en', f), path.join(root, 'content/en', f));
  }
  const F = 'pages/x/index.json';
  fs.mkdirSync(path.join(root, 'content/en/pages/x'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'content/en', F),
    '{ "version": 1, "kind": "page", "id": "pg-xxxx" }',
  );
  const ids = new Set();
  const page = (title) => ({
    version: 1,
    kind: 'page',
    id: 'pg-t005',

    sections: [
      newSection(ids, [
        {
          ...newWidget('button', ids),
          label: title,
          source: { mode: 'item', from: 'people', id: 'p-qw7b' },
        },
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
