import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTAINED,
  checkLayout,
  containedOf,
  containedWidth,
  layoutVars,
} from '../src/site/layout/contain.js';
import { checkContent } from '../src/site/validate.js';
import { loadContent } from './content.mjs';
import { buildRoutes } from '../src/site/routes.js';
import { renderRoute } from '../src/site/render.js';

test('contained width: N columns of the full-width cell, at least the side margins from the edges', () => {
  assert.equal(CONTAINED, 115);
  // the default is the look before (the margins: clamp(16px, 2.6vw, 40px)) up to 1920px
  for (const vw of [1280, 1366, 1440, 1536, 1920]) {
    const pad = Math.min(40, Math.max(16, vw * 0.026));
    assert.ok(Math.abs(containedWidth(vw) - (vw - 2 * pad)) < 0.01, String(vw));
  }
  assert.ok(Math.abs(containedWidth(2560) - (2560 * 115) / 120) < 0.01); // wider: 115/120
  assert.equal(containedWidth(1440, 100), 1200);
  assert.equal(containedWidth(1440, 120), 1440 - 2 * 37.44); // never past the margins
  assert.equal(containedOf({}), 115);
  assert.equal(containedOf({ layout: { contained: 96 } }), 96);
  assert.equal(containedOf({ layout: { contained: 20 } }), 115); // invalid: the default
  assert.equal(layoutVars({}), '');
  assert.equal(layoutVars({ layout: { contained: 96 } }), '--contain: 96');
});

test('contained width: validated in site.json, and on the page as --contain', () => {
  assert.deepEqual(checkLayout(undefined), []);
  assert.deepEqual(checkLayout({ contained: 100 }), []);
  assert.deepEqual(checkLayout(3), ['"layout" must be an object { contained }']);
  assert.deepEqual(checkLayout({ contained: 59, gap: 1 }), [
    '"layout.contained" must be a whole number of columns from 60 to 120',
    '"layout.gap" is not a layout setting',
  ]);
  assert.deepEqual(checkLayout({ contained: 100.5 }).length, 1);
  const content = loadContent('.');
  // the site's own setting doesn't matter: the default (no layout) and a set one
  const { layout: _own, ...plain } = content.site; // eslint-disable-line no-unused-vars
  const site = { ...plain, layout: { contained: 121 } };
  assert.match(checkContent('settings/site.json', site).join('\n'), /layout.contained/);
  const { routes } = buildRoutes(content);
  const about = routes.find((r) => r.path === '/about/');
  const head = (s) => renderRoute(about, { ...content, site: s }).head;
  assert.doesNotMatch(head(plain), /--contain/);
  assert.doesNotMatch(head({ ...plain, layout: { contained: 115 } }), /--contain/);
  assert.match(head({ ...plain, layout: { contained: 100 } }), /--contain: 100;/);
});
