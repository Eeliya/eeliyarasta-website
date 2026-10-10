import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutes, sitemapXml } from '../src/site/routes.js';
import { renderRoute } from '../src/site/render.js';
import { contentFromFiles } from '../src/site/files.js';
import { seoOf, seoWarnings, shareImage } from '../src/site/seo.js';
import { checkContent } from '../src/site/validate.js';

const site = {
  name: 'Site',
  url: 'https://example.com',
  title: 'Site home',
  description: 'The site.',
  ogImage: 'a/share.jpg',
};
const media = {
  'a/share.jpg': {
    width: 2000,
    height: 1000,
    src: '/media/a/share-960.webp',
    srcset: [{ url: '/media/a/share-960.webp', w: 960 }],
  },
};
const content = (files, more = {}) => ({
  ...contentFromFiles({ 'settings/site.json': { ...site, ...more }, ...files }),
  media,
  photos: { 'a/share.jpg': { alt: 'A share' } },
});
const routeOf = (c, path) => buildRoutes(c).routes.find((r) => r.path === path);

test('titles: the site template around the page title; home in full', () => {
  const files = {
    'pages/index.json': {},
    'pages/about/index.json': {
      sections: [{ id: 's-aaaa', blocks: [{ id: 'b-aaaa', type: 'heading', title: 'About me' }] }],
    },
    'pages/work/index.json': { meta: { title: 'My work' } },
  };
  assert.equal(routeOf(content(files), '/').title, 'Site home');
  assert.equal(routeOf(content(files), '/about/').title, 'About me | Site');
  const c = content(files, { titleTemplate: '{page} · {site}' });
  assert.equal(routeOf(c, '/work/').title, 'My work · Site');
});

test('a page: its meta, else the site defaults; canonical override', () => {
  const c = content({
    'pages/a/index.json': {},
    'pages/b/index.json': {
      meta: { description: 'B.', image: 'b.jpg', canonical: '/a/', noindex: true },
    },
  });
  const a = seoOf(c, routeOf(c, '/a/'));
  assert.equal(a.description, 'The site.');
  assert.equal(a.url, 'https://example.com/a/');
  assert.deepEqual(a.image, {
    url: 'https://example.com/media/a/share-960.webp',
    width: 960,
    height: 480,
    alt: 'A share',
  });
  assert.equal(a.noindex, false);
  const b = seoOf(c, routeOf(c, '/b/'));
  assert.equal(b.description, 'B.');
  assert.equal(b.url, 'https://example.com/a/');
  assert.equal(b.image.url, 'https://example.com/media/b.jpg');
  assert.equal(b.noindex, true);
  assert.doesNotMatch(sitemapXml(buildRoutes(c).routes, site.url), /\/b\//);
});

test('[slug] pages: the item name, summary and cover, then the template meta', () => {
  const c = content({
    'pages/people/index.json': {},
    'pages/people/[slug].json': {
      config: { source: 'people' },
      section: 'People',
      meta: { description: 'A person.', image: 'p.jpg' },
    },
    'sources/people.json': [
      { name: 'Noor', summary: 'Noor.', images: [{ src: 'n.jpg' }] },
      { name: 'Daan' },
    ],
  });
  const noor = routeOf(c, '/people/noor/');
  assert.equal(noor.title, 'Noor | People | Site');
  assert.equal(noor.description, 'Noor.');
  assert.equal(noor.image, 'n.jpg');
  const daan = routeOf(c, '/people/daan/');
  assert.equal(daan.description, 'A person.');
  assert.equal(daan.image, 'p.jpg');
  const off = content({
    'pages/people/[slug].json': { config: { source: 'people' }, meta: { noindex: true } },
    'sources/people.json': [{ name: 'Noor' }],
  });
  assert.equal(routeOf(off, '/people/noor/').noindex, true);
});

test('site robots "noindex": every page noindex, an empty sitemap', () => {
  const c = content({ 'pages/index.json': {}, 'pages/a/index.json': {} }, { robots: 'noindex' });
  const { routes } = buildRoutes(c);
  assert.ok(routes.every((r) => r.noindex));
  assert.doesNotMatch(sitemapXml(routes, site.url), /<url>/);
});

test('head: description, canonical, og, twitter card, robots, image size; <html lang>', () => {
  const c = content(
    { 'pages/index.json': {}, 'pages/b/index.json': { meta: { noindex: true } } },
    { lang: 'nl' },
  );
  const { routes } = buildRoutes(c);
  const out = renderRoute(
    routes.find((r) => r.path === '/b/'),
    c,
  );
  assert.match(out.head, /<meta name="description" content="The site\." \/>/);
  assert.match(out.head, /<link rel="canonical" href="https:\/\/example\.com\/b\/" \/>/);
  assert.match(out.head, /<meta name="robots" content="noindex">/);
  assert.match(out.head, /og:image" content="https:\/\/example\.com\/media\/a\/share-960\.webp"/);
  assert.match(out.head, /og:image:width" content="960"[\s\S]*og:image:height" content="480"/);
  assert.match(out.head, /twitter:card" content="summary_large_image"/);
  assert.equal(out.lang, 'nl');
  const bare = content({ 'pages/index.json': {} }, { ogImage: undefined });
  const home = renderRoute(buildRoutes(bare).routes[0], bare);
  assert.doesNotMatch(home.head, /og:image/);
  assert.match(home.head, /twitter:card" content="summary"/);
});

test('share image: R2 keys and full URLs', () => {
  const ctx = {
    site: { ...site, mediaUrl: 'https://photos.example.com/' },
    media: {},
    photos: {
      'photos/x': { srcset: [{ key: 'photos/x-960.webp', w: 960 }], width: 960, height: 640 },
    },
  };
  assert.equal(shareImage(ctx, 'photos/x').url, 'https://photos.example.com/photos/x');
  assert.equal(
    shareImage(ctx, 'https://cdn.example.com/y.jpg').url,
    'https://cdn.example.com/y.jpg',
  );
  assert.equal(shareImage(ctx, ''), null);
});

test('warnings: indexable pages without a description, long titles and descriptions', () => {
  const long = 'x'.repeat(170);
  const c = content(
    {
      'pages/a/index.json': { meta: { title: 'T'.repeat(70) } },
      'pages/b/index.json': { meta: { description: long } },
      'pages/c/index.json': { meta: { description: long, noindex: true } },
    },
    { description: '' },
  );
  const w = seoWarnings(buildRoutes(c).routes).join('\n');
  assert.match(w, /\/a\/: no description/);
  assert.match(w, /\/a\/: title is \d+ characters/);
  assert.match(w, /\/b\/: description is 170 characters/);
  assert.doesNotMatch(w, /\/c\//);
});

test('validation: page meta and site defaults', () => {
  assert.deepEqual(checkContent('pages/a/index.json', { meta: { noindex: true, title: 'A' } }), []);
  assert.deepEqual(checkContent('pages/a/index.json', { meta: { noindex: 'yes' } }), [
    'meta: "noindex" must be a boolean, not a string',
  ]);
  const s = (more) => checkContent('settings/site.json', { name: 'S', url: 'u', ...more });
  assert.deepEqual(s({ robots: 'index', titleTemplate: '{page}', lang: 'en' }), []);
  assert.deepEqual(s({ robots: 'nofollow' }), ['"robots" must be "index" or "noindex"']);
});
