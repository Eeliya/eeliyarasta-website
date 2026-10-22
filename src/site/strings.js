/**
 * UI text of the public site: the core's English defaults, under the site's own
 * strings.json (content folder). A site sets only what it changes; a missing key falls back
 * to these. Placeholders in braces ("Show photo {n}") are filled by t().
 *
 *   t(ctx, 'album.prev')               "Previous photo"
 *   t(ctx, 'album.show', { n: 3 })     "Show photo 3"
 *
 * Widget content (titles, buttons a widget's fields hold) is not here: it is the page's.
 */
import { isObject } from './is.js';

export const CORE_STRINGS = Object.freeze({
  page: { skip: 'Skip to content' },
  nav: {
    menu: 'Menu',
    close: 'Close',
    clock: '',
    home: '{name}, home',
    main: 'Main',
    mobile: 'Mobile',
  },
  tag: { placeholder: 'Placeholder' },
  hero: { scroll: 'Scroll' },
  album: {
    photos: '{title} photos',
    slide: '{n} of {total}',
    prev: 'Previous photo',
    next: 'Next photo',
    show: 'Show photo {n}',
    open: 'Open photo {n}',
    view: 'View mode',
    slider: 'Slider',
    grid: 'Grid',
  },
  projects: { visit: 'Visit' },
  form: {
    honeypot: 'Leave this empty',
    submit: 'Send',
    sent: 'Sent.',
    error: 'Not sent. Please try again.',
    required: 'Please fill this in.',
    invalid: 'Please enter a valid email address.',
  },
});

/** The site's strings.json over the core defaults (one level of groups, like strings.json). */
export function stringsOf(own = {}) {
  const out = {};
  for (const [group, values] of Object.entries(CORE_STRINGS)) out[group] = { ...values };
  for (const [group, values] of Object.entries(isObject(own) ? own : {}))
    if (isObject(values)) out[group] = { ...out[group], ...values };
  return out;
}

const fill = (s, vars) =>
  vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : String(s);

/** A string by "group.key" from ctx.strings (else the core default), placeholders filled. */
export function t(ctx, key, vars) {
  const [group, name] = key.split('.');
  const own = ctx?.strings?.[group]?.[name];
  return fill(own ?? CORE_STRINGS[group]?.[name] ?? key, vars);
}
