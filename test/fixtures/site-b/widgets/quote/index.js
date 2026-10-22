/**
 * Quote: a pull quote with its author, the example of a site's own widget (README "Custom
 * widgets"). Its look: style.scss; on the page, client.js marks it seen once it scrolls in.
 */
import { html, esc, lines } from '#widget-api';

export default {
  type: 'quote',
  label: 'Quote',
  icon: 'quote-left',
  line: 'A pull quote and who said it',
  fields: [
    { key: 'quote', label: 'Quote', type: 'block' },
    { key: 'author', label: 'Author', width: 'half' },
    { key: 'role', label: 'Role', width: 'half' },
  ],
  config: [
    {
      key: 'size',
      label: 'Size',
      type: 'select',
      options: [
        ['', 'Normal'],
        ['large', 'Large'],
      ],
    },
  ],
  defaults: { quote: 'Something worth repeating.', author: 'Someone', role: '', config: {} },
  check: (w) =>
    String(w.quote || '').length > 400 ? ['"quote" is longer than 400 characters'] : [],
  render: (w, ctx, b) =>
    html`<figure class="quote${w.config?.size === 'large' ? ' quote--large' : ''}">
      <blockquote class="quote__text" ${b.ed('quote', 'block')}>${lines(w.quote)}</blockquote>
      <figcaption class="quote__by">
        <span ${b.ed('author')}>${esc(w.author)}</span
        >${w.role ? html`, <span ${b.ed('role')}>${esc(w.role)}</span>` : ''}
      </figcaption>
    </figure>`,
};
