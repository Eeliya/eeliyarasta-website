import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { header, mobileMenu } from '../src/site/templates/header.js';
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

test('nav.json validation: links, nesting depth; no footer menu', () => {
  const problems = (nav) => checkContent(NAV, { version: 1, ...nav });
  assert.deepEqual(problems({ header: [{ label: 'A', page: 'pg-aaaa' }] }), []);
  assert.deepEqual(
    problems({ header: [{ label: 'A', item: { source: 'people', id: 'p-aaaa' } }] }),
    [],
  );
  assert.match(problems({ header: {} })[0], /"header" must be an array/);
  assert.match(problems({ header: [{ label: 'A' }] })[0], /one of "page".*"item".*"href"/);
  assert.match(problems({ header: [{ label: 'A', page: 'pg-aaaa', href: 'x' }] })[0], /one of/);
  assert.match(problems({ header: [{ label: 'A', page: '/about/' }] })[0], /a page id/);
  assert.match(problems({ header: [{ label: 'A', item: { source: 'people' } }] })[0], /"item"/);
  assert.match(problems({ header: [{ label: 'A', page: 'pg-aaaa', x: 1 }] })[0], /no "x"/);
  assert.match(problems({ header: [{ page: 'pg-aaaa' }] })[0], /needs a "label"/);
  const deep = {
    label: 'A',
    page: 'pg-aaaa',
    children: [{ label: 'B', page: 'pg-bbbb', children: [] }],
  };
  assert.match(problems({ header: [deep] })[0], /one level deep/);
  const both = { label: 'A', page: 'pg-aaaa', children: [], items: 'people' };
  assert.match(problems({ header: [both] })[0], /not both/);
  assert.match(
    problems({ footer: [{ label: 'A', page: 'pg-aaaa' }] })[0],
    /"footer" is gone: the footer is settings\/footer\.json/,
  );
});

test('render: the header and mobile menu follow nav.json', () => {
  const nav = {
    header: [
      {
        label: 'Work',
        page: 'pg-evsk',
        children: [{ label: 'Faces', page: 'pg-yzuw', items: 'people' }],
      },
      { label: 'Builds', page: 'pg-cwyg', all: 'Every build', items: 'projects' },
      { label: 'Shop', href: 'https://shop.example.com' },
      { label: 'Me', page: 'pg-lyos' },
      { label: 'Noor', item: { source: 'people', id: 'p-qw7b' } },
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
  // an item link: the item's page, computed from its id
  assert.match(
    h,
    /<a class="nav__item" href="\/people\/noor-vermeer\/" data-nav="\/people\/noor-vermeer\/"><span>Noor/,
  );
  const m = mobileMenu(ctx);
  assert.match(
    m,
    /<a class="mmenu__head" href="\/people\/"><span>Faces<\/span><\/a><a href="\/people\/noor-vermeer\/">/,
  );
  assert.match(m, /mmenu__sub--single/);
  assert.match(m, /<a class="mmenu__big" href="\/about\/" data-nav="\/about\/" data-mm-item>/);
});

test('render: a link to no page warns; labels are marked for the editor', () => {
  const ctx = ctxWith({ header: [{ label: 'Gone', page: 'pg-gone' }] });
  const [h, seen] = warnings(() => header(ctx));
  assert.match(h, /href="#"/);
  assert.match(seen.join('\n'), /"Gone" points at page "pg-gone", which is no page/);
  setEditable(true);
  try {
    assert.match(header(ctx), /data-edit="settings\/nav\.json#\/header\/0\/label"/);
  } finally {
    setEditable(false);
  }
});

test('links: a page by id, an item by id, an href; made into URLs at build time', async () => {
  const { hrefOf, linkProblem } = await import('../src/site/hrefs.js');
  const ctx = ctxWith(base.nav);
  assert.equal(hrefOf(ctx, { page: 'pg-lyos' }), '/about/');
  assert.equal(hrefOf(ctx, { item: { source: 'people', id: 'p-qw7b' } }), '/people/noor-vermeer/');
  assert.equal(hrefOf(ctx, { href: 'mailto:a@b.c' }), 'mailto:a@b.c');
  assert.equal(hrefOf(ctx, 'https://bound.example'), 'https://bound.example'); // a bound value
  assert.equal(hrefOf(ctx, undefined), '');
  const [miss, seen] = warnings(() => hrefOf(ctx, { item: { source: 'people', id: 'p-none' } }));
  assert.equal(miss, '#');
  assert.match(seen.join('\n'), /item "p-none" of "people", which isn't there/);
  assert.equal(linkProblem({ page: 'pg-aaaa' }), null);
  assert.match(linkProblem({ href: '/x/', page: 'pg-aaaa' }), /one of/);
  assert.match(linkProblem('/about/'), /a link/);
});
