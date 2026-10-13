import { esc, editable } from '../helpers.js';
import { FOOTER } from '../files.js';
import { renderSections } from '../layout/index.js';

/**
 * The footer: settings/footer.json's sections, on the page grid like a page's, under every
 * page. Outside the view (layout.js body): page transitions swap the view, not the footer.
 * Empty, it renders nothing visible (the editor gives it a placeholder to click).
 */
export function footer(ctx, route) {
  const sections = ctx.footer?.sections;
  const file = editable ? ` data-page-file="${esc(FOOTER)}"` : '';
  return `<footer class="site-footer" data-footer${file}>${renderSections(ctx, route, FOOTER, sections)}</footer>`;
}
