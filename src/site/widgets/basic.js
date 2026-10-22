/**
 * Plain widget types for any page: text, one photo, a button. See ./index.js for the shape.
 */
import { html, esc, img, extAttrs, sizes, pad, editable } from '../helpers.js';
import { checkBody, countText, fieldText, renderBody } from '../text.js';
import { sourceList } from './data.js';
import { hrefOf } from '../hrefs.js';

/**
 * Text: lines in the site's text styles (a label, a title, paragraphs, ...), with bold,
 * italic, links, an item's fields and counts in them (../text.js has the body's shape).
 * Edited in the preview only (src/editor/rich.js). config.center: centred;
 * config.numbered: its first label starts with its number among the page's numbered text
 * widgets ("(01) "). A title line animates as page.title, the lines after it (when the
 * widget has no motion of its own) as page.intro.
 */
export const text = {
  type: 'text',
  label: 'Text',
  icon: 'font',
  line: 'Titles, paragraphs, labels: any text',
  sketch: 'text',
  fields: [{ key: 'body', label: 'Text', type: 'rich' }],
  config: [
    { key: 'center', label: 'Centred', type: 'boolean' },
    { key: 'numbered', label: 'Numbered (01)', type: 'boolean' },
  ],
  defaults: { body: [{ style: 'paragraph', text: [{ t: 'Some text.' }] }], config: {} },
  check: (b) => (b.body === undefined ? [] : checkBody(b.body)),
  render: (s, ctx, b) => {
    const c = s.config || {};
    const body = Array.isArray(s.body) ? s.body : [];
    const missing = (name) => (editable ? `{{${name}}}` : '');
    const value = (r) => {
      if (r.field !== undefined) return fieldText(r, b.item) || missing(r.field);
      const n = r.count.source ? sourceList(ctx, r.count.source).length : (b.items || []).length;
      return countText(n);
    };
    const firstTitle = body.findIndex((l) => l?.style === 'title');
    const firstLabel = body.findIndex((l) => l?.style === 'label');
    const own = typeof s.motion?.anim === 'string';
    const attrs = (i, style) =>
      style === 'title' && i === firstTitle
        ? ' data-anim="page.title"'
        : !own && firstTitle >= 0 && i > firstTitle
          ? ' data-anim="page.intro"'
          : '';
    const lead = (i) =>
      c.numbered && i === firstLabel
        ? `<span class="ts__num"${editable ? ' contenteditable="false"' : ''}>(${pad(b.number)}) </span>`
        : '';
    return html`<div class="text${c.center ? ' text--center' : ''}">
      <div class="text__body" ${b.ed('body', 'rich')}>${renderBody(body, {
        value,
        href: (link) => hrefOf(ctx, link, 'a text link') || '#',
        attrs,
        lead,
      })}</div>
    </div>`;
  },
};

/** One photo, as wide as the text column, with an optional caption. */
export const photo = {
  type: 'photo',
  label: 'Photo',
  icon: 'image',
  line: 'One photo, with a caption',
  sketch: 'photo',
  fields: [
    { key: 'src', label: 'Photo', type: 'image' },
    { key: 'caption', label: 'Caption (empty: none)' },
  ],
  defaults: { src: '', caption: '', motion: { anim: 'image-reveal' } },
  render: (s, ctx, b) =>
    html` <div class="photowidget">
      <figure class="photowidget__figure">
        ${s.src ? img(ctx, s.src, { sizes: sizes('100vw', '60vw'), attrs: b.ed('src', 'image') }) : ''}
        ${s.caption ? html`<figcaption class="label muted" ${b.ed('caption')}>${esc(s.caption)}</figcaption>` : ''}
      </figure>
    </div>`,
};

/** A button linking somewhere (config.link: a page, an item or a URL; src/site/hrefs.js). */
export const button = {
  type: 'button',
  label: 'Button',
  icon: 'arrow-right',
  line: 'A link to a page or a site',
  sketch: 'button',
  fields: [{ key: 'label', label: 'Label' }],
  config: [{ key: 'link', label: 'Link', type: 'link' }],
  defaults: {
    label: 'Get in touch',
    config: { link: { href: '/about/' } },
    motion: { anim: 'fade-in' },
  },
  render: (s, ctx, b) => {
    const href = hrefOf(ctx, s.config?.link, 'a button') || '/';
    return html` <div class="buttonwidget">
      <a class="btn glass" href="${esc(href)}"${extAttrs(href)}><span${b.ed('label')}>${esc(s.label)}</span> <span aria-hidden="true">→</span></a>
    </div>`;
  },
};
