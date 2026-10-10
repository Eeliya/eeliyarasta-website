/**
 * Plain block types for any page: text, one photo, a button. See ./index.js for the shape.
 */
import { html, esc, img, extAttrs } from '../helpers.js';

/** Paragraphs (a blank line starts a new one) under an optional title. */
export const text = {
  type: 'text',
  label: 'Text',
  icon: 'align-left',
  fields: [
    { key: 'title', label: 'Title (empty: none)' },
    { key: 'text', label: 'Text (a blank line starts a paragraph)', type: 'block' },
  ],
  defaults: { title: '', text: 'Some text.' },
  render: (s, ctx, b) => {
    const paragraphs = String(s.text ?? '')
      .split(/\n\s*\n/)
      .filter((p) => p.trim());
    return html` <div class="textblock">
      ${s.title ? html`<h2 class="section__title" data-anim="section.title" ${b.ed('title')}>${esc(s.title)}</h2>` : ''}
      <div class="textblock__body" data-anim="about.body" ${b.ed('text', 'block')}>
        ${paragraphs.map((p) => html`<p>${esc(p.trim()).replace(/\r?\n/g, '<br>')}</p>`)}
      </div>
    </div>`;
  },
};

/** One photo, as wide as the text column, with an optional caption. */
export const photo = {
  type: 'photo',
  label: 'Photo',
  icon: 'image',
  fields: [
    { key: 'src', label: 'Photo', type: 'image' },
    { key: 'caption', label: 'Caption (empty: none)' },
  ],
  defaults: { src: '', caption: '' },
  render: (s, ctx, b) =>
    html` <div class="photoblock">
      <figure class="photoblock__figure" data-anim="about.image">
        ${s.src ? img(ctx, s.src, { sizes: '(max-width: 760px) 100vw, 60vw', attrs: b.ed('src', 'image') }) : ''}
        ${s.caption ? html`<figcaption class="label muted" ${b.ed('caption')}>${esc(s.caption)}</figcaption>` : ''}
      </figure>
    </div>`,
};

/** A button linking somewhere (config.href: a path on the site or a full URL). */
export const button = {
  type: 'button',
  label: 'Button',
  icon: 'arrow-right',
  fields: [{ key: 'label', label: 'Label' }],
  config: [{ key: 'href', label: 'Link (/path/ or https://…)', type: 'text' }],
  defaults: { label: 'Get in touch', config: { href: '/about/' } },
  render: (s, ctx, b) => {
    const href = s.config?.href || '/';
    return html` <div class="buttonblock">
      <a class="btn glass" href="${esc(href)}"${extAttrs(href)}><span${b.ed('label')}>${esc(s.label)}</span> <span aria-hidden="true">→</span></a>
    </div>`;
  },
};
