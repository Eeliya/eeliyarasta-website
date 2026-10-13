/**
 * The page's backdrop (src/site/backdrop.js): its photos in a fixed layer under the sections,
 * driven by the page's scroll from its top to its bottom (one ScrollTrigger).
 *   scroll  a strip of them (down or across) moves by its length less one screen: the first in
 *           view at the top, the last fully in view at the end
 *   fade    stacked; each has an equal share of the page; at the end of a share the next one
 *           fades in (directly, or the current out to black, then the next in). scrub: the fades
 *           follow the scroll; else each plays as a short timed fade once its point is passed.
 *           parallax: a slow zoom and drift over the whole page
 * Reduced motion: no movement, each photo shows in its share and changes at once.
 * Returns its cleanup (or null without a backdrop).
 */
import { gsap, ScrollTrigger, reducedMotion } from '../lib/env.js';

const FADE = 0.8; // s, a timed fade (half of it each way through black)
const SPAN = 0.5; // of a share, a scrubbed fade

export function backdrop() {
  const el = document.querySelector('#portal [data-backdrop]');
  if (!el) return null;
  let opts = {};
  try {
    opts = JSON.parse(el.dataset.backdrop || '{}');
  } catch {
    /* none */
  }
  const track = el.querySelector('.pbd__track');
  const photos = [...el.querySelectorAll('.pbd__photo')];
  const imgs = photos.map((p) => p.querySelector('img'));
  const n = photos.length;
  // the rest load once the page is idle (lazy ones far down the strip would show late)
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  const load = idle(() => imgs.forEach((im) => im && (im.loading = 'eager')));
  imgs.forEach((im) => {
    if (!im) return;
    const done = () => im.classList.add('is-loaded');
    if (im.complete && im.naturalWidth) done();
    else im.addEventListener('load', done, { once: true });
  });

  const whole = { trigger: document.documentElement, start: 0, end: 'max' };
  const ctx = gsap.context(() => {
    if (n < 2 && !(opts.transition === 'fade' && opts.parallax)) return;
    const still = reducedMotion();
    if (opts.transition === 'scroll' && !still) {
      const axis = opts.direction === 'horizontal' ? 'xPercent' : 'yPercent';
      gsap.fromTo(
        track,
        { [axis]: 0 },
        { [axis]: (-100 * (n - 1)) / n, ease: 'none', scrollTrigger: { ...whole, scrub: true } },
      );
      return;
    }
    // fade (and scroll with reduced motion: a photo per share, changed at once)
    const black = opts.transition === 'fade' && opts.through === 'black';
    gsap.set(photos, { autoAlpha: (i) => (i === 0 ? 1 : 0) });
    if (opts.parallax && !still)
      gsap.fromTo(
        imgs.filter(Boolean),
        { scale: 1.12, yPercent: 3 },
        { scale: 1, yPercent: -3, ease: 'none', scrollTrigger: { ...whole, scrub: true } },
      );
    if (n < 2) return;
    if (opts.scrub && !still && opts.transition === 'fade') {
      // one timeline over the page: 1 per share; fade k at the end of share k-1
      const tl = gsap.timeline({ scrollTrigger: { ...whole, scrub: true } });
      tl.set({}, {}, n); // its length: n shares
      for (let k = 1; k < n; k++) {
        const at = k - SPAN / 2;
        if (black) {
          tl.to(photos[k - 1], { autoAlpha: 0, duration: SPAN / 2, ease: 'none' }, at);
          tl.to(photos[k], { autoAlpha: 1, duration: SPAN / 2, ease: 'none' }, at + SPAN / 2);
        } else {
          tl.to(photos[k], { autoAlpha: 1, duration: SPAN, ease: 'none' }, at);
          tl.set(photos[k - 1], { autoAlpha: 0 }, at + SPAN);
        }
      }
      return;
    }
    // timed (or at once): the photo of the share the scroll is in
    let now = 0;
    let tl = null;
    const show = (k) => {
      if (k === now) return;
      const from = photos[now];
      const to = photos[k];
      now = k;
      tl?.progress(1);
      if (still) {
        gsap.set(photos, { autoAlpha: (i) => (i === k ? 1 : 0) });
        return;
      }
      tl = gsap.timeline({
        onComplete: () =>
          gsap.set(
            photos.filter((p) => p !== to),
            { autoAlpha: 0 },
          ),
      });
      if (black)
        tl.to(from, { autoAlpha: 0, duration: FADE / 2 }).to(to, {
          autoAlpha: 1,
          duration: FADE / 2,
        });
      else
        tl.set(to, { zIndex: 1 }).to(to, { autoAlpha: 1, duration: FADE }).set(to, { zIndex: '' });
    };
    ScrollTrigger.create({
      ...whole,
      onUpdate: (st) => show(Math.min(n - 1, Math.floor(st.progress * n))),
      onRefresh: (st) => show(Math.min(n - 1, Math.floor(st.progress * n))),
    });
  }, el);

  return () => {
    (window.cancelIdleCallback || clearTimeout)(load);
    ctx.revert();
  };
}
