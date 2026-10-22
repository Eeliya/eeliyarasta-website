/**
 * The built-in Photo panels widget (panels): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, pad, coverOf, firstPhotos, sizes } from '../../helpers.js';
import { sourcePage } from '../data.js';

/** Big panels linking to sources' pages: panels [{ source, title, unit }] ("People", "models"). */
export const panels = {
  type: 'panels',
  label: 'Photo panels',
  icon: 'table-columns',
  line: 'Big panels to your lists',
  sketch: 'panels',
  fields: [
    {
      key: 'panels',
      label: 'Panels',
      list: {
        source: { type: 'source', label: 'Source' },
        title: { type: 'text', label: 'Title', width: 'half' },
        unit: { type: 'text', label: 'Unit (after the count)', width: 'half' },
      },
      item: { source: 'people', title: 'People', unit: 'items' },
    },
  ],
  defaults: {
    panels: [{ source: 'people', title: 'People', unit: 'models' }],
    motion: { anim: 'grid-reveal' },
  },
  render: (s, ctx, b) => {
    const panel = ({ source, title, unit }, i) => {
      const list = Array.isArray(ctx.sources[source]) ? ctx.sources[source] : [];
      const cover = list.map(coverOf).find(Boolean);
      return html` <a class="ppanel" href="${esc(sourcePage(ctx, source))}" data-anim-item>
      <span class="ppanel__media"
        >${cover ? img(ctx, cover, { sizes: sizes('100vw', '50vw'), ...firstPhotos(i), attrs: 'data-anim="place.card.image"' }) : ''}</span
      >
      <span class="ppanel__info"
        ><span class="ppanel__title"${b.ed(['panels', i, 'title'])}>${esc(title)}</span
        ><span class="label">${pad(list.length)} <span${b.ed(['panels', i, 'unit'])}>${esc(unit)}</span></span></span
      >
    </a>`;
    };
    return html` <div class="ppanels">
      ${(s.panels || []).map(panel)}
    </div>`;
  },
};

export default panels;
