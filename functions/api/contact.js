/**
 * POST /api/contact: the contact form (src/site/sections/form.js) on Cloudflare Pages.
 * A Pages Function: Cloudflare runs it for this path; nothing secret is in the site or its
 * content. It checks the submission, drops spam, and emails it through Resend's HTTP API.
 *
 * Environment variables (Cloudflare Pages project > Settings > Variables and Secrets):
 *   RESEND_API_KEY        Resend API key (a secret)
 *   CONTACT_TO            where submissions go (comma-separated for several)
 *   CONTACT_FROM          the sender, an address on a domain verified in Resend,
 *                         e.g. "Website <contact@eeliyarasta.com>"
 *   TURNSTILE_SECRET_KEY  optional: check Cloudflare Turnstile (with site.json
 *                         forms.turnstileSiteKey, which shows the widget)
 *
 * Spam: a hidden field ("website") people leave empty, and a minimum time between showing
 * the form and sending it (_t, set by the page's script). Both answer "sent" and send
 * nothing, so bots learn nothing.
 *
 * Answers JSON ({ ok, error?, fields? }) to the page's script (Accept: application/json),
 * and a small HTML page to a form sent without JavaScript. The dev server runs the same
 * handler (scripts/vite-plugin-static-site.mjs), with a fetch that only logs.
 */

export const MIN_SECONDS = 3;
const MAX_FIELDS = 30;
const MAX_LENGTH = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// form fields that are not the message
const INTERNAL = (k) => k.startsWith('_') || k === 'website' || k === 'cf-turnstile-response';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const oneLine = (s) =>
  String(s)
    .replace(/[\r\n]+/g, ' ')
    .trim();

/** The submission as { key: value } (a form post or JSON). */
async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await request.json();
    return Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')]));
  }
  const data = await request.formData();
  const out = {};
  for (const [k, v] of data) if (typeof v === 'string') out[k] = v;
  return out;
}

/** The answer: JSON for the page's script, else a small page with a link back. */
function answer(request, body, status, { message, page }) {
  if ((request.headers.get('accept') || '').includes('application/json'))
    return Response.json(body, { status });
  const back = /^\/(?!\/)/.test(page || '') ? page : '/';
  const text =
    message || (body.ok ? 'Thank you, your message was sent.' : 'Your message could not be sent.');
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${body.ok ? 'Sent' : 'Not sent'}</title><body style="font:16px/1.6 system-ui,sans-serif;background:#030303;color:#f2efe9;max-width:36rem;margin:20vh auto;padding:0 24px"><p>${esc(text)}</p><p><a style="color:inherit" href="${esc(back)}">← Back</a></p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Handle one submission. env: the variables above; fetch: for Resend and Turnstile (tests
 * and the dev server pass their own); now: the time in ms; log: console.
 */
export async function handleContact(
  request,
  env = {},
  { fetch: send = fetch, now = Date.now(), log = console } = {},
) {
  let data;
  try {
    data = await readBody(request);
  } catch {
    return answer(request, { ok: false, error: 'unreadable' }, 400, {});
  }
  const reply = (body, status, message) =>
    answer(request, body, status, { message, page: data._page });
  const sent = () => reply({ ok: true }, 200, data._success);
  const failed = (body, status) => reply({ ok: false, ...body }, status, data._error);

  // spam: the trap was filled, or it was sent faster than a person can
  const t = Number(data._t);
  if ((data.website || '').trim() || (t > 0 && now - t < MIN_SECONDS * 1000)) {
    log.warn('[contact] spam dropped (trap field or too fast)');
    return sent();
  }

  const fields = Object.entries(data).filter(([k]) => !INTERNAL(k));
  const problems = {};
  const email = (data.email || '').trim();
  if (!EMAIL.test(email) || email.length > 254) problems.email = 'invalid';
  if (fields.length > MAX_FIELDS) problems._form = 'too many fields';
  for (const [k, v] of fields) if (v.length > MAX_LENGTH) problems[k] = 'too long';
  if (!fields.some(([k, v]) => k !== 'email' && v.trim())) problems._form = 'empty';
  if (Object.keys(problems).length) return failed({ error: 'invalid', fields: problems }, 400);

  if (env.TURNSTILE_SECRET_KEY) {
    const check = await send('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: data['cf-turnstile-response'] || '',
        remoteip: request.headers.get('cf-connecting-ip') || '',
      }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    if (!check.success) return failed({ error: 'challenge' }, 400);
  }

  const missing = ['RESEND_API_KEY', 'CONTACT_TO', 'CONTACT_FROM'].filter((k) => !env[k]);
  if (missing.length) {
    log.error(
      `[contact] not sent: ${missing.join(', ')} not set. Add them in the Cloudflare Pages project (Settings > Variables and Secrets), see the README "Contact form".`,
    );
    return failed({ error: 'not configured' }, 500);
  }

  const about = oneLine(data.subject || data.name || email).slice(0, 120);
  const text = [
    ...fields.map(([k, v]) => `${k}:\n${v.trim()}\n`),
    `Sent from ${oneLine(data._page || '/')}`,
  ].join('\n');
  try {
    const res = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: env.CONTACT_TO.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        reply_to: email,
        subject: `Contact form: ${about}`,
        text,
      }),
    });
    if (!res.ok) {
      log.error(`[contact] Resend answered ${res.status}: ${await res.text()}`);
      return failed({ error: 'send failed' }, 502);
    }
  } catch (err) {
    log.error(`[contact] Resend could not be reached: ${err.message}`);
    return failed({ error: 'send failed' }, 502);
  }
  return sent();
}

/** Cloudflare Pages: POST /api/contact (other methods get 405 from Pages). */
export const onRequestPost = ({ request, env }) => handleContact(request, env);
