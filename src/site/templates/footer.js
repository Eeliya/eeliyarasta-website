import { html, esc, ed, lines } from '../helpers.js';

export function footer(ctx) {
  const { site } = ctx;
  const year = new Date().getFullYear();
  return html`
  <footer class="footer">
    <div class="footer__cta">
      <span class="label"${ed('site.json', ['footer', 'label'])}>${esc(site.footer.label)}</span>
      <a class="footer__big" href="mailto:${esc(site.email)}" data-anim="footer.cta" data-cursor="Write me"${ed('site.json', ['footer', 'cta'], 'block')}>${lines(site.footer.cta)}</a>
    </div>
    <div class="footer__cols" data-anim="footer.cols">
      <div class="footer__col">
        <h2 class="label">Social</h2>
        <ul>${site.social.map((s) => html`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} <span class="muted">${esc(s.handle)}</span> <span class="arrow-ne" aria-hidden="true">↗</span></a></li>`)}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label">Index</h2>
        <ul>
          <li><a href="/">Home</a></li><li><a href="/people/">People</a></li><li><a href="/places/">Places</a></li>
          <li><a href="/projects/">Projects</a></li><li><a href="/about/">About</a></li>
        </ul>
      </div>
      <div class="footer__col">
        <h2 class="label">Contact</h2>
        <ul><li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
        ${site.emailIsPlaceholder ? '<li class="muted">(placeholder address)</li>' : ''}</ul>
      </div>
      <div class="footer__col">
        <h2 class="label">Local time</h2>
        <ul><li><time data-clock>--:--</time> <span class="muted">${esc(site.location)}</span></li></ul>
      </div>
    </div>
    <div class="footer__base">
      <span>© ${year} ${esc(site.name)}</span>
      <span class="muted">Shot on ${esc(site.camera)}. Built with Vite + GSAP.</span>
      <button class="btn glass" type="button" data-to-top>Back to top <span aria-hidden="true">↑</span></button>
    </div>
  </footer>`;
}
