/**
 * What a widget module may import from the core (a site's own widgets: `import { html, esc }
 * from '#widget-api'`, package.json "imports"). Kept small and stable: the rest of src/site
 * can change without breaking a site's widgets.
 *
 *   html`...`        a template that joins lists and leaves nested html as is
 *   esc(text)        text made safe for HTML (attributes too)
 *   lines(text)      esc, line breaks as <br>
 *   words(text)      one <span> per word (split animations)
 *   img(ctx, src, o) a photo: srcset, sizes, placeholder, alt from photos.json
 *   sizes(phone, wider), pad(n), extAttrs(url), hrefOf(ctx, link, where)
 *   t(ctx, 'group.key', vars)  UI text (strings.json over the core's English)
 *   warnOnce(message)          a build/dev warning, once
 */
export { html, esc, lines, words, img, sizes, pad, extAttrs, warnOnce } from './helpers.js';
export { hrefOf } from './hrefs.js';
export { t } from './strings.js';
