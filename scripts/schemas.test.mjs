import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkItems,
  checkSchema,
  checkSources,
  inferSchema,
  newItemOf,
  schemaOf,
} from '../src/site/schemas.js';
import { buildRoutes } from '../src/site/routes.js';
import { contentFromFiles, isContentFile, schemaIdOf, sourceIdOf } from '../src/site/files.js';
import { checkContent } from '../src/site/validate.js';
import { save } from './editor-server.mjs';

const PEOPLE = {
  label: 'People',
  title: 'name',
  slug: 'slug',
  fields: [
    { key: 'slug', label: 'Slug', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'year', label: 'Year', type: 'number', width: 'half' },
    { key: 'kind', label: 'Kind', type: 'choice', options: ['model', 'band'] },
    { key: 'url', label: 'Link', type: 'link' },
    { key: 'shot', label: 'Shot on', type: 'date' },
    { key: 'image', label: 'Photo', type: 'photo' },
    { key: 'images', label: 'Photos', type: 'photos' },
    { key: 'placeholder', label: 'Placeholder', type: 'boolean' },
  ],
};

test('schema files: their own name, not a source; checked as a schema', () => {
  assert.equal(isContentFile('sources/people.schema.json'), true);
  assert.equal(sourceIdOf('sources/people.schema.json'), null);
  assert.equal(schemaIdOf('sources/people.schema.json'), 'people');
  assert.equal(isContentFile('sources/people.x.json'), false);
  const c = contentFromFiles({
    'sources/people.json': [],
    'sources/people.schema.json': PEOPLE,
  });
  assert.deepEqual(Object.keys(c.sources), ['people']);
  assert.equal(c.schemas.people, PEOPLE);
  assert.deepEqual(checkContent('sources/people.schema.json', PEOPLE), []);
  assert.deepEqual(checkContent('sources/people.schema.json', { title: 'x', fields: [{}] }), [
    'field 1: needs a "key"',
    'field 1: "type" must be one of text, longtext, number, photo, photos, link, choice, boolean, date',
    '"title" must be the key of one of its fields',
  ]);
  assert.deepEqual(
    checkSchema({
      title: 'a',
      fields: [
        { key: 'a', type: 'choice' },
        { key: 'a', type: 'text', width: 'wide' },
      ],
    }),
    [
      'field 1 ("a"): a choice needs "options", a list of values',
      'field 2 ("a"): another field has this key',
      'field 2 ("a"): "width" can only be "half"',
    ],
  );
});

test('inferSchema: one type per field from all items, title and slug', () => {
  const s = inferSchema('people', [
    { slug: 'a', name: 'Ann', year: 2024, bio: 'Short', cover: 'people/a/01.jpg', on: true },
    {
      slug: 'b',
      name: 'Bob',
      year: 2025,
      bio: 'Two\nlines',
      cover: '',
      on: false,
      images: [{ src: 'people/b/01.jpg' }],
      credit: { name: 'x' },
      mixed: 1,
    },
    { slug: 'c', name: 'A name that is much longer than short', mixed: 'one' },
  ]);
  assert.equal(s.label, 'People');
  assert.equal(s.title, 'name');
  assert.equal(s.slug, 'slug');
  const type = Object.fromEntries(s.fields.map((f) => [f.key, [f.type, f.width]]));
  assert.deepEqual(type, {
    slug: ['text', 'half'],
    name: ['text', undefined], // one of them is longer than 24 characters
    year: ['number', 'half'],
    bio: ['longtext', undefined], // a line break somewhere
    cover: ['photo', undefined],
    on: ['boolean', undefined],
    images: ['photos', undefined],
  }); // credit (an object) and mixed (number and text) are left out
  assert.equal(inferSchema('projects', [{ title: 'T' }]).title, 'title');
  assert.equal(inferSchema('x', [{ label: 'L' }]).title, 'label');
  assert.equal(inferSchema('x', [{ label: 'L' }]).slug, '');
});

test('checkItems: required, types, choices, links, dates, photos, slugs', () => {
  const photoExists = (k) => k === 'ok.jpg';
  const items = [
    {
      slug: 'ann',
      name: 'Ann',
      year: '2024',
      kind: 'other',
      url: 'example.com',
      shot: '1/2/2024',
      image: 'missing.jpg',
      images: [{ src: 'ok.jpg' }, { src: 'gone.jpg' }],
      placeholder: 'yes',
    },
    { slug: 'ann', name: '' },
    {
      slug: 'Bad Slug',
      name: 'C',
      url: 'https://x.y/',
      image: 'https://cdn/x.jpg',
      shot: '2024-02-01',
    },
  ];
  assert.deepEqual(checkItems(items, PEOPLE, { photoExists }), [
    'item 1 (Ann): "Year" must be a number',
    'item 1 (Ann): "Kind" must be one of model, band',
    'item 1 (Ann): "Link" must be a link (https://…, /path/ or mailto:…)',
    'item 1 (Ann): "Shot on" must be a date (YYYY-MM-DD)',
    'item 1 (Ann): "Photo" "missing.jpg" is not a photo in media/ or content/settings/photos.json',
    'item 1 (Ann): "Photos" photo 2 "gone.jpg" is not a photo in media/ or content/settings/photos.json',
    'item 1 (Ann): "Placeholder" must be true or false',
    'item 2: "Name" is required',
    'item 2: another item has the slug "ann"',
    'item 3 (C): slug "Bad Slug" must be lowercase words with dashes',
  ]);
  // without photoExists, photos are not looked up
  assert.deepEqual(checkItems([{ slug: 'a', name: 'A', image: 'x.jpg' }], PEOPLE), []);
});

