import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleContact } from '../functions/api/contact.js';
import { formTarget, form } from '../src/site/sections/form.js';
import { newSection } from '../src/site/sections/index.js';
import { checkContent } from '../src/site/validate.js';

const ENV = {
  RESEND_API_KEY: 're_test',
  CONTACT_TO: 'me@example.com',
  CONTACT_FROM: 'Site <site@example.com>',
};
const NOW = 1_000_000;

/** A POST like the page's script sends it (JSON answer), or a plain form post (json: false). */
function post(fields, { json = true } = {}) {
  return new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: json ? { accept: 'application/json' } : { accept: 'text/html' },
    body: new URLSearchParams({
      _page: '/about/',
      _t: String(NOW - 10_000),
      website: '',
      ...fields,
    }),
  });
}
const valid = { name: 'Ann', email: 'ann@example.com', message: 'Hello there' };

/** A fetch that records its calls and answers like Resend (or with `status`). */
function mockFetch(status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return status === 200 ? Response.json({ id: 'x' }) : new Response('nope', { status });
  };
  return { calls, fetch };
}
function mockLog() {
  const lines = { warn: [], error: [] };
  return { lines, log: { warn: (m) => lines.warn.push(m), error: (m) => lines.error.push(m) } };
}

test('a valid message is emailed through Resend, replies go to the sender', async () => {
  const { calls, fetch } = mockFetch();
  const res = await handleContact(post({ ...valid, subject: 'Shoot\r\nBcc: x' }), ENV, {
    fetch,
    now: NOW,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.authorization, 'Bearer re_test');
  const mail = JSON.parse(calls[0].init.body);
  assert.equal(mail.from, 'Site <site@example.com>');
  assert.deepEqual(mail.to, ['me@example.com']);
  assert.equal(mail.reply_to, 'ann@example.com');
  assert.equal(mail.subject, 'Contact form: Shoot Bcc: x'); // one line
  assert.match(mail.text, /name:\nAnn\n/);
  assert.match(mail.text, /message:\nHello there\n/);
  assert.match(mail.text, /Sent from \/about\//);
  assert.doesNotMatch(mail.text, /_t|website|_page:/);
});

test('an invalid email or an empty message: 400 with the field, nothing sent', async () => {
  const { calls, fetch } = mockFetch();
  let res = await handleContact(post({ ...valid, email: 'ann@' }), ENV, { fetch, now: NOW });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, error: 'invalid', fields: { email: 'invalid' } });
  res = await handleContact(post({ email: 'ann@example.com', message: '  ' }), ENV, {
    fetch,
    now: NOW,
  });
  assert.equal(res.status, 400);
  res = await handleContact(post({ ...valid, message: 'x'.repeat(5001) }), ENV, {
    fetch,
    now: NOW,
  });
  assert.deepEqual((await res.json()).fields, { message: 'too long' });
  assert.equal(calls.length, 0);
});

test('spam: the trap field, or sent too fast: "sent", nothing sent', async () => {
  const { calls, fetch } = mockFetch();
  const { lines, log } = mockLog();
  let res = await handleContact(post({ ...valid, website: 'http://spam' }), ENV, {
    fetch,
    now: NOW,
    log,
  });
  assert.deepEqual(await res.json(), { ok: true });
  res = await handleContact(post({ ...valid, _t: String(NOW - 1000) }), ENV, {
    fetch,
    now: NOW,
    log,
  });
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 0);
  assert.equal(lines.warn.length, 2);
  // no _t (a form sent without JavaScript): no time check
  res = await handleContact(post({ ...valid, _t: '' }), ENV, { fetch, now: NOW, log });
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
});

test('missing settings: 500 and a log line that says what to set', async () => {
  const { calls, fetch } = mockFetch();
  const { lines, log } = mockLog();
  const res = await handleContact(post(valid), { RESEND_API_KEY: 'x' }, { fetch, now: NOW, log });
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { ok: false, error: 'not configured' });
  assert.equal(calls.length, 0);
  assert.match(lines.error[0], /CONTACT_TO, CONTACT_FROM not set/);
  assert.match(lines.error[0], /Cloudflare Pages project/);
});

test('Resend fails: 502, logged', async () => {
  const { fetch } = mockFetch(403);
  const { lines, log } = mockLog();
  const res = await handleContact(post(valid), ENV, { fetch, now: NOW, log });
  assert.equal(res.status, 502);
  assert.match(lines.error[0], /Resend answered 403: nope/);
});

