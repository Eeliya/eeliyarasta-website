import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { header, mobileMenu } from '../src/site/templates/header.js';
import { footer } from '../src/site/templates/footer.js';
import { checkContent } from '../src/site/validate.js';
import { setEditable } from '../src/site/helpers.js';

const NAV = 'settings/nav.json';
const base = loadContent('.');
const ctxWith = (nav) => {
  const content = { ...base, nav };
  return { ...content, routes: buildRoutes(content).routes };
};

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

test('nav.json: the shipped menus are valid', () => {
  assert.deepEqual(checkContent(NAV, base.nav), []);
});

test('nav.json validation: links, nesting depth, footer links are plain', () => {
  const problems = (nav) => checkContent(NAV, nav);
  assert.deepEqual(problems({ header: [{ label: 'A', page: '/a/' }], footer: [] }), []);
  assert.match(problems({ header: {} })[0], /"header" must be an array/);
  assert.match(problems({ header: [{ label: 'A' }] })[0], /needs a "page".*or an "href"/);
  assert.match(problems({ header: [{ label: 'A', page: '/a/', href: 'x' }] })[0], /one of them/);
  assert.match(
    problems({ header: [{ label: 'A', page: 'about' }] })[0],
    /page path like \/about\//,
  );
  assert.match(problems({ header: [{ page: '/' }] })[0], /needs a "label"/);
  const deep = { label: 'A', page: '/a/', children: [{ label: 'B', page: '/b/', children: [] }] };
  assert.match(problems({ header: [deep] })[0], /one level deep/);
  const both = { label: 'A', page: '/a/', children: [], items: 'people' };
  assert.match(problems({ header: [both] })[0], /not both/);
  assert.match(
    problems({ footer: [{ label: 'A', page: '/', items: 'people' }] })[0],
    /plain links/,
  );
});

test('render: the header, mobile menu and footer follow nav.json', () => {
  const nav = {
    header: [
      {
        label: 'Work',
        page: '/photography/',
        children: [{ label: 'Faces', page: '/people/', items: 'people' }],
      },
      { label: 'Builds', page: '/projects/', all: 'Every build', items: 'projects' },
      { label: 'Shop', href: 'https://shop.example.com' },
      { label: 'Me', page: '/about/' },
    ],
    footer: [
      { label: 'Bio', page: '/about/' },
      { label: 'Ext', href: 'https://x.example.com' },
    ],
  };
  const ctx = ctxWith(nav);
  const h = header(ctx);
  assert.ok(h.indexOf('>Work<') < h.indexOf('>Builds<') && h.indexOf('>Shop<') < h.indexOf('>Me<'));
  assert.match(
    h,
    /aria-controls="dd-photography" data-dropdown-toggle data-nav-section="\/photography\/,\/people\/"/,
  );
  assert.match(
    h,
    /<a class="dropdown__head" href="\/people\/"><span>Faces<\/span> <sup>04<\/sup><\/a>/,
  );
  assert.match(h, /class="dd-link" href="\/people\/noor-vermeer\/"/); // items with pages: photo rows
  assert.match(h, /class="dd-link dd-link--text" href="\/projects\/#/); // without: their spot
  assert.match(h, /<a class="dropdown__all" href="\/projects\/"><span>Every build<\/span>/);
  assert.match(
    h,
    /<a class="nav__item" href="https:\/\/shop\.example\.com" target="_blank" rel="noopener"><span>Shop<\/span><\/a>/,
  );
  assert.match(
    h,
    /<a class="nav__item" href="\/about\/" data-nav="\/about\/"><span>Me<\/span><\/a>/,
  );
  const m = mobileMenu(ctx);
  assert.match(
    m,
    /<a class="mmenu__head" href="\/people\/"><span>Faces<\/span><\/a><a href="\/people\/noor-vermeer\/">/,
  );
  assert.match(m, /mmenu__sub--single/);
  assert.match(m, /<a class="mmenu__big" href="\/about\/" data-nav="\/about\/" data-mm-item>/);
  const f = footer(ctx);
  assert.match(f, /<li><a href="\/about\/"><span>Bio<\/span><\/a><\/li>/);
  assert.match(f, /href="https:\/\/x\.example\.com" target="_blank" rel="noopener"><span>Ext/);
});

test('render: a link to no page warns; labels are marked for the editor', () => {
  const ctx = ctxWith({ header: [{ label: 'Gone', page: '/gone-page/' }], footer: [] });
  const [h, seen] = warnings(() => header(ctx));
  assert.match(h, /href="\/gone-page\/"/);
  assert.match(seen.join('\n'), /"Gone" links to "\/gone-page\/", which is no page/);
  setEditable(true);
  try {
    assert.match(header(ctx), /data-edit="settings\/nav\.json#\/header\/0\/label"/);
  } finally {
    setEditable(false);
  }
});
