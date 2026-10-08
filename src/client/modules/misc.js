/** Small page behaviours: album-card hover cycling, back-to-top, image fade-in. */
import { finePointer } from '../lib/env.js';
import { interactions } from '../anim/engine.js';
import { scrollToTop } from '../smooth.js';

export function cards(view) {
  if (!finePointer()) return null;
  const interval = (interactions.cardCycle?.interval || 0.75) * 1000;
  const off = [];
  view.querySelectorAll('[data-card-cycle]').forEach((card) => {
    const imgs = [...card.querySelectorAll('.acard__media img')];
    if (imgs.length < 2) return;
    let i = 0;
    let timer = null;
    const set = (k) => imgs.forEach((im, j) => im.classList.toggle('is-active', j === k));
    const enter = () => {
      imgs.forEach((im) => (im.loading = 'eager'));
      timer = setInterval(() => set((i = (i + 1) % imgs.length)), interval);
    };
    const leave = () => {
      clearInterval(timer);
      set((i = 0));
    };
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    off.push(() => {
      clearInterval(timer);
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
    });
  });
  return () => off.forEach((f) => f());
}

export function toTop(view) {
  const btns = [...view.querySelectorAll('[data-to-top]')];
  const fn = () => scrollToTop(false);
  btns.forEach((b) => b.addEventListener('click', fn));
  return () => btns.forEach((b) => b.removeEventListener('click', fn));
}

export function imageFade(view) {
  view.querySelectorAll('img').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener('load', done, { once: true });
  });
  return null;
}
