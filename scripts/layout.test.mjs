import { flat, lay, warnings } from './test-layout.mjs';
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
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import { newWidget, newSection, renderSections, rowsOf } from '../src/site/layout/index.js';
import { idsOf, isId, newId } from '../src/site/layout/ids.js';
import { createStore } from '../src/editor/store.js';
import {
  addWidget,
  addSection,
  duplicateWidget,
  duplicateSection,
  layerWidget,
  moveWidget,
  moveWidgetTo,
  moveSection,
  placeWidget,
  removeWidget,
  removeSection,
  setSection,
} from '../src/editor/layout-ops.js';

const content = loadContent('.');
const { routes } = buildRoutes(content);
const ctxOf = (route) => ({ ...content, route, routes, curtains: {} });
const page = routes.find((r) => r.path === '/about/');
const item = routes.find((r) => r.album);
const F = 'pages/test/index.json';

/** A section of widgets (given as [type, fields] or widgets), with fixed ids. */
let n = 0;
const id = (kind) => `${kind}-t${String(++n).padStart(3, '0')}`;
const widget = (type, more = {}) => lay({ id: id('b'), type, ...more });
// a Text widget's body: one paragraph line
const lines = (t) => [{ style: 'paragraph', text: [{ t }] }];
const section = (widgets, more = {}) => ({ id: id('s'), widgets, ...more });

/** Console warnings while fn runs. */

test('ids: s-/b- with 4+ letters or digits, new ones never taken', () => {
  assert.ok(isId('s-k3x9', 's'));
  assert.ok(isId('b-7qpa', 'b'));
  assert.ok(!isId('s-k3x9', 'b'));
  assert.ok(!isId('s-K3', 's'));
  const taken = new Set();
  for (let i = 0; i < 300; i++) assert.ok(isId(newId('b', taken), 'b'));
  assert.equal(taken.size, 300);
  const list = [section([widget('text'), widget('photo')])];
  assert.equal(idsOf(list).size, 3);
});

test('registry: every widget type has a label, an icon and renders its defaults', () => {
  for (const [type, t] of Object.entries(WIDGET_TYPES)) {
    assert.equal(t.type, type);
    assert.ok(t.label && t.icon, type);
    const route = t.item ? item : page;
    const ids = new Set();
    const list = [newSection(ids, [newWidget(type, ids)])];
    const out = renderSections(ctxOf(route), route, F, list);
    assert.match(out, new RegExp(`<div class="wgt wgt--${type} wgt--auto"`), type); // auto: the default
    assert.deepEqual(
      checkContent(F, { version: 1, kind: 'page', id: 'pg-t006', sections: list }),
      [],
      type,
    );
  }
});

test("a widget whose source or item is cleared (the editor's ✕) still renders, and validates", () => {
  for (const [type, t] of Object.entries(WIDGET_TYPES)) {
    const route = t.item ? item : page;
    const ids = new Set();
    const b = newWidget(type, ids);
    for (const c of t.config || []) if (c.type === 'source') delete b.config?.[c.key];
    for (const f of t.fields || []) if (f.type === 'source') delete b[f.key];
    delete b.item;
    const list = [newSection(ids, [b])];
    assert.doesNotThrow(() => renderSections(ctxOf(route), route, F, list), type);
    assert.deepEqual(
      checkContent(F, { version: 1, kind: 'page', id: 'pg-t007', sections: list }),
      [],
      type,
    );
  }
});

test('a list widget without a source: its head without a link, no items (not a default list)', () => {
  for (const type of ['grid', 'projects', 'albums']) {
    const ids = new Set();
    const b = newWidget(type, ids);
    delete b.source; // None
    const out = renderSections(ctxOf(page), page, F, [newSection(ids, [b])]);
    assert.doesNotMatch(out, /section__cta|<img/, type);
  }
});

