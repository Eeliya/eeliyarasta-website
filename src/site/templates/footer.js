import { html, esc, ed, extAttrs, lines } from '../helpers.js';
import { NAV, SITE } from '../files.js';
import { linkOf } from './header.js';

/** The footer; its Index column lists content/settings/nav.json "footer" (see header.js). */
export function footer(ctx) {
  const { site } = ctx;
  const year = new Date().getFullYear();
  const foot = site.footer || {};
  const cols = foot.columns || {};
  const index = cols.index || { title: 'Index' };
  const links = Array.isArray(ctx.nav?.footer) ? ctx.nav.footer : [];
  const social = cols.social || { title: 'Social' };
  const contact = cols.contact || { title: 'Contact' };
  const time = cols.time || { title: 'Local time' };
  return html`
  <footer class="footer" data-footer>
    <div class="footer__cta">
      <span class="label"${ed(SITE, ['footer', 'label'])}>${esc(foot.label)}</span>
      <a class="footer__big" href="mailto:${esc(site.email)}" data-anim="footer.cta"${ed(SITE, ['footer', 'cta'], 'block')}>${lines(foot.cta)}</a>
    </div>
    <div class="footer__cols" data-anim="footer.cols">
      <div class="footer__col">
        <h2 class="label"${ed(SITE, ['footer', 'columns', 'social', 'title'])}>${esc(social.title)}</h2>
        <ul>${(site.social || []).map((s, i) => html`<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><span${ed(SITE, ['social', i, 'label'])}>${esc(s.label)}</span> <span class="muted"${ed(SITE, ['social', i, 'handle'])}>${esc(s.handle)}</span> <span class="arrow-ne" aria-hidden="true">↗</span></a></li>`)}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed(SITE, ['footer', 'columns', 'index', 'title'])}>${esc(index.title)}</h2>
        <ul>
          ${links.map((link, i) => html`<li><a href="${esc(linkOf(ctx, link))}"${extAttrs(linkOf(ctx, link))}><span${ed(NAV, ['footer', i, 'label'])}>${esc(link.label)}</span></a></li>`)}
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed(SITE, ['footer', 'columns', 'contact', 'title'])}>${esc(contact.title)}</h2>
        <ul><li><a href="mailto:${esc(site.email)}"><span${ed(SITE, ['email'])}>${esc(site.email)}</span></a></li>
        ${site.emailIsPlaceholder ? '<li class="muted">(placeholder address)</li>' : ''}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label"${ed(SITE, ['footer', 'columns', 'time', 'title'])}>${esc(time.title)}</h2>
        <ul><li><time data-clock="${esc(site.timezone)}">--:--</time> <span class="muted"${ed(SITE, ['location'])}>${esc(site.location)}</span></li></ul>
      </div>
    </div>
    <div class="footer__base">
      <span>© ${year} ${esc(site.name)}</span>
      <span class="muted"${ed(SITE, ['footer', 'note'])}>${esc(foot.note)}</span>
      <button class="btn glass" type="button" data-to-top><span${ed(SITE, ['footer', 'toTop'])}>${esc(foot.toTop)}</span> <span aria-hidden="true">↑</span></button>
    </div>
  </footer>`;
}
