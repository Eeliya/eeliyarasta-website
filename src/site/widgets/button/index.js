/**
 * The built-in Button widget (button): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, extAttrs } from '../../helpers.js';
import { hrefOf } from '../../hrefs.js';

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

export default button;
