/**
 * The contact form section. See ./index.js for the shape of a type.
 *
 * Its texts are content (title, intro, each field's label and placeholder, the button, the
 * messages); `fields` is the list of inputs: { name, type, label, placeholder, required,
 * options } (type text | email | tel | textarea | select; options: a select's choices,
 * comma-separated). The name is what the submission calls the value; "name", "email" and
 * "phone" get the browser's autofill, and "email" is the reply-to address (needed).
 *
 * Where it sends (config.target, else site.json forms.target, see formTarget):
 *   function  POST /api/contact: the Cloudflare Pages Function functions/api/contact.js
 *             (the dev server answers it too, scripts/vite-plugin-static-site.mjs)
 *   endpoint  POST to site.json forms.endpoint (a form service such as Formspree)
 *   email     the visitor's mail app, to site.json email (mailto:); also the fallback
 * A plain <form method="post"> that works without JavaScript; src/client/modules/form.js
 * sends it with fetch and shows the messages in place.
 */
import { html, esc, warnOnce } from '../helpers.js';

export const FIELD_TYPES = [
  ['text', 'Text'],
  ['email', 'Email'],
  ['tel', 'Phone'],
  ['textarea', 'Long text'],
  ['select', 'Choice'],
];
export const TARGETS = [
  ['function', 'Cloudflare function (/api/contact)'],
  ['endpoint', 'External endpoint (a URL)'],
  ['email', 'Email link (mailto)'],
];
const AUTOCOMPLETE = { name: 'name', email: 'email', phone: 'tel' };

/** Where a form section sends: { mode, action }. Without an endpoint or function: email. */
export function formTarget(site, s) {
  const forms = site?.forms || {};
  let mode = s.config?.target || forms.target || 'function';
  if (mode === 'endpoint' && !/^https:\/\//.test(forms.endpoint || '')) {
    warnOnce(
      'A form sends to an external endpoint, but site.json forms.endpoint is not set: email link',
      'form',
    );
    mode = 'email';
  }
  if (mode === 'function') return { mode, action: '/api/contact' };
  if (mode === 'endpoint') return { mode, action: forms.endpoint };
  return { mode: 'email', action: `mailto:${site?.email || ''}` };
}

