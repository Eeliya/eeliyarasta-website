/**
 * The built-in Hero widget (hero): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, lines, words, firstPhotos, sizes } from '../../helpers.js';
import { t } from '../../strings.js';
import { hrefOf } from '../../hrefs.js';

const heroPhoto = (ctx, b, p, i) => {
  // phone: its own x / y / w over the desktop's (partly or all); null: hidden on phones
  const mobile = p.phone !== null;
  const ph = { x: p.x, y: p.y, w: p.w, ...(p.phone || {}) };
  const style = `--x:${p.x}%;--y:${p.y}%;--w:${p.w}vw;${mobile ? `--mx:${ph.x}%;--my:${ph.y}%;--mw:${ph.w}vw;` : ''}`;
  if (!p.src) return '';
  return html` <a
    class="scatter scatter--${p.layer === 'front' ? 'front' : 'back'}${mobile ? '' : ' scatter--desktop'}"
    href="${esc(hrefOf(ctx, p.link, 'a hero photo'))}"
    style="${style}"
    data-depth="${p.depth}"
    aria-label="${esc(p.label)}"
  >
    <span class="scatter__drift"
      ><span class="scatter__frame">
        ${img(ctx, p.src, { decorative: true, sizes: sizes(`${mobile ? ph.w : 30}vw`, `${p.w}vw`), ...firstPhotos(i), attrs: b.ed(['photos', i, 'src'], 'image') })}
      </span></span
    >
  </a>`;
};

/** The big name over scattered photos (photos: [{ src, link, label, x, y, w, phone?: { x?, y?, w? } | null, depth?, layer? }]). */
export const hero = {
  type: 'hero',
  label: 'Hero',
  icon: 'star',
  line: 'Your name over scattered photos',
  sketch: 'hero',
  fields: [
    { key: 'title', label: 'Name', type: 'words', width: 'half' },
    { key: 'eyebrow', label: 'Eyebrow', width: 'half' },
    { key: 'body', label: 'Subline', type: 'block' },
    {
      key: 'photos',
      label: 'Photos',
      list: { src: 'image', link: { type: 'link', label: 'Link' } },
      // a new photo: in the middle, behind the name (x / y / w in % of the hero; see heroPhoto)
      item: { src: '', x: 40, y: 30, w: 16, depth: 1 },
    },
  ],
  defaults: { title: 'Your name', eyebrow: '', body: '', photos: [] },
  render: (s, ctx, b) =>
    html` <div class="hero" data-hero>
      <div class="hero__photos" data-anim="hero.photos">
        ${(s.photos || []).map((p, i) => heroPhoto(ctx, b, p, i))}
      </div>
      <h1 class="hero__title" data-anim="hero.title">
        <span class="hero__name" ${b.ed('title', 'words')}
          >${words(s.title ?? ctx.site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${b.ed('eyebrow')}>${esc(s.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>${esc(t(ctx, 'hero.scroll'))}</span>
        <p class="hero__subline" ${b.ed('body', 'block')}>${lines(s.body)}</p>
      </div>
    </div>`,
};

export default hero;