test('render: sections are grids, widgets carry their area; off is hidden', () => {
  const list = [
    section([
      widget('text', {
        body: lines('One'),
        layout: { base: { col: 3, span: 10, row: 2, rows: 4 } },
        z: 2,
      }),
    ]),
    section([widget('text', { body: lines('Two'), config: { enabled: false } })], {
      name: 'Our People',
      height: 'full',
      width: 'full',
    }),
    section([widget('text', { body: lines('Three') })], { enabled: false }),
  ];
  const out = renderSections(ctxOf(page), page, F, list);
  // rows: down to the lowest widget; the phone grid's rows: its widgets' halved areas
  // no space above or below (no --pt / --pb): the rows between sections are the space
  assert.match(out, /<section class="sec" style="--rows:5;--mrows:3">/);
  assert.match(
    out,
    /<div class="wgt wgt--text wgt--auto" style="--c:3;--s:10;--r:2;--rs:4;--z:2;--mc:2;--ms:5;--mr:1;--mrs:2">/,
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
  const mobile = [section([widget('text', { phone: { col: 1, span: 24, row: 1, rows: 2 } })])];
  assert.match(
    renderSections(ctxOf(page), page, F, mobile),
    /class="sec"[\s\S]*;--mc:1;--ms:24;--mr:1;--mrs:1"/,
  );
  // links and scaled text on the element
  const linked = [
    section([
      widget('text', { id: 'b-lead' }),
      widget('text', {
        id: 'b-foll',
        link: { to: 'b-lead', gap: -3 },
        scale: { on: true, adjust: 120 },
      }),
    ]),
  ];
  const lo = renderSections(ctxOf(page), page, F, linked);
  assert.match(
    lo,
    /class="wgt wgt--text wgt--auto wgt--scale"[^>]*;--tk:1.2" data-link="b-lead -3" data-mlink="b-lead -2"/,
  );
  // a widget can't run past column 120
  const wide = [
    section([widget('text', { layout: { base: { col: 116, span: 10, row: 1, rows: 1 } } })]),
  ];
  assert.match(renderSections(ctxOf(page), page, F, wide), /--c:116;--s:5;/);
});

test('render: no automatic numbering; a heading can be numbered, counting the ones that are on', () => {
  // a Text widget: its label numbered (its first label line), then its title
  const heading = (title, numbered, more) =>
    widget('text', {
      body: [
        { style: 'label', text: [{ t: `L${title}` }] },
        { style: 'title', text: [{ t: title }] },
      ],
      config: { numbered },
      ...more,
    });
  const list = [
    section([heading('A', true), heading('B', false)]),
    section([heading('C', true)], { enabled: false }),
    section([
      heading('D', true),
      widget('grid', { title: 'G', eyebrow: 'L', config: { source: 'people' } }),
    ]),
  ];
  const out = renderSections(ctxOf(page), page, F, list);
  assert.match(out, /\(01\) <\/span>LA</);
  assert.match(out, /\(02\) <\/span>LD</);
  assert.doesNotMatch(out, /\(03\)/);
  assert.match(out, /data-anim="section.label">L</); // a grid head has no number
});

test('render: editor markers point into the widgets, only when editable', () => {
  const list = [section([widget('photo'), widget('text')])];
  assert.doesNotMatch(renderSections(ctxOf(page), page, F, list), /data-edit|data-sec|data-widget/);
  setEditable(true);
  try {
    const out = renderSections(ctxOf(page), page, F, list);
    assert.match(out, new RegExp(`data-sec="${list[0].id}"`));
    assert.match(out, new RegExp(`data-widget="${list[0].widgets[1].id}"`));
    assert.match(
      out,
      /data-edit="pages\/test\/index\.json#\/sections\/0\/widgets\/1\/body" data-edit-type="rich"/,
    );
  } finally {
    setEditable(false);
  }
});

test('render: an unknown type, or an item type without an item, warns and is skipped', () => {
  const [out, seen] = warnings(() =>
    renderSections(ctxOf(page), page, F, [
      section([
        widget('nope'),
        widget('album', { source: undefined }),
        widget('text', { body: lines('x') }),
      ]),
    ]),
  );
  assert.doesNotMatch(out, /data-album/);
  assert.match(out, /<p class="ts ts--paragraph" data-line="paragraph">x<\/p>/);
  assert.match(seen.join('\n'), /unknown widget type "nope"/);
  assert.match(seen.join('\n'), /"album" widget shows an item: it has none/);
  assert.match(render.renderRoute(item, content).body, /data-album/);
});

test('validation: the layout, then each widget against its type', () => {
  const problems = (sections) =>
    checkContent(F, { version: 1, kind: 'page', id: 'pg-t007', sections });
  const ok = (more) => section([widget('text')], more);
  assert.deepEqual(problems([ok()]), []);
  assert.deepEqual(problems([3]), ['section 1 must be an object']);
  assert.deepEqual(problems([{ id: 's-aaaa' }]), ['section 1: "widgets" must be a list']);
  assert.deepEqual(problems([{ id: 'x', widgets: [] }]), [
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
  assert.deepEqual(one({ title: 'x' }), ['section 1, widget 1 needs a "type"']);
  assert.deepEqual(one({ type: 'unknown-type', anything: 1 }), []);
  assert.deepEqual(one({ type: 'text', layout: { base: { col: 116, span: 10, row: 1 } } }), [
    'section 1, widget 1 (Text): "layout.base" must end by column 120 (col 116 + span 10)',
  ]);
  assert.match(
    one({ type: 'text', layout: { base: { col: 0, span: 1, row: 1 } } })[0],
    /layout.base.col/,
  );
  assert.match(one({ type: 'text', z: 1.5 })[0], /"z" must be a whole number/);
  assert.match(one({ type: 'text', body: 3 })[0], /\(Text\): "body" must be a list of lines/);
  assert.match(
    one({ type: 'text', body: [{ style: 'huge', text: [{ t: 'x', marks: ['u'] }] }] }).join(),
    /"body\.0\.style" must be one of title[\s\S]*"body\.0\.text\.0\.marks" must/,
  );
  assert.match(one({ type: 'about', facts: ['x'] })[0], /list of objects/);
  assert.match(one({ type: 'grid', config: { layout: 'wild' } })[0], /one of staggered, even/);
  assert.match(one({ type: 'text', config: { numbered: 'yes' } })[0], /must be a boolean/);
  assert.match(one({ type: 'text', config: { enabled: 1 } })[0], /true or false/);
  const twice = section([widget('text'), widget('text')]);
  twice.widgets[1].id = twice.widgets[0].id;
  assert.deepEqual(problems([twice]), [`the id "${twice.widgets[0].id}" is used twice`]);
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

test('ops: sections and widgets added, copied, moved, removed; one undo step each', () => {
  const store = createStore();
  store.load({ [F]: { version: 1, kind: 'page', id: 'pg-t008', sections: [] } });
  const sections = () => store.current[F].sections;
  const types = () => sections().map((s) => s.widgets.map((b) => b.type).join('+'));
  addSection(store, F, 'photo');
  addSection(store, F, 'text', 0);
  addSection(store, F); // empty
  assert.deepEqual(types(), ['text', 'photo', '']);
  assert.ok(sections().every((s) => isId(s.id, 's') && s.widgets.every((b) => isId(b.id, 'b'))));
  duplicateSection(store, F, 0);
  assert.deepEqual(types(), ['text', 'text', 'photo', '']);
  assert.notEqual(sections()[0].id, sections()[1].id);
  assert.notEqual(sections()[0].widgets[0].id, sections()[1].widgets[0].id);
  moveSection(store, F, 2, 0);
  assert.deepEqual(types(), ['photo', 'text', 'text', '']);
  assert.equal(moveSection(store, F, 0, -1), false);
  removeSection(store, F, 3);
  assert.deepEqual(types(), ['photo', 'text', 'text']);

  const b = addWidget(store, F, 0, 'button');
  assert.deepEqual(flat(sections()[0].widgets[1]).pos, { col: 1, span: 120, row: 9 }); // below
  assert.equal(rowsOf(sections()[0]), 9);
  assert.equal(sections()[0].rows, undefined); // its rows: down to its lowest widget, not stored
  assert.ok(isId(b.id, 'b'));
  duplicateWidget(store, F, 0, 1);
  assert.deepEqual(types()[0], 'photo+button+button');
  assert.equal(flat(sections()[0].widgets[2]).pos.row, 17);
  moveWidget(store, F, 0, 2, 0);
  assert.deepEqual(types()[0], 'button+photo+button');
  // to another section: free, below its widgets; one undo step
  moveWidgetTo(store, F, 0, 0, 1, 0);
  assert.deepEqual(types().slice(0, 2), ['photo+button', 'button+text']);
  assert.equal(flat(sections()[1].widgets[0]).pos.row > 1, true);
  store.undo();
  assert.deepEqual(types()[0], 'button+photo+button');
  removeWidget(store, F, 0, 0);
  assert.deepEqual(types()[0], 'photo+button');
  placeWidget(store, F, 0, 1, { col: 13, span: 12, row: 30, rows: 4 });
  assert.deepEqual(flat(sections()[0].widgets[1]).pos, { col: 13, span: 12, row: 30 });
  assert.equal(rowsOf(sections()[0]), 30); // a section grows to fit
  placeWidget(store, F, 0, 1, { col: 13, span: 12, row: 40, rows: 4 });
  assert.equal(rowsOf(sections()[0]), 40); // grown in the same step
  layerWidget(store, F, 0, 1, 1);
  assert.equal(sections()[0].widgets[1].z, 1);
  layerWidget(store, F, 0, 1, -1);
  assert.equal(sections()[0].widgets[1].z, undefined);
  setSection(store, F, 1, { height: 'half', name: 'Our people' });
  assert.deepEqual([sections()[1].height, sections()[1].name], ['half', 'Our people']);
  assert.deepEqual(checkContent(F, store.current[F]), []);

  store.undo(); // section settings
  store.undo(); // layer down
  store.undo(); // layer up
  store.undo(); // the second drag
  assert.equal(rowsOf(sections()[0]), 30);
  store.undo(); // the first drag
  assert.deepEqual(flat(sections()[0].widgets[1]).pos, { col: 1, span: 120, row: 9 });
  assert.equal(rowsOf(sections()[0]), 9); // down to its lowest widget again
  store.undo(); // remove
  assert.deepEqual(types()[0], 'button+photo+button');
  store.redo();
  assert.deepEqual(types()[0], 'photo+button');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'));
  for (const f of ['settings/site.json', 'settings/animations.json', 'pages/index.json']) {
    fs.mkdirSync(path.dirname(path.join(root, 'content/en', f)), { recursive: true });
    fs.copyFileSync(path.join('content/en', f), path.join(root, 'content/en', f));
  }
  fs.mkdirSync(path.join(root, 'content/en/pages/test'));
  fs.writeFileSync(
    path.join(root, 'content/en', F),
    '{ "version": 1, "kind": "page", "id": "pg-xxxx" }',
  );
  assert.equal(save(root, { [F]: store.current[F] }).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'content/en', F), 'utf8'));
  assert.deepEqual(
    saved.sections.map((s) => s.widgets.length),
    [2, 1, 1],
  );
  const bad = { sections: [section([widget('text', { body: 3 })])] };
  assert.equal(save(root, { [F]: bad }).status, 400);
});

test('render endpoint: one section of a page, from the editor copy over the drafts', () => {
  const file = 'pages/about/index.json';
  const data = structuredClone(content.pages.about);
  const [s] = data.sections;
  s.widgets[0].title = 'Edited headline';
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
  assert.match(html, /data-edit="pages\/about\/index\.json#\/sections\/0\/widgets\/0\/title"/);
  assert.match(html, /<\/section>$/);
  // the item of a [param] page
  const slug = routes.find((r) => r.album);
  const tpl = content.pages[slug.id];
  const out = renderOp(
    render,
    '.',
    {},
    {
      path: slug.path,
      file: `pages/${slug.id}/index.json`,
      data: tpl,
      ids: [tpl.sections[0].id],
    },
  );
  assert.match(Object.values(out.body.html)[0], /data-album/);
  // wrong page, bad data, no ids
  assert.equal(renderOp(render, '.', {}, { path: '/', file, data, ids: [] }).status, 400);
  const bad = { sections: [{ id: 'x', widgets: [] }] };
  assert.equal(
    renderOp(render, '.', {}, { path: '/about/', file, data: bad, ids: [] }).status,
    400,
  );
  assert.equal(renderOp(render, '.', {}, { path: '/about/', file }).status, 400);
});

test('add widget: its source fits the page; removing the main widget leaves the page without one', () => {
  const store = createStore();
  const P = 'pages/people/[person]/index.json';
  const A = 'pages/about/index.json';
  const people = { version: 1, items: [{ id: 'p-noor', slug: 'noor', title: 'Noor' }] };
  const page = (id) => ({
    version: 1,
    kind: 'page',
    id,
    sections: [{ id: `s-${id.slice(3)}`, widgets: [] }],
  });
  store.load({
    'sources/people.json': people,
    'sources/people.schema.json': { version: 1, title: 'title', slug: 'slug', fields: [] },
    [P]: page('pg-t300'),
    [A]: page('pg-t301'),
  });
  const widget = (file, type) => addWidget(store, file, 0, type);
  // an album on a [param] page: From URL, [person] on slug (people has no "person" field)
  assert.deepEqual(widget(P, 'album').source, {
    mode: 'url',
    from: 'people',
    where: { op: 'and', rules: [{ param: 'person', field: 'slug' }] },
  });
  // off one: no params to match, so its source's first item; a list keeps All
  assert.deepEqual(widget(A, 'album').source, { mode: 'item', from: 'people', id: 'p-noor' });
  assert.deepEqual(widget(A, 'albums').source, { mode: 'all', from: 'people' });
  assert.equal(widget(A, 'text').source, undefined);
  // the main widget removed: "main" goes with it, one undo step
  const main = store.get(P, '/sections/0/widgets/0/id');
  store.set(P, '/main', main);
  removeWidget(store, P, 0, 0);
  assert.equal(store.get(P, '/main'), undefined);
  store.undo();
  assert.equal(store.get(P, '/main'), main);
  assert.equal(store.get(P, '/sections/0/widgets/0/id'), main);
});
