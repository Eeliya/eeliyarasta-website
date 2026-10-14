import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/editor/store.js';

import { appendPhotos } from '../src/editor/lib/photo-list.js';

test('multi-pick: photos appended in pick order, as items or keys; one undo step', () => {
  assert.deepEqual(appendPhotos(['a'], ['c', 'b']), ['a', 'c', 'b']);
  assert.deepEqual(appendPhotos(undefined, ['x']), ['x']);
  const item = { src: '', layer: 'front' };
  const out = appendPhotos([{ src: 'a' }], ['c', 'b'], { item, photo: 'src' });
  assert.deepEqual(out, [{ src: 'a' }, { src: 'c', layer: 'front' }, { src: 'b', layer: 'front' }]);
  assert.equal(item.src, ''); // the template untouched
  const store = createStore();
  const F = 'pages/x/index.json';
  store.load({
    [F]: { version: 1, kind: 'page', id: 'pg-t200', backdrop: { transition: 'fade' } },
  });
  store.set(F, '/backdrop/photos', appendPhotos(store.get(F, '/backdrop/photos'), ['p1', 'p2']));
  assert.deepEqual(store.get(F, '/backdrop'), { transition: 'fade', photos: ['p1', 'p2'] });
  store.undo();
  assert.deepEqual(store.get(F, '/backdrop'), { transition: 'fade' });
});
