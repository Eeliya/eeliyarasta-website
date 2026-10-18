import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalUrl } from '../src/client/lib/final-url.js';

const at = (href) => new URL(href, 'https://site.example');

test('router: a redirected fetch ends at its final URL, with the hash asked for', () => {
  const asked = at('/people/old/#3');
  assert.equal(
    finalUrl(asked, { redirected: false, url: 'https://site.example/people/old/' }),
    asked,
  );
  assert.equal(finalUrl(asked, undefined), asked);
  const to = finalUrl(asked, { redirected: true, url: 'https://site.example/models/old/' });
  assert.equal(to.pathname + to.search + to.hash, '/models/old/#3');
  // its own hash and query win
  const own = finalUrl(asked, { redirected: true, url: 'https://site.example/m/?a=1#top' });
  assert.equal(own.pathname + own.search + own.hash, '/m/?a=1#top');
  // the editor's draft param: kept as the server sends it back
  const draft = finalUrl(at('/old/?draft=x'), {
    redirected: true,
    url: 'https://site.example/new/?draft=x',
  });
  assert.equal(draft.pathname + draft.search, '/new/?draft=x');
  // off the site: null (a full page load)
  assert.equal(finalUrl(asked, { redirected: true, url: 'https://elsewhere.example/' }), null);
});
