import { html, esc, ed, lines } from '../helpers.js';

export function footer(ctx) {
  const { site } = ctx;
  const year = new Date().getFullYear();
  const cols = site.footer?.columns || {};
  const index = cols.index || { title: 'Index', links: [] };
  const social = cols.social || { title: 'Social' };
  const contact = cols.contact || { title: 'Contact' };
  const time = cols.time || { title: 'Local time' };
  return html`
  <footer class="footer" data-footer>
    <div class="footer__cta">
      <span class="label"${ed('site.json', ['footer', 'label'])}>${esc(site.footer.label)}</span>
      <a class="footer__big" href="mailto:${esc(site.email)}" data-anim="footer.cta"${ed('site.json', ['footer', 'cta'], 'block')}>${lines(site.footer.cta)}</a>
    </div>
    <div class="footer__cols" data-anim="footer.cols">
      <div class="footer__col">
        <h2 class="label"${ed('site.json', ['footer', 'columns', 'social', 'title'])}>${esc(social.title)}</h2>
        <ul>${site.social.map((s, i) => html`<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><span${ed('site.json', ['social', i, 'label'])}>${esc(s.label)}</span> <span class="muted"${ed('site.json', ['social', i, 'handle'])}>${esc(s.handle)}</span> <span class="arrow-ne" aria-hidden="true">↗</span></a></li>`)}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed('site.json', ['footer', 'columns', 'index', 'title'])}>${esc(index.title)}</h2>
        <ul>
          ${(index.links || []).map((link, i) => html`<li><a href="${esc(link.href)}"><span${ed('site.json', ['footer', 'columns', 'index', 'links', i, 'label'])}>${esc(link.label)}</span></a></li>`)}
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed('site.json', ['footer', 'columns', 'contact', 'title'])}>${esc(contact.title)}</h2>
        <ul><li><a href="mailto:${esc(site.email)}"><span${ed('site.json', ['email'])}>${esc(site.email)}</span></a></li>
        ${site.emailIsPlaceholder ? '<li class="muted">(placeholder address)</li>' : ''}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed('site.json', ['footer', 'columns', 'time', 'title'])}>${esc(time.title)}</h2>
        <ul><li><time data-clock>--:--</time> <span class="muted"${ed('site.json', ['location'])}>${esc(site.location)}</span></li></ul>
      </div>
    </div>
    <div class="footer__base">
      <span>© ${year} ${esc(site.name)}</span>
      <span class="muted">Shot on ${esc(site.camera)}. Built with Vite + GSAP.</span>
      <button class="btn glass" type="button" data-to-top>Back to top <span aria-hidden="true">↑</span></button>
    </div>
  </footer>`;
}
