import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paramPage } from './test-layout.mjs';
import {
  defaultField,
  defaultWhere,
  hasField,
  matches,
  query,
  ruleOf,
  unmatched,
  valueOf,
} from '../src/site/query.js';
import { widgetItems, mainAt, mainProblem, sourceOf } from '../src/site/layout/source.js';
import { buildRoutes } from '../src/site/routes.js';
import { contentFromFiles } from '../src/site/files.js';
import { checkContent } from '../src/site/validate.js';
import { itemHref } from '../src/site/helpers.js';

const schema = {
  version: 1,
  title: 'name',
  fields: [
    { key: 'name', type: 'text' },
    { key: 'person', type: 'text' },
    { key: 'year', type: 'text' },
  ],
};
const shoots = [
  { id: 's-1', name: 'Dunes', person: 'noor', year: 2024 },
  { id: 's-2', name: 'Forest Walk', person: 'Noor', year: '2024' },
  { id: 's-3', name: 'City', person: 'p-daan', year: '2025' },
  { id: 's-4', name: 'Odd', year: '2023' },
];
const and = (...rules) => ({ op: 'and', rules });
const names = (list) => list.map((s) => s.id);

test('query: a field as a URL part, slug the item’s slug', () => {
  assert.equal(valueOf(shoots[1], 'slug', schema), 'forest-walk');
  assert.equal(valueOf(shoots[1], 'person', schema), 'noor'); // slugified
  assert.equal(valueOf(shoots[0], 'year', schema), '2024'); // numbers too
  assert.equal(valueOf(shoots[3], 'person', schema), '');
  assert.ok(hasField(schema, 'slug') && hasField(schema, 'year') && !hasField(schema, 'when'));
  // the default: the field of the same name, else slug
  assert.equal(defaultField('year', schema), 'year');
  assert.equal(defaultField('model', schema), 'slug');
  assert.deepEqual(
    defaultWhere(['person', 'slug'], schema),
    and({ param: 'person', field: 'person' }, { param: 'slug', field: 'slug' }),
  );
});

test('query: every rule must match; a param without a rule (Any) doesn’t filter', () => {
  const where = and({ param: 'person', field: 'person' }, { param: 'year', field: 'year' });
  assert.deepEqual(names(query(shoots, where, { person: 'noor', year: '2024' }, { schema })), [
    's-1',
    's-2',
  ]);
  assert.deepEqual(names(query(shoots, where, { person: 'noor', year: '2025' }, { schema })), []);
  // [year] on Any
  const any = and({ param: 'person', field: 'person' });
  assert.deepEqual(names(query(shoots, any, { person: 'noor', year: '1999' }, { schema })), [
    's-1',
    's-2',
  ]);
  assert.equal(ruleOf(any, 'year'), undefined);
  // no rules, no where: every item, in order
  assert.deepEqual(names(query(shoots, and(), {}, { schema })), names(shoots));
  assert.deepEqual(names(query(shoots, undefined, {}, { schema })), names(shoots));
  // a rule for a param the page doesn't have: nothing to match
  assert.deepEqual(names(query(shoots, where, {}, { schema })), names(shoots));
  assert.deepEqual(query('nope', where, {}), []);
});

test('query: a field holding the id of the param’s item matches (refs); groups nest', () => {
  const where = and({ param: 'person', field: 'person' });
  assert.deepEqual(names(query(shoots, where, { person: 'daan' }, { schema })), []);
  assert.deepEqual(
    names(query(shoots, where, { person: 'daan' }, { schema, refs: { person: 'p-daan' } })),
    ['s-3'],
  );
  // groups: room for more kinds of rules
  const or = {
    op: 'or',
    rules: [and({ param: 'year', field: 'year' }), { param: 'person', field: 'person' }],
  };
  assert.deepEqual(names(query(shoots, or, { year: '2023', person: 'noor' }, { schema })), [
    's-1',
    's-2',
    's-4',
  ]);
  assert.equal(matches(shoots[0], and({ param: 'x' }), { x: 'a' }), false); // a broken rule
});

test('unmatched: Any and a missing field, per param, in address order', () => {
  const where = and({ param: 'year', field: 'when' });
  assert.deepEqual(unmatched(where, ['person', 'year'], schema), [
    { param: 'person', problem: 'any' },
    { param: 'year', problem: 'missing', field: 'when' },
  ]);
  assert.deepEqual(
    unmatched(defaultWhere(['person', 'year'], schema), ['person', 'year'], schema),
    [],
  );
});

/** People and shoots, a [person] and a [person]/[year] page. */
const site = (inner = {}, files = {}) =>
  contentFromFiles({
    'settings/site.json': { name: 'S', title: 'S' },
    'pages/people/index.json': { title: 'People' },
    'pages/people/[person]/index.json': paramPage('people/[person]', 'people'),
    'pages/people/[person]/[year]/index.json': paramPage(
      'people/[person]/[year]',
      'shoots',
      { person: 'person', year: 'year' },
      inner,
    ),
    'sources/people.json': {
      version: 1,
      items: [
        { id: 'p-noor', slug: 'noor', name: 'Noor' },
        { id: 'p-daan', slug: 'daan', name: 'Daan' },
        { id: 'p-mila', slug: 'mila', name: 'Mila' },
      ],
    },
    'sources/shoots.json': { version: 1, items: shoots },
    'sources/shoots.schema.json': schema,
    ...files,
  });
