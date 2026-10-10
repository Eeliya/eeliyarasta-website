import { html, esc, editable } from '../helpers.js';
import { seoOf } from '../seo.js';
import { header, mobileMenu } from './header.js';
import { footer } from './footer.js';

/** <head> contents injected into index.html at <!--ssr-head--> (meta: src/site/seo.js) */
export function head(ctx, route, accent) {
  const { site } = ctx;
  const seo = seoOf(ctx, route);
  const image = seo.image;
  const ld =
    route.page === 'home'
      ? html`<script type="application/ld+json">
          ${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: site.name,
            url: site.url,
            jobTitle: site.jobTitle || undefined,
            address: site.country
              ? { '@type': 'PostalAddress', addressCountry: site.country }
              : undefined,
            sameAs: (site.social || []).map((s) => s.url),
          })}
        </script>`
      : '';
  return html` <title>${esc(seo.title)}</title>
    <meta name="description" content="${esc(seo.description)}" />
    <link rel="canonical" href="${esc(seo.url)}" />
    ${seo.noindex ? '<meta name="robots" content="noindex">' : ''}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:title" content="${esc(seo.title)}" />
    <meta property="og:description" content="${esc(seo.description)}" />
    <meta property="og:url" content="${esc(seo.url)}" />
    ${
      image
        ? html`<meta property="og:image" content="${esc(image.url)}" />${
            image.width
              ? html`
    <meta property="og:image:width" content="${image.width}" />
    <meta property="og:image:height" content="${image.height}" />`
              : ''
          }${
            image.alt
              ? html`
    <meta property="og:image:alt" content="${esc(image.alt)}" />`
              : ''
          }`
        : ''
    }
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <style id="accent-init">
      :root {
        --accent: ${esc(accent)};
      }
    </style>
    ${ld}`;
}

/**
 * Pages whose curtain is not the global one, as JSON for the client router (router.js reads
 * #page-curtains). Nothing when every page uses the global curtain.
 */
function pageCurtains(curtains) {
  if (!Object.keys(curtains || {}).length) return '';
  const json = JSON.stringify(curtains).replace(/</g, '\\u003c');
  return `<script type="application/json" id="page-curtains">${json}</script>`;
}

/** Full <body> contents injected at <!--ssr-body-->; file: the page file of its sections. */
export function body(ctx, route, accent, view, file) {
  const curtain = route.curtain ?? '';
  // the editor: where the curtain text and the sections are stored
  const curtainEdit = editable
    ? `${route.curtainEdit ? ` data-curtain-edit="${esc(route.curtainEdit)}"` : ''} data-page-file="${esc(file)}"`
    : '';
  const page = html` <a class="skip-link" href="#main">Skip to content</a>
    <div class="backdrop" aria-hidden="true">
      <div class="backdrop__glow"></div>
      <div class="backdrop__grain"></div>
    </div>
    ${header(ctx)} ${mobileMenu(ctx)}
    <main
      id="main"
      tabindex="-1"
      class="view view--${esc(route.page)}"
      data-router-view
      data-page="${esc(route.page)}"
      data-accent="${esc(accent)}"
      data-curtain="${esc(curtain)}"
      ${curtainEdit}
    >
      ${view} ${route.page === 'album' ? '' : footer(ctx, route)}
    </main>
    <div id="portal"></div>
    <div class="curtain" aria-hidden="true">
      <div class="curtain__panel"></div>
      <span class="curtain__label"></span>
    </div>`;
  return page + pageCurtains(ctx.curtains);
}
