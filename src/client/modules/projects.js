/** Project index rows: click to expand (GSAP height), deep-link via #slug. */
import { gsap, reducedMotion } from '../lib/env.js';
import { refresh, scrollToEl } from '../smooth.js';

export function projects(view) {
  const rows = [...view.querySelectorAll('[data-prow]')];
  if (!rows.length) return null;
  const reduce = reducedMotion();
  const off = [];

  function setOpen(row, open) {
    const head = row.querySelector('.prow__head');
    const body = row.querySelector('.prow__body');
    if (row.classList.contains('is-open') === open) return;
    row.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
    gsap.killTweensOf(body);
    if (open) {
      body.hidden = false;
      if (reduce) return refresh();
      gsap.fromTo(
        body,
        { height: 0 },
        { height: 'auto', duration: 0.8, ease: 'expo.out', onComplete: refresh },
      );
      gsap.fromTo(
        body.querySelectorAll('.prow__media, .prow__text > *'),
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06, delay: 0.1 },
      );
    } else {
      if (reduce) return ((body.hidden = true), refresh());
      gsap.to(body, {
        height: 0,
        duration: 0.45,
        ease: 'power2.inOut',
        onComplete: () => (
          (body.hidden = true),
          gsap.set(body, { clearProps: 'height' }),
          refresh()
        ),
      });
    }
  }

  rows.forEach((row) => {
    const head = row.querySelector('.prow__head');
    const fn = () => setOpen(row, !row.classList.contains('is-open'));
    head.addEventListener('click', fn);
    off.push(() => head.removeEventListener('click', fn));
  });

  const openFromHash = () => {
    const row =
      location.hash &&
      view.querySelector(`[data-prow][id="${CSS.escape(location.hash.slice(1))}"]`);
    if (!row) return;
    setOpen(row, true);
    setTimeout(() => scrollToEl(row), 250);
  };
  openFromHash();
  window.addEventListener('router:hash', openFromHash);
  off.push(() => window.removeEventListener('router:hash', openFromHash));
  return () => off.forEach((f) => f());
}
