import { html, esc } from '../helpers.js';
import { header, mobileMenu } from './header.js';
import { footer } from './footer.js';

/** <head> contents injected into index.html at <!--ssr-head--> */
export function head(ctx, route, accent) {
  const { site } = ctx;
  const url = site.url + (route.out === '404.html' ? '/404' : route.path);
  const image = route.image
    ? ctx.media?.[route.image]?.src || `/media/${route.image}`
    : ctx.media?.['people/noor-vermeer/02.jpg']?.src;
  const ld =
    route.page === 'home'
      ? html`<script type="application/ld+json">
          ${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: site.name,
            url: site.url,
            jobTitle: 'Photographer',
            address: { '@type': 'PostalAddress', addressCountry: 'NL' },
            sameAs: site.social.map((s) => s.url),
          })}
        </script>`
      : '';
  return html` <title>${esc(route.title)}</title>
    <meta name="description" content="${esc(route.description || site.description)}" />
    <link rel="canonical" href="${esc(url)}" />
    ${route.noindex ? '<meta name="robots" content="noindex">' : ''}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:title" content="${esc(route.title)}" />
    <meta property="og:description" content="${esc(route.description || site.description)}" />
    <meta property="og:url" content="${esc(url)}" />
    ${image ? html`<meta property="og:image" content="${esc(site.url + image)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <style id="accent-init">
      :root {
        --accent: ${esc(accent)};
      }
    </style>
    ${ld}`;
}

/** Full <body> contents injected at <!--ssr-body--> */
export function body(ctx, route, accent, view) {
  const curtain = route.curtain ?? '';
  const curtainEdit = route.curtainEdit ? ` data-curtain-edit="${esc(route.curtainEdit)}"` : '';
  return html` <a class="skip-link" href="#main">Skip to content</a>
    <div class="backdrop" aria-hidden="true">
      <div class="backdrop__glow"></div>
      <div class="backdrop__grain"></div>
    </div>
    ${header(ctx, route)} ${mobileMenu(ctx, route)}
    <div id="smooth-wrapper">
      <div id="smooth-content">
        <main
          id="main"
          class="view view--${esc(route.page)}"
          data-router-view
          data-page="${esc(route.page)}"
          data-accent="${esc(accent)}"
          data-curtain="${esc(curtain)}"
          ${curtainEdit}
        >
          ${view} ${route.page === 'album' ? '' : footer(ctx, route)}
        </main>
      </div>
    </div>
    <div id="portal"></div>
    <div class="curtain" aria-hidden="true">
      <div class="curtain__panel"></div>
      <span class="curtain__label"></span>
    </div>`;
}
