import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from './content.mjs';
import { save } from './editor-server.mjs';
import { motionChecks } from '../src/site/render.js';
import { checkContent } from '../src/site/validate.js';
import { WIDGET_TYPES } from '../src/site/widgets/index.js';
import {
  WIDGET_ANIM_TYPES,
  TIMING_KEYS,
  checkMotion,
  motionAttrs,
  motionProblems,
} from '../src/site/layout/motion.js';
import { widgetModel, inherited, keepFor } from '../src/editor/svelte/motion.js';
import { SITE_A } from '../test/fixtures/index.mjs';

const content = loadContent(SITE_A);
const presets = content.animations.presets;
const pageWith = (motion) => ({
  version: 1,
  kind: 'page',
  id: 'pg-t011',

  sections: [{ id: 's-aaaa', widgets: [{ id: 'b-aaaa', type: 'text', text: 'x', motion }] }],
});
const problems = (motion) =>
  motionProblems({ animations: content.animations, pages: { t: pageWith(motion) } });

test('checkMotion: an animation id and only timing keys of the right kind', () => {
  assert.deepEqual(checkMotion({ anim: 'fade-in' }), []);
  assert.deepEqual(
    checkMotion({
      anim: 'fade-in',
      duration: 1.2,
      delay: 0,
      stagger: 0.1,
      ease: 'power2.out',
      trigger: 'load',
      start: 'top 80%',
      end: 'bottom top',
      scrub: 0.5,
    }),
    [],
  );
  assert.deepEqual(checkMotion({ anim: 'x', scrub: true }), []);
  assert.equal(checkMotion('fade-in').length, 1);
  assert.equal(checkMotion({}).length, 1);
  assert.match(checkMotion({ anim: 'x', from: { y: 10 } })[0], /motion\.from/);
  assert.equal(checkMotion({ anim: 'x', duration: -1 }).length, 1);
  assert.equal(checkMotion({ anim: 'x', duration: '1' }).length, 1);
  assert.equal(checkMotion({ anim: 'x', trigger: 'hover' }).length, 1);
  assert.equal(checkMotion({ anim: 'x', scrub: 'yes' }).length, 1);
  assert.equal(checkMotion({ anim: 'x', start: 80 }).length, 1);
  assert.deepEqual(TIMING_KEYS.toSorted(), [
    'delay',
    'duration',
    'ease',
    'end',
    'scrub',
    'stagger',
    'start',
    'trigger',
  ]);
  assert.match(checkContent('pages/t/index.json', pageWith(3)).join(' '), /motion/);
});

test('motionProblems: unknown animations and markup-only types', () => {
  assert.deepEqual(problems({ anim: 'fade-in' }), []);
  assert.match(problems({ anim: 'nope' })[0], /unknown animation "nope"/);
  const markup = Object.entries(presets).find(([, p]) => !WIDGET_ANIM_TYPES.includes(p.type));
  if (markup) assert.match(problems({ anim: markup[0] })[0], /needs its own markup/);
  assert.deepEqual(problems(undefined), []);
});

test('motionAttrs: the animation and its timing on the widget element', () => {
  assert.equal(motionAttrs({}), '');
  assert.equal(motionAttrs({ motion: { anim: 'fade-in' } }), ' data-motion="fade-in"');
  assert.equal(
    motionAttrs({ motion: { anim: 'fade-in', start: 'top 80%' } }),
    ' data-motion="fade-in" data-motion-options="{&quot;start&quot;:&quot;top 80%&quot;}"',
  );
});

test('the library has the scroll animations and every default and page animation exists', () => {
  for (const k of ['parallax-y', 'fade-scrub', 'scale-scrub']) assert.ok(presets[k], k);
  assert.equal(presets['parallax-y'].type, 'scroll');
  for (const [type, def] of Object.entries(WIDGET_TYPES)) {
    const anim = def.defaults?.motion?.anim;
    if (!anim) continue;
    assert.ok(presets[anim], `${type}: ${anim}`);
    assert.ok(WIDGET_ANIM_TYPES.includes(presets[anim].type), `${type}: ${anim}`);
    assert.deepEqual(checkMotion(def.defaults.motion), [], type);
  }
  assert.deepEqual(motionChecks(content), []);
});