/** "A, B , C" -> ['A', 'B', 'C'] */
const choices = (options) =>
  String(options ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

function input(f, id) {
  const name = esc(f.name);
  const attrs = [
    `id="${id}" name="${name}" class="cform__input"`,
    f.required ? ' required' : '',
    f.placeholder && f.type !== 'select' ? ` placeholder="${esc(f.placeholder)}"` : '',
    ` autocomplete="${AUTOCOMPLETE[f.name] || 'off'}"`,
    ` aria-describedby="${id}-error"`,
  ].join('');
  if (f.type === 'textarea') return html`<textarea ${attrs} rows="6"></textarea>`;
  if (f.type === 'select')
    return html`<select ${attrs}>
      <option value="">${esc(f.placeholder || '—')}</option>
      ${choices(f.options).map((o) => html`<option>${esc(o)}</option>`)}
    </select>`;
  const type = ['email', 'tel'].includes(f.type) ? f.type : 'text';
  return html`<input type="${type}" ${attrs} />`;
}

export const form = {
  type: 'form',
  label: 'Contact form',
  icon: 'envelope',
  fields: [
    { key: 'title', label: 'Title (empty: none)' },
    { key: 'intro', label: 'Intro (empty: none)', type: 'block' },
    {
      key: 'fields',
      label: 'Form fields',
      list: {
        label: { type: 'text', label: 'Label', width: 'half' },
        placeholder: { type: 'text', label: 'Placeholder', width: 'half' },
        name: { type: 'words', label: 'Name (in the email; name, email, phone autofill)' },
        type: { type: 'select', label: 'Type', options: FIELD_TYPES, width: 'half' },
        required: { type: 'boolean', label: 'Required', width: 'half' },
        options: { type: 'text', label: 'Choices (a Choice field; comma-separated)' },
      },
      item: { name: 'subject', type: 'text', label: 'Subject', placeholder: '', required: false },
    },
    { key: 'submit', label: 'Send button', width: 'half' },
    { key: 'sending', label: 'While sending', width: 'half' },
    { key: 'success', label: 'Message: sent', type: 'block' },
    { key: 'error', label: 'Message: not sent', type: 'block' },
    { key: 'required', label: 'Message: a required field is empty' },
    { key: 'invalid', label: 'Message: an email address is not valid' },
  ],
  config: [
    {
      key: 'target',
      label: 'Sends to',
      type: 'select',
      options: [['', 'Site default (Settings > Forms)'], ...TARGETS],
    },
  ],
  defaults: {
    title: 'Get in touch',
    intro: 'Shoots, collaborations or just hello: I read everything.',
    fields: [
      { name: 'name', type: 'text', label: 'Name', placeholder: 'Your name', required: true },
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        placeholder: 'you@example.com',
        required: true,
      },
      { name: 'message', type: 'textarea', label: 'Message', placeholder: '', required: true },
    ],
    submit: 'Send message',
    sending: 'Sending…',
    success: 'Thank you! Your message is on its way. I will get back to you soon.',
    error: 'Sorry, your message could not be sent. Please try again, or email me.',
    required: 'Please fill this in.',
    invalid: 'Please enter a valid email address.',
    config: { target: '' },
  },
  // its fields: valid names, once each, known types; an email field for the reply
  check: (s) => {
    const out = [];
    const list = Array.isArray(s.fields) ? s.fields.filter((f) => f && typeof f === 'object') : [];
    const seen = new Set();
    list.forEach((f, i) => {
      const where = `field ${i + 1}`;
      if (typeof f.name !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(f.name))
        out.push(`${where}: "name" must be lowercase letters, digits, - or _ (e.g. "phone")`);
      else if (f.name === 'website') out.push(`${where}: "website" is taken (the spam trap)`);
      else if (seen.has(f.name)) out.push(`${where}: another field is called "${f.name}"`);
      seen.add(f.name);
      if (!FIELD_TYPES.some(([t]) => t === f.type))
        out.push(`${where}: "type" must be one of ${FIELD_TYPES.map(([t]) => t).join(', ')}`);
      if (f.required !== undefined && typeof f.required !== 'boolean')
        out.push(`${where}: "required" must be true or false`);
      for (const k of ['label', 'placeholder', 'options'])
        if (f[k] !== undefined && typeof f[k] !== 'string')
          out.push(`${where}: "${k}" must be a string`);
      if (f.type === 'select' && !choices(f.options).length)
        out.push(`${where}: a Choice field needs "options" (comma-separated)`);
    });
    if (!list.some((f) => f.name === 'email' && f.type === 'email'))
      out.push('needs a field named "email" of type email: replies go there');
    return out;
  },
  render: (s, ctx, sec) => {
    const { mode, action } = formTarget(ctx.site, s);
    const id = `contact-${sec.at}`;
    const fields = (Array.isArray(s.fields) ? s.fields : []).filter((f) => f?.name);
    const email = ctx.site?.email;
    const turnstile = mode === 'function' && ctx.site?.forms?.turnstileSiteKey;
    const msg = (key) => ` data-${key}="${esc(s[key] ?? '')}"`;
    return html` <section class="section formblock" ${sec.attrs}>
      ${s.title ? html`<h2 class="section__title" data-anim="section.title" ${sec.ed('title')}>${esc(s.title)}</h2>` : ''}
      ${s.intro ? html`<p class="formblock__intro" ${sec.ed('intro', 'block')}>${esc(s.intro)}</p>` : ''}
      <form class="cform" id="${id}" method="post" action="${esc(action)}"${mode === 'email' ? ' enctype="text/plain"' : ''} data-contact="${mode}"${msg('success')}${msg('error')}${msg('required')}${msg('invalid')}${msg('sending')}>
        ${fields.map(
          (f, i) => html`<div class="cform__field">
          <label class="cform__label" for="${id}-${esc(f.name)}"><span ${sec.ed(['fields', i, 'label'])}>${esc(f.label || f.name)}</span>${f.required ? html`<span class="cform__req" aria-hidden="true"> *</span>` : ''}</label>
          ${input(f, `${id}-${esc(f.name)}`)}
          <p class="cform__error" id="${id}-${esc(f.name)}-error" hidden></p>
        </div>`,
        )}
        <div class="cform__hp" aria-hidden="true">
          <label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </div>
        ${
          mode === 'email'
            ? ''
            : html`<input type="hidden" name="_page" value="${esc(ctx.route?.path || '/')}" />
        <input type="hidden" name="_t" value="" />`
        }
        ${
          mode === 'function'
            ? html`<input type="hidden" name="_success" value="${esc(s.success ?? '')}" />
        <input type="hidden" name="_error" value="${esc(s.error ?? '')}" />`
            : ''
        }
        ${turnstile ? html`<div class="cf-turnstile" data-sitekey="${esc(turnstile)}"></div>` : ''}
        <div class="cform__actions">
          <button class="btn glass cform__submit" type="submit"><span class="cform__text" ${sec.ed('submit')}>${esc(s.submit || 'Send')}</span><span class="cform__spinner" aria-hidden="true"></span></button>
          ${email && mode !== 'email' ? html`<a class="cform__alt muted" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
        </div>
        <p class="cform__status" role="status" aria-live="polite" tabindex="-1"></p>
      </form>
    </section>`;
  },
};
