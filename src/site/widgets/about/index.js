/**
 * The built-in Bio widget (about): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html, esc, img, lines, creditText, creditOf, sizes } from '../../helpers.js';

/** The About bio: photo (with credit), eyebrow, title (headline), body (paragraphs), facts, email and socials. */
export const about = {
  type: 'about',
  label: 'Bio',
  icon: 'user',
  line: 'A portrait with your story',
  sketch: 'about',
  fields: [
    { key: 'image', label: 'Photo', type: 'image' },
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Headline' },
    { key: 'body', label: 'Paragraphs', list: 'block' },
    {
      key: 'facts',
      label: 'Facts',
      list: {
        label: { type: 'text', label: 'Label', width: 'half' },
        value: { type: 'text', label: 'Value', width: 'half' },
      },
    },
    { key: 'emailLabel', label: 'Email button' },
  ],
  defaults: {
    image: '',
    eyebrow: 'About',
    title: 'A line about you.',
    body: ['A paragraph about you.'],
    facts: [{ label: 'Based in', value: 'Netherlands' }],
    emailLabel: 'Email me',
  },
  render: (a, ctx, b) => html` <div class="about">
    <div class="about__media">
      <figure class="about__figure" data-anim="about.image">
        ${a.image ? img(ctx, a.image, { sizes: sizes('100vw', '45vw'), priority: true, attrs: b.ed('image', 'image') }) : ''}
      </figure>
      <figcaption class="label muted">
        ${esc(creditText(creditOf(ctx, a.image)))}
      </figcaption>
    </div>
    <div class="about__text">
      <span class="label page-head__crumb" ${b.ed('eyebrow')}>${esc(a.eyebrow)}</span>
      <h1 class="about__headline" data-anim="about.headline" ${b.ed('title')}>
        ${esc(a.title)}
      </h1>
      <div class="about__body" data-anim="about.body">
        ${(a.body || []).map((p, i) => html`<p${b.ed(['body', i], 'block')}>${lines(p)}</p>`)}
        <dl class="facts">
          ${(a.facts || []).map((f, i) => html`<div><dt class="label"${b.ed(['facts', i, 'label'])}>${esc(f.label)}</dt><dd${b.ed(['facts', i, 'value'])}>${esc(f.value)}</dd></div>`)}
        </dl>
        <div class="about__links">
          <a class="btn glass" href="mailto:${esc(ctx.site.email)}"
            ><span${b.ed('emailLabel')}>${esc(a.emailLabel)}</span>
            <span aria-hidden="true">→</span></a
          >
          ${(ctx.site.social || []).slice(0, 2).map((s) => html`<a class="btn glass" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="arrow-ne" aria-hidden="true">↗</span></a>`)}
        </div>
      </div>
    </div>
  </div>`,
};

export default about;
