/**
 * The built-in Photo widget (photo): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, sizes } from '../../helpers.js';

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

export default photo;