test('without JavaScript: a small page with the message and a link back', async () => {
  const { fetch } = mockFetch();
  let res = await handleContact(
    post({ ...valid, _success: 'Thanks <3', _page: '//evil.example' }, { json: false }),
    ENV,
    { fetch, now: NOW },
  );
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  let page = await res.text();
  assert.match(page, /Thanks &#60;3/);
  assert.match(page, /href="\/"/); // only paths on this site
  res = await handleContact(post({ ...valid, email: 'x', _error: 'Oops' }, { json: false }), ENV, {
    fetch,
    now: NOW,
  });
  assert.equal(res.status, 400);
  page = await res.text();
  assert.match(page, /Oops/);
  assert.match(page, /href="\/about\/"/);
});

test('Turnstile: checked when its secret is set', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(url);
    if (url.includes('turnstile'))
      return Response.json({ success: init.body.get('response') === 'good' });
    return Response.json({ id: 'x' });
  };
  const env = { ...ENV, TURNSTILE_SECRET_KEY: 'secret' };
  let res = await handleContact(post({ ...valid, 'cf-turnstile-response': 'bad' }), env, {
    fetch,
    now: NOW,
  });
  assert.deepEqual(await res.json(), { ok: false, error: 'challenge' });
  res = await handleContact(post({ ...valid, 'cf-turnstile-response': 'good' }), env, {
    fetch,
    now: NOW,
  });
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.filter((u) => u.includes('resend')).length, 1);
});

test('the section: where it sends, its form, its validation', () => {
  const s = newSection('form');
  const site = { email: 'hi@example.com' };
  assert.deepEqual(formTarget(site, s), { mode: 'function', action: '/api/contact' });
  assert.deepEqual(
    formTarget({ ...site, forms: { target: 'endpoint', endpoint: 'https://f.io/x' } }, s),
    {
      mode: 'endpoint',
      action: 'https://f.io/x',
    },
  );
  // an endpoint without a URL: the email link
  assert.equal(formTarget({ ...site, forms: { target: 'endpoint' } }, s).mode, 'email');
  assert.equal(formTarget(site, { config: { target: 'email' } }).action, 'mailto:hi@example.com');

  const sec = { at: 2, attrs: '', ed: () => '' };
  const html = form.render(s, { site, route: { path: '/about/' } }, sec);
  assert.match(html, /<form class="cform" id="contact-2" method="post" action="\/api\/contact"/);
  assert.match(
    html,
    /<input type="email" id="contact-2-email" name="email" class="cform__input" required/,
  );
  assert.match(html, /autocomplete="email"/);
  assert.match(html, /<textarea id="contact-2-message"[^>]*required/);
  assert.match(html, /<label class="cform__label" for="contact-2-name">/);
  assert.match(html, /name="website" tabindex="-1"/);
  assert.match(html, /name="_page" value="\/about\/"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /cf-turnstile/);
  const withKey = form.render(
    s,
    { site: { ...site, forms: { turnstileSiteKey: 'k' } }, route: {} },
    sec,
  );
  assert.match(withKey, /<div class="cf-turnstile" data-sitekey="k">/);

  const page = (fields) => ({ sections: [{ type: 'form', fields }] });
  assert.deepEqual(checkContent('pages/contact/index.json', page(s.fields)), []);
  assert.deepEqual(
    checkContent(
      'pages/contact/index.json',
      page([
        { name: 'Email', type: 'email' },
        { name: 'topic', type: 'select', options: '' },
        { name: 'topic', type: 'date', required: 'yes' },
      ]),
    ),
    [
      'section 1 (Contact form): field 1: "name" must be lowercase letters, digits, - or _ (e.g. "phone")',
      'section 1 (Contact form): field 2: a Choice field needs "options" (comma-separated)',
      'section 1 (Contact form): field 3: another field is called "topic"',
      'section 1 (Contact form): field 3: "type" must be one of text, email, tel, textarea, select',
      'section 1 (Contact form): field 3: "required" must be true or false',
      'section 1 (Contact form): needs a field named "email" of type email: replies go there',
    ],
  );
  assert.deepEqual(
    checkContent('settings/site.json', {
      name: 'x',
      url: 'y',
      forms: { target: 'fax', endpoint: 'http://x' },
    }),
    [
      'forms: "target" must be "function", "endpoint" or "email"',
      'forms: "endpoint" must be an https:// URL',
    ],
  );
});
