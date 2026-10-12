/**
 * Locate (a section card's or the block view's button): the editor's preview scrolls, smoothly
 * (instantly with reduced motion), to section `id`'s top, below the site's fixed header.
 * Nothing opens or is selected.
 */
export function locate(bridge, id) {
  const el = bridge?.doc?.querySelector(`[data-sec="${CSS.escape(id)}"]`);
  const win = el?.ownerDocument.defaultView;
  if (!win) return;
  // (below the site's fixed header, so the section's top isn't under it)
  const head = [...el.ownerDocument.querySelectorAll('body > header, .site-header')].find((h) =>
    ['fixed', 'sticky'].includes(win.getComputedStyle(h).position),
  );
  const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  win.scrollTo({
    top: el.getBoundingClientRect().top + win.scrollY - (head?.offsetHeight || 0),
    behavior: still ? 'instant' : 'smooth',
  });
}