test('checkSources: every source, with its schema or inferred; photos from media and photos.json', () => {
  const content = {
    ...contentFromFiles({
      'sources/people.json': [{ slug: 'a', name: 'A', image: 'people/a.jpg' }],
      'sources/people.schema.json': PEOPLE,
      'sources/places.json': [{ name: 'P', cover: 'places/p.jpg' }],
      'settings/photos.json': { 'places/p.jpg': { srcset: [] } },
    }),
    media: {},
  };
  assert.deepEqual(checkSources(content), [
    'content/sources/people.json: item 1 (A): "Photo" "people/a.jpg" is not a photo in media/ or content/settings/photos.json',
  ]);
  content.media = { 'people/a.jpg': {} };
  assert.deepEqual(checkSources(content), []);
});

test('routes: slug and title from the schema', () => {
  const schema = {
    title: 'label',
    slug: 'handle',
    fields: [
      { key: 'handle', type: 'text' },
      { key: 'label', type: 'text' },
    ],
  };
  const c = contentFromFiles({
    'settings/site.json': { name: 'Site', titleTemplate: '{page} | {site}' },
    'pages/bands/[slug].json': { config: { source: 'bands' }, section: 'Bands' },
    'sources/bands.json': [
      { handle: 'the-xx', label: 'The xx', slug: 'ignored' },
      { label: 'Big Thief', name: 'ignored' },
    ],
    'sources/bands.schema.json': schema,
  });
  const r = buildRoutes(c).routes;
  assert.deepEqual(
    r.map((x) => [x.path, x.name]),
    [
      ['/bands/the-xx/', 'The xx'],
      ['/bands/big-thief/', 'Big Thief'],
    ],
  );
  assert.equal(r[0].title, 'The xx | Bands | Site');
  // no schema file: inferred (slug, name)
  assert.equal(schemaOf({ sources: { x: [{ slug: 's', name: 'N' }] } }, 'x').title, 'name');
});

test('newItemOf: every field empty, a unique slug and title', () => {
  const item = newItemOf(PEOPLE, [{ slug: 'new-item-2' }]);
  assert.equal(item.slug, 'new-item-3');
  assert.equal(item.name, 'New item 3');
  assert.equal(item.year, new Date().getFullYear());
  assert.deepEqual(item.images, []);
  assert.equal(item.placeholder, false);
  assert.equal(item.kind, ''); // not required: no choice made
  assert.equal(
    newItemOf({ ...PEOPLE, fields: [{ key: 'k', type: 'choice', required: true, options: ['b'] }] })
      .k,
    'b',
  );
});

test('save: a source that breaks its schema is not written', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'schemas-'));
  const dir = path.join(root, 'content', 'sources');
  fs.mkdirSync(dir, { recursive: true });
  const people = [{ slug: 'a', name: 'A', year: 2024 }];
  fs.writeFileSync(path.join(dir, 'people.json'), JSON.stringify(people));
  fs.writeFileSync(path.join(dir, 'people.schema.json'), JSON.stringify(PEOPLE));
  const before = fs.readFileSync(path.join(dir, 'people.json'), 'utf8');

  let r = save(root, { 'sources/people.json': [{ slug: 'a', name: '', year: 2024 }] });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /sources\/people\.json: item 1: "Name" is required/);
  r = save(root, { 'sources/people.json': [{ slug: 'a', name: 'A', image: 'nope.jpg' }] });
  assert.match(r.body.error, /"nope\.jpg" is not a photo/);
  // a new schema is checked against the saved items too
  const strict = {
    ...PEOPLE,
    fields: [...PEOPLE.fields, { key: 'role', type: 'text', required: true }],
  };
  r = save(root, { 'sources/people.schema.json': strict });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /"Role" is required/);
  assert.equal(fs.readFileSync(path.join(dir, 'people.json'), 'utf8'), before);

  r = save(root, { 'sources/people.json': [{ slug: 'a', name: 'Ann', year: 2025 }] });
  assert.equal(r.status, 200);
});
