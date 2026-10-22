/**
 * The album widget: one item (a person or a place), Faint Film "slider view": a big current
 * image, numbered thumbnail strip, 01/08 counter, keyboard / drag / wheel navigation and a
 * Slider ⇄ Grid toggle. Its photos are its source's item (../../layout/source.js: on a [param]
 * page usually From URL, the page's own; item: true, without one it is skipped). A widget module (../index.js has the format).
 * Its texts are fields bound to the item (../../layout/bindings.js): the title { "bind": "title" },
 * the facts ("Role" / { "bind": "role" }; a fact whose value is empty is left out, "Photos" and the
 * count always come last) and the body { "bind": "body" }.
 */
import {
  html,
  esc,
  img,
  pad,
  creditText,
  creditOf,
  ratio,
  ed,
  lines,
  imagesOf,
  sizes,
} from '../../helpers.js';
import { sourceFile } from '../../files.js';
import { t } from '../../strings.js';
import { titleCase } from '../../routes.js';
import { sourcePage } from '../data.js';

export const album = {
  type: 'album',
  label: 'Album (the item)',
  icon: 'film',
  line: 'The item: its title, facts and photos',
  sketch: 'photo',
  item: true,
  fields: [
    { key: 'title', label: 'Title' },
    {
      key: 'meta',
      label: 'Facts',
      list: {
        label: { type: 'text', label: 'Label', width: 'half' },
        value: { type: 'text', label: 'Value', width: 'half' },
      },
    },
    { key: 'body', label: 'Summary', type: 'block' },
  ],
  defaults: {
    source: { mode: 'url', from: 'people', where: { op: 'and', rules: [] } },
    title: { bind: 'title' },
    meta: [
      { label: 'Location', value: { bind: 'location' } },
      { label: 'Year', value: { bind: 'year' } },
    ],
    body: { bind: 'body' },
  },
  render: (s, ctx, b) => albumOf(s, ctx, ctx.route, b),
};

function albumOf(s, ctx, route, b) {
  const a = b.item;
  const images = imagesOf(a);
  const n = images.length;
  const file = sourceFile(b.source);
  const at = (field, type) => ed(file, ['items', b.index, field], type);
  // a photo's path, edited (and uploaded) in the editor
  const photo = (i) => ed(file, ['items', b.index, 'images', i], 'image');
  // back: the page around it (a [param] page's), else the page of all of its source
  const back = route.parent ?? sourcePage(ctx, b.source);
  const section = route.section ?? titleCase(b.source);
  const title = String(s.title ?? '');
  const summary = String(s.body ?? '');
  const meta = [
    ...(Array.isArray(s.meta) ? s.meta : []).map((m, i) => [
      m?.label,
      m?.value,
      b.ed(['meta', i, 'value']),
      b.ed(['meta', i, 'label']),
    ]),
    ['Photos', pad(n), '', ''],
  ].filter((m) => m[0] && m[1] !== undefined && m[1] !== null && String(m[1]) !== '');

  return html` <div class="album" data-album data-view="slider" data-count="${n}">
    <aside class="album__info">
      <a class="album__back label" href="${esc(back)}"
        ><span aria-hidden="true">←</span> <span>${esc(section)}</span></a
      >
      <h1 class="album__title" data-anim="album.title" ${b.ed('title')}>${esc(title)}</h1>
      <div class="album__details" data-anim="album.meta">
        <dl class="album__meta">
          ${meta.map(([k, v, attr, labelAttr]) => html`<div><dt class="label"${labelAttr}>${esc(k)}</dt><dd${attr}>${esc(v)}</dd></div>`)}
        </dl>
        ${summary ? html`<p class="album__summary" ${b.ed('body', 'block')}>${lines(summary)}</p>` : ''}
        ${a.placeholder ? html`<p class="album__note"><span class="tag">${esc(t(ctx, 'tag.placeholder'))}</span> <span${at('note', 'block')}>${lines(a.note || '')}</span></p>` : ''}
      </div>
    </aside>

    <div
      class="album__stage"
      data-anim="album.stage"
      data-album-stage
      aria-roledescription="carousel"
      aria-label="${esc(t(ctx, 'album.photos', { title: title || a.title }))}"
    >
      ${images.map(
        (im, i) =>
          html` <figure
            class="slide${i === 0 ? ' is-active' : ''}"
            data-slide="${i}"
            data-credit="${esc(creditText(creditOf(ctx, im)))}"
            data-credit-url="${esc(creditOf(ctx, im)?.source || '')}"
            style="--r:${ratio(ctx, im).toFixed(4)}"
            aria-label="${esc(t(ctx, 'album.slide', { n: i + 1, total: n }))}"
            ${i === 0 ? '' : ' aria-hidden="true"'}
          >
            ${img(ctx, im, { sizes: sizes('100vw', '70vw'), priority: i === 0, loading: i < 2 ? 'eager' : 'lazy', attrs: photo(i) })}
          </figure>`,
      )}
      <button
        class="album__arrow album__arrow--prev glass"
        type="button"
        data-album-prev
        aria-label="${esc(t(ctx, 'album.prev'))}"
      >
        ←
      </button>
      <button
        class="album__arrow album__arrow--next glass"
        type="button"
        data-album-next
        aria-label="${esc(t(ctx, 'album.next'))}"
      >
        →
      </button>
    </div>

    <div class="album__bar">
      <div class="album__counter" aria-live="polite">
        <span class="album__current" data-album-current>01</span><span class="album__sep">/</span
        ><span>${pad(n)}</span>
      </div>
      <a
        class="album__credit label muted"
        data-album-credit
        href="${esc(creditOf(ctx, images[0])?.source || '#')}"
        target="_blank"
        rel="noopener"
        >${esc(creditText(creditOf(ctx, images[0])))}</a
      >
      <ol class="album__thumbs" data-anim="album.thumbs" data-album-thumbs>
        ${images.map(
          (im, i) =>
            html` <li>
              <button
                class="thumb${i === 0 ? ' is-active' : ''}"
                type="button"
                data-goto="${i}"
                aria-label="${esc(t(ctx, 'album.show', { n: i + 1 }))}"
              >
                <span class="thumb__num">${pad(i + 1)}</span
                >${img(ctx, im, { decorative: true, sizes: '80px', attrs: photo(i) })}
              </button>
            </li>`,
        )}
      </ol>
    </div>

    <div class="album__grid" data-album-grid hidden>
      ${images.map(
        (im, i) =>
          html` <button
            class="gcell"
            type="button"
            data-goto="${i}"
            aria-label="${esc(t(ctx, 'album.open', { n: i + 1 }))}"
          >
            <span class="gcell__num">${pad(i + 1)}</span>
            <span class="gcell__media"
              >${img(ctx, im, { sizes: sizes('50vw', '20vw'), attrs: photo(i) })}</span
            >
          </button>`,
      )}
    </div>

    <div class="viewtoggle glass" data-portal role="group" aria-label="${esc(t(ctx, 'album.view'))}">
      <span class="viewtoggle__pill" aria-hidden="true"></span>
      <button type="button" class="is-active" aria-pressed="true" data-view-btn="slider">
        ${esc(t(ctx, 'album.slider'))}
      </button>
      <button type="button" aria-pressed="false" data-view-btn="grid">${esc(t(ctx, 'album.grid'))}</button>
    </div>
  </div>`;
}

export default album;
