/**
 * Contact forms (src/site/blocks/form.js): the page works without this (a plain POST);
 * with it, the form checks its fields in place, sends with fetch and shows the section's
 * messages (data-success, data-error, data-required, data-invalid, data-sending on the
 * <form>) without leaving the page. While sending, the button is disabled with a spinner;
 * the result goes to the role="status" line, which gets the focus. An email-link form opens
 * the visitor's mail app with the message filled in. Turnstile (a .cf-turnstile in the form)
 * loads Cloudflare's script on demand.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScript = null;

function loadTurnstile() {
  turnstileScript ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE;
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = reject;
    document.head.append(s);
  });
  return turnstileScript;
}

/** The problem with one input ('' when fine), in the section's words. */
function problem(form, el) {
  const value = el.value.trim();
  if (el.required && !value) return form.dataset.required || 'Please fill this in.';
  if (el.type === 'email' && value && !EMAIL.test(value))
    return form.dataset.invalid || 'Please enter a valid email address.';
  return '';
}

/** Show (or clear) an input's problem under it. Returns whether it is fine. */
function mark(form, el) {
  const msg = problem(form, el);
  const out = document.getElementById(el.getAttribute('aria-describedby'));
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (out) {
    out.textContent = msg;
    out.hidden = !msg;
  }
  return !msg;
}

/** mailto: with the fields as the body (an email-link form). */
function mailto(form) {
  const data = new FormData(form);
  const body = [...form.querySelectorAll('.cform__input')]
    .map(
      (el) =>
        `${el.labels?.[0]?.textContent.replace(/\s*\*$/, '') || el.name}: ${data.get(el.name) || ''}`,
    )
    .join('\n\n');
  const subject = data.get('subject') || data.get('name') || '';
  return `${form.action.split('?')[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function enhance(form) {
  const inputs = [...form.querySelectorAll('.cform__input')];
  const status = form.querySelector('.cform__status');
  const button = form.querySelector('.cform__submit');
  const label = button.querySelector('.cform__text');
  const idle = label.textContent;
  const time = form.querySelector('input[name="_t"]');
  const widget = form.querySelector('.cf-turnstile');
  let widgetId = null;
  form.noValidate = true; // our messages instead of the browser's bubbles
  if (time) time.value = String(Date.now());
  if (widget)
    loadTurnstile()
      .then((t) => (widgetId = t.render(widget)))
      .catch(() => {});

  const say = (text, error) => {
    status.textContent = text;
    status.classList.toggle('is-error', !!error);
    status.focus();
  };
  const busy = (on) => {
    button.disabled = on;
    form.classList.toggle('is-sending', on);
    form.setAttribute('aria-busy', String(on));
    label.textContent = on ? form.dataset.sending || idle : idle;
  };

  // a field's message updates as soon as it was left once
  const onBlur = (e) => inputs.includes(e.target) && mark(form, e.target);
  const onInput = (e) =>
    inputs.includes(e.target) &&
    e.target.getAttribute('aria-invalid') === 'true' &&
    mark(form, e.target);

  async function onSubmit(e) {
    e.preventDefault();
    const bad = inputs.filter((el) => !mark(form, el));
    if (bad.length) return bad[0].focus();
    if (form.dataset.contact === 'email') {
      window.location.href = mailto(form);
      return;
    }
    busy(true);
    status.textContent = '';
    let ok;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      ok = res.ok && (await res.json().catch(() => ({ ok: true }))).ok !== false;
    } catch {
      ok = false;
    }
    busy(false);
    if (widgetId !== null) window.turnstile?.reset(widgetId);
    if (ok) {
      form.reset();
      inputs.forEach((el) => el.removeAttribute('aria-invalid'));
      if (time) time.value = String(Date.now());
      say(form.dataset.success || 'Sent.', false);
    } else say(form.dataset.error || 'Not sent. Please try again.', true);
  }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('focusout', onBlur);
  form.addEventListener('input', onInput);
  return () => {
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('focusout', onBlur);
    form.removeEventListener('input', onInput);
    if (widgetId !== null) window.turnstile?.remove(widgetId);
  };
}

export function contactForms(view) {
  const offs = [...view.querySelectorAll('form[data-contact]')].map(enhance);
  return offs.length ? () => offs.forEach((off) => off()) : null;
}
