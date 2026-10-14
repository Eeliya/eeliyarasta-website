/**
 * Plain block types for any page: text, one photo, a button. See ./index.js for the shape.
 */
import { html, esc, img, extAttrs, lines, sizes } from '../helpers.js';
import { hrefOf } from '../hrefs.js';

/** Paragraphs (a blank line starts a new one) under an optional title. */
export const text = {
  type: 'text',
  label: 'Text',
  icon: 'align-left',
  line: 'Paragraphs, with a title if you like',
  sketch: 'text',
  fields: [
    { key: 'title', label: 'Title (empty: none)' },
    { key: 'body', label: 'Text (a blank line starts a paragraph)', type: 'block' },
  ],
  defaults: { title: '', body: 'Some text.', motion: { anim: 'lines-up' } },
  render: (s, ctx, b) => {
    const paragraphs = String(s.body ?? '')
      .split(/\n\s*\n/)
      .filter((p) => p.trim());
    return html` <div class="textblock">
      ${s.title ? html`<h2 class="section__title" ${b.ed('title')}>${esc(s.title)}</h2>` : ''}
      <div class="textblock__body" ${b.ed('body', 'block')}>
        ${paragraphs.map((p) => html`<p>${lines(p.trim())}</p>`)}
      </div>
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
    html` <div class="photoblock">
      <figure class="photoblock__figure">
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
    return html` <div class="buttonblock">
      <a class="btn glass" href="${esc(href)}"${extAttrs(href)}><span${b.ed('label')}>${esc(s.label)}</span> <span aria-hidden="true">→</span></a>
    </div>`;
  },
};
