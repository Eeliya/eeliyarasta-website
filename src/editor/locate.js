/**
 * Locate (the section and widget settings' button, ViewTop.svelte): the editor's preview
 * scrolls, smoothly (instantly with reduced motion), to the top of section or widget `id`,
 * below the site's fixed header. Nothing opens or is selected.
 */
export function locate(bridge, id) {
  const q = CSS.escape(id || '');
  const el = bridge?.doc?.querySelector(`[data-sec="${q}"], [data-widget="${q}"]`);
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
