import { html, esc, img, pad, creditText, ratio, ed, lines } from '../helpers.js';

/**
 * Album page (one person or place), Faint Film "slider view":
 * a big current image, numbered thumbnail strip, 01/08 counter,
 * keyboard / drag / wheel navigation and a Slider ⇄ Grid toggle.
 */
export function album(ctx, route) {
  const a = route.album;
  const n = a.images.length;
  const isPeople = route.kind === 'people';
  const at = (field, type) => ed(route.file, [route.index, field], type);
  const meta = [
    isPeople ? ['Role', a.role, at('role')] : null,
    isPeople ? ['Agency', a.agency, at('agency')] : null,
    ['Location', a.location, at('location')],
    ['Year', a.year, at('year', 'number')],
    ['Photos', pad(n), ''],
  ].filter((m) => m && m[1]);

  return html` <section class="album" data-album data-view="slider" data-count="${n}">
    <aside class="album__info">
      <a class="album__back label" href="/${route.kind}/"
        ><span aria-hidden="true">←</span> ${esc(route.section)}</a
      >
      <h1 class="album__title" data-anim="album.title" ${at('name')}>${esc(a.name)}</h1>
      <div class="album__details" data-anim="album.meta">
        <dl class="album__meta">
          ${meta.map(([k, v, attr]) => html`<div><dt class="label">${esc(k)}</dt><dd${attr}>${esc(v)}</dd></div>`)}
        </dl>
        ${a.summary ? html`<p class="album__summary" ${at('summary', 'block')}>${lines(a.summary)}</p>` : ''}
        ${a.placeholder ? html`<p class="album__note"><span class="tag">Placeholder</span> <span${at('note', 'block')}>${lines(a.note || '')}</span></p>` : ''}
      </div>
    </aside>

    <div
      class="album__stage"
      data-anim="album.stage"
      data-album-stage
      aria-roledescription="carousel"
      aria-label="${esc(a.name)} photos"
    >
      ${a.images.map(
        (im, i) =>
          html` <figure
            class="slide${i === 0 ? ' is-active' : ''}"
            data-slide="${i}"
            data-credit="${esc(creditText(im.credit))}"
            data-credit-url="${esc(im.credit?.source || '')}"
            style="--r:${ratio(ctx, im.src).toFixed(4)}"
            aria-label="${i + 1} of ${n}"
            ${i === 0 ? '' : ' aria-hidden="true"'}
          >
            ${img(ctx, im.src, { alt: im.alt, sizes: '(max-width: 760px) 100vw, 70vw', priority: i === 0, loading: i < 2 ? 'eager' : 'lazy' })}
          </figure>`,
      )}
      <button
        class="album__arrow album__arrow--prev glass"
        type="button"
        data-album-prev
        aria-label="Previous photo"
      >
        ←
      </button>
      <button
        class="album__arrow album__arrow--next glass"
        type="button"
        data-album-next
        aria-label="Next photo"
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
        href="${esc(a.images[0].credit?.source || '#')}"
        target="_blank"
        rel="noopener"
        >${esc(creditText(a.images[0].credit))}</a
      >
      <ol class="album__thumbs" data-anim="album.thumbs" data-album-thumbs>
        ${a.images.map(
          (im, i) =>
            html` <li>
              <button
                class="thumb${i === 0 ? ' is-active' : ''}"
                type="button"
                data-goto="${i}"
                aria-label="Show photo ${i + 1}"
              >
                <span class="thumb__num">${pad(i + 1)}</span
                >${img(ctx, im.src, { alt: '', sizes: '80px' })}
              </button>
            </li>`,
        )}
      </ol>
    </div>

    <div class="album__grid" data-album-grid hidden>
      ${a.images.map(
        (im, i) =>
          html` <button
            class="gcell"
            type="button"
            data-goto="${i}"
            aria-label="Open photo ${i + 1}"
          >
            <span class="gcell__num">${pad(i + 1)}</span>
            <span class="gcell__media"
              >${img(ctx, im.src, { alt: im.alt, sizes: '(max-width: 760px) 50vw, 20vw' })}</span
            >
          </button>`,
      )}
      <a class="album__nextlink" href="/${route.kind}/${route.next.slug}/">
        <span class="label">Next ${isPeople ? 'person' : 'place'}</span>
        <span class="album__nextname"
          >${esc(route.next.name)} <span aria-hidden="true">→</span></span
        >
      </a>
    </div>

    <div class="viewtoggle glass" data-portal role="group" aria-label="View mode">
      <span class="viewtoggle__pill" aria-hidden="true"></span>
      <button type="button" class="is-active" aria-pressed="true" data-view-btn="slider">
        Slider
      </button>
      <button type="button" aria-pressed="false" data-view-btn="grid">Grid</button>
    </div>
  </section>`;
}
