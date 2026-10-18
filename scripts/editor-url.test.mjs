import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorHref, legacyRedirect, wantsEditor } from '../src/editor/lib/editor-url.js';

const u = (s) => new URL(s, 'http://localhost');

test('a top-level page with ?edit gets the editor', () => {
  assert.equal(wantsEditor(u('/?edit')), true);
  assert.equal(wantsEditor(u('/photography/?edit&tab=motion')), true);
  assert.equal(wantsEditor(u('/about/?edit='), { 'sec-fetch-dest': 'document' }), true);
  assert.equal(wantsEditor(u('/about/')), false);
  assert.equal(wantsEditor(u('/about/?tab=motion')), false);
});

test('the preview never gets the editor (no recursion)', () => {
  assert.equal(wantsEditor(u('/?edit&draft=abc')), false);
  assert.equal(wantsEditor(u('/?edit'), { 'sec-fetch-dest': 'iframe' }), false);
});

test('editorHref puts a bare edit flag first', () => {
  assert.equal(editorHref(u('/about/?tab=motion&edit=')), '/about/?edit&tab=motion');
  assert.equal(editorHref(u('/?edit=')), '/?edit');
  assert.equal(editorHref(u('/x/?edit&source=people#a')), '/x/?edit&source=people#a');
});

test('old /edit addresses move to ?edit, the sandbox to /sandbox/', () => {
  assert.equal(legacyRedirect(u('/edit')), '/?edit');
  assert.equal(legacyRedirect(u('/edit/')), '/?edit');
  assert.equal(
    legacyRedirect(u('/edit/?path=%2Fphotography%2Fpeople%2F&tab=content&item=noor')),
    '/photography/people/?edit&tab=content&item=noor',
  );
  assert.equal(legacyRedirect(u('/edit/sandbox/?mock=a')), '/sandbox/?mock=a');
  assert.equal(legacyRedirect(u('/edit/sandbox')), '/sandbox/');
  assert.equal(legacyRedirect(u('/editorial/')), null);
  assert.equal(legacyRedirect(u('/about/')), null);
});