const years = (c) =>
  buildRoutes(c)
    .routes.filter((r) => r.id === 'people/[person]/[year]')
    .map((r) => [r.path, r.count, r.album?.id]);

test('main widget: a page per value of its own param among the items the outer params match', () => {
  assert.deepEqual(years(site()), [
    ['/people/noor/2024/', 2, 's-1'], // two shoots, one page: its item the first
    ['/people/daan/2025/', 1, 's-3'], // by id reference
  ]); // mila: no shoots, no pages; s-4 names no person
  assert.equal(mainProblem(site(), 'people/[person]/[year]'), null);
  // a link to the second item of a page goes to that page
  const c = site();
  const ctx = { ...c, routes: buildRoutes(c).routes };
  assert.equal(itemHref(ctx, 'shoots', shoots[1]), '/people/noor/2024/');
  assert.equal(mainAt(site().pages['people/[person]']).widget.id, 'b-main');
});

test('main widget: a list widget decides too (a page exists if at least one item matches)', () => {
  const c = site({
    sections: [
      {
        id: 's-main',
        widgets: [
          {
            id: 'b-main',
            type: 'albums',
            source: {
              mode: 'url',
              from: 'shoots',
              where: and({ param: 'person', field: 'person' }, { param: 'year', field: 'year' }),
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    years(c).map(([p, n]) => [p, n]),
    [
      ['/people/noor/2024/', 2],
      ['/people/daan/2025/', 1],
    ],
  );
  // what it shows on its page: every matching item
  const route = buildRoutes(c).routes.find((r) => r.path === '/people/noor/2024/');
  const widget = c.pages['people/[person]/[year]'].sections[0].widgets[0];
  assert.deepEqual(names(widgetItems(c, route, widget).items), ['s-1', 's-2']);
});

test('main widget: none, not From URL, Any or a missing field: no pages, says why', () => {
  const kind = (c) => mainProblem(c, 'people/[person]/[year]')?.kind;
  const at = (c) => c.pages['people/[person]/[year]'];
  const none = site({ main: undefined });
  assert.equal(kind(none), 'none');
  assert.deepEqual(years(none), []);
  const item = site();
  at(item).sections[0].widgets[0].source = { mode: 'item', from: 'shoots', id: 'p-xxxx' };
  assert.equal(kind(item), 'mode');
  const any = site();
  at(any).sections[0].widgets[0].source.where.rules.pop();
  assert.deepEqual(mainProblem(any, 'people/[person]/[year]'), {
    kind: 'any',
    message: 'No pages are built: [year] needs a field to match',
    param: 'year',
    problem: 'any',
  });
  assert.deepEqual(years(any), []);
  const missing = site();
  at(missing).sections[0].widgets[0].source.where.rules[0].field = 'model';
  assert.equal(
    mainProblem(missing, 'people/[person]/[year]').message,
    'No pages are built: [person] matches no field',
  );
  assert.deepEqual(years(missing), []);
  // it still saves: a page whose main widget can't decide is valid content
  assert.deepEqual(
    checkContent('pages/people/[person]/[year]/index.json', {
      version: 1,
      kind: 'page',
      id: 'pg-t200',
      ...at(missing),
    }).filter((p) => !/id/.test(p)),
    [],
  );
});

test('source shapes: modes per widget kind, where rules', () => {
  const page = (source, type = 'album') => ({
    version: 1,
    kind: 'page',
    id: 'pg-t201',
    sections: [{ id: 's-t201', widgets: [{ id: 'b-t201', type, source }] }],
  });
  const F = 'pages/people/[person]/index.json';
  const check = (...a) => checkContent(F, page(...a));
  assert.deepEqual(check({ mode: 'item', from: 'people', id: 'p-3pdk' }), []);
  assert.deepEqual(check({ mode: 'url', from: 'people', where: and() }), []);
  assert.deepEqual(check({ mode: 'all', from: 'people' }, 'albums'), []);
  assert.match(check({ mode: 'all', from: 'people' }).join(), /for list widgets/);
  assert.match(check({ mode: 'item', from: 'people', id: 'p-3pdk' }, 'albums').join(), /a list/);
  assert.match(check({ mode: 'nope', from: 'people' }).join(), /"source" must be/);
  const twice = and({ param: 'person', field: 'slug' }, { param: 'person', field: 'name' });
  assert.match(check({ mode: 'url', from: 'people', where: twice }).join(), /one rule per param/);
  assert.match(
    check({ mode: 'url', from: 'people', where: { op: 'or', rules: [] } }).join(),
    /"source.where" must be/,
  );
  assert.equal(sourceOf({ source: { mode: 'url' } }), null); // no from: None
});
