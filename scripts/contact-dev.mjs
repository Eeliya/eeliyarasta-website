/**
 * The dev server's POST /api/contact: the contact form's Cloudflare Pages Function
 * (functions/api/contact.js) with stand-in settings and a fetch that logs the email instead
 * of sending it, so the form can be tried in `npm run dev` and the editor preview without
 * keys. ?contact-fail in the page's URL (or ?fail on the request) answers like a failed send.
 * Turnstile is not checked here.
 */
import { handleContact } from '../functions/api/contact.js';

const ENV = { RESEND_API_KEY: 'dev', CONTACT_TO: 'you@localhost', CONTACT_FROM: 'site@localhost' };

/** Node request -> a fetch Request with its body. */
async function toRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Request(new URL(req.originalUrl || req.url, 'http://localhost'), {
    method: req.method,
    headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
    body: Buffer.concat(chunks),
  });
}

export function contactMiddleware(logger) {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next();
    const request = await toRequest(req);
    const fail =
      new URL(request.url).searchParams.has('fail') ||
      /[?&]contact-fail\b/.test(req.headers.referer || '');
    const log = {
      warn: (m) => logger.warn(m),
      error: (m) => logger.error(m),
    };
    const fetch = async (url, init) => {
      if (url.includes('resend.com')) {
        const mail = JSON.parse(init.body);
        logger.info(
          `\x1b[36m[contact]\x1b[0m ${fail ? 'simulated failure for' : 'would send'}: ${mail.subject} (reply to ${mail.reply_to})\n${mail.text}`,
        );
        return fail
          ? new Response('simulated failure', { status: 500 })
          : Response.json({ id: 'dev' });
      }
      return Response.json({ success: true });
    };
    const response = await handleContact(request, ENV, { fetch, log });
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
