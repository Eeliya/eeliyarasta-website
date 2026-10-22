import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './content.mjs';
import { renderOp } from './editor-server.mjs';
import * as render from '../src/site/render.js';
import { FOOTER, STRINGS, contentFromFiles } from '../src/site/files.js';
import { checkContent } from '../src/site/validate.js';
import { newWidget, newSection } from '../src/site/layout/index.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const content = loadContent(SITE_A);

test("footer.json: a part, its sections checked like a page's; the kind is the file's", () => {
  assert.deepEqual(checkContent(FOOTER, { version: 1, kind: 'part', sections: [] }), []);
  assert.deepEqual(checkContent(FOOTER, { version: 1, kind: 'part' }), []);
  assert.match(
    checkContent(FOOTER, { version: 1, kind: 'part', sections: [], meta: {} })[0],
    /only "sections"/,
  );
  assert.ok(
    checkContent(FOOTER, { version: 1, kind: 'part', sections: [{ id: 'x', widgets: [] }] }).length,
  );
  const taken = new Set();
  const s = newSection(taken, [newWidget('text', taken)]);
  const twice = checkContent(FOOTER, { version: 1, kind: 'part', sections: [s, { ...s }] });
  assert.ok(twice.includes(`the id "${s.id}" is used twice`));
  // one document type: the file decides the kind
  assert.match(checkContent(FOOTER, { version: 1, sections: [] })[0], /"kind" must be "part"/);
  assert.match(
    checkContent(FOOTER, { version: 1, kind: 'page', sections: [] })[0],
    /"kind" must be "part"/,
  );
  const page = { version: 1, kind: 'part', id: 'pg-t300', sections: [] };
  assert.match(checkContent('pages/x/index.json', page).join(), /"kind" must be "page"/);
  // the old footer texts and menu are gone
  assert.match(checkContent(STRINGS, { version: 1, footer: {} })[0], /"footer" is gone/);
  // no footer file: an empty footer
  assert.deepEqual(contentFromFiles({}).footer, { kind: 'part', sections: [] });
});

test('footer: shipped empty, rendered under every page, outside the view', () => {
  assert.deepEqual(content.footer.sections, []);
  for (const route of render.getRoutes(content).slice(0, 4)) {
    const { body } = render.renderRoute(route, content, { editable: true });
    const main = body.indexOf('</main>');
    const foot = body.indexOf('<footer class="site-footer" data-footer');
    assert.ok(main > 0 && foot > main && foot < body.indexOf('id="portal"'), route.path);
    assert.match(body, /data-page-file="settings\/footer\.json"><\/footer>/);
    assert.doesNotMatch(body, /Let's make|footer__cta|data-to-top/);
  }
  // public: no editor markers
  const [home] = render.getRoutes(content);
  assert.doesNotMatch(render.renderRoute(home, content).body, /data-page-file="settings/);
});

test('footer: its sections render on every page, and the editor renders them on any page', () => {
  const taken = new Set();
  const widget = newWidget('text', taken);
  widget.body = [{ style: 'title', text: [{ t: 'Say hello' }] }];
  const s = newSection(taken, [widget]);
  const data = { version: 1, kind: 'part', sections: [s] };
  const withFooter = { ...content, footer: data };
  const routes = render.getRoutes(withFooter);
  for (const route of [routes[0], routes.at(-1)]) {
    const { body } = render.renderRoute(route, withFooter, { editable: true });
    const foot = body.slice(body.indexOf('<footer class="site-footer"'));
    assert.match(foot, new RegExp(`data-sec="${s.id}"`));
    assert.match(foot, /Say hello/);
    assert.match(foot, /data-edit="settings\/footer\.json#\/sections\/0\/widgets\/0\/body"/);
  }
  for (const path of ['/', '/about/']) {
    const r = renderOp(render, SITE_A, {}, { path, file: FOOTER, data, ids: [s.id] });
    assert.equal(r.status, 200, path);
    assert.match(r.body.html[s.id], /Say hello/);
  }
  // another page's file still only renders on its page
  const about = { ...content.pages.about };
  const bad = renderOp(
    render,
    SITE_A,
    {},
    { path: '/', file: 'pages/about/index.json', data: about, ids: [] },
  );
  assert.equal(bad.status, 400);
});
