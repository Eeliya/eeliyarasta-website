import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curtainFor, curtainMode } from '../src/client/anim/curtain.js';
import { checkContent } from '../src/site/validate.js';
import { createStore } from '../src/editor/store.js';
import { setCurtainMode } from '../src/editor/svelte/curtain-edit.js';

const site = { label: true, in: { duration: 0.3, ease: 'power4.out' }, total: 1.1 };

test('page transition: the site curtain or none; its timing is the site curtain alone', () => {
  assert.equal(curtainMode(undefined), 'global');
  assert.equal(curtainMode({ preset: 'none' }), 'off');
  assert.equal(curtainFor(undefined, site), site);
  assert.equal(curtainFor({ preset: 'none' }, site), null);
});

test('page transition: validation and the editor modes', () => {
  const F = 'pages/x/index.json';
  const of = (transition) => checkContent(F, { version: 1, id: 'pg-xxxx', transition });
  assert.deepEqual(of({ preset: 'none' }), []);
  assert.equal(of({ preset: 'curtain', overrides: { total: 2 } }).length, 1); // no per-page timing
  assert.equal(of({ mode: 'custom' }).length, 1);
  assert.equal(of({ preset: 'none', overrides: {} }).length, 1);
  const store = createStore();
  store.load({ [F]: { version: 1, id: 'pg-xxxx' } });
  const page = { file: F, ptr: '/transition' };
  setCurtainMode(store, page, 'off');
  assert.deepEqual(store.current[F].transition, { preset: 'none' });
  setCurtainMode(store, page, 'global');
  assert.ok(!('transition' in store.current[F]));
});