test('save refuses a widget with an unknown animation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  fs.cpSync(path.join(SITE_A, 'content/en'), path.join(root, 'content/en'), { recursive: true });
  const F = 'pages/index.json';
  const page = JSON.parse(fs.readFileSync(path.join(SITE_A, 'content/en', F), 'utf8'));
  const wgt = page.sections.flatMap((s) => s.widgets).find((b) => b.motion);
  const before = fs.readFileSync(path.join(root, 'content/en', F), 'utf8');
  wgt.motion = { anim: 'no-such-animation' };
  const res = save(root, { [F]: page });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /unknown animation "no-such-animation"/);
  assert.equal(fs.readFileSync(path.join(root, 'content/en', F), 'utf8'), before);
  // removing the animation from the library breaks the pages that use it
  const cfg = structuredClone(content.animations);
  const used = page.sections.flatMap((s) => s.widgets).find((b) => b.motion && b !== wgt);
  delete cfg.presets[used.motion.anim];
  assert.equal(save(root, { 'settings/animations.json': cfg }).status, 400);
  wgt.motion = { anim: 'fade-scrub', start: 'top 70%' };
  assert.equal(save(root, { [F]: page }).status, 200);
  fs.rmSync(root, { recursive: true });
});

test('editor: a widget layer over its animation, inherit and keep', () => {
  const m = widgetModel(content.animations, { anim: 'fade-scrub', end: 'top 40%' });
  assert.equal(m.type, 'scroll');
  assert.equal(m.spec.end, 'top 40%');
  assert.equal(m.spec.start, presets['fade-scrub'].start);
  assert.deepEqual(inherited(m, 'widget', ['start']), [presets['fade-scrub'].start, 'preset']);
  assert.deepEqual(inherited(m, 'widget', ['nothing']), [null, null]);
  assert.equal(keepFor('widget'), 5);
  assert.equal(widgetModel(content.animations, undefined).type, undefined);
});

test('widget parts: shape, attributes; defaults and comments are refused', async () => {
  const { checkMotion, motionAttrs } = await import('../src/site/layout/motion.js');
  const { omitDefaults, storedDefaults } = await import('../src/site/defaults.js');
  assert.deepEqual(checkMotion({ parts: { 'hero.title': { preset: 'x', delay: 0.2 } } }), []);
  assert.deepEqual(checkMotion({ parts: { 'hero.title': { from: {} } } }), [
    '"motion.parts.hero.title.from" must be left out: only duration, ease, delay, stagger, trigger, start, end, scrub can be set',
  ]);
  assert.deepEqual(checkMotion({ delay: 1, parts: { a: { delay: 1 } } }), [
    '"motion.anim" must be set when the widget sets its own timing',
  ]);
  assert.equal(
    motionAttrs({ motion: { parts: { a: { delay: 1 } } } }),
    ' data-anim-parts="{&quot;a&quot;:{&quot;delay&quot;:1}}"',
  );
  const F = 'pages/x/index.json';
  const page = {
    version: 1,
    kind: 'page',
    id: 'pg-aaaa',

    sections: [{ id: 's-aaaa', enabled: true, height: 'fit', widgets: [] }],
  };
  assert.equal(storedDefaults(F, page).length, 2);
  assert.deepEqual(omitDefaults(F, page).sections[0], { id: 's-aaaa', widgets: [] });
  assert.deepEqual(checkContent(F, { ...omitDefaults(F, page), _comment: 'x' }), [
    '"_comment": no comments in content (the README documents the shape)',
  ]);
});
