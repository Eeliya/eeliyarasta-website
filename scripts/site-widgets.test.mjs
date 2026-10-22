// A site's own widgets (scripts/site-widgets.mjs, widgets/index.js registerWidgets): loaded from
// site.config.mjs, rendered, validated and added in the editor like built-ins. test/fixtures/site-b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { SITE_A, SITE_B } from '../test/fixtures/index.mjs';
import {
  widgetModulesOf,
  registerSiteWidgets,
  widgetsModule,
  widgetClientsModule,
} from './site-widgets.mjs';
import { loadContent, readContentDir } from './content.mjs';
import {
  WIDGET_TYPES,
  BUILTIN_WIDGETS,
  registerWidgets,
  widgetProblems,
  isCustomWidget,
} from '../src/site/widgets/index.js';
import { renderRoute, getRoutes } from '../src/site/render.js';
import { checkContent } from '../src/site/validate.js';
import { newWidget } from '../src/site/layout/index.js';
import { createStore } from '../src/editor/store.js';
import { addWidget } from '../src/editor/layout-ops.js';

const QUOTE = path.join(SITE_B, 'widgets/quote');
await registerSiteWidgets(SITE_B);
const about = () => structuredClone(readContentDir(SITE_B)['pages/about/index.json']);

test('site.config.mjs widgets: their folders, with the optional style and client', () => {
  assert.deepEqual(widgetModulesOf(SITE_A), []);
  assert.deepEqual(widgetModulesOf(SITE_B), [
    {
      spec: './widgets/quote',
      dir: QUOTE,
      index: path.join(QUOTE, 'index.js'),
      style: path.join(QUOTE, 'style.scss'),
      client: path.join(QUOTE, 'client.js'),
    },
  ]);
});

test('registered next to the built-ins, which stay as they were', () => {
  assert.equal(WIDGET_TYPES.quote.label, 'Quote');
  assert.ok(isCustomWidget('quote'));
  assert.ok(!isCustomWidget('text'));
  for (const def of BUILTIN_WIDGETS) assert.equal(WIDGET_TYPES[def.type], def);
});

test('bad definitions are refused, built-in types cannot be replaced', () => {
  assert.ok(widgetProblems({ type: 'Bad Type' }).length);
  assert.throws(() => registerWidgets([{ type: 'x-1' }], 'x'), /x-1/);
  assert.throws(() => registerWidgets([{ ...WIDGET_TYPES.quote, type: 'text' }], 'x'), /text/);
});

test('render: the widget on its page, with its fields and config', () => {
  const content = loadContent(SITE_B);
  const route = getRoutes(content).find((r) => r.path === '/about/');
  const out = renderRoute(route, content).body;
  assert.match(out, /class="wgt wgt--quote/);
  assert.match(out, /<figure class="quote quote--large">/);
  assert.match(out, /Light is the only thing<br>I really edit\./);
  assert.match(out, /Noor Vermeer<\/span\s*>, <span >Model<\/span>/);
});

test('validate: the new type and its fields pass; its own check and a wrong field type fail', () => {
  const F = 'pages/about/index.json';
  assert.deepEqual(checkContent(F, about()), []);
  const long = about();
  long.sections.at(-1).widgets[0].quote = 'x'.repeat(401);
  assert.match(checkContent(F, long).join('\n'), /longer than 400/);
  const wrong = about();
  wrong.sections.at(-1).widgets[0].author = 42;
  assert.match(checkContent(F, wrong).join('\n'), /author/);
});

test('editor: Add widget makes a quote with its defaults, which validates', () => {
  const w = newWidget('quote', new Set());
  assert.equal(w.type, 'quote');
  assert.equal(w.author, 'Someone');
  const F = 'pages/about/index.json';
  const store = createStore();
  store.load({ [F]: about() });
  const added = addWidget(store, F, 0, 'quote');
  assert.equal(store.current[F].sections[0].widgets.at(-1).id, added.id);
  assert.equal(added.quote, 'Something worth repeating.');
  assert.deepEqual(checkContent(F, store.current[F]), []);
});

test('virtual modules: the definitions for the editor, the styles and clients for the page', async () => {
  const defs = widgetsModule(SITE_B);
  assert.match(defs, new RegExp(`import w0 from ${JSON.stringify(path.join(QUOTE, 'index.js'))}`));
  assert.match(defs, /export default \[w0\]/);
  assert.equal(widgetsModule(SITE_A).trim(), 'export default [];');
  const clients = await widgetClientsModule(SITE_B);
  assert.match(clients, /style\.scss/);
  assert.match(clients, /client\.js/);
  assert.match(clients, /type: "quote"/);
});
